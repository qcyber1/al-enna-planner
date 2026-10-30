import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Shape, Stage, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { ElementKind, PlanElement, Vec2 } from '../types/plan';
import { getPlan, useEditor, usePlan } from '../store/editorStore';
import { useDebounced, useElementSize, getValidation } from '../hooks/useDerived';
import { useViewport, MAX_SCALE, MIN_SCALE, drawingState } from './viewport';
import { PolylineNode, RectNode, type NodeHandlers } from './nodes';
import {
  drawCourtZone,
  drawDimensionLine,
  drawFence,
  drawGrid,
  drawLabels,
  drawLand,
  drawMeasurement,
  drawTentEntranceZones,
  type DrawOpts,
} from '../render2d/draw';
import { drawLightMap } from '../render2d/lightmap';
import { CATALOG_BY_KIND, createElement, isPolyline, qiblaRotation } from '../lib/catalog';
import {
  DEG,
  boundsIntersect,
  dist,
  elementBounds,
  elementShapes,
  formatMeters,
  landBounds,
  lerp,
  normalizeAngle,
  rectCorners,
  round,
  shapesDistance,
  snapValue,
} from '../lib/geometry';
import { EditorOverlay } from './EditorOverlay';

export const DND_MIME = 'application/x-enna-kind';

type KEvent<T = MouseEvent> = Konva.KonvaEventObject<T>;

interface DragInfo {
  id: string;
  starts: Map<string, { x: number; y: number; points?: Vec2[] }>;
  poly: boolean;
}

function nativeCtx(c: Konva.Context): CanvasRenderingContext2D {
  return (c as unknown as { _context: CanvasRenderingContext2D })._context;
}

