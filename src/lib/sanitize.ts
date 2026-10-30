import {
  SCHEMA_VERSION,
  type Design,
  type ElementKind,
  type Land,
  type Measurement,
  type Plan,
  type PlanElement,
  type Project,
  type Vec2,
} from '../types/plan';
import { CATALOG_BY_KIND } from './catalog';
import { uid } from './id';
import { defaultLand } from './sample';
import { DEFAULT_ESTIMATE } from './quantities';

/** خطأ استيراد برسالة عربية واضحة */
export class ImportError extends Error {}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, def: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function str(v: unknown, def: string, maxLen = 200): string {
  return typeof v === 'string' ? v.slice(0, maxLen) : def;
}

function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}

function oneOf<T extends string>(v: unknown, options: readonly T[], def: T): T {
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : def;
}

function color(v: unknown, def: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : def;
}

function vec(v: unknown): Vec2 | null {
  if (!isObj(v)) return null;
  const x = num(v.x, NaN);
  const y = num(v.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.max(-1000, Math.min(2000, x)), y: Math.max(-1000, Math.min(2000, y)) };
}

export function sanitizeLand(raw: unknown): Land {
  const d = defaultLand();
  if (!isObj(raw)) return d;
  const shape = oneOf(raw.shape, ['rectangle', 'square', 'polygon'] as const, 'rectangle');
  const width = num(raw.width, d.width, 2, 1000);
  const depth = shape === 'square' ? width : num(raw.depth, d.depth, 2, 1000);
  let polygon: Vec2[] | undefined;
  if (shape === 'polygon' && Array.isArray(raw.polygon)) {
    polygon = raw.polygon.map(vec).filter((p): p is Vec2 => !!p);
    if (polygon.length < 3) polygon = undefined;
  }
  const ent = isObj(raw.entrance) ? raw.entrance : {};
  const fence = isObj(raw.fence) ? raw.fence : {};
  return {
    shape: shape === 'polygon' && !polygon ? 'rectangle' : shape,
    width,
    depth,
    polygon,
    ground: oneOf(raw.ground, ['sand', 'soil', 'flat'] as const, d.ground),
    northAngle: num(raw.northAngle, 0, -360, 360),
    entrance: {
      edge: Math.round(num(ent.edge, d.entrance.edge, 0, 64)),
      offset: num(ent.offset, width / 2, 0, 1000),
      width: num(ent.width, d.entrance.width, 0.5, 50),
    },
    fence: {
      enabled: bool(fence.enabled, d.fence.enabled),
      type: oneOf(fence.type, ['fabric', 'mesh', 'block'] as const, d.fence.type),
      height: num(fence.height, d.fence.height, 0.3, 6),
      color: color(fence.color, d.fence.color),
    },
    surroundings: Array.isArray(raw.surroundings)
      ? raw.surroundings.slice(0, 64).map((x) => oneOf(x, ['open', 'dunes', 'hazm', 'sea'] as const, 'open'))
      : undefined,
  };
}

