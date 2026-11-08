import { AlertTriangle, Copy, Lock, Trash2, Unlock, ArrowUpToLine, ArrowDownToLine, RotateCcw, RotateCw, Plus, Ruler, Wand2 } from 'lucide-react';
import type { FloorFinish, PlanElement, RoomType, Side, WallFinish } from '../types/plan';
import { getPlan, useEditor, usePlan } from '../store/editorStore';
import { useValidation } from '../hooks/useDerived';
import { FixButton, runFixAll } from './FixButton';
import { circlePath, polyCenter } from '../lib/angleAssist';
import { addCircleGrass } from './Library';
import {
  CATALOG_BY_KIND,
  COURT_SURFACE_LABELS,
  INTERIOR_LABELS,
  LIGHT_COLOR_LABELS,
  PATH_MATERIAL_LABELS,
  SIDE_LABELS,
  TENT_STYLE_LABELS,
  createElement,
  qiblaRotation,
  ROOF_COLORS,
  ROOF_KINDS,
  ROOM_TYPE_LABELS,
  ROOM_PRESETS,
  FLOOR_LABELS,
  WALL_LABELS,
} from '../lib/catalog';
import { roomNetArea } from '../lib/rooms';
import {
  dist,
  elementCenter,
  elementShapes,
  entranceInfo,
  formatArea,
  formatMeters,
  landArea,
  landBounds,
  normalizeAngle,
  polylineLength,
  round,
  shapesDistance,
} from '../lib/geometry';
import { estimateWoodTurf, DEFAULT_ESTIMATE, tentCapacity } from '../lib/quantities';
import { aimRotation } from '../lib/sample';
import { stringBulbs } from '../lib/lighting';
import { windNotes, type WindNote } from '../lib/wind';
import { useMemo } from 'react';
import { Button, ColorInput, Field, NumberInput, Section, Select, TextInput, Toggle, cx } from './ui';

function useEl(): PlanElement[] {
  const plan = usePlan();
  const sel = useEditor((s) => s.selection);
  return plan.elements.filter((e) => sel.includes(e.id));
}

export function PropertiesPanel() {
  const els = useEl();
  if (els.length === 0) return <NothingSelected />;
  if (els.length > 1) return <MultiSelected els={els} />;
  return <SingleElement key={els[0].id} el={els[0]} />;
}

