import type { EstimateSettings, ElementKind, PathMaterial, Plan, PlanElement, Vec2 } from '../types/plan';
import { CATALOG_BY_KIND, PATH_MATERIAL_LABELS, isTentKind } from './catalog';
import {
  boundsIntersect,
  boundsOf,
  courtSafetyPolygon,
  dist,
  elementBounds,
  elementShapes,
  entranceInfo,
  landArea,
  landBounds,
  landPolygon,
  pointInPolygon,
  polygonPerimeter,
  polylineLength,
  type Bounds,
} from './geometry';
import { pathEdgeLights, stringBulbs, totalLightingWatts } from './lighting';

export const DEFAULT_ESTIMATE: EstimateSettings = {
  beamLength: 3,
  beamSection: '6×6',
  beamSpacing: 0.6,
  sheetWidth: 1.22,
  sheetLength: 2.44,
  wastePct: 10,
  turfRollWidth: 4,
};

export interface PathQuantity {
  id: string;
  name: string;
  material: PathMaterial;
  length: number;
  width: number;
  area: number;
  segments: number;
}

export interface WoodTurfEstimate {
  area: number;
  longBeams: number;
  crossBeams: number;
  totalBeams: number;
  beamMeters: number;
  sheets: number;
  turfArea: number;
  turfRollMeters: number;
}

export interface Summary {
  landArea: number;
  landPerimeter: number;
  fenceLength: number;
  tents: { id: string; name: string; kind: ElementKind; width: number; depth: number; area: number }[];
  tentCount: number;
  tentArea: number;
  courts: { id: string; name: string; area: number; zoneArea: number; width: number; depth: number; margin: number }[];
  courtArea: number;
  courtZoneArea: number;
  paths: PathQuantity[];
  pathLength: number;
  pathArea: number;
  pathByMaterial: Record<PathMaterial, { length: number; area: number }>;
  turfArea: number;
  woodTurf: WoodTurfEstimate;
  lights: {
    poles: number;
    floods: number;
    strings: number;
    stringLength: number;
    bulbs: number;
    groundLights: number;
    pathEdgeLights: number;
    entranceLights: number;
    lanterns: number;
    tentEntranceLights: number;
    totalWatts: number;
  };
  counts: Record<ElementKind, number>;
  toilets: number;
  sinks: number;
  parkingSlots: number;
  seats: number;
  occupiedArea: number;
  reservedArea: number;
  freeArea: number;
  freePct: number;
}

const emptyMaterials = (): Record<PathMaterial, { length: number; area: number }> => ({
  turf: { length: 0, area: 0 },
  'wood-turf': { length: 0, area: 0 },
  tiles: { length: 0, area: 0 },
  sand: { length: 0, area: 0 },
  stone: { length: 0, area: 0 },
});

export function pathQuantity(el: PlanElement): PathQuantity {
  const pts = el.points ?? [];
  const length = polylineLength(pts);
  const width = el.path?.width ?? 0;
  return {
    id: el.id,
    name: el.name,
    material: el.path?.material ?? 'turf',
    length,
    width,
    area: length * width,
    segments: Math.max(0, pts.length - 1),
  };
}

/** تقدير خامات ممر الخشب + العشب: أخشاب طولية وعرضية، ألواح، عشب */
export function estimateWoodTurf(paths: PlanElement[], s: EstimateSettings = DEFAULT_ESTIMATE): WoodTurfEstimate {
  let area = 0;
  let longBeams = 0;
  let crossMeters = 0;
  for (const el of paths) {
    if (el.path?.material !== 'wood-turf' || !el.points) continue;
    const w = el.path.width;
    const rows = Math.max(2, Math.floor(w / Math.max(0.2, s.beamSpacing)) + 1);
    for (let i = 1; i < el.points.length; i++) {
      const L = dist(el.points[i - 1], el.points[i]);
      if (L <= 0) continue;
      area += L * w;
      longBeams += rows * Math.ceil(L / s.beamLength);
      const crossCount = Math.ceil(L / s.beamLength) + 1;
      crossMeters += crossCount * w;
    }
  }
  const waste = 1 + Math.max(0, s.wastePct) / 100;
  const crossBeams = Math.ceil((crossMeters * waste) / s.beamLength);
  longBeams = Math.ceil(longBeams * waste);
  const sheetArea = Math.max(0.1, s.sheetWidth * s.sheetLength);
  const turfArea = area * waste;
  return {
    area,
    longBeams,
    crossBeams,
    totalBeams: longBeams + crossBeams,
    beamMeters: (longBeams + crossBeams) * s.beamLength,
    sheets: area > 0 ? Math.ceil((area * waste) / sheetArea) : 0,
    turfArea,
    turfRollMeters: turfArea / Math.max(0.5, s.turfRollWidth),
  };
}

