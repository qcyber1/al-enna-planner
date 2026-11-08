import { useState } from 'react';
import { Search } from 'lucide-react';
import { CATALOG, CATEGORY_LABELS, CATEGORY_ORDER, IZBA_CATEGORY_ORDER, createElement, qiblaRotation, type CatalogItem } from '../lib/catalog';
import { getPlan, useEditor, usePlan } from '../store/editorStore';
import { landBounds } from '../lib/geometry';
import { DND_MIME } from '../editor2d/Editor2D';
import { useViewport } from '../editor2d/viewport';
import { cx } from './ui';
import type { PlanElement } from '../types/plan';
import { BUILDING_PRESETS, buildPreset, type BuildingPreset } from '../lib/buildings';
import { circlePath } from '../lib/angleAssist';

type Box = { minX: number; minY: number; maxX: number; maxY: number };
const half = (e: { width: number; depth: number; rotation: number }) => {
  const r = (e.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { hx: (e.width * c + e.depth * s) / 2, hy: (e.width * s + e.depth * c) / 2 };
};
/** أقرب نقطة (بخطوات نص متر بشكل حلزوني) ما يتداخل فيها العنصر مع غيره وداخل حدود الأرض */
export function freeSpot(el: PlanElement, others: PlanElement[], land: Box): { x: number; y: number } {
  const me = half(el);
  const boxes = others.filter((o) => !o.points).map((o) => ({ ...half(o), x: o.x, y: o.y }));
  const ok = (x: number, y: number) =>
    x - me.hx >= land.minX && x + me.hx <= land.maxX && y - me.hy >= land.minY && y + me.hy <= land.maxY &&
    boxes.every((o) => Math.abs(x - o.x) >= me.hx + o.hx + 0.5 || Math.abs(y - o.y) >= me.hy + o.hy + 0.5);
  if (!Number.isFinite(land.minX) || ok(el.x, el.y)) return { x: el.x, y: el.y };
  for (let r = 1; r <= 120; r++) {
    for (let i = -r; i <= r; i++) {
      for (const [dx, dy] of [[i, -r], [i, r], [-r, i], [r, i]]) {
        const x = el.x + dx * 0.5;
        const y = el.y + dy * 0.5;
        if (ok(x, y)) return { x, y };
      }
    }
  }
  return { x: el.x, y: el.y };
}

function addAtCenter(item: CatalogItem) {
  const st = useEditor.getState();
  if (item.geometry === 'polyline') {
    st.setTool(item.kind === 'path' ? 'path' : 'string-lights');
    if (st.view === '3d') st.setView('2d');
    st.toast(item.kind === 'path' ? 'ارسم الممر: انقر نقطة البداية ثم الزوايا، وانقر مرتين للإنهاء' : 'انقر على الأعمدة لتعليق السلسلة، وانقر مرتين للإنهاء', 'info');
    return;
  }
  const plan = getPlan();
  const b = landBounds(plan.land);
  const vp = useViewport.getState();
  let p = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const host = document.querySelector('[data-testid="editor-2d"]');
  if (host && st.view !== '3d') {
    p = { x: (host.clientWidth / 2 - vp.x) / vp.scale, y: (host.clientHeight / 2 - vp.y) / vp.scale };
  }
  const el = createElement(item.kind, { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 }, item.kind === 'prayer-area' ? { rotation: qiblaRotation(plan.land.northAngle) } : {});
  // ندوّر له أقرب مكان فاضي عشان ما ينحط فوق شي ثاني
  const spot = freeSpot(el, plan.elements, b);
  el.x = spot.x;
  el.y = spot.y;
  st.setTool('select');
  st.addElement(el);
  st.toast(`تمت إضافة «${el.name}» — اضغط عليه واسحبه لمكانه`, 'success');
}

/** مبنى جاهز (غرف + أثاث) في وسط الشاشة، بمكان فاضي */
export function addBuilding(id: BuildingPreset['id']) {
  const st = useEditor.getState();
  const preset = BUILDING_PRESETS.find((b) => b.id === id)!;
  const plan = getPlan();
  const b = landBounds(plan.land);
  const vp = useViewport.getState();
  let p = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const host = document.querySelector('[data-testid="editor-2d"]');
  if (host && st.view !== '3d') p = { x: (host.clientWidth / 2 - vp.x) / vp.scale, y: (host.clientHeight / 2 - vp.y) / vp.scale };
  // نلقى مكان فاضي بحجم المبنى كامل
  const probe = createElement('room', { x: Math.round(p.x), y: Math.round(p.y) }, { width: preset.width, depth: preset.depth });
  const spot = freeSpot(probe, plan.elements, b);
  const els = buildPreset(id, Math.round((spot.x - preset.width / 2) * 2) / 2, Math.round((spot.y - preset.depth / 2) * 2) / 2);
  st.setTool('select');
  st.addElements(els);
  st.toast(`تمت إضافة «${preset.title}» — اضغط أي غرفة وغيّر نوعها وتشطيبها، أو شوف الداخل من 3D`, 'success');
}

/** دائرة حشيش كاملة (مثلاً تحت جلسة دائرية) — نصف القطر يتعدل من الخصائص */
export function addCircleGrass(center?: { x: number; y: number }, r = 3) {
  const st = useEditor.getState();
  const plan = getPlan();
  const b = landBounds(plan.land);
  let c = center ?? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const host = document.querySelector('[data-testid="editor-2d"]');
  if (!center && host && st.view !== '3d') {
    const vp = useViewport.getState();
    c = { x: (host.clientWidth / 2 - vp.x) / vp.scale, y: (host.clientHeight / 2 - vp.y) / vp.scale };
  }
  if (!center) {
    const probe = createElement('majlis-rug', { x: Math.round(c.x * 2) / 2, y: Math.round(c.y * 2) / 2 }, { width: r * 2, depth: r * 2 });
    c = freeSpot(probe, plan.elements, b);
  }
  const g = circlePath(c, r, true, 2);
  const n = plan.elements.filter((e) => e.path?.circle).length + 1;
  const el = createElement('path', g.points[0], { points: g.points, name: `حشيش دائري ${n}` });
  el.path = { ...el.path!, material: 'turf', width: g.width, circle: { r, filled: true } };
  st.setTool('select');
  st.addElement(el);
  // الحشيش أرضية: ينرسم تحت باقي العناصر
  st.reorder(el.id, 'back');
  st.toast(`تمت إضافة «${el.name}» — كبّرها أو صغّرها من الخصائص، أو خلها حلقة`, 'success');
}

export function Library({ onPicked, sheet }: { onPicked?: () => void; sheet?: boolean }) {
  const [q, setQ] = useState('');
  const izba = usePlan().land.site === 'izba';
  const items = CATALOG.filter((c) => (izba || !c.izbaOnly) && (!q || c.label.includes(q) || c.description.includes(q)));
  const order = izba ? IZBA_CATEGORY_ORDER : CATEGORY_ORDER;
  return (
    <div className="flex h-full flex-col">
      <div className={sheet ? 'border-b border-sand-200 px-3 pb-2' : 'border-b border-sand-200 p-3'}>
        {!sheet && <h2 className="mb-2 text-sm font-bold text-dune">{izba ? 'مكتبة عناصر العزبة' : 'مكتبة عناصر العنة'}</h2>}
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute top-2.5 right-2.5 text-sand-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن عنصر…"
            className="h-9 w-full rounded-lg border border-sand-300 bg-white pr-8 pl-2 text-base outline-none focus:border-gold-500 sm:text-sm"
          />
        </div>
        {!sheet && <p className="mt-2 text-[11px] leading-relaxed text-sand-600">اسحب العنصر إلى المخطط أو انقر عليه لإضافته في منتصف العرض.</p>}
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-2">
        {order.map((cat) => {
          const list = items.filter((i) => i.category === cat);
          if (!list.length) return null;
          return (
            <div key={cat} className="mb-3">
              <div className="mb-1.5 px-1 text-[11px] font-bold tracking-wide text-sand-600">{CATEGORY_LABELS[cat]}</div>
              {cat === 'building' && !q && (
                <div className="mb-1.5 grid gap-1.5">
                  {BUILDING_PRESETS.map((bp) => (
                    <button
                      key={bp.id}
                      type="button"
                      onClick={() => {
                        addBuilding(bp.id);
                        onPicked?.();
                      }}
                      data-testid={`lib-building-${bp.id}`}
                      className="flex items-center gap-2 rounded-xl border border-gold-500/60 bg-gold-50 p-2 text-right transition hover:border-gold-500 hover:shadow-sm"
                    >
                      <span className="text-xl leading-none">🏠</span>
                      <span>
                        <span className="block text-[12px] font-bold leading-tight text-dune">{bp.title} ({bp.width}×{bp.depth} م)</span>
                        <span className="block text-[10px] leading-tight text-sand-600">{bp.blurb}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className={sheet ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-2 gap-1.5'}>
                {list.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    draggable={item.geometry !== 'polyline'}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DND_MIME, item.kind);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => {
                      addAtCenter(item);
                      onPicked?.();
                    }}
                    title={item.description}
                    data-testid={`lib-${item.kind}`}
                    className={cx(
                      'group flex flex-col items-start gap-0.5 rounded-xl border border-sand-200 bg-white p-2 text-right transition hover:border-gold-500 hover:shadow-sm active:scale-[0.98]',
                      item.geometry !== 'polyline' && 'cursor-grab',
                    )}
                  >
                    <span className="text-xl leading-none">{item.icon}</span>
                    <span className="text-[12px] font-semibold leading-tight text-dune">{item.label}</span>
                    <span className="text-[10px] leading-tight text-sand-600">
                      {item.geometry === 'polyline'
                        ? item.kind === 'path'
                          ? 'ارسم من نقطة لنقطة'
                          : 'بين الأعمدة'
                        : item.geometry === 'point'
                          ? `ارتفاع ${item.defaults.light?.mountHeight ?? item.defaults.height} م`
                          : `${item.defaults.width} × ${item.defaults.depth} م`}
                    </span>
                  </button>
                ))}
                {cat === 'paths' && (!q || 'حشيش دائري دائرة'.includes(q) || q.includes('دائر')) && (
                  <button
                    type="button"
                    onClick={() => {
                      addCircleGrass();
                      onPicked?.();
                    }}
                    data-testid="lib-circle-grass"
                    className="group flex flex-col items-start gap-0.5 rounded-xl border border-sand-200 bg-white p-2 text-right transition hover:border-gold-500 hover:shadow-sm active:scale-[0.98]"
                  >
                    <span className="text-xl leading-none">🟢</span>
                    <span className="text-[12px] font-semibold leading-tight text-dune">حشيش دائري</span>
                    <span className="text-[10px] leading-tight text-sand-600">لجلسة دائرية • قطر 6 م</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
