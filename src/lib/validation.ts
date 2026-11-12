import { isCourtKind } from './catalog';
import type { Plan, PlanElement, Vec2 } from '../types/plan';
import { CATALOG_BY_KIND, isTentKind, type CollisionClass } from './catalog';
import { angleDiff, compassName, WIND_FROM } from './wind';
import {
  boundsIntersect,
  boundsOf,
  convexIntersect,
  courtSafetyPolygon,
  elementBounds,
  elementShapes,
  entranceInfo,
  formatMeters,
  landPolygon,
  localToWorld,
  polygonInside,
  rectCorners,
  shapesDistance,
  add,
  scale,
  centroid,
  rotate,
} from './geometry';

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
  | 'out-of-bounds'
  | 'overlap'
  | 'court-overlap'
  | 'court-clearance'
  | 'court-zone-outside'
  | 'entrance-blocked'
  | 'tent-entrance-blocked'
  | 'livestock-wind';

export interface Issue {
  id: string;
  code: IssueCode;
  severity: IssueSeverity;
  elementIds: string[];
  message: string;
  at: Vec2;
}

export interface ValidationResult {
  issues: Issue[];
  byElement: Map<string, Issue[]>;
  errorCount: number;
  warningCount: number;
}

type Rule = 'error' | 'warning' | 'ok';

/** الحلال وأحواشه */
const PENS = new Set<string>(['sheep-pen', 'camel-pen']);
/** اللي طبيعي يكون داخل الحوش (مب مجلس ولا مولد) */
const IN_PEN = new Set<string>(['trough', 'animal-shade', 'feed-store', 'tree', 'palm']);
const LIVESTOCK = new Set<string>(['sheep-pen', 'camel-pen', 'horse-stable']);
/** أماكن الجلوس اللي ما نبي ريحة الحلال توصلها */
const SITTING = new Set<string>(['majlis-room', 'main-tent', 'canopy', 'majlis-rug', 'seating', 'fire-pit', 'dakka', 'dining-tent', 'pool']);
export const LIVESTOCK_MIN_GAP = 10;
export const LIVESTOCK_WIND_GAP = 30;

function pairRule(a: CollisionClass, b: CollisionClass): Rule {
  const key = [a, b].sort().join('|');
  switch (key) {
    case 'structure|structure':
    case 'cover|structure':
    case 'court|structure':
    case 'court|cover':
    case 'court|court':
    case 'court|soft':
    case 'court|pole':
      return 'error';
    case 'pole|structure':
    case 'cover|cover':
    case 'soft|soft':
    case 'court|path':
    case 'path|pole':
    case 'soft|structure':
      return 'warning';
    default:
      return 'ok';
  }
}

function shapesIntersect(a: Vec2[][], b: Vec2[][]): boolean {
  for (const pa of a) for (const pb of b) if (convexIntersect(pa, pb)) return true;
  return false;
}

/** غرفتين متلاصقتين: التداخل ما يتعدى سماكة جدار (0.25 م) */
function roomsOnlyTouch(a: PlanElement, b: PlanElement): boolean {
  const A = elementBounds(a);
  const B = elementBounds(b);
  const ox = Math.min(A.maxX, B.maxX) - Math.max(A.minX, B.minX);
  const oy = Math.min(A.maxY, B.maxY) - Math.max(A.minY, B.minY);
  return Math.min(ox, oy) <= 0.25;
}

/** هل العنصر (أثاث) داخل الخيمة بالكامل؟ */
function fullyInside(inner: PlanElement, outer: PlanElement): boolean {
  const poly = rectCorners(outer.x, outer.y, outer.width, outer.depth, outer.rotation);
  return elementShapes(inner).every((s) => polygonInside(s, poly, 0.05));
}

export function tentEntranceZone(el: PlanElement, depth = 1.2): Vec2[] | null {
  if (!el.tent) return null;
  const t = el.tent;
  const side = t.entranceSide;
  const along = side === 'front' || side === 'back' ? el.width : el.depth;
  const w = Math.min(t.entranceWidth, along);
  const off = Math.max(-along / 2 + w / 2, Math.min(along / 2 - w / 2, t.entranceOffset));
  let center: Vec2;
  let rot = el.rotation;
  switch (side) {
    case 'front':
      center = { x: off, y: el.depth / 2 + depth / 2 };
      break;
    case 'back':
      center = { x: off, y: -el.depth / 2 - depth / 2 };
      break;
    case 'left':
      center = { x: -el.width / 2 - depth / 2, y: off };
      rot += 90;
      break;
    case 'right':
      center = { x: el.width / 2 + depth / 2, y: off };
      rot += 90;
      break;
  }
  const c = localToWorld(el, center);
  return rectCorners(c.x, c.y, w, depth, rot);
}