function rasterAreas(plan: Plan): { occupied: number; reserved: number; land: number } {
  const land = landPolygon(plan.land);
  const lb = landBounds(plan.land);
  const total = (lb.maxX - lb.minX) * (lb.maxY - lb.minY);
  const cell = Math.max(0.2, Math.sqrt(total / 40000));
  const solid: { shapes: Vec2[][]; b: Bounds }[] = [];
  const zones: { shapes: Vec2[][]; b: Bounds }[] = [];
  for (const el of plan.elements) {
    const cls = CATALOG_BY_KIND[el.kind].collision;
    if (cls === 'none') continue;
    const shapes = elementShapes(el);
    if (!shapes.length) continue;
    solid.push({ shapes, b: elementBounds(el) });
    if (el.kind === 'volleyball' && el.court && el.court.safetyMargin > 0) {
      const z = courtSafetyPolygon(el);
      zones.push({ shapes: [z], b: boundsOf(z) });
    }
  }
  const inPoly = (p: Vec2, list: { shapes: Vec2[][]; b: Bounds }[]) => {
    const pb: Bounds = { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
    for (const s of list) {
      if (!boundsIntersect(pb, s.b)) continue;
      for (const poly of s.shapes) if (pointInPolygon(p, poly)) return true;
    }
    return false;
  };
  let inside = 0;
  let occ = 0;
  let res = 0;
  for (let y = lb.minY + cell / 2; y < lb.maxY; y += cell) {
    for (let x = lb.minX + cell / 2; x < lb.maxX; x += cell) {
      const p = { x, y };
      if (!pointInPolygon(p, land)) continue;
      inside++;
      if (inPoly(p, solid)) occ++;
      else if (inPoly(p, zones)) res++;
    }
  }
  const area = landArea(plan.land);
  if (!inside) return { occupied: 0, reserved: 0, land: area };
  return { occupied: (occ / inside) * area, reserved: (res / inside) * area, land: area };
}

export function computeSummary(plan: Plan, est: EstimateSettings = DEFAULT_ESTIMATE): Summary {
  const counts = Object.fromEntries(Object.keys(CATALOG_BY_KIND).map((k) => [k, 0])) as Record<ElementKind, number>;
  const tents: Summary['tents'] = [];
  const courts: Summary['courts'] = [];
  const paths: PathQuantity[] = [];
  const pathEls: PlanElement[] = [];
  const pathByMaterial = emptyMaterials();
  const lights = {
    poles: 0,
    floods: 0,
    strings: 0,
    stringLength: 0,
    bulbs: 0,
    groundLights: 0,
    pathEdgeLights: 0,
    entranceLights: 0,
    lanterns: 0,
    tentEntranceLights: 0,
    totalWatts: totalLightingWatts(plan),
  };
  let parkingSlots = 0;
  let seats = 0;

  for (const el of plan.elements) {
    counts[el.kind]++;
    if (isTentKind(el.kind)) {
      tents.push({ id: el.id, name: el.name, kind: el.kind, width: el.width, depth: el.depth, area: el.width * el.depth });
      if (el.tent?.entranceLight) lights.tentEntranceLights++;
    }
    switch (el.kind) {
      case 'volleyball': {
        const m = el.court?.safetyMargin ?? 0;
        courts.push({
          id: el.id,
          name: el.name,
          width: el.width,
          depth: el.depth,
          margin: m,
          area: el.width * el.depth,
          zoneArea: (el.width + 2 * m) * (el.depth + 2 * m),
        });
        break;
      }
      case 'path': {
        const q = pathQuantity(el);
        paths.push(q);
        pathEls.push(el);
        pathByMaterial[q.material].length += q.length;
        pathByMaterial[q.material].area += q.area;
        lights.pathEdgeLights += pathEdgeLights(el).length;
        break;
      }
      case 'light-pole':
        lights.poles++;
        break;
      case 'flood-light':
        lights.floods++;
        break;
      case 'string-lights':
        lights.strings++;
        lights.stringLength += polylineLength(el.points ?? []);
        lights.bulbs += stringBulbs(el).length;
        break;
      case 'ground-light':
        lights.groundLights++;
        break;
      case 'entrance-light':
        lights.entranceLights++;
        break;
      case 'lantern':
        lights.lanterns++;
        break;
      case 'parking':
        parkingSlots += el.parking?.slots ?? 0;
        break;
      case 'table-set':
        seats += el.furniture?.seats ?? 0;
        break;
    }
  }

  const poly = landPolygon(plan.land);
  const perimeter = polygonPerimeter(poly);
  const ent = entranceInfo(plan.land);
  const areas = rasterAreas(plan);
  const landA = areas.land;
  const free = Math.max(0, landA - areas.occupied - areas.reserved);

  return {
    landArea: landA,
    landPerimeter: perimeter,
    fenceLength: plan.land.fence.enabled ? Math.max(0, perimeter - ent.width) : 0,
    tents,
    tentCount: tents.length,
    tentArea: tents.reduce((s, t) => s + t.area, 0),
    courts,
    courtArea: courts.reduce((s, c) => s + c.area, 0),
    courtZoneArea: courts.reduce((s, c) => s + c.zoneArea, 0),
    paths,
    pathLength: paths.reduce((s, p) => s + p.length, 0),
    pathArea: paths.reduce((s, p) => s + p.area, 0),
    pathByMaterial,
    turfArea: pathByMaterial.turf.area + pathByMaterial['wood-turf'].area,
    woodTurf: estimateWoodTurf(pathEls, est),
    lights,
    counts,
    toilets: counts.toilet,
    sinks: counts.sink,
    parkingSlots,
    seats,
    occupiedArea: areas.occupied,
    reservedArea: areas.reserved,
    freeArea: free,
    freePct: landA > 0 ? (free / landA) * 100 : 0,
  };
}

export interface CostLine {
  key: string;
  label: string;
  unit: string;
  qty: number;
}

/** بنود التكلفة التقديرية — الكميات تلقائية والأسعار يدخلها المستخدم */
export function costLines(s: Summary): CostLine[] {
  const lines: CostLine[] = [];
  const kindLabel = (k: ElementKind) => CATALOG_BY_KIND[k].label;
  const pieceKinds: ElementKind[] = [
    'main-tent',
    'small-tent',
    'dining-tent',
    'kitchen-tent',
    'canopy',
    'majlis-rug',
    'volleyball',
    'toilet',
    'sink',
    'outdoor-kitchen',
    'storage',
    'water-tank',
    'generator',
    'bbq',
    'table-set',
    'seating',
    'light-pole',
    'flood-light',
    'ground-light',
    'entrance-light',
    'lantern',
  ];
  for (const k of pieceKinds) {
    if (s.counts[k] > 0) lines.push({ key: `kind:${k}`, label: kindLabel(k), unit: 'قطعة', qty: s.counts[k] });
  }
  if (s.lights.stringLength > 0)
    lines.push({ key: 'string-length', label: 'سلاسل لمبات معلقة', unit: 'م طولي', qty: s.lights.stringLength });
  if (s.lights.pathEdgeLights > 0)
    lines.push({ key: 'path-edge-lights', label: 'إنارة جوانب الممرات', unit: 'قطعة', qty: s.lights.pathEdgeLights });
  for (const m of Object.keys(s.pathByMaterial) as PathMaterial[]) {
    if (m === 'wood-turf') continue;
    const a = s.pathByMaterial[m].area;
    if (a > 0) lines.push({ key: `path:${m}`, label: `ممر — ${PATH_MATERIAL_LABELS[m]}`, unit: 'م²', qty: a });
  }
  if (s.woodTurf.area > 0) {
    lines.push({ key: 'wood-beams', label: 'أخشاب الممر (قطع)', unit: 'قطعة', qty: s.woodTurf.totalBeams });
    lines.push({ key: 'wood-sheets', label: 'ألواح خشب الممر', unit: 'لوح', qty: s.woodTurf.sheets });
    lines.push({ key: 'wood-turf-grass', label: 'عشب صناعي فوق الخشب', unit: 'م²', qty: s.woodTurf.turfArea });
  }
  if (s.fenceLength > 0) lines.push({ key: 'fence', label: 'السياج أو التور', unit: 'م طولي', qty: s.fenceLength });
  return lines;
}