function NothingSelected() {
  const plan = usePlan();
  const v = useValidation();
  const select = useEditor((s) => s.select);
  const openDialog = useEditor((s) => s.openDialog);
  const removeMeasurement = useEditor((s) => s.removeMeasurement);
  const b = landBounds(plan.land);
  return (
    <div>
      <Section title="الأرض" actions={<Button size="sm" onClick={() => openDialog('land')}>تعديل الأرض</Button>}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-white p-2">
            <div className="text-[11px] text-sand-600">المقاس</div>
            <div className="font-bold tabular-nums">{round(b.maxX - b.minX, 2)} × {round(b.maxY - b.minY, 2)} م</div>
          </div>
          <div className="rounded-lg bg-white p-2">
            <div className="text-[11px] text-sand-600">المساحة</div>
            <div className="font-bold tabular-nums">{formatArea(landArea(plan.land), 0)}</div>
          </div>
        </div>
        <p className="text-[12px] leading-relaxed text-sand-700">اختر أي عنصر من المخطط لتعديل أبعاده وموقعه ودورانه وألوانه. استخدم Shift لتحديد عدة عناصر أو اسحب مستطيل تحديد.</p>
      </Section>
      <Section title={`التنبيهات (${v.issues.length})`}>
        {v.issues.length === 0 ? (
          <div className="rounded-lg bg-turf-500/10 p-2.5 text-[13px] text-turf-700">✓ ما في تداخلات ولا شي طالع برا السور</div>
        ) : (
          <ul className="space-y-1.5">
            {v.issues.length > 1 && (
              <li>
                <button type="button" onClick={runFixAll} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-dune py-2 text-[12px] font-bold text-sand-50 active:scale-95" data-testid="fix-all">
                  <Wand2 size={14} /> أصلح الكل تلقائياً
                </button>
              </li>
            )}
            {v.issues.slice(0, 40).map((i) => (
              <li
                key={i.id}
                className={cx('flex items-start gap-1.5 rounded-lg p-2 text-[12px] leading-snug', i.severity === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900')}
              >
                <button type="button" onClick={() => select(i.elementIds.slice(0, 1))} className="flex min-w-0 flex-1 items-start gap-2 text-right">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {i.message}
                </button>
                <FixButton issue={i} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      <WindSection />
      <Section title={`القياسات (${plan.measurements.length})`}>
        {plan.measurements.length === 0 && <p className="text-[12px] text-sand-600">استخدم أداة القياس <Ruler size={12} className="inline" /> لقياس أي مسافة على المخطط.</p>}
        {plan.measurements.map((m, i) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 text-sm">
            <span>قياس {i + 1}: <b className="tabular-nums">{formatMeters(dist(m.a, m.b))}</b></span>
            <button type="button" onClick={() => removeMeasurement(m.id)} className="text-red-700" aria-label="حذف القياس">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </Section>
    </div>
  );
}

function MultiSelected({ els }: { els: PlanElement[] }) {
  const st = useEditor.getState();
  const ids = els.map((e) => e.id);
  const allLocked = els.every((e) => e.locked);
  const align = (mode: 'left' | 'right' | 'top' | 'bottom' | 'cx' | 'cy') => {
    const rect = els.filter((e) => !e.points && !e.locked);
    if (rect.length < 2) return;
    const xs = rect.map((e) => e.x);
    const ys = rect.map((e) => e.y);
    const patches: Record<string, Partial<PlanElement>> = {};
    for (const e of rect) {
      if (mode === 'left') patches[e.id] = { x: Math.min(...xs) };
      if (mode === 'right') patches[e.id] = { x: Math.max(...xs) };
      if (mode === 'cx') patches[e.id] = { x: round(xs.reduce((a, b) => a + b, 0) / xs.length, 3) };
      if (mode === 'top') patches[e.id] = { y: Math.min(...ys) };
      if (mode === 'bottom') patches[e.id] = { y: Math.max(...ys) };
      if (mode === 'cy') patches[e.id] = { y: round(ys.reduce((a, b) => a + b, 0) / ys.length, 3) };
    }
    st.updateElements(patches);
  };
  return (
    <div>
      <Section title={`${els.length} عناصر محددة`}>
        <p className="text-[12px] text-sand-700">اسحب أي عنصر منها لتحريكها معاً، أو استخدم الأسهم في لوحة المفاتيح (Shift للتحريك بمتر).</p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => st.duplicateElements(ids)}><Copy size={15} /> نسخ</Button>
          <Button onClick={() => st.setLocked(ids, !allLocked)}>{allLocked ? <Unlock size={15} /> : <Lock size={15} />} {allLocked ? 'فك القفل' : 'قفل'}</Button>
          <Button onClick={() => st.rotateElements(ids, -90)}><RotateCcw size={15} /> 90°−</Button>
          <Button onClick={() => st.rotateElements(ids, 90)}><RotateCw size={15} /> 90°+</Button>
          <Button variant="danger" className="col-span-2" onClick={() => st.removeElements(ids)}><Trash2 size={15} /> حذف المحدد</Button>
        </div>
      </Section>
      <Section title="محاذاة">
        <div className="grid grid-cols-3 gap-1.5">
          <Button size="sm" onClick={() => align('right')}>يمين</Button>
          <Button size="sm" onClick={() => align('cx')}>وسط أفقي</Button>
          <Button size="sm" onClick={() => align('left')}>يسار</Button>
          <Button size="sm" onClick={() => align('top')}>أعلى</Button>
          <Button size="sm" onClick={() => align('cy')}>وسط رأسي</Button>
          <Button size="sm" onClick={() => align('bottom')}>أسفل</Button>
        </div>
      </Section>
      <Section title="العناصر">
        <ul className="space-y-1 text-sm">
          {els.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded bg-white px-2 py-1">
              <span>{CATALOG_BY_KIND[e.kind].icon} {e.name}</span>
              {e.locked && <Lock size={13} className="text-sand-600" />}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function SingleElement({ el }: { el: PlanElement }) {
  const plan = usePlan();
  const v = useValidation();
  const st = useEditor.getState();
  const cat = CATALOG_BY_KIND[el.kind];
  const upd = (patch: Partial<PlanElement>, key?: string) => st.updateElement(el.id, patch, { mergeKey: key ? `${el.id}:${key}` : undefined });
  const dis = el.locked;
  const issues = v.byElement.get(el.id) ?? [];
  const wind = useMemo(() => windNotes(plan).find((n) => n.elementId === el.id), [plan, el.id]);
  const lb = landBounds(plan.land);

  // المسافات
  const shapes = elementShapes(el);
  const ent = entranceInfo(plan.land);
  const center = elementCenter(el);
  const distances: { label: string; value: string }[] = [];
  distances.push({ label: 'إلى المدخل الرئيسي', value: formatMeters(dist(center, ent.center), 1) });
  const findNearest = (pred: (e: PlanElement) => boolean, label: string) => {
    if (!shapes.length) return;
    let best = Infinity;
    let name = '';
    for (const o of plan.elements) {
      if (o.id === el.id || !pred(o)) continue;
      const os = elementShapes(o);
      if (!os.length) continue;
      const d = shapesDistance(shapes, os).dist;
      if (d < best) {
        best = d;
        name = o.name;
      }
    }
    if (Number.isFinite(best)) distances.push({ label: `${label} (${name})`, value: formatMeters(best, 2) });
  };
  if (el.kind !== 'main-tent') findNearest((o) => o.kind === 'main-tent', 'إلى الخيمة الرئيسية');
  if (el.kind !== 'volleyball') findNearest((o) => o.kind === 'volleyball', 'إلى الملعب');
  findNearest((o) => CATALOG_BY_KIND[o.kind].collision !== 'none' && CATALOG_BY_KIND[o.kind].collision !== 'path', 'أقرب عنصر');

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-sand-200 bg-white px-4 py-3">
        <span className="text-2xl">{cat.icon}</span>
        <div className="min-w-0 flex-1">
          <TextInput value={el.name} onCommit={(n) => n.trim() && upd({ name: n.trim().slice(0, 80) })} ariaLabel="اسم العنصر" />
          <div className="mt-0.5 text-[11px] text-sand-600">{cat.label}</div>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="space-y-1 border-b border-sand-200 px-4 py-2">
          {issues.map((i) => (
            <div key={i.id} className={cx('flex gap-1.5 rounded-lg p-2 text-[12px]', i.severity === 'error' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900')}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span className="flex-1">{i.message}</span>
              <FixButton issue={i} />
            </div>
          ))}
        </div>
      )}

      {wind && (
        <div className="border-b border-sand-200 px-4 py-2" data-testid="wind-note-el">
          <WindNoteRow note={wind} disabled={dis} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 border-b border-sand-200 px-4 py-2.5">
        <Button size="sm" variant={el.locked ? 'gold' : 'secondary'} onClick={() => st.setLocked([el.id], !el.locked)} data-testid="lock-toggle">
          {el.locked ? <Lock size={14} /> : <Unlock size={14} />} {el.locked ? 'مقفل' : 'قفل'}
        </Button>
        <Button size="sm" onClick={() => st.duplicateElements([el.id])}><Copy size={14} /> نسخ</Button>
        <Button size="sm" onClick={() => st.reorder(el.id, 'front')} title="إلى الأمام"><ArrowUpToLine size={14} /></Button>
        <Button size="sm" onClick={() => st.reorder(el.id, 'back')} title="إلى الخلف"><ArrowDownToLine size={14} /></Button>
        <Button size="sm" variant="danger" disabled={el.locked} onClick={() => st.removeElements([el.id])}><Trash2 size={14} /> حذف</Button>
        {!el.points && (
          <Button size="sm" onClick={() => addCircleGrass({ x: el.x, y: el.y }, round(Math.max(el.width, el.depth) / 2 + 1, 1))} data-testid="circle-under">
            🟢 حشيش دائري تحته
          </Button>
        )}
      </div>

      {cat.geometry !== 'polyline' && (
        <Section title="الموقع والدوران">
          <div className="grid grid-cols-2 gap-2">
            <Field label="X من الحافة اليسرى"><NumberInput value={el.x - lb.minX} onChange={(x) => upd({ x: round(x + lb.minX, 3) }, 'x')} unit="م" disabled={dis} /></Field>
            <Field label="Y من الحافة العلوية"><NumberInput value={el.y - lb.minY} onChange={(y) => upd({ y: round(y + lb.minY, 3) }, 'y')} unit="م" disabled={dis} /></Field>
          </div>
          <Field label="الدوران">
            <div className="flex gap-1">
              <Button size="sm" disabled={dis} onClick={() => upd({ rotation: normalizeAngle(el.rotation - 90) })}>90−</Button>
              <Button size="sm" disabled={dis} onClick={() => upd({ rotation: normalizeAngle(el.rotation - 15) })}>15−</Button>
              <NumberInput value={el.rotation} onChange={(r) => upd({ rotation: normalizeAngle(r) }, 'rot')} unit="°" step={1} digits={1} disabled={dis} className="flex-1" />
              <Button size="sm" disabled={dis} onClick={() => upd({ rotation: normalizeAngle(el.rotation + 15) })}>15+</Button>
              <Button size="sm" disabled={dis} onClick={() => upd({ rotation: normalizeAngle(el.rotation + 90) })}>90+</Button>
            </div>
          </Field>
        </Section>
      )}

      {cat.geometry === 'rect' && (
        <Section title="الأبعاد">
          <div className="grid grid-cols-3 gap-2">
            <Field label="الطول"><NumberInput value={el.width} min={cat.minSize} max={200} onChange={(w) => upd({ width: w }, 'w')} unit="م" disabled={dis} /></Field>
            <Field label="العرض"><NumberInput value={el.depth} min={cat.minSize} max={200} onChange={(d) => upd({ depth: d }, 'd')} unit="م" disabled={dis} /></Field>
            <Field label={el.kind === 'volleyball' ? 'ارتفاع الشبكة' : 'الارتفاع'}>
              <NumberInput
                value={el.kind === 'volleyball' ? (el.court?.netHeight ?? 2.43) : el.height}
                min={0.1}
                max={30}
                onChange={(h) => (el.kind === 'volleyball' && el.court ? upd({ court: { ...el.court, netHeight: h }, height: h }, 'h') : upd({ height: h }, 'h'))}
                unit="م"
                disabled={dis}
              />
            </Field>
          </div>
          <div className="text-[12px] text-sand-700">المساحة: <b>{formatArea(el.width * el.depth)}</b></div>
        </Section>
      )}

      {el.tent && <TentSection el={el} upd={upd} />}
      {el.court && <CourtSection el={el} upd={upd} />}
      {el.path && <PathSection el={el} upd={upd} />}
      {el.light && <LightSection el={el} upd={upd} />}
      {el.parking && (
        <Section title="المواقف">
          <Field label="عدد المواقف"><NumberInput value={el.parking.slots} min={1} max={60} step={1} digits={0} onChange={(n) => upd({ parking: { ...el.parking!, slots: Math.round(n) }, width: round(Math.round(n) * 2.7, 2) }, 'slots')} /></Field>
          <Toggle label="إظهار سيارات توضيحية" checked={el.parking.showCars} onChange={(c) => upd({ parking: { ...el.parking!, showCars: c } })} />
        </Section>
      )}
      {el.kind === 'prayer-area' && (
        <Section title="المصلّى">
          <p className="text-[12px] text-sand-700">المحراب يتجه للقبلة (حوالي 255° من الشمال في قطر) حسب اتجاه الشمال المحدد للأرض.</p>
          <Button size="sm" variant="gold" disabled={dis} onClick={() => upd({ rotation: qiblaRotation(plan.land.northAngle) })}>🕋 وجّه للقبلة</Button>
        </Section>
      )}
      {el.furniture && (
        <Section title="الكراسي">
          <Field label="عدد الكراسي"><NumberInput value={el.furniture.seats} min={0} max={20} step={1} digits={0} onChange={(n) => upd({ furniture: { seats: Math.round(n) } }, 'seats')} /></Field>
        </Section>
      )}

      {el.room && <RoomSection el={el} upd={upd} dis={dis} />}
      {ROOF_KINDS.has(el.kind) && (
        <Section title="لون السقف (كيربي)">
          <div className="flex flex-wrap gap-1.5" data-testid="roof-colors">
            {ROOF_COLORS.map((r) => (
              <button
                key={r.color}
                type="button"
                disabled={dis}
                onClick={() => upd({ roof: r.color }, 'roof')}
                title={r.label}
                className={cx('flex h-9 items-center gap-1.5 rounded-lg border px-2 text-[12px] font-semibold', el.roof === r.color ? 'border-gold-500 ring-2 ring-gold-500/30' : 'border-sand-300')}
              >
                <span className="h-4 w-4 rounded" style={{ background: r.color }} /> {r.label}
              </button>
            ))}
            {el.roof && (
              <button type="button" disabled={dis} onClick={() => upd({ roof: undefined }, 'roof')} className="h-9 rounded-lg border border-sand-300 px-2 text-[12px] text-sand-700">بدون</button>
            )}
          </div>
        </Section>
      )}
      {el.kind !== 'string-lights' && (
        <Section title="الألوان">
          <ColorInput label="اللون الأساسي" value={el.color} onChange={(c) => upd({ color: c }, 'color')} />
          <ColorInput label="اللون الثانوي / الزخرفة" value={el.accent} onChange={(c) => upd({ accent: c }, 'accent')} />
        </Section>
      )}

      <Section title="المسافات">
        {distances.map((d) => (
          <div key={d.label} className="flex items-center justify-between text-[13px]">
            <span className="text-sand-700">{d.label}</span>
            <b className="tabular-nums">{d.value}</b>
          </div>
        ))}
        <Toggle label="مسموح خارج حدود الأرض" checked={!!el.allowOutside} onChange={(c) => upd({ allowOutside: c || undefined })} />
      </Section>
    </div>
  );
}

type Upd = (patch: Partial<PlanElement>, key?: string) => void;

function TentSection({ el, upd }: { el: PlanElement; upd: Upd }) {
  const t = el.tent!;
  const set = (p: Partial<typeof t>, key?: string) => upd({ tent: { ...t, ...p } }, key);
  const along = t.entranceSide === 'front' || t.entranceSide === 'back' ? el.width : el.depth;
  const cap = tentCapacity(el);
  return (
    <Section title="الخيمة والمدخل">
      {cap != null && (
        <div className="mb-2 rounded-lg bg-turf-500/10 px-2.5 py-1.5 text-[12px] text-turf-700" data-testid="tent-capacity-hint">
          👥 يكفي تقريباً <b>{cap}</b> شخص {t.interior === 'majlis' ? 'جلوس على الجدران' : 'على السفرة'}
        </div>
      )}
      <Field label="الشكل">
        <Select
          value={t.style}
          onChange={(s) => {
            const patch: Partial<PlanElement> = { tent: { ...t, style: s } };
            if (s === 'bedouin' && el.color !== '#2a2522') patch.color = '#2a2522';
            if (s !== 'bedouin' && el.color === '#2a2522') patch.color = '#efe4cc';
            upd(patch);
          }}
          options={Object.entries(TENT_STYLE_LABELS).map(([value, label]) => ({ value: value as typeof t.style, label }))}
        />
      </Field>
      <Field label="ارتفاع الجدار"><NumberInput value={t.wallHeight} min={0.8} max={Math.max(1, el.height - 0.2)} onChange={(h) => set({ wallHeight: h }, 'wall')} unit="م" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="جهة المدخل">
          <Select value={t.entranceSide} onChange={(s) => set({ entranceSide: s, entranceOffset: 0 })} options={Object.entries(SIDE_LABELS).map(([value, label]) => ({ value: value as typeof t.entranceSide, label }))} />
        </Field>
        <Field label="عرض المدخل"><NumberInput value={t.entranceWidth} min={0.6} max={along} onChange={(w) => set({ entranceWidth: w }, 'ew')} unit="م" /></Field>
      </div>
      <Field label="إزاحة المدخل عن المنتصف">
        <input type="range" className="w-full" min={-along / 2 + t.entranceWidth / 2} max={along / 2 - t.entranceWidth / 2} step={0.1} value={t.entranceOffset} onChange={(e) => set({ entranceOffset: parseFloat(e.target.value) }, 'eo')} />
      </Field>
      <Field label="التجهيز الداخلي">
        <Select value={t.interior} onChange={(i) => set({ interior: i })} options={Object.entries(INTERIOR_LABELS).map(([value, label]) => ({ value: value as typeof t.interior, label }))} />
      </Field>
      <Toggle label="إنارة داخلية" checked={t.interiorLight} onChange={(c) => set({ interiorLight: c })} />
      <Toggle label="فانوس عند المدخل" checked={t.entranceLight} onChange={(c) => set({ entranceLight: c })} />
    </Section>
  );
}

function CourtSection({ el, upd }: { el: PlanElement; upd: Upd }) {
  const c = el.court!;
  const set = (p: Partial<typeof c>, key?: string) => upd({ court: { ...c, ...p } }, key);
  const addFloods = () => {
    const st = useEditor.getState();
    const m = c.safetyMargin + 0.4;
    const center = { x: el.x, y: el.y };
    const r = (el.rotation * Math.PI) / 180;
    const pts = [
      [-el.width / 2 + 2, -(el.depth / 2 + m)],
      [el.width / 2 - 2, -(el.depth / 2 + m)],
      [-el.width / 2 + 2, el.depth / 2 + m],
      [el.width / 2 - 2, el.depth / 2 + m],
    ].map(([x, y]) => ({ x: el.x + x * Math.cos(r) - y * Math.sin(r), y: el.y + x * Math.sin(r) + y * Math.cos(r) }));
    st.addElements(pts.map((p) => createElement('flood-light', { x: round(p.x, 2), y: round(p.y, 2) }, { name: 'كشاف الملعب', rotation: aimRotation(p, center) })));
    st.toast('تمت إضافة 4 كشافات حول الملعب موجهة لمنتصفه', 'success');
  };
  return (
    <Section title="ملعب الكرة الطائرة">
      <Field label="أرضية الملعب">
        <Select value={c.surface} onChange={(s) => set({ surface: s })} options={Object.entries(COURT_SURFACE_LABELS).map(([value, label]) => ({ value: value as typeof c.surface, label }))} />
      </Field>
      <Field label="منطقة الأمان حول الملعب" hint={`المساحة الإجمالية مع منطقة الأمان: ${formatArea((el.width + 2 * c.safetyMargin) * (el.depth + 2 * c.safetyMargin), 0)} — يُنصح بـ 3 م على الأقل`}>
        <NumberInput value={c.safetyMargin} min={0} max={10} onChange={(m) => set({ safetyMargin: m }, 'margin')} unit="م" />
      </Field>
      <Toggle label="خطوط الهجوم (3 م)" checked={c.attackLines} onChange={(a) => set({ attackLines: a })} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => upd({ width: 18, depth: 9 })}>المقاس القياسي 18×9</Button>
        <Button size="sm" onClick={() => upd({ width: 16, depth: 8 })}>شاطئي 16×8</Button>
      </div>
      <Button size="sm" variant="gold" onClick={addFloods}><Plus size={14} /> إضافة كشافات للملعب</Button>
    </Section>
  );
}

function PathSection({ el, upd }: { el: PlanElement; upd: Upd }) {
  const p = el.path!;
  const set = (q: Partial<typeof p>, key?: string) => upd({ path: { ...p, ...q } }, key);
  const est = useEditor((s) => s.project.estimate) ?? DEFAULT_ESTIMATE;
  const len = polylineLength(el.points ?? []);
  const wt = p.material === 'wood-turf' && !p.circle ? estimateWoodTurf([el], est) : null;
  const regen = (r: number, filled: boolean, w: number, key?: string) => {
    const c = polyCenter(el.points ?? [{ x: el.x, y: el.y }]);
    const g = circlePath(c, r, filled, w);
    upd({ points: g.points, path: { ...p, width: g.width, circle: { r, filled } } }, key);
  };
  return (
    <Section title="الممر">
      <Field label="نوع الممر">
        <Select value={p.material} onChange={(m) => set({ material: m })} options={Object.entries(PATH_MATERIAL_LABELS).map(([value, label]) => ({ value: value as typeof p.material, label }))} />
      </Field>
      {p.circle ? (
        <div className="space-y-2 rounded-lg bg-white p-2.5" data-testid="circle-controls">
          <div className="text-[12px] font-bold text-dune">⭕ شكل دائري</div>
          <Field label="نصف القطر"><NumberInput value={p.circle.r} min={0.5} max={25} onChange={(r) => regen(r, p.circle!.filled, p.width, 'cr')} unit="م" /></Field>
          <Toggle label="دائرة كاملة (مو حلقة)" checked={p.circle.filled} onChange={(f) => regen(p.circle!.r, f, f ? p.width : Math.min(2, p.circle!.r), undefined)} />
          {!p.circle.filled && <Field label="عرض الحلقة"><NumberInput value={p.width} min={0.3} max={20} onChange={(w) => set({ width: w }, 'pw')} unit="م" /></Field>}
          <div className="text-[11px] text-sand-600">القطر: {round(p.circle.r * 2, 2)} م • المساحة تقريباً {formatArea(p.circle.filled ? Math.PI * p.circle.r ** 2 : Math.PI * 2 * p.circle.r * p.width, 1)}</div>
        </div>
      ) : (
        <>
          <Field label="عرض الممر"><NumberInput value={p.width} min={0.3} max={20} onChange={(w) => set({ width: w }, 'pw')} unit="م" /></Field>
          <Button size="sm" onClick={() => {
            const b = (el.points ?? []).reduce((a, q) => ({ minX: Math.min(a.minX, q.x), maxX: Math.max(a.maxX, q.x), minY: Math.min(a.minY, q.y), maxY: Math.max(a.maxY, q.y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
            regen(Math.max(1, round(Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2, 1)), true, p.width, undefined);
          }} data-testid="to-circle">⭕ حوّله دائري</Button>
        </>
      )}
      <div className={cx('grid grid-cols-3 gap-2 text-center', p.circle && 'hidden')}>
        <div className="rounded-lg bg-white p-2"><div className="text-[11px] text-sand-600">الطول</div><b className="tabular-nums">{formatMeters(len)}</b></div>
        <div className="rounded-lg bg-white p-2"><div className="text-[11px] text-sand-600">المساحة</div><b className="tabular-nums">{formatArea(len * p.width, 2)}</b></div>
        <div className="rounded-lg bg-white p-2"><div className="text-[11px] text-sand-600">الزوايا</div><b>{Math.max(0, (el.points?.length ?? 2) - 2)}</b></div>
      </div>
      {!p.circle && <p className="text-[11px] text-sand-600">حرّك نقاط الممر بالسحب، انقر «+» لإضافة زاوية، وانقر مرتين على نقطة لحذفها. وأنت ترسم: الخط يستقيم لحاله لو قريب من أفقي أو عمودي أو موازي للسور (Alt يطفيه).</p>}
      {wt && (
        <div className="rounded-lg border border-sand-300 bg-sand-50 p-2.5 text-[12px] leading-relaxed">
          <b className="text-dune">تقدير خامات (خشب {est.beamSection} بطول {est.beamLength} م + ألواح + عشب):</b>
          <ul className="mt-1 list-disc pr-4">
            <li>أخشاب طولية: {wt.longBeams} قطعة</li>
            <li>أخشاب عرضية: {wt.crossBeams} قطعة</li>
            <li>إجمالي الأخشاب: {wt.totalBeams} قطعة ({Math.round(wt.beamMeters)} م طولي)</li>
            <li>ألواح {est.sheetWidth}×{est.sheetLength} م: {wt.sheets} لوح</li>
            <li>عشب صناعي: {round(wt.turfArea, 1)} م² (شامل هدر {est.wastePct}%)</li>
          </ul>
          <span className="text-sand-600">قابلة للتعديل من صفحة الكميات.</span>
        </div>
      )}
      <Toggle label="إنارة أرضية على جانبي الممر" checked={p.edgeLights} onChange={(c) => set({ edgeLights: c })} />
      {p.edgeLights && <Field label="المسافة بين الإنارات"><NumberInput value={p.edgeLightSpacing} min={0.5} max={20} onChange={(s) => set({ edgeLightSpacing: s }, 'els')} unit="م" /></Field>}
    </Section>
  );
}

function LightSection({ el, upd }: { el: PlanElement; upd: Upd }) {
  const L = el.light!;
  const set = (q: Partial<typeof L>, key?: string) => upd({ light: { ...L, ...q } }, key);
  return (
    <Section title="الإنارة">
      <Toggle label="تشغيل" checked={L.on} onChange={(on) => set({ on })} />
      <Field label={`الشدة: ${Math.round(L.intensity)}%`}>
        <input type="range" className="w-full" min={0} max={100} step={1} value={L.intensity} onChange={(e) => set({ intensity: parseFloat(e.target.value) }, 'int')} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="اللون">
          <Select value={L.color} onChange={(c) => set({ color: c })} options={Object.entries(LIGHT_COLOR_LABELS).map(([value, label]) => ({ value: value as typeof L.color, label }))} />
        </Field>
        <Field label={el.kind === 'string-lights' ? 'واط لكل ليت' : 'القدرة'}>
          <NumberInput value={L.watts} min={0} max={2000} step={1} digits={1} onChange={(w) => set({ watts: w }, 'w')} unit="W" />
        </Field>
      </div>
      <Field label="ارتفاع التركيب"><NumberInput value={L.mountHeight} min={0.2} max={20} onChange={(h) => upd({ light: { ...L, mountHeight: h }, height: h }, 'mh')} unit="م" /></Field>
      {el.kind === 'flood-light' && (
        <>
          <Field label={`اتجاه الكشاف: ${Math.round(el.rotation)}°`}>
            <input type="range" className="w-full" min={0} max={359} step={1} value={el.rotation} onChange={(e) => upd({ rotation: parseFloat(e.target.value) }, 'rot')} />
          </Field>
          <Field label={`الميل للأسفل: ${Math.round(L.tilt)}°`}>
            <input type="range" className="w-full" min={5} max={90} step={1} value={L.tilt} onChange={(e) => set({ tilt: parseFloat(e.target.value) }, 'tilt')} />
          </Field>
        </>
      )}
      {(el.kind === 'flood-light' || el.kind === 'light-pole') && (
        <Field label={`زاوية انتشار الحزمة: ${Math.round(L.beam)}°`}>
          <input type="range" className="w-full" min={15} max={160} step={1} value={L.beam} onChange={(e) => set({ beam: parseFloat(e.target.value) }, 'beam')} />
        </Field>
      )}
      {el.string && (
        <>
          <Field label="الترهل في المنتصف"><NumberInput value={el.string.sag} min={0} max={2} onChange={(s) => upd({ string: { ...el.string!, sag: s } }, 'sag')} unit="م" /></Field>
          <Field label="المسافة بين الليتات"><NumberInput value={el.string.bulbSpacing} min={0.2} max={5} onChange={(s) => upd({ string: { ...el.string!, bulbSpacing: s } }, 'bs')} unit="م" /></Field>
          <Toggle label="أعمدة تثبيت تلقائية" checked={el.string.autoPoles} onChange={(c) => upd({ string: { ...el.string!, autoPoles: c } })} />
          <div className="text-[12px] text-sand-700">الطول {formatMeters(polylineLength(el.points ?? []))} — {stringBulbs(el).length} ليت</div>
        </>
      )}
      <p className="text-[11px] text-sand-600">بدّل إلى «ليل» لمشاهدة تأثير الإنارة، أو فعّل خريطة الإضاءة في المخطط 2D.</p>
    </Section>
  );
}

/** ريح الشمال: ملاحظات معلوماتية على مداخل الخيام */
function WindSection() {
  const plan = usePlan();
  const notes = useMemo(() => windNotes(plan), [plan]);
  const hasTents = plan.elements.some((e) => e.tent);
  if (!hasTents) return null;
  return (
    <Section title="🌬️ ريح الشمال">
      {notes.length === 0 ? (
        <div className="rounded-lg bg-sky-50 p-2.5 text-[12px] leading-relaxed text-sky-900" data-testid="wind-ok">
          ✓ ما في مدخل خيمة بوجه ريح الشمال (تهب من الشمال/الشمال الغربي).
        </div>
      ) : (
        <ul className="space-y-1.5" data-testid="wind-notes">
          {notes.map((n) => (
            <li key={n.elementId}>
              <WindNoteRow note={n} showSelect />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function WindNoteRow({ note, showSelect, disabled }: { note: WindNote; showSelect?: boolean; disabled?: boolean }) {
  const st = useEditor.getState();
  const apply = () => {
    const cur = getPlan().elements.find((e) => e.id === note.elementId);
    if (!cur?.tent || cur.locked) return;
    st.updateElement(cur.id, { tent: { ...cur.tent, entranceSide: note.bestSide, entranceOffset: 0 } });
  };
  return (
    <div className="rounded-lg bg-sky-50 p-2 text-[12px] leading-relaxed text-sky-900">
      <div>🌬️ {note.message}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Button size="sm" disabled={disabled} onClick={apply} data-testid="wind-fix">حوّل المدخل جهة {note.bestFacing}</Button>
        {showSelect && <Button size="sm" variant="ghost" onClick={() => st.select([note.elementId])}>اختر الخيمة</Button>}
      </div>
    </div>
  );
}

// ——— الغرفة: النوع والتشطيب والأبواب والشبابيك ———
function RoomSection({ el, upd, dis }: { el: PlanElement; upd: (p: Partial<PlanElement>, key?: string) => void; dis: boolean }) {
  const r = el.room!;
  const set = (p: Partial<NonNullable<PlanElement['room']>>, key?: string) => upd({ room: { ...r, ...p } }, key);
  const setType = (type: RoomType) => {
    const preset = ROOM_PRESETS[type];
    const keepName = el.name !== ROOM_TYPE_LABELS[r.type] && el.name !== 'غرفة';
    upd({ room: { ...r, ...preset, type }, ...(keepName ? {} : { name: ROOM_TYPE_LABELS[type] }) });
  };
  const sideOpts = (Object.keys(SIDE_LABELS) as Side[]).map((v) => ({ value: v, label: SIDE_LABELS[v] }));
  const list = (key: 'doors' | 'windows', label: string, defW: number) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <b className="text-[12px] text-dune">{label}</b>
        <Button size="sm" disabled={dis} onClick={() => set({ [key]: [...r[key], { side: 'front', offset: 0, width: defW }] })} data-testid={`room-add-${key}`}>
          <Plus size={13} /> إضافة
        </Button>
      </div>
      {r[key].length === 0 && <p className="text-[11px] text-sand-600">ما فيه</p>}
      {r[key].map((o, i) => (
        <div key={i} className="grid grid-cols-[1fr_4.5rem_4.5rem_auto] items-end gap-1">
          <Select value={o.side} onChange={(side) => set({ [key]: r[key].map((x, j) => (j === i ? { ...x, side } : x)) })} options={sideOpts} disabled={dis} ariaLabel="الجهة" />
          <NumberInput value={o.offset} step={0.1} min={-20} max={20} onChange={(offset) => set({ [key]: r[key].map((x, j) => (j === i ? { ...x, offset } : x)) }, `${key}${i}o`)} unit="م" />
          <NumberInput value={o.width} step={0.1} min={0.4} max={6} onChange={(width) => set({ [key]: r[key].map((x, j) => (j === i ? { ...x, width } : x)) }, `${key}${i}w`)} unit="م" />
          <button type="button" disabled={dis} onClick={() => set({ [key]: r[key].filter((_, j) => j !== i) })} className="mb-1 rounded p-1.5 text-red-700 hover:bg-red-50" aria-label="حذف">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
  return (
    <Section title="الغرفة">
      <Field label="نوع الغرفة">
        <Select value={r.type} onChange={setType} disabled={dis} options={(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((v) => ({ value: v, label: ROOM_TYPE_LABELS[v] }))} />
      </Field>
      <p className="text-[12px] text-sand-700">المساحة من الداخل: <b>{roomNetArea(el).toFixed(1)} م²</b> — الارتفاع {el.height.toFixed(1)} م{el.height > 4 ? ' ⚠ أعلى من 4 م (اشتراطات البلدية)' : ''}</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="الأرضية">
          <Select value={r.floor} onChange={(floor) => set({ floor })} disabled={dis} options={(Object.keys(FLOOR_LABELS) as FloorFinish[]).map((v) => ({ value: v, label: FLOOR_LABELS[v] }))} />
        </Field>
        <Field label="الجدران من داخل">
          <Select value={r.wall} onChange={(wall) => set({ wall })} disabled={dis} options={(Object.keys(WALL_LABELS) as WallFinish[]).map((v) => ({ value: v, label: WALL_LABELS[v] }))} />
        </Field>
      </div>
      {r.wall === 'paint' && <ColorInput label="لون الدهان" value={r.wallColor} onChange={(wallColor) => set({ wallColor }, 'wallColor')} />}
      <Toggle label="إضاءة مخفية في السقف (جبس)" checked={r.coveLight} onChange={(coveLight) => set({ coveLight })} />
      <p className="text-[11px] text-sand-600">الإزاحة من منتصف الجدار (سالب = يسار/فوق)، والعرض بالمتر.</p>
      {list('doors', '🚪 الأبواب', 0.9)}
      {list('windows', '🪟 الشبابيك', 1.2)}
    </Section>
  );
}