export default function Editor2D() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const { width, height } = useElementSize(wrapRef);

  const plan = usePlan();
  const selection = useEditor((s) => s.selection);
  const tool = useEditor((s) => s.tool);
  const grid = useEditor((s) => s.grid);
  const overlays = useEditor((s) => s.overlays);
  const time = useEditor((s) => s.time);
  const vp = useViewport();
  const validation = getValidation(plan);
  const night = time !== 'day';

  const [draft, setDraft] = useState<Vec2[] | null>(null);
  const [cursor, setCursorLocal] = useState<Vec2 | null>(null);
  const [marquee, setMarquee] = useState<{ a: Vec2; b: Vec2 } | null>(null);
  const [measureDraft, setMeasureDraft] = useState<{ a: Vec2; b: Vec2 } | null>(null);
  const [selMeasure, setSelMeasure] = useState<string | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [fontsTick, setFontsTick] = useState(0);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const pinchRef = useRef<{ d: number; c: Vec2; scale: number; x: number; y: number } | null>(null);
  const dragRef = useRef<DragInfo | null>(null);
  const fittedRef = useRef(false);
  const altRef = useRef(false);

  const ppm = vp.scale;
  const lb = landBounds(plan.land);

  // ——— الملاءمة والتكبير ———
  const fit = useCallback(() => {
    if (!width || !height) return;
    const b = landBounds(getPlan().land);
    const pad = 3.5;
    const w = b.maxX - b.minX + pad * 2;
    const h = b.maxY - b.minY + pad * 2;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(width / w, height / h)));
    useViewport.getState().setView({
      scale,
      x: width / 2 - ((b.minX + b.maxX) / 2) * scale,
      y: height / 2 - ((b.minY + b.maxY) / 2) * scale,
    });
  }, [width, height]);

  useEffect(() => {
    if (width > 0 && height > 0 && !fittedRef.current) {
      fittedRef.current = true;
      fit();
    }
  }, [width, height, fit]);

  useEffect(() => {
    if (vp.fitNonce) fit();
  }, [vp.fitNonce, fit]);

  const zoomAt = useCallback((factor: number, center: Vec2) => {
    const v = useViewport.getState();
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
    const wx = (center.x - v.x) / v.scale;
    const wy = (center.y - v.y) / v.scale;
    v.setView({ scale, x: center.x - wx * scale, y: center.y - wy * scale });
  }, []);

  useEffect(() => {
    if (vp.zoomRequest.nonce) zoomAt(vp.zoomRequest.factor, { x: width / 2, y: height / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.zoomRequest.nonce]);

  useEffect(() => {
    document.fonts?.ready.then(() => setFontsTick((t) => t + 1)).catch(() => undefined);
  }, []);

  // ——— أدوات مساعدة ———
  const toWorld = useCallback((p: Vec2): Vec2 => {
    const v = useViewport.getState();
    return { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale };
  }, []);

  const snapPoint = useCallback(
    (p: Vec2): Vec2 => {
      const g = useEditor.getState().grid;
      if (!g.snap || altRef.current) return { x: round(p.x, 3), y: round(p.y, 3) };
      return { x: round(snapValue(p.x, g.size), 3), y: round(snapValue(p.y, g.size), 3) };
    },
    [],
  );

  /** التقاط نقاط مهمة (مراكز العناصر، أطراف الممرات، الأعمدة) */
  const magnet = useCallback(
    (p: Vec2, kinds?: ElementKind[]): Vec2 | null => {
      const v = useViewport.getState();
      const r = 12 / v.scale;
      let best: Vec2 | null = null;
      let bd = r;
      for (const el of getPlan().elements) {
        if (kinds && !kinds.includes(el.kind)) continue;
        const cands: Vec2[] = [];
        if (el.points) cands.push(el.points[0], el.points[el.points.length - 1]);
        else {
          cands.push({ x: el.x, y: el.y });
          if (CATALOG_BY_KIND[el.kind].geometry === 'rect') cands.push(...rectCorners(el.x, el.y, el.width, el.depth, el.rotation));
        }
        for (const c of cands) {
          const d = dist(c, p);
          if (d < bd) {
            bd = d;
            best = c;
          }
        }
      }
      return best;
    },
    [],
  );

  const drawPoint = useCallback(
    (raw: Vec2, shift: boolean): Vec2 => {
      const t = useEditor.getState().tool;
      const mag = magnet(raw, t === 'string-lights' ? ['light-pole', 'entrance-light', 'canopy', 'main-tent', 'small-tent', 'dining-tent', 'kitchen-tent', 'flood-light'] : undefined);
      if (mag) return { x: round(mag.x, 3), y: round(mag.y, 3) };
      let p = snapPoint(raw);
      if (shift && draft && draft.length) {
        const last = draft[draft.length - 1];
        const ang = Math.atan2(p.y - last.y, p.x - last.x);
        const snapA = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        const L = dist(last, p);
        p = { x: round(last.x + Math.cos(snapA) * L, 3), y: round(last.y + Math.sin(snapA) * L, 3) };
      }
      return p;
    },
    [draft, magnet, snapPoint],
  );

  // ——— إنهاء الرسم ———
  const draftRef = useRef<Vec2[] | null>(null);
  draftRef.current = draft;
  const finishDraft = useCallback(() => {
    const st = useEditor.getState();
    const d = draftRef.current;
    if (d && d.length >= 2) {
      const clean = d.filter((p, i) => i === 0 || dist(p, d[i - 1]) > 0.05);
      if (clean.length >= 2) {
        const kind: ElementKind = st.tool === 'string-lights' ? 'string-lights' : 'path';
        const count = getPlan().elements.filter((e) => e.kind === kind).length + 1;
        const el = createElement(kind, clean[0], {
          points: clean,
          name: kind === 'path' ? `ممر ${count}` : `سلسلة ليتات ${count}`,
        });
        st.addElement(el);
        st.setTool('select');
        st.toast(kind === 'path' ? 'تمت إضافة الممر — عدّل عرضه ونوعه من لوحة الخصائص' : 'تمت إضافة سلسلة الليتات', 'success');
      } else {
        st.toast('أضف نقطتين مختلفتين على الأقل', 'warning');
      }
    }
    draftRef.current = null;
    setDraft(null);
  }, []);

  useEffect(() => {
    drawingState.active = !!draft || !!measureDraft;
  }, [draft, measureDraft]);

  useEffect(() => {
    if (tool !== 'path' && tool !== 'string-lights') setDraft(null);
    if (tool !== 'measure') setMeasureDraft(null);
  }, [tool]);

  // ——— لوحة المفاتيح الخاصة بالمحرر ———
  useEffect(() => {
    const isInput = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
    const down = (e: KeyboardEvent) => {
      altRef.current = e.altKey;
      if (isInput(e.target)) return;
      if (e.code === 'Space' && !e.repeat) setSpaceDown(true);
      if (draft) {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishDraft();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(null);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          setDraft((d) => (d && d.length > 1 ? d.slice(0, -1) : null));
        }
      }
      if (selMeasure && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        useEditor.getState().removeMeasurement(selMeasure);
        setSelMeasure(null);
      }
    };
    const up = (e: KeyboardEvent) => {
      altRef.current = e.altKey;
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up);
    };
  }, [draft, finishDraft, selMeasure]);

  // ——— معالجات العناصر ———
  const handlers = useRef<NodeHandlers>({
    onPointerDown: () => undefined,
    onDragStart: () => undefined,
    onDragMove: () => undefined,
    onDragEnd: () => undefined,
    onDblClick: () => undefined,
  });

  handlers.current.onPointerDown = (id, e) => {
    const st = useEditor.getState();
    if (st.tool !== 'select') return;
    e.cancelBubble = true;
    setSelMeasure(null);
    const evt = e.evt as MouseEvent;
    if (evt.shiftKey || evt.ctrlKey || evt.metaKey) {
      st.toggleSelect(id);
      return;
    }
    if (!st.selection.includes(id)) st.select([id]);
  };

  handlers.current.onDragStart = (id, e) => {
    const st = useEditor.getState();
    if (st.tool !== 'select') {
      e.target.stopDrag();
      return;
    }
    let sel = st.selection;
    if (!sel.includes(id)) {
      sel = [id];
      st.select(sel);
    }
    const plan = getPlan();
    const starts = new Map<string, { x: number; y: number; points?: Vec2[] }>();
    for (const el of plan.elements) {
      if (!sel.includes(el.id) || el.locked) continue;
      starts.set(el.id, { x: el.x, y: el.y, points: el.points });
    }
    const dragged = plan.elements.find((x) => x.id === id);
    dragRef.current = { id, starts, poly: !!dragged && isPolyline(dragged.kind) };
    st.beginGesture();
  };

  const computeDelta = (id: string, node: Konva.Node): { dx: number; dy: number } | null => {
    const info = dragRef.current;
    if (!info || info.id !== id) return null;
    const start = info.starts.get(id);
    if (!start) return null;
    const g = useEditor.getState().grid;
    const doSnap = g.snap && !altRef.current;
    if (info.poly) {
      let dx = node.x();
      let dy = node.y();
      if (doSnap) {
        dx = snapValue(dx, g.size);
        dy = snapValue(dy, g.size);
      }
      node.position({ x: dx, y: dy });
      return { dx, dy };
    }
    let nx = node.x();
    let ny = node.y();
    if (doSnap) {
      nx = snapValue(nx, g.size);
      ny = snapValue(ny, g.size);
    }
    node.position({ x: nx, y: ny });
    return { dx: nx - start.x, dy: ny - start.y };
  };

  const applyDrag = (dx: number, dy: number, includeDraggedPoly: boolean) => {
    const info = dragRef.current;
    if (!info) return;
    const patches: Record<string, Partial<PlanElement>> = {};
    for (const [eid, s] of info.starts) {
      if (s.points) {
        if (eid === info.id && info.poly && !includeDraggedPoly) continue;
        patches[eid] = { points: s.points.map((p) => ({ x: round(p.x + dx, 3), y: round(p.y + dy, 3) })) };
      } else {
        patches[eid] = { x: round(s.x + dx, 3), y: round(s.y + dy, 3) };
      }
    }
    useEditor.getState().updateElements(patches, { history: false });
  };

  handlers.current.onDragMove = (id, e) => {
    const d = computeDelta(id, e.target);
    if (!d) return;
    applyDrag(d.dx, d.dy, false);
  };

  handlers.current.onDragEnd = (id, e) => {
    const d = computeDelta(id, e.target);
    const st = useEditor.getState();
    if (d) applyDrag(d.dx, d.dy, true);
    const moved = dragRef.current ? Array.from(dragRef.current.starts.keys()) : [];
    dragRef.current = null;
    st.endGesture();
    // تنبيه فوري إذا أصبح الوضع غير صالح
    const v = getValidation(getPlan());
    const errs = v.issues.filter((i) => i.severity === 'error' && i.elementIds.some((x) => moved.includes(x)));
    if (errs.length) st.toast(`⚠ ${errs[0].message}`, 'error');
  };

  handlers.current.onDblClick = (id) => {
    const el = getPlan().elements.find((x) => x.id === id);
    if (!el) return;
    if (el.locked) useEditor.getState().toast('العنصر مقفل — يمكنك إلغاء القفل من لوحة الخصائص', 'info');
  };

  // ——— المحوّل (تدوير وتغيير المقاس) ———
  const single = selection.length === 1 ? plan.elements.find((e) => e.id === selection[0]) : undefined;
  const singleGeo = single ? CATALOG_BY_KIND[single.kind].geometry : null;
  const trEnabled = !!single && !single.locked && tool === 'select' && singleGeo !== 'polyline';
  const trResize = trEnabled && singleGeo === 'rect';
  const trRotate = trEnabled && (singleGeo === 'rect' || single?.kind === 'flood-light');

  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if ((trResize || trRotate) && single) {
      const node = stage.findOne(`#${single.id}`);
      tr.nodes(node ? [node] : []);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [single, trResize, trRotate, plan]);

  const onTransformEnd = () => {
    const tr = trRef.current;
    if (!tr || !single) return;
    const node = tr.nodes()[0];
    if (!node) return;
    const min = CATALOG_BY_KIND[single.kind].minSize;
    const sx = Math.abs(node.scaleX());
    const sy = Math.abs(node.scaleY());
    node.scaleX(1);
    node.scaleY(1);
    const patch: Partial<PlanElement> = {
      x: round(node.x(), 3),
      y: round(node.y(), 3),
      rotation: normalizeAngle(node.rotation()),
    };
    if (singleGeo === 'rect') {
      patch.width = Math.max(min, round(single.width * sx, 2));
      patch.depth = Math.max(min, round(single.depth * sy, 2));
      if (single.kind === 'volleyball' && single.court) {
        // لا شيء إضافي — منطقة الأمان تتبع الأبعاد تلقائياً
      }
    }
    useEditor.getState().updateElement(single.id, patch);
  };

  // ——— أحداث المسرح ———
  const onStageDown = (e: KEvent<MouseEvent | TouchEvent>) => {
    const st = useEditor.getState();
    const evt = e.evt;
    const isTouch = 'touches' in evt;
    if (isTouch && (evt as TouchEvent).touches.length >= 2) {
      const t = (evt as TouchEvent).touches;
      const rect = wrapRef.current!.getBoundingClientRect();
      const a = { x: t[0].clientX - rect.left, y: t[0].clientY - rect.top };
      const b = { x: t[1].clientX - rect.left, y: t[1].clientY - rect.top };
      const v = useViewport.getState();
      pinchRef.current = { d: dist(a, b), c: lerp(a, b, 0.5), scale: v.scale, x: v.x, y: v.y };
      panRef.current = null;
      setMarquee(null);
      return;
    }
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    const world = toWorld(pos);
    const button = isTouch ? 0 : (evt as MouseEvent).button;
    const onEmpty = e.target === e.target.getStage();
    if (button === 1 || button === 2 || st.tool === 'pan' || spaceDown || (isTouch && onEmpty && st.tool === 'select')) {
      const v = useViewport.getState();
      panRef.current = { sx: pos.x, sy: pos.y, vx: v.x, vy: v.y };
      return;
    }
    if (st.tool === 'measure') {
      const p = magnet(world) ?? snapPoint(world);
      setMeasureDraft({ a: p, b: p });
      return;
    }
    if (st.tool === 'path' || st.tool === 'string-lights') {
      const p = drawPoint(world, !isTouch && (evt as MouseEvent).shiftKey);
      setDraft((d) => (d ? [...d, p] : [p]));
      return;
    }
    if (onEmpty) {
      setSelMeasure(null);
      setMarquee({ a: world, b: world });
    }
  };

  const onStageMove = () => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    const world = toWorld(pos);
    setCursorLocal(world);
    useViewport.getState().setCursor(world);
    if (panRef.current) {
      const p = panRef.current;
      useViewport.getState().setView({ x: p.vx + pos.x - p.sx, y: p.vy + pos.y - p.sy, scale: useViewport.getState().scale });
      return;
    }
    if (marquee) setMarquee({ a: marquee.a, b: world });
    if (measureDraft) setMeasureDraft({ a: measureDraft.a, b: magnet(world) ?? snapPoint(world) });
  };

  const onTouchMove = (e: KEvent<TouchEvent>) => {
    const t = e.evt.touches;
    if (t.length >= 2 && pinchRef.current) {
      e.evt.preventDefault();
      const rect = wrapRef.current!.getBoundingClientRect();
      const a = { x: t[0].clientX - rect.left, y: t[0].clientY - rect.top };
      const b = { x: t[1].clientX - rect.left, y: t[1].clientY - rect.top };
      const p = pinchRef.current;
      const c = lerp(a, b, 0.5);
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, (p.scale * dist(a, b)) / Math.max(1, p.d)));
      const wx = (p.c.x - p.x) / p.scale;
      const wy = (p.c.y - p.y) / p.scale;
      useViewport.getState().setView({ scale, x: c.x - wx * scale, y: c.y - wy * scale });
      return;
    }
    onStageMove();
  };

  const onStageUp = (e: KEvent<MouseEvent | TouchEvent>) => {
    const st = useEditor.getState();
    pinchRef.current = null;
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    if (measureDraft) {
      if (dist(measureDraft.a, measureDraft.b) > 0.1) st.addMeasurement(measureDraft.a, measureDraft.b);
      setMeasureDraft(null);
      return;
    }
    if (marquee) {
      const minX = Math.min(marquee.a.x, marquee.b.x);
      const maxX = Math.max(marquee.a.x, marquee.b.x);
      const minY = Math.min(marquee.a.y, marquee.b.y);
      const maxY = Math.max(marquee.a.y, marquee.b.y);
      const additive = 'shiftKey' in e.evt && (e.evt as MouseEvent).shiftKey;
      if ((maxX - minX) * ppm < 4 && (maxY - minY) * ppm < 4) {
        if (!additive) st.clearSelection();
      } else {
        const box = { minX, minY, maxX, maxY };
        const ids = getPlan()
          .elements.filter((el) => boundsIntersect(box, elementBounds(el)))
          .map((el) => el.id);
        st.select(ids, additive);
      }
      setMarquee(null);
    }
  };

  const onWheel = (e: KEvent<WheelEvent>) => {
    e.evt.preventDefault();
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    if (e.evt.ctrlKey || Math.abs(e.evt.deltaY) >= Math.abs(e.evt.deltaX)) {
      const factor = Math.exp(-e.evt.deltaY * (e.evt.ctrlKey ? 0.01 : 0.0015));
      zoomAt(factor, pos);
    } else {
      const v = useViewport.getState();
      v.setView({ x: v.x - e.evt.deltaX, y: v.y - e.evt.deltaY, scale: v.scale });
    }
  };

  const onDblClick = () => {
    if (draftRef.current) finishDraft();
  };

  // ——— الإفلات من المكتبة ———
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData(DND_MIME) as ElementKind;
    if (!kind || !CATALOG_BY_KIND[kind]) return;
    const stage = stageRef.current;
    if (!stage) return;
    stage.setPointersPositions(e.nativeEvent);
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const p = snapPoint(toWorld(pos));
    const st = useEditor.getState();
    const el = createElement(kind, p, kind === 'prayer-area' ? { rotation: qiblaRotation(getPlan().land.northAngle) } : {});
    st.setTool('select');
    st.addElement(el);
  };

  // ——— البيانات المشتقة للرسم ———
  const lightPlan = useDebounced(plan, 180);
  const issueOf = (id: string): 'error' | 'warning' | null => {
    const l = validation.byElement.get(id);
    if (!l?.length) return null;
    return l.some((i) => i.severity === 'error') ? 'error' : 'warning';
  };

  const ordered = useMemo(() => {
    const paths = plan.elements.filter((e) => e.kind === 'path');
    const strings = plan.elements.filter((e) => e.kind === 'string-lights');
    const rest = plan.elements.filter((e) => e.kind !== 'path' && e.kind !== 'string-lights');
    return [...paths, ...rest, ...strings];
  }, [plan.elements]);

  const baseOpts: DrawOpts = { ppm, night };
  const selectable = tool === 'select';

  // إرشادات المسافات للعنصر المحدد
  const guides = useMemo(() => {
    if (!overlays.distances || selection.length !== 1) return null;
    const el = plan.elements.find((e) => e.id === selection[0]);
    if (!el || el.kind === 'string-lights') return null;
    const shapes = elementShapes(el);
    if (!shapes.length) return null;
    const b = elementBounds(el);
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const edges = [
      { a: { x: lb.minX, y: cy }, b: { x: b.minX, y: cy } },
      { a: { x: b.maxX, y: cy }, b: { x: lb.maxX, y: cy } },
      { a: { x: cx, y: lb.minY }, b: { x: cx, y: b.minY } },
      { a: { x: cx, y: b.maxY }, b: { x: cx, y: lb.maxY } },
    ].filter((g) => dist(g.a, g.b) > 0.05 && g.b.x >= g.a.x - 1e-6 && g.b.y >= g.a.y - 1e-6);
    const near: { a: Vec2; b: Vec2; d: number; name: string }[] = [];
    for (const o of plan.elements) {
      if (o.id === el.id || o.kind === 'string-lights') continue;
      const os = elementShapes(o);
      if (!os.length) continue;
      const ob = elementBounds(o);
      if (!boundsIntersect(b, ob, 15)) continue;
      const r = shapesDistance(shapes, os);
      if (r.dist > 0.05 && r.dist < 15) near.push({ a: r.a, b: r.b, d: r.dist, name: o.name });
    }
    near.sort((x, y) => x.d - y.d);
    return { edges, near: near.slice(0, 3) };
  }, [overlays.distances, selection, plan.elements, lb.minX, lb.minY, lb.maxX, lb.maxY]);

  const selectedPoly = single && singleGeo === 'polyline' && !single.locked && tool === 'select' ? single : null;
  const handleR = 7 / ppm;

  const cursorStyle =
    panRef.current || tool === 'pan' || spaceDown
      ? 'grab'
      : tool === 'path' || tool === 'string-lights' || tool === 'measure'
        ? 'crosshair'
        : 'default';

  return (
    <div
      ref={wrapRef}
      dir="ltr"
      className="relative h-full w-full overflow-hidden bg-[#e3cfa6] select-none"
      style={{ cursor: cursorStyle, touchAction: 'none' }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DND_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={onDrop}
      onContextMenu={(e) => e.preventDefault()}
      data-testid="editor-2d"
    >
      {width > 0 && height > 0 && (
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          x={vp.x}
          y={vp.y}
          scaleX={ppm}
          scaleY={ppm}
          onMouseDown={onStageDown}
          onTouchStart={onStageDown}
          onMouseMove={onStageMove}
          onTouchMove={onTouchMove}
          onMouseUp={onStageUp}
          onTouchEnd={onStageUp}
          onMouseLeave={() => {
            setCursorLocal(null);
            useViewport.getState().setCursor(null);
          }}
          onWheel={onWheel}
          onDblClick={onDblClick}
          onDblTap={onDblClick}
        >
          {/* الخلفية: الأرض، الشبكة، خريطة الإضاءة، منطقة أمان الملعب، السياج */}
          <Layer listening={false}>
            <Shape
              key={`bg${fontsTick}`}
              perfectDrawEnabled={false}
              sceneFunc={(c) => {
                const ctx = nativeCtx(c);
                drawLand(ctx, plan.land, baseOpts);
                if (grid.show) drawGrid(ctx, plan.land, grid.size, baseOpts);
                if (overlays.lightMap) drawLightMap(ctx, lightPlan);
                if (overlays.safety) {
                  for (const el of plan.elements) {
                    if (el.kind !== 'volleyball') continue;
                    ctx.save();
                    ctx.translate(el.x, el.y);
                    ctx.rotate(el.rotation * DEG);
                    drawCourtZone(ctx, el, baseOpts);
                    ctx.restore();
                  }
                  drawTentEntranceZones(ctx, plan);
                }
                drawFence(ctx, plan.land, baseOpts);
              }}
            />
          </Layer>

          {/* العناصر */}
          <Layer>
            {ordered.map((el) => {
              const props = {
                el,
                ppm,
                selected: selection.includes(el.id),
                issue: issueOf(el.id),
                night,
                draggable: selectable && !el.locked,
                listening: true,
                handlers,
              };
              return isPolyline(el.kind) ? <PolylineNode key={el.id} {...props} /> : <RectNode key={el.id} {...props} />;
            })}
            <Transformer
              ref={trRef}
              rotateEnabled={trRotate}
              resizeEnabled={trResize}
              keepRatio={false}
              flipEnabled={false}
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              rotationSnapTolerance={4}
              anchorSize={9}
              anchorCornerRadius={3}
              borderStroke="#1d6fd8"
              anchorStroke="#1d6fd8"
              anchorFill="#ffffff"
              rotateAnchorOffset={24}
              ignoreStroke
              boundBoxFunc={(oldBox, newBox) => {
                if (!single) return newBox;
                const min = CATALOG_BY_KIND[single.kind].minSize * ppm;
                if (Math.abs(newBox.width) < min || Math.abs(newBox.height) < min) return oldBox;
                return newBox;
              }}
              onTransformStart={() => useEditor.getState().beginGesture()}
              onTransformEnd={() => {
                onTransformEnd();
                useEditor.getState().endGesture();
              }}
            />
          </Layer>

          {/* التسميات والقياسات والإرشادات */}
          <Layer listening={false}>
            <Shape
              key={`lbl${fontsTick}`}
              perfectDrawEnabled={false}
              sceneFunc={(c) => {
                const ctx = nativeCtx(c);
                drawLabels(ctx, plan, {
                  ...baseOpts,
                  names: overlays.labels,
                  dims: overlays.dims,
                  issues: validation.byElement,
                });
                for (const m of plan.measurements) drawMeasurement(ctx, m, { ...baseOpts, selected: m.id === selMeasure });
                if (guides) {
                  for (const g of guides.edges) drawDimensionLine(ctx, g.a, g.b, formatMeters(dist(g.a, g.b), 2), baseOpts, '#2f6f4f', true);
                  for (const g of guides.near) drawDimensionLine(ctx, g.a, g.b, formatMeters(g.d, 2), baseOpts, '#c2410c', true);
                }
                if (measureDraft) drawDimensionLine(ctx, measureDraft.a, measureDraft.b, formatMeters(dist(measureDraft.a, measureDraft.b)), baseOpts, '#1d6fd8');
              }}
            />
            {draft && (
              <Shape
                sceneFunc={(c) => {
                  const ctx = nativeCtx(c);
                  const pts = cursor ? [...draft, drawPoint(cursor, false)] : draft;
                  const width = tool === 'path' ? 2 : 0.08;
                  ctx.save();
                  ctx.lineJoin = 'miter';
                  ctx.lineCap = 'butt';
                  ctx.strokeStyle = tool === 'path' ? 'rgba(79,154,53,0.55)' : 'rgba(255,190,80,0.9)';
                  ctx.lineWidth = Math.max(width, 3 / ppm);
                  ctx.beginPath();
                  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
                  ctx.stroke();
                  ctx.strokeStyle = '#1d6fd8';
                  ctx.lineWidth = 1.5 / ppm;
                  ctx.setLineDash([6 / ppm, 4 / ppm]);
                  ctx.stroke();
                  ctx.restore();
                  if (pts.length >= 2) {
                    const a = pts[pts.length - 2];
                    const b = pts[pts.length - 1];
                    drawDimensionLine(ctx, a, b, formatMeters(dist(a, b)), baseOpts, '#1d6fd8');
                  }
                  ctx.fillStyle = '#1d6fd8';
                  for (const p of draft) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4 / ppm, 0, Math.PI * 2);
                    ctx.fill();
                  }
                }}
              />
            )}
            {marquee && (
              <Rect
                x={Math.min(marquee.a.x, marquee.b.x)}
                y={Math.min(marquee.a.y, marquee.b.y)}
                width={Math.abs(marquee.b.x - marquee.a.x)}
                height={Math.abs(marquee.b.y - marquee.a.y)}
                fill="rgba(29,111,216,0.08)"
                stroke="#1d6fd8"
                strokeWidth={1 / ppm}
                dash={[6 / ppm, 4 / ppm]}
              />
            )}
          </Layer>

          {/* مقابض التحرير والقياسات القابلة للتحديد */}
          <Layer>
            {tool === 'select' &&
              plan.measurements.map((m) => (
                <Group key={m.id}>
                  <Line
                    points={[m.a.x, m.a.y, m.b.x, m.b.y]}
                    stroke="rgba(0,0,0,0)"
                    strokeWidth={1 / ppm}
                    hitStrokeWidth={14 / ppm}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      setSelMeasure(m.id);
                      useEditor.getState().clearSelection();
                    }}
                    onTouchStart={(e) => {
                      e.cancelBubble = true;
                      setSelMeasure(m.id);
                    }}
                  />
                  {selMeasure === m.id && (
                    <Group
                      x={(m.a.x + m.b.x) / 2}
                      y={(m.a.y + m.b.y) / 2 - 22 / ppm}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                        useEditor.getState().removeMeasurement(m.id);
                        setSelMeasure(null);
                      }}
                      onTouchStart={(e) => {
                        e.cancelBubble = true;
                        useEditor.getState().removeMeasurement(m.id);
                        setSelMeasure(null);
                      }}
                    >
                      <Circle radius={9 / ppm} fill="#d62828" />
                      <Text
                        text="×"
                        fontSize={14 / ppm}
                        fill="#fff"
                        width={18 / ppm}
                        height={18 / ppm}
                        offsetX={9 / ppm}
                        offsetY={8.5 / ppm}
                        align="center"
                        verticalAlign="middle"
                      />
                    </Group>
                  )}
                </Group>
              ))}
            {selectedPoly?.points && (
              <PolyHandles el={selectedPoly} r={handleR} snapPoint={snapPoint} />
            )}
          </Layer>
        </Stage>
      )}
      <EditorOverlay
        drawing={!!draft}
        draftCount={draft?.length ?? 0}
        onFinish={finishDraft}
        onCancel={() => setDraft(null)}
        selectedMeasure={selMeasure}
        onDeleteMeasure={() => {
          if (selMeasure) useEditor.getState().removeMeasurement(selMeasure);
          setSelMeasure(null);
        }}
      />
    </div>
  );
}

