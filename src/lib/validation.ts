import type { Plan, PlanElement, Vec2 } from '../types/plan';
import { CATALOG_BY_KIND, isTentKind, type CollisionClass } from './catalog';
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
} from './geometry';

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
  | 'out-of-bounds'
  | 'overlap'
  | 'court-overlap'
  | 'court-clearance'
  | 'court-zone-outside'
  | 'entrance-blocked'
  | 'tent-entrance-blocked';

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
    if (it.el.kind === 'volleyball' && inside && !polygonInside(courtSafetyPolygon(it.el), land)) {
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
    if (C.el.kind !== 'volleyball' || !C.el.court) continue;
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
      message: `«${O.el.name}» يعيق المدخل الرئيسي للعنة`,
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
