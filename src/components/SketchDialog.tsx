// «📷 أرضي من الكروكي»: صوّر مخطط البلدية أو الكروكي ← حدد ضلع تعرف طوله ← انقر زوايا الأرض ← تصير أرضك بشكلها الحقيقي والصورة تحتها
import { useRef, useState } from 'react';
import type { Land, Plan, Vec2 } from '../types/plan';
import { useEditor, usePlan } from '../store/editorStore';
import { useViewport } from '../editor2d/viewport';
import { Button, Modal, NumberInput, Field } from './ui';

type Step = 'pick' | 'scale' | 'corners';

/** نصغّر الصورة (1600 بكسل بالكثير، JPEG) عشان تنحفظ مع المشروع بدون ما تثقله */
async function loadImage(file: File): Promise<{ src: string; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = bad;
      i.src = url;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return { src: c.toDataURL('image/jpeg', 0.72), w: c.width, h: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** من بكسلات الصورة لأرض بالمتر (أول نقطة فوق يسار = 0) ومكان الصورة تحتها */
export function sketchToLand(base: Land, corners: Vec2[], mpp: number): { land: Land; underlay: { x: number; y: number; scale: number } } {
  const minX = Math.min(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y));
  const poly = corners.map((p) => ({ x: Math.round((p.x - minX) * mpp * 100) / 100, y: Math.round((p.y - minY) * mpp * 100) / 100 }));
  const width = Math.max(...poly.map((p) => p.x));
  const depth = Math.max(...poly.map((p) => p.y));
  const e0 = Math.hypot(poly[1].x - poly[0].x, poly[1].y - poly[0].y);
  return {
    land: { ...base, shape: 'polygon', polygon: poly, width: Math.round(width * 10) / 10, depth: Math.round(depth * 10) / 10, entrance: { ...base.entrance, edge: 0, offset: Math.round((e0 / 2) * 10) / 10, width: Math.min(base.entrance.width, Math.max(1, e0 / 3)) } },
    underlay: { x: -minX * mpp, y: -minY * mpp, scale: mpp },
  };
}

export function SketchDialog() {
  const open = useEditor((s) => s.dialog === 'sketch');
  if (!open) return null;
  return <Body />;
}

function Body() {
  const openDialog = useEditor((s) => s.openDialog);
  const plan = usePlan();
  const [img, setImg] = useState<{ src: string; w: number; h: number } | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [scalePts, setScalePts] = useState<Vec2[]>([]);
  const [len, setLen] = useState(50);
  const [corners, setCorners] = useState<Vec2[]>([]);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr('');
    try {
      setImg(await loadImage(f));
      setStep('scale');
      setScalePts([]);
      setCorners([]);
    } catch {
      setErr('ما قدرنا نفتح الصورة — جرّب صورة ثانية (JPG أو PNG)');
    }
  };
  const tap = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!img || !imgRef.current) return;
    // الصورة معروضة object-contain: نحسب الفراغ حولها عشان النقرة تطيح بالمكان الصح
    const r = imgRef.current.getBoundingClientRect();
    const k = Math.min(r.width / img.w, r.height / img.h);
    const ox = r.left + (r.width - img.w * k) / 2;
    const oy = r.top + (r.height - img.h * k) / 2;
    const p = { x: (e.clientX - ox) / k, y: (e.clientY - oy) / k };
    if (p.x < 0 || p.y < 0 || p.x > img.w || p.y > img.h) return;
    if (step === 'scale') setScalePts((s) => (s.length >= 2 ? [p] : [...s, p]));
    else if (step === 'corners') {
      // نقرة قريبة من أول نقطة = سكّر الشكل
      if (corners.length >= 3 && Math.hypot(p.x - corners[0].x, p.y - corners[0].y) < Math.max(img.w, img.h) * 0.03) return apply();
      setCorners((c) => [...c, p]);
    }
  };
  const mpp = scalePts.length === 2 ? len / Math.max(1, Math.hypot(scalePts[1].x - scalePts[0].x, scalePts[1].y - scalePts[0].y)) : 0;
  const apply = (cs = corners) => {
    if (!img || cs.length < 3 || !mpp) return;
    const r = sketchToLand(plan.land, cs, mpp);
    const st = useEditor.getState();
    st.setPlan((p: Plan) => ({ ...p, land: r.land, underlay: { src: img.src, ...r.underlay, opacity: 0.55, show: true } }));
    openDialog(null);
    setTimeout(() => useViewport.getState().requestFit(), 60);
    st.toast(`أرضك صارت بشكلها من الكروكي (${r.land.width} × ${r.land.depth} م تقريباً) — الصورة تحت المخطط وتقدر تخفيها من «تعديل الأرض»`, 'success');
  };
  const sizeTxt = (a: Vec2, b: Vec2) => (mpp ? `${Math.round(Math.hypot(b.x - a.x, b.y - a.y) * mpp * 10) / 10} م` : '');
  const pt = (p: Vec2) => ({ cx: p.x, cy: p.y });
  const R = img ? Math.max(img.w, img.h) * 0.012 : 6;

  return (
    <Modal
      open
      onClose={() => openDialog(null)}
      wide
      title="📷 أرضي من الكروكي"
      footer={
        <>
          <Button onClick={() => openDialog(null)}>إلغاء</Button>
          {step === 'scale' && (
            <Button variant="gold" disabled={scalePts.length < 2 || !(len > 0)} onClick={() => setStep('corners')} data-testid="sketch-next">
              التالي ← زوايا الأرض
            </Button>
          )}
          {step === 'corners' && (
            <>
              <Button disabled={!corners.length} onClick={() => setCorners((c) => c.slice(0, -1))}>تراجع</Button>
              <Button variant="gold" disabled={corners.length < 3} onClick={() => apply()} data-testid="sketch-apply">
                ✓ تم — طبّق على أرضي
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-3 p-4" data-testid="sketch">
        <ol className="flex gap-1 text-[12px] font-bold">
          {(
            [
              ['pick', '١ الصورة'],
              ['scale', '٢ ضلع معروف'],
              ['corners', '٣ زوايا الأرض'],
            ] as const
          ).map(([k, l]) => (
            <li key={k} className={`flex-1 rounded-lg px-2 py-1 text-center ${step === k ? 'bg-gold-500 text-dune' : 'bg-sand-100 text-sand-600'}`}>
              {l}
            </li>
          ))}
        </ol>
        {step === 'pick' && (
          <div className="space-y-2 text-center">
            <p className="text-[13px] text-sand-700">صوّر مخطط الأرض من البلدية، أو الكروكي، أو حتى رسمة بيدك — وأرضك تطلع بشكلها الحقيقي.</p>
            <Button variant="gold" onClick={() => fileRef.current?.click()} data-testid="sketch-pick">
              📷 اختار صورة / صوّر
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="sketch-file" onChange={(e) => void pick(e.target.files?.[0])} />
            {err && <p className="text-sm text-red-700">{err}</p>}
          </div>
        )}
        {img && step !== 'pick' && (
          <>
            <p className="rounded-lg bg-sand-50 p-2 text-[13px] text-dune">
              {step === 'scale' ? '👆 انقر على طرفين ضلع تعرف طوله (مثلاً واجهة الأرض)، واكتب طوله تحت.' : '👆 انقر على زوايا الأرض بالترتيب (يمين أو يسار ما يفرق)، وارجع لأول زاوية أو اضغط «تم».'}
            </p>
            {step === 'scale' && (
              <Field label="طول هالضلع">
                <NumberInput value={len} min={1} max={1000} step={1} digits={1} unit="م" onChange={setLen} />
              </Field>
            )}
            <div className="relative overflow-hidden rounded-xl border border-sand-300 bg-sand-100">
              <img ref={imgRef} src={img.src} alt="الكروكي" onClick={tap} className="block max-h-[55vh] w-full cursor-crosshair object-contain" data-testid="sketch-img" />
              <svg viewBox={`0 0 ${img.w} ${img.h}`} className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
                {step === 'scale' && scalePts.length === 2 && <line x1={scalePts[0].x} y1={scalePts[0].y} x2={scalePts[1].x} y2={scalePts[1].y} stroke="#d4a24c" strokeWidth={R * 0.6} />}
                {step === 'scale' && scalePts.map((p, i) => <circle key={i} {...pt(p)} r={R} fill="#d4a24c" stroke="#3b2a1e" strokeWidth={R * 0.25} />)}
                {step === 'corners' && corners.length > 1 && <polyline points={corners.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgba(212,162,76,0.18)" stroke="#8f2a2a" strokeWidth={R * 0.5} />}
                {step === 'corners' &&
                  corners.map((p, i) => (
                    <g key={i}>
                      <circle {...pt(p)} r={R} fill={i ? '#8f2a2a' : '#2f8f5b'} stroke="#fff" strokeWidth={R * 0.25} />
                      {i > 0 && (
                        <text x={(p.x + corners[i - 1].x) / 2} y={(p.y + corners[i - 1].y) / 2} fontSize={R * 2.2} fill="#3b2a1e" stroke="#fff" strokeWidth={R * 0.3} paintOrder="stroke" textAnchor="middle">
                          {sizeTxt(corners[i - 1], p)}
                        </text>
                      )}
                    </g>
                  ))}
              </svg>
            </div>
            {step === 'corners' && (
              // مكانه محجوز من البداية عشان الصورة ما تتحرك وقت النقر
              <p className="min-h-[1.25rem] text-[12px] text-sand-600">{corners.length >= 3 && mpp > 0 ? `الضلع الأخير (يرجع لأول زاوية): ${sizeTxt(corners[corners.length - 1], corners[0])}` : `${corners.length} زوايا`}</p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
