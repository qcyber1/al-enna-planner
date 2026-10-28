import { useState } from 'react';
import { Search } from 'lucide-react';
import { CATALOG, CATEGORY_LABELS, CATEGORY_ORDER, createElement, type CatalogItem } from '../lib/catalog';
import { getPlan, useEditor } from '../store/editorStore';
import { landBounds } from '../lib/geometry';
import { DND_MIME } from '../editor2d/Editor2D';
import { useViewport } from '../editor2d/viewport';
import { cx } from './ui';

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
  const n = plan.elements.filter((e) => e.kind === item.kind).length;
  const el = createElement(item.kind, { x: Math.round(p.x * 2) / 2 + (n % 4) * 0.5, y: Math.round(p.y * 2) / 2 + (n % 4) * 0.5 });
  st.setTool('select');
  st.addElement(el);
  st.toast(`تمت إضافة «${el.name}» — اسحبه إلى مكانه`, 'success');
}

export function Library({ onPicked }: { onPicked?: () => void }) {
  const [q, setQ] = useState('');
  const items = CATALOG.filter((c) => !q || c.label.includes(q) || c.description.includes(q));
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sand-200 p-3">
        <h2 className="mb-2 text-sm font-bold text-dune">مكتبة عناصر العنة</h2>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute top-2.5 right-2.5 text-sand-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن عنصر…"
            className="h-9 w-full rounded-lg border border-sand-300 bg-white pr-8 pl-2 text-sm outline-none focus:border-gold-500"
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-sand-600">اسحب العنصر إلى المخطط أو انقر عليه لإضافته في منتصف العرض.</p>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto p-2">
        {CATEGORY_ORDER.map((cat) => {
          const list = items.filter((i) => i.category === cat);
          if (!list.length) return null;
          return (
            <div key={cat} className="mb-3">
              <div className="mb-1.5 px-1 text-[11px] font-bold tracking-wide text-sand-600">{CATEGORY_LABELS[cat]}</div>
              <div className="grid grid-cols-2 gap-1.5">
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