function PolyHandles({ el, r, snapPoint }: { el: PlanElement; r: number; snapPoint: (p: Vec2) => Vec2 }) {
  const pts = el.points ?? [];
  const update = (i: number, p: Vec2) => {
    const next = pts.map((q, k) => (k === i ? p : q));
    useEditor.getState().updateElement(el.id, { points: next }, { history: false });
  };
  return (
    <>
      {pts.slice(1).map((p, i) => {
        const a = pts[i];
        const m = lerp(a, p, 0.5);
        if (dist(a, p) * (1 / r) < 6) return null;
        return (
          <Group
            key={`m${i}`}
            x={m.x}
            y={m.y}
            onMouseDown={(e) => {
              e.cancelBubble = true;
              const next = [...pts.slice(0, i + 1), { x: round(m.x, 3), y: round(m.y, 3) }, ...pts.slice(i + 1)];
              useEditor.getState().updateElement(el.id, { points: next });
            }}
            onTouchStart={(e) => {
              e.cancelBubble = true;
              const next = [...pts.slice(0, i + 1), { x: round(m.x, 3), y: round(m.y, 3) }, ...pts.slice(i + 1)];
              useEditor.getState().updateElement(el.id, { points: next });
            }}
          >
            <Circle radius={r * 0.8} fill="rgba(255,255,255,0.85)" stroke="#1d6fd8" strokeWidth={r * 0.18} />
            <Text text="+" fontSize={r * 1.5} fill="#1d6fd8" width={r * 2} height={r * 2} offsetX={r} offsetY={r * 0.95} align="center" verticalAlign="middle" />
          </Group>
        );
      })}
      {pts.map((p, i) => (
        <Circle
          key={`v${i}`}
          x={p.x}
          y={p.y}
          radius={r}
          fill="#ffffff"
          stroke="#1d6fd8"
          strokeWidth={r * 0.3}
          draggable
          onMouseDown={(e) => {
            e.cancelBubble = true;
          }}
          onTouchStart={(e) => {
            e.cancelBubble = true;
          }}
          onDragStart={() => useEditor.getState().beginGesture()}
          onDragMove={(e) => {
            const q = snapPoint({ x: e.target.x(), y: e.target.y() });
            e.target.position(q);
            update(i, q);
          }}
          onDragEnd={(e) => {
            const q = snapPoint({ x: e.target.x(), y: e.target.y() });
            update(i, q);
            useEditor.getState().endGesture();
          }}
          onDblClick={(e) => {
            e.cancelBubble = true;
            if (pts.length > 2) useEditor.getState().updateElement(el.id, { points: pts.filter((_, k) => k !== i) });
          }}
          onDblTap={(e) => {
            e.cancelBubble = true;
            if (pts.length > 2) useEditor.getState().updateElement(el.id, { points: pts.filter((_, k) => k !== i) });
          }}
        />
      ))}
    </>
  );
}
