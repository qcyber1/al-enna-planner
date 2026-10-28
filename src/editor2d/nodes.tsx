import { memo, useLayoutEffect, useRef, type MutableRefObject } from 'react';
import { Group, Shape } from 'react-konva';
import type Konva from 'konva';
import type { PlanElement } from '../types/plan';
import { drawLocalElement, drawPolylineElement, type DrawOpts } from '../render2d/draw';
import { CATALOG_BY_KIND } from '../lib/catalog';
import { outlinePolygon } from '../lib/geometry';

export interface NodeHandlers {
  onPointerDown: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDblClick: (id: string) => void;
}

interface NodeProps {
  el: PlanElement;
  ppm: number;
  selected: boolean;
  issue: 'error' | 'warning' | null;
  night: boolean;
  draggable: boolean;
  listening: boolean;
  handlers: MutableRefObject<NodeHandlers>;
}

function nativeCtx(c: Konva.Context): CanvasRenderingContext2D {
  return (c as unknown as { _context: CanvasRenderingContext2D })._context;
}

/** عنصر مستطيل أو نقطي في المحرر */
export const RectNode = memo(function RectNode({ el, ppm, selected, issue, night, draggable, listening, handlers }: NodeProps) {
  const isPoint = CATALOG_BY_KIND[el.kind].geometry === 'point';
  const hitMin = 16 / ppm;
  const w = isPoint ? Math.max(el.width, hitMin) : el.width;
  const d = isPoint ? Math.max(el.depth, hitMin) : el.depth;
  const opts: DrawOpts = { ppm, selected, issue, night };
  return (
    <Group
      id={el.id}
      name="element"
      x={el.x}
      y={el.y}
      rotation={el.rotation}
      draggable={draggable}
      listening={listening}
      onMouseDown={(e) => handlers.current.onPointerDown(el.id, e)}
      onTouchStart={(e) => handlers.current.onPointerDown(el.id, e)}
      onDragStart={(e) => handlers.current.onDragStart(el.id, e)}
      onDragMove={(e) => handlers.current.onDragMove(el.id, e)}
      onDragEnd={(e) => handlers.current.onDragEnd(el.id, e)}
      onDblClick={() => handlers.current.onDblClick(el.id)}
      onDblTap={() => handlers.current.onDblClick(el.id)}
    >
      <Shape
        width={w}
        height={d}
        offsetX={w / 2}
        offsetY={d / 2}
        perfectDrawEnabled={false}
        sceneFunc={(c) => {
          const ctx = nativeCtx(c);
          ctx.save();
          ctx.translate(w / 2, d / 2);
          drawLocalElement(ctx, el, opts);
          ctx.restore();
        }}
        hitFunc={(c, s) => {
          c.beginPath();
          c.rect(0, 0, w, d);
          c.closePath();
          c.fillStrokeShape(s);
        }}
      />
    </Group>
  );
});

/** ممر أو سلسلة لمبات (نقاط مطلقة) */
export const PolylineNode = memo(function PolylineNode({
  el,
  ppm,
  selected,
  issue,
  night,
  draggable,
  listening,
  handlers,
}: NodeProps) {
  const ref = useRef<Konva.Group>(null);
  // بعد تحديث النقاط في المخزن نعيد موضع المجموعة إلى الصفر
  useLayoutEffect(() => {
    const g = ref.current;
    if (g && (g.x() !== 0 || g.y() !== 0)) {
      g.position({ x: 0, y: 0 });
      g.getLayer()?.batchDraw();
    }
  }, [el.points]);
  const opts: DrawOpts = { ppm, selected, issue, night };
  const pts = el.points ?? [];
  const hitWidth = el.kind === 'path' ? Math.max(el.path?.width ?? 1, 12 / ppm) : 14 / ppm;
  return (
    <Group
      ref={ref}
      id={el.id}
      name="element"
      x={0}
      y={0}
      draggable={draggable}
      listening={listening}
      onMouseDown={(e) => handlers.current.onPointerDown(el.id, e)}
      onTouchStart={(e) => handlers.current.onPointerDown(el.id, e)}
      onDragStart={(e) => handlers.current.onDragStart(el.id, e)}
      onDragMove={(e) => handlers.current.onDragMove(el.id, e)}
      onDragEnd={(e) => handlers.current.onDragEnd(el.id, e)}
      onDblClick={() => handlers.current.onDblClick(el.id)}
      onDblTap={() => handlers.current.onDblClick(el.id)}
    >
      <Shape
        perfectDrawEnabled={false}
        sceneFunc={(c) => {
          drawPolylineElement(nativeCtx(c), el, opts);
        }}
        hitFunc={(c, s) => {
          if (pts.length < 2) return;
          const outline = outlinePolygon(pts, hitWidth);
          c.beginPath();
          outline.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
          c.closePath();
          c.fillStrokeShape(s);
        }}
      />
    </Group>
  );
});