export function sanitizeElement(raw: unknown): PlanElement | null {
  if (!isObj(raw)) return null;
  const kind = raw.kind as ElementKind;
  const cat = CATALOG_BY_KIND[kind];
  if (!cat) return null;
  const d = cat.defaults;
  const el: PlanElement = {
    id: str(raw.id, uid(kind.slice(0, 3)), 80) || uid(kind.slice(0, 3)),
    kind,
    name: str(raw.name, cat.label, 80),
    x: num(raw.x, 0, -1000, 2000),
    y: num(raw.y, 0, -1000, 2000),
    width: num(raw.width, d.width, 0.05, 500),
    depth: num(raw.depth, d.depth, 0.05, 500),
    height: num(raw.height, d.height, 0.01, 50),
    rotation: num(raw.rotation, 0, -3600, 3600),
    color: color(raw.color, d.color),
    accent: color(raw.accent, d.accent),
    locked: bool(raw.locked, false),
  };
  if (raw.allowOutside === true) el.allowOutside = true;
  if (typeof raw.notes === 'string') el.notes = raw.notes.slice(0, 1000);

  if (cat.geometry === 'polyline') {
    const pts = Array.isArray(raw.points) ? raw.points.map(vec).filter((p): p is Vec2 => !!p) : [];
    if (pts.length < 2) return null;
    el.points = pts.slice(0, 200);
  }
  if (d.tent) {
    const t = isObj(raw.tent) ? raw.tent : {};
    el.tent = {
      style: oneOf(t.style, ['majlis', 'bedouin', 'pyramid'] as const, d.tent.style),
      wallHeight: num(t.wallHeight, d.tent.wallHeight, 0.8, 20),
      entranceSide: oneOf(t.entranceSide, ['front', 'back', 'left', 'right'] as const, 'front'),
      entranceOffset: num(t.entranceOffset, 0, -250, 250),
      entranceWidth: num(t.entranceWidth, d.tent.entranceWidth, 0.5, 50),
      interior: oneOf(t.interior, ['majlis', 'dining', 'kitchen', 'empty'] as const, d.tent.interior),
      interiorLight: bool(t.interiorLight, d.tent.interiorLight),
      entranceLight: bool(t.entranceLight, d.tent.entranceLight),
    };
  }
  if (d.court) {
    const c = isObj(raw.court) ? raw.court : {};
    el.court = {
      surface: oneOf(c.surface, ['sand', 'turf'] as const, d.court.surface),
      safetyMargin: num(c.safetyMargin, d.court.safetyMargin, 0, 20),
      netHeight: num(c.netHeight, d.court.netHeight, 1, 4),
      attackLines: bool(c.attackLines, d.court.attackLines),
    };
  }
  if (d.path) {
    const p = isObj(raw.path) ? raw.path : {};
    el.path = {
      material: oneOf(p.material, ['turf', 'wood-turf', 'tiles', 'sand', 'stone'] as const, d.path.material),
      width: num(p.width, d.path.width, 0.2, 30),
      edgeLights: bool(p.edgeLights, false),
      edgeLightSpacing: num(p.edgeLightSpacing, d.path.edgeLightSpacing, 0.5, 50),
    };
  }
  if (d.light) {
    const l = isObj(raw.light) ? raw.light : {};
    el.light = {
      on: bool(l.on, true),
      intensity: num(l.intensity, d.light.intensity, 0, 100),
      watts: num(l.watts, d.light.watts, 0, 10000),
      color: oneOf(l.color, ['warm', 'white'] as const, d.light.color),
      mountHeight: num(l.mountHeight, d.light.mountHeight, 0.1, 30),
      tilt: num(l.tilt, d.light.tilt, 0, 90),
      beam: num(l.beam, d.light.beam, 5, 360),
    };
  }
  if (d.string) {
    const s = isObj(raw.string) ? raw.string : {};
    el.string = {
      sag: num(s.sag, d.string.sag, 0, 5),
      bulbSpacing: num(s.bulbSpacing, d.string.bulbSpacing, 0.15, 10),
      autoPoles: bool(s.autoPoles, d.string.autoPoles),
    };
  }
  if (d.parking) {
    const p = isObj(raw.parking) ? raw.parking : {};
    el.parking = {
      slots: Math.round(num(p.slots, d.parking.slots, 1, 100)),
      showCars: bool(p.showCars, d.parking.showCars),
    };
  }
  if (d.furniture) {
    const f = isObj(raw.furniture) ? raw.furniture : {};
    el.furniture = { seats: Math.round(num(f.seats, d.furniture.seats, 0, 40)) };
  }
  return el;
}

export interface SanitizeReport {
  dropped: number;
}

export function sanitizePlan(raw: unknown, report?: SanitizeReport): Plan {
  if (!isObj(raw)) throw new ImportError('بيانات المخطط غير صالحة');
  const land = sanitizeLand(raw.land);
  const rawEls = Array.isArray(raw.elements) ? raw.elements : [];
  const seen = new Set<string>();
  const elements: PlanElement[] = [];
  for (const r of rawEls.slice(0, 2000)) {
    const el = sanitizeElement(r);
    if (!el) {
      if (report) report.dropped++;
      continue;
    }
    if (seen.has(el.id)) el.id = uid(el.kind.slice(0, 3));
    seen.add(el.id);
    elements.push(el);
  }
  const measurements: Measurement[] = [];
  if (Array.isArray(raw.measurements)) {
    for (const m of raw.measurements.slice(0, 200)) {
      if (!isObj(m)) continue;
      const a = vec(m.a);
      const b = vec(m.b);
      if (a && b) measurements.push({ id: str(m.id, uid('m'), 80), a, b });
    }
  }
  return { land, elements, measurements };
}