export function validatePlan(plan: Plan): ValidationResult {
  const issues: Issue[] = [];
  const land = landPolygon(plan.land);
  const items = plan.elements.map((el) => ({
    el,
    cls: CATALOG_BY_KIND[el.kind].collision,
    shapes: elementShapes(el),
    bounds: elementBounds(el),
  }));

  let n = 0;
  const push = (i: Omit<Issue, 'id'>) => issues.push({ ...i, id: `i${n++}` });

  // 1) حدود الأرض
  for (const it of items) {
    if (it.el.allowOutside) continue;
    let inside = true;
    if (it.shapes.length) {
      inside = it.shapes.every((s) => polygonInside(s, land));
    } else if (it.el.points?.length) {
      inside = polygonInside(it.el.points, land) || it.el.points.every((p) => polygonInside([p], land));
    }
    if (!inside) {
      push({
        code: 'out-of-bounds',
        severity: 'error',
        elementIds: [it.el.id],
        message: `«${it.el.name}» يتجاوز حدود الأرض`,
        at: { x: it.el.x, y: it.el.y },
      });
    }
    if (isCourtKind(it.el.kind) && inside && !polygonInside(courtSafetyPolygon(it.el), land)) {
      push({
        code: 'court-zone-outside',
        severity: 'warning',
        elementIds: [it.el.id],
        message: `منطقة أمان «${it.el.name}» تتجاوز حدود الأرض (السور)`,
        at: { x: it.el.x, y: it.el.y },
      });
    }
  }

  // 2) التداخلات
  for (let i = 0; i < items.length; i++) {
    const A = items[i];
    if (A.cls === 'none' || !A.shapes.length) continue;
    for (let j = i + 1; j < items.length; j++) {
      const B = items[j];
      if (B.cls === 'none' || !B.shapes.length) continue;
      const rule = pairRule(A.cls, B.cls);
      if (rule === 'ok') continue;
      if (!boundsIntersect(A.bounds, B.bounds)) continue;
      if (!shapesIntersect(A.shapes, B.shapes)) continue;
      // مظلة السيارات فوق المواقف مسموحة
      if ((A.el.kind === 'carport' && B.el.kind === 'parking') || (B.el.kind === 'carport' && A.el.kind === 'parking')) continue;
      // الأثاث وأي شي داخل الغرفة بالكامل مسموح
      if (B.el.kind === 'room' && A.el.kind !== 'room' && fullyInside(A.el, B.el)) continue;
      if (A.el.kind === 'room' && B.el.kind !== 'room' && fullyInside(B.el, A.el)) continue;
      // غرف لاصقة في بعض (جدار مشترك) مب تداخل
      if (A.el.kind === 'room' && B.el.kind === 'room' && roomsOnlyTouch(A.el, B.el)) continue;
      // اللي داخل حوش الحلال بالكامل (معلف، مظلة، شجرة) مسموح
      if (PENS.has(B.el.kind) && IN_PEN.has(A.el.kind) && fullyInside(A.el, B.el)) continue;
      if (PENS.has(A.el.kind) && IN_PEN.has(B.el.kind) && fullyInside(B.el, A.el)) continue;
      // الأثاث داخل الخيمة مسموح
      if (A.cls === 'soft' && isTentKind(B.el.kind) && fullyInside(A.el, B.el)) continue;
      if (B.cls === 'soft' && isTentKind(A.el.kind) && fullyInside(B.el, A.el)) continue;
      const courtInvolved = A.cls === 'court' || B.cls === 'court';
      const court = A.cls === 'court' ? A.el : B.el;
      const other = A.cls === 'court' ? B.el : A.el;
      let message = `تداخل بين «${A.el.name}» و«${B.el.name}»`;
      if (courtInvolved && A.cls !== B.cls) {
        message =
          other.kind === 'path'
            ? `الممر «${other.name}» يعبر «${court.name}»`
            : `«${other.name}» موضوع فوق «${court.name}»`;
      }
      const ca = centroid(A.shapes[0]);
      const cb = centroid(B.shapes[0]);
      push({
        code: courtInvolved ? 'court-overlap' : 'overlap',
        severity: rule,
        elementIds: [A.el.id, B.el.id],
        message,
        at: { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 },
      });
    }
  }

  // 3) منطقة أمان الملعب
  for (const C of items) {
    if (!isCourtKind(C.el.kind) || !C.el.court) continue;
    const margin = C.el.court.safetyMargin;
    if (margin <= 0) continue;
    const zone = [courtSafetyPolygon(C.el)];
    const zoneBounds = boundsOf(zone[0]);
    for (const O of items) {
      if (O === C || !O.shapes.length) continue;
      if (O.cls === 'none') continue;
      if (!boundsIntersect(zoneBounds, O.bounds)) continue;
      if (!shapesIntersect(zone, O.shapes)) continue;
      if (shapesIntersect(C.shapes, O.shapes)) continue; // مُبلغ عنه كتداخل
      const d = shapesDistance(C.shapes, O.shapes);
      push({
        code: 'court-clearance',
        severity: 'warning',
        elementIds: [O.el.id, C.el.id],
        message: `«${O.el.name}» قريب جداً من الملعب: ${formatMeters(d.dist, 1)} (المطلوب ${formatMeters(margin, 1)})`,
        at: d.b,
      });
    }
  }

  // 4) المدخل الرئيسي
  const ent = entranceInfo(plan.land);
  const entZoneCenter = add(ent.center, scale(ent.inward, 1.25));
  const entAngle = (Math.atan2(ent.dir.y, ent.dir.x) * 180) / Math.PI;
  const entZone = [rectCorners(entZoneCenter.x, entZoneCenter.y, ent.width, 2.5, entAngle)];
  for (const O of items) {
    if (!O.shapes.length) continue;
    if (O.cls === 'none' || O.cls === 'path') continue;
    if (O.el.kind === 'entrance-light') continue;
    if (!shapesIntersect(entZone, O.shapes)) continue;
    push({
      code: 'entrance-blocked',
      severity: 'warning',
      elementIds: [O.el.id],
      message: `«${O.el.name}» يعيق المدخل الرئيسي`,
      at: ent.center,
    });
  }

  // 5) مداخل الخيام
  for (const T of items) {
    if (!T.el.tent) continue;
    const zone = tentEntranceZone(T.el);
    if (!zone) continue;
    for (const O of items) {
      if (O === T || !O.shapes.length) continue;
      if (O.cls !== 'structure' && O.cls !== 'court' && O.cls !== 'cover' && O.cls !== 'pole') continue;
      if (!shapesIntersect([zone], O.shapes)) continue;
      push({
        code: 'tent-entrance-blocked',
        severity: 'warning',
        elementIds: [T.el.id, O.el.id],
        message: `مدخل «${T.el.name}» مسدود بـ«${O.el.name}»`,
        at: centroid(zone),
      });
    }
  }

  // 5) الحلال والمجلس: المسافة واتجاه الريح (الشمال تهب من الشمال الغربي)
  for (const L of items) {
    if (!LIVESTOCK.has(L.el.kind) || !L.shapes.length) continue;
    for (const S of items) {
      if (!SITTING.has(S.el.kind) || !S.shapes.length) continue;
      const gap = shapesDistance(L.shapes, S.shapes).dist;
      const v = rotate({ x: L.el.x - S.el.x, y: L.el.y - S.el.y }, -plan.land.northAngle);
      const bearing = (((Math.atan2(v.x, -v.y) * 180) / Math.PI) % 360 + 360) % 360;
      const upwind = angleDiff(bearing, WIND_FROM) <= 60;
      let message = '';
      if (gap < LIVESTOCK_MIN_GAP) message = `«${L.el.name}» قريبة وايد من «${S.el.name}» (${formatMeters(gap)}) — الريحة والذباب. خلها ${LIVESTOCK_MIN_GAP} م على الأقل`;
      else if (upwind && gap < LIVESTOCK_WIND_GAP)
        message = `«${L.el.name}» فوق الريح عن «${S.el.name}» — مع ريح الشمال ريحتها بتوصلكم. الأفضل تكون جهة ${compassName(WIND_FROM + 180)} منه`;
      if (!message) continue;
      push({
        code: 'livestock-wind',
        severity: 'warning',
        elementIds: [L.el.id, S.el.id],
        message,
        at: centroid(L.shapes[0]),
      });
    }
  }

  const byElement = new Map<string, Issue[]>();
  for (const issue of issues) {
    for (const id of issue.elementIds) {
      const list = byElement.get(id) ?? [];
      list.push(issue);
      byElement.set(id, list);
    }
  }
  return {
    issues,
    byElement,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
  };
}