export function sanitizeDesign(raw: unknown, report?: SanitizeReport): Design {
  if (!isObj(raw)) throw new ImportError('بيانات التصميم غير صالحة');
  const now = Date.now();
  return {
    id: str(raw.id, uid('d'), 80) || uid('d'),
    name: str(raw.name, 'تصميم', 80) || 'تصميم',
    note: typeof raw.note === 'string' ? raw.note.slice(0, 2000) : undefined,
    plan: sanitizePlan(raw.plan, report),
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
  };
}

export function sanitizeProject(raw: unknown, report?: SanitizeReport): Project {
  if (!isObj(raw)) throw new ImportError('ملف المشروع غير صالح');
  const now = Date.now();
  const designsRaw = Array.isArray(raw.designs) ? raw.designs : [];
  const designs: Design[] = [];
  const ids = new Set<string>();
  for (const d of designsRaw.slice(0, 50)) {
    try {
      const des = sanitizeDesign(d, report);
      if (ids.has(des.id)) des.id = uid('d');
      ids.add(des.id);
      designs.push(des);
    } catch {
      if (report) report.dropped++;
    }
  }
  if (!designs.length) throw new ImportError('لا يحتوي الملف على أي تصميم صالح');
  const active = str(raw.activeDesignId, designs[0].id);
  const prices: Record<string, number> = {};
  if (isObj(raw.prices)) {
    for (const [k, val] of Object.entries(raw.prices)) {
      const n = num(val, NaN, 0, 1e9);
      if (Number.isFinite(n)) prices[k.slice(0, 80)] = n;
    }
  }
  const est = isObj(raw.estimate) ? raw.estimate : {};
  return {
    schema: SCHEMA_VERSION,
    id: str(raw.id, uid('p'), 80) || uid('p'),
    name: str(raw.name, 'مشروع مستورد', 80) || 'مشروع مستورد',
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
    designs,
    activeDesignId: designs.some((d) => d.id === active) ? active : designs[0].id,
    finalDesignId: typeof raw.finalDesignId === 'string' ? raw.finalDesignId : undefined,
    prices,
    estimate: {
      beamLength: num(est.beamLength, DEFAULT_ESTIMATE.beamLength, 0.5, 12),
      beamSection: str(est.beamSection, DEFAULT_ESTIMATE.beamSection, 20),
      beamSpacing: num(est.beamSpacing, DEFAULT_ESTIMATE.beamSpacing, 0.2, 3),
      sheetWidth: num(est.sheetWidth, DEFAULT_ESTIMATE.sheetWidth, 0.2, 5),
      sheetLength: num(est.sheetLength, DEFAULT_ESTIMATE.sheetLength, 0.2, 10),
      wastePct: num(est.wastePct, DEFAULT_ESTIMATE.wastePct, 0, 100),
      turfRollWidth: num(est.turfRollWidth, DEFAULT_ESTIMATE.turfRollWidth, 0.5, 10),
    },
  };
}

export type ImportKind = 'project' | 'design' | 'plan';

/** يتعرف على نوع الملف المستورد: مشروع كامل، تصميم، أو مخطط */
export function parseImport(text: string): { kind: ImportKind; project?: Project; design?: Design; report: SanitizeReport } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('الملف ليس بصيغة JSON صحيحة');
  }
  if (!isObj(raw)) throw new ImportError('محتوى الملف غير متوقع');
  const report: SanitizeReport = { dropped: 0 };
  const payload = isObj(raw.payload) ? raw.payload : raw;
  if (Array.isArray(payload.designs)) return { kind: 'project', project: sanitizeProject(payload, report), report };
  if (isObj(payload.plan)) return { kind: 'design', design: sanitizeDesign(payload, report), report };
  if (isObj(payload.land) && Array.isArray(payload.elements)) {
    const now = Date.now();
    return {
      kind: 'plan',
      design: { id: uid('d'), name: 'تصميم مستورد', plan: sanitizePlan(payload, report), createdAt: now, updatedAt: now },
      report,
    };
  }
  throw new ImportError('لم يتم التعرف على الملف كمخطط عنة');
}
