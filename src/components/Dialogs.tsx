import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, FileJson, Image as ImageIcon, Link2, MessageCircle, Plus, Printer, Star, Trash2, Upload, Box, Pencil, FolderPlus, Sparkles } from 'lucide-react';
import type { Land, Plan } from '../types/plan';
import { activeDesign, useActiveDesign, useEditor, usePlan } from '../store/editorStore';
import { useSummary } from '../hooks/useDerived';
import { Button, Field, Modal, NumberInput, Select, Stat, TextInput, Toggle, cx } from './ui';
import { FENCE_LABELS, GROUND_LABELS, PATH_MATERIAL_LABELS } from '../lib/catalog';
import { formatArea, formatMeters, formatNumber, landEdges, round } from '../lib/geometry';
import { DEFAULT_ESTIMATE, computeSummary, costLines } from '../lib/quantities';
import { renderPlanCanvas, canvasToBlob, dateLabel, planThumbnail } from '../render2d/exportImage';
import { askConfirm, copyText, exportDesignJson, exportProjectJson, readFileText, safeFileName, shareOrDownload, downloadBlob } from '../lib/files';
import { buildShareLink } from '../lib/share';
import { ImportError, parseImport } from '../lib/sanitize';
import { createSamplePlan, defaultLand, emptyPlan } from '../lib/sample';
import { loadThumbs } from '../lib/storage';
import { validatePlan } from '../lib/validation';
import { useViewport } from '../editor2d/viewport';

// ——— الترحيب ———
export function WelcomeDialog() {
  const open = useEditor((s) => s.dialog === 'welcome');
  const openDialog = useEditor((s) => s.openDialog);
  return (
    <Modal open={open} onClose={() => openDialog(null)} title="أهلاً بك في مخطط العنة ⛺">
      <div className="space-y-4 p-5">
        <div className="sadu-band h-2 rounded" />
        <p className="text-sm leading-relaxed text-sand-800">
          صمّم عنتك قبل التركيب: وزّع الخيام والملعب والممرات والإنارة بمقاسات حقيقية بالمتر، شاهدها مجسمة ثلاثية الأبعاد نهاراً وليلاً، واحفظ أكثر من مقترح وشاركه مع الشباب.
        </p>
        <p className="rounded-lg bg-sand-100 p-3 text-[13px] text-sand-800">
          جهّزنا لك <b>مثالاً تجريبياً</b> على أرض 40 × 30 م. كل المقاسات والمواقع افتراضية — غيّرها لمقاساتك الفعلية.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="primary" onClick={() => openDialog(null)} data-testid="welcome-sample">
            <Sparkles size={16} /> استكشف المثال الجاهز
          </Button>
          <Button variant="gold" onClick={() => openDialog('land')} data-testid="welcome-land">
            حدد مقاسات أرضك
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ——— إعدادات الأرض ———
export function LandDialog() {
  const open = useEditor((s) => s.dialog === 'land');
  const openDialog = useEditor((s) => s.openDialog);
  const plan = usePlan();
  const [land, setLand] = useState<Land>(plan.land);
  useEffect(() => {
    if (open) setLand(plan.land);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const edges = landEdges(land);
  const edge = edges[Math.min(land.entrance.edge, edges.length - 1)];
  const sideNames = ['الخلفي (أعلى المخطط)', 'الأيمن', 'الأمامي (أسفل المخطط)', 'الأيسر'];
  const apply = () => {
    const st = useEditor.getState();
    const l = { ...land, depth: land.shape === 'square' ? land.width : land.depth };
    l.entrance = { ...l.entrance, offset: Math.min(Math.max(l.entrance.offset, l.entrance.width / 2), (landEdges(l)[l.entrance.edge]?.length ?? 10) - l.entrance.width / 2) };
    st.updateLand(l);
    openDialog(null);
    setTimeout(() => useViewport.getState().requestFit(), 50);
    st.toast('تم تحديث الأرض — راجع التنبيهات إن كانت هناك عناصر خارج الحدود', 'success');
  };
  return (
    <Modal
      open={open}
      onClose={() => openDialog(null)}
      title="مساحة العنة"
      footer={
        <>
          <Button onClick={() => openDialog(null)}>إلغاء</Button>
          <Button variant="primary" onClick={apply} data-testid="land-apply">تطبيق</Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <Field label="شكل الأرض">
          <Select
            value={land.shape === 'polygon' ? 'rectangle' : land.shape}
            onChange={(shape) => setLand({ ...land, shape })}
            options={[
              { value: 'rectangle', label: 'مستطيل' },
              { value: 'square', label: 'مربع' },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الطول (أفقي)">
            <NumberInput value={land.width} min={5} max={500} step={1} onChange={(width) => setLand({ ...land, width })} unit="م" ariaLabel="طول الأرض" />
          </Field>
          <Field label="العرض (رأسي)">
            <NumberInput value={land.shape === 'square' ? land.width : land.depth} min={5} max={500} step={1} disabled={land.shape === 'square'} onChange={(depth) => setLand({ ...land, depth })} unit="م" ariaLabel="عرض الأرض" />
          </Field>
        </div>
        <div className="text-[12px] text-sand-700">المساحة: <b>{formatArea(land.width * (land.shape === 'square' ? land.width : land.depth), 0)}</b></div>
        <Field label="نوع الأرضية">
          <Select value={land.ground} onChange={(ground) => setLand({ ...land, ground })} options={Object.entries(GROUND_LABELS).map(([value, label]) => ({ value: value as Land['ground'], label }))} />
        </Field>
        <div className="rounded-xl border border-sand-200 bg-white p-3">
          <div className="mb-2 text-sm font-bold text-dune">المدخل الرئيسي</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الضلع">
              <Select
                value={String(land.entrance.edge)}
                onChange={(v) => {
                  const e = parseInt(v, 10);
                  const L = landEdges(land)[e]?.length ?? 10;
                  setLand({ ...land, entrance: { ...land.entrance, edge: e, offset: L / 2 } });
                }}
                options={edges.map((_, i) => ({ value: String(i), label: sideNames[i] ?? `ضلع ${i + 1}` }))}
              />
            </Field>
            <Field label="عرض المدخل"><NumberInput value={land.entrance.width} min={1} max={30} onChange={(width) => setLand({ ...land, entrance: { ...land.entrance, width } })} unit="م" /></Field>
          </div>
          <Field label={`موضع المدخل على الضلع: ${round(land.entrance.offset, 1)} م من بدايته`}>
            <input type="range" className="w-full" min={land.entrance.width / 2} max={Math.max(land.entrance.width / 2, (edge?.length ?? 10) - land.entrance.width / 2)} step={0.5} value={land.entrance.offset} onChange={(e) => setLand({ ...land, entrance: { ...land.entrance, offset: parseFloat(e.target.value) } })} />
          </Field>
        </div>
        <Field label={`اتجاه الشمال: ${Math.round(land.northAngle)}° (0 = أعلى المخطط)`} hint="يؤثر على اتجاه الشمس والظلال في المشهد ثلاثي الأبعاد">
          <input type="range" className="w-full" min={0} max={359} step={1} value={((land.northAngle % 360) + 360) % 360} onChange={(e) => setLand({ ...land, northAngle: parseFloat(e.target.value) })} />
        </Field>
        <div className="rounded-xl border border-sand-200 bg-white p-3">
          <Toggle label="سياج حول الأرض" checked={land.fence.enabled} onChange={(enabled) => setLand({ ...land, fence: { ...land.fence, enabled } })} />
          {land.fence.enabled && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Field label="النوع"><Select value={land.fence.type} onChange={(type) => setLand({ ...land, fence: { ...land.fence, type } })} options={Object.entries(FENCE_LABELS).map(([value, label]) => ({ value: value as Land['fence']['type'], label }))} /></Field>
              <Field label="الارتفاع"><NumberInput value={land.fence.height} min={0.5} max={5} onChange={(height) => setLand({ ...land, fence: { ...land.fence, height } })} unit="م" /></Field>
              <Field label="اللون"><input type="color" value={land.fence.color} onChange={(e) => setLand({ ...land, fence: { ...land.fence, color: e.target.value } })} className="h-9 w-full rounded-lg border border-sand-300" /></Field>
            </div>
          )}
        </div>
        <p className="text-[11px] text-sand-600">الأشكال غير المنتظمة (حرف L وغيرها) مدعومة في نموذج البيانات وسيتم إضافة أداة رسمها لاحقاً.</p>
      </div>
    </Modal>
  );
}

// ——— القياسات وحصر الكميات ———
export function SummaryDialog() {
  const open = useEditor((s) => s.dialog === 'summary');
  const openDialog = useEditor((s) => s.openDialog);
  const s = useSummary();
  const project = useEditor((st) => st.project);
  const setPrice = useEditor((st) => st.setPrice);
  const setEstimate = useEditor((st) => st.setEstimate);
  const design = useActiveDesign();
  const est = project.estimate ?? DEFAULT_ESTIMATE;
  const lines = costLines(s);
  const total = lines.reduce((sum, l) => sum + (project.prices[l.key] ?? 0) * l.qty, 0);
  const priced = lines.filter((l) => project.prices[l.key] !== undefined).length;
  const exportCsv = () => {
    const rows = [['البند', 'الوحدة', 'الكمية', 'سعر الوحدة', 'الإجمالي'], ...lines.map((l) => [l.label, l.unit, String(round(l.qty, 2)), String(project.prices[l.key] ?? ''), String(round((project.prices[l.key] ?? 0) * l.qty, 2))])];
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeFileName(project.name)}-كميات.csv`);
  };
  if (!open) return null;
  return (
    <Modal
      open={open}
      onClose={() => openDialog(null)}
      wide="xl"
      title={`القياسات وحصر الكميات — ${design.name}`}
      footer={
        <>
          <Button onClick={exportCsv}><Download size={15} /> تصدير CSV</Button>
          <Button onClick={() => window.print()}><Printer size={15} /> طباعة</Button>
          <Button variant="primary" onClick={() => openDialog(null)}>إغلاق</Button>
        </>
      }
    >
      <div className="space-y-5 p-5" data-testid="summary">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="مساحة الأرض" value={formatArea(s.landArea, 0)} sub={`المحيط ${formatMeters(s.landPerimeter, 1)}`} />
          <Stat label={`الخيام (${s.tentCount})`} value={formatArea(s.tentArea, 1)} />
          <Stat label="الملعب + منطقة الأمان" value={formatArea(s.courtZoneArea, 0)} sub={`الملعب ${formatArea(s.courtArea, 0)}`} />
          <Stat label="المساحة الفارغة المتبقية" value={formatArea(s.freeArea, 0)} sub={`${formatNumber(s.freePct, 0)}% من الأرض`} />
          <Stat label="أطوال الممرات" value={formatMeters(s.pathLength, 1)} sub={`المساحة ${formatArea(s.pathArea, 1)}`} />
          <Stat label="العشب الصناعي (تقديري)" value={formatArea(s.turfArea, 1)} />
          <Stat label="الحمامات / المغاسل" value={`${s.toilets} / ${s.sinks}`} />
          <Stat label="طول السياج" value={formatMeters(s.fenceLength, 1)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-sand-200 bg-white p-3">
            <h3 className="mb-2 font-bold text-dune">الخيام</h3>
            <table className="w-full text-sm">
              <thead className="text-[11px] text-sand-600"><tr><th className="text-right">الخيمة</th><th>الأبعاد</th><th>المساحة</th></tr></thead>
              <tbody>
                {s.tents.map((t) => (
                  <tr key={t.id} className="border-t border-sand-100"><td className="py-1">{t.name}</td><td className="text-center tabular-nums">{round(t.width, 2)} × {round(t.depth, 2)}</td><td className="text-center tabular-nums">{formatArea(t.area)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-sand-200 bg-white p-3">
            <h3 className="mb-2 font-bold text-dune">الممرات</h3>
            <table className="w-full text-sm">
              <thead className="text-[11px] text-sand-600"><tr><th className="text-right">الممر</th><th>النوع</th><th>الطول × العرض</th><th>المساحة</th></tr></thead>
              <tbody>
                {s.paths.map((p) => (
                  <tr key={p.id} className="border-t border-sand-100"><td className="py-1">{p.name}</td><td className="text-center text-xs">{PATH_MATERIAL_LABELS[p.material]}</td><td className="text-center tabular-nums">{round(p.length, 2)} × {round(p.width, 2)}</td><td className="text-center tabular-nums">{formatArea(p.area, 2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-sand-200 bg-white p-3">
            <h3 className="mb-2 font-bold text-dune">الإنارة</h3>
            <ul className="grid grid-cols-2 gap-1 text-sm">
              <li>أعمدة إنارة: <b>{s.lights.poles}</b></li>
              <li>كشافات LED: <b>{s.lights.floods}</b></li>
              <li>سلاسل لمبات: <b>{s.lights.strings}</b> ({formatMeters(s.lights.stringLength, 1)})</li>
              <li>عدد اللمبات المعلقة: <b>{s.lights.bulbs}</b></li>
              <li>إنارة أرضية: <b>{s.lights.groundLights + s.lights.pathEdgeLights}</b></li>
              <li>إنارة المدخل: <b>{s.lights.entranceLights}</b></li>
              <li>فوانيس مداخل الخيام: <b>{s.lights.tentEntranceLights + s.lights.lanterns}</b></li>
              <li>الحمل التقديري: <b>{formatNumber(s.lights.totalWatts / 1000, 2)} kW</b></li>
            </ul>
          </div>
          <div className="rounded-xl border border-sand-200 bg-white p-3">
            <h3 className="mb-2 font-bold text-dune">ممر الخشب + العشب (تقديري)</h3>
            {s.woodTurf.area > 0 ? (
              <ul className="mb-2 space-y-0.5 text-sm">
                <li>المساحة: <b>{formatArea(s.woodTurf.area, 2)}</b></li>
                <li>أخشاب {est.beamSection} بطول {est.beamLength} م: <b>{s.woodTurf.totalBeams}</b> قطعة ({s.woodTurf.longBeams} طولية + {s.woodTurf.crossBeams} عرضية)</li>
                <li>ألواح خشب: <b>{s.woodTurf.sheets}</b> لوح</li>
                <li>عشب صناعي: <b>{formatArea(s.woodTurf.turfArea, 1)}</b> ≈ {formatNumber(s.woodTurf.turfRollMeters, 1)} م طولي من لفة بعرض {est.turfRollWidth} م</li>
              </ul>
            ) : (
              <p className="mb-2 text-sm text-sand-600">لا يوجد ممر من نوع «خشب + عشب صناعي» في هذا التصميم.</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Field label="طول الخشبة"><NumberInput value={est.beamLength} min={0.5} max={12} onChange={(v) => setEstimate({ beamLength: v })} unit="م" /></Field>
              <Field label="تباعد الأخشاب"><NumberInput value={est.beamSpacing} min={0.2} max={3} onChange={(v) => setEstimate({ beamSpacing: v })} unit="م" /></Field>
              <Field label="الهدر"><NumberInput value={est.wastePct} min={0} max={100} step={1} onChange={(v) => setEstimate({ wastePct: v })} unit="%" /></Field>
              <Field label="عرض اللوح"><NumberInput value={est.sheetWidth} min={0.2} max={5} onChange={(v) => setEstimate({ sheetWidth: v })} unit="م" /></Field>
              <Field label="طول اللوح"><NumberInput value={est.sheetLength} min={0.2} max={10} onChange={(v) => setEstimate({ sheetLength: v })} unit="م" /></Field>
              <Field label="عرض لفة العشب"><NumberInput value={est.turfRollWidth} min={0.5} max={10} onChange={(v) => setEstimate({ turfRollWidth: v })} unit="م" /></Field>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-sand-200 bg-white p-3">
          <h3 className="mb-1 font-bold text-dune">التكلفة التقديرية</h3>
          <p className="mb-2 text-[12px] text-sand-600">الكميات محسوبة تلقائياً من المخطط. لا توجد أسعار افتراضية — أدخل سعر الوحدة بنفسك (بالريال القطري).</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-[11px] text-sand-600"><tr><th className="text-right">البند</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-t border-sand-100">
                    <td className="py-1">{l.label}</td>
                    <td className="text-center tabular-nums">{formatNumber(l.qty, 2)}</td>
                    <td className="text-center text-xs">{l.unit}</td>
                    <td className="w-32 py-1">
                      <input
                        type="number"
                        min={0}
                        dir="ltr"
                        placeholder="—"
                        value={project.prices[l.key] ?? ''}
                        onChange={(e) => setPrice(l.key, e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="h-8 w-full rounded border border-sand-300 px-2 text-left text-sm"
                        aria-label={`سعر ${l.label}`}
                      />
                    </td>
                    <td className="text-center tabular-nums">{project.prices[l.key] !== undefined ? formatNumber(project.prices[l.key] * l.qty, 2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-sand-300 font-bold">
                  <td colSpan={4} className="py-2">الإجمالي التقديري ({priced} من {lines.length} بنود مسعّرة)</td>
                  <td className="text-center tabular-nums">{formatNumber(total, 2)} ر.ق</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ——— التصاميم والمقارنة ———
export function DesignsDialog() {
  const dialog = useEditor((s) => s.dialog);
  const open = dialog === 'designs' || dialog === 'compare';
  const openDialog = useEditor((s) => s.openDialog);
  const project = useEditor((s) => s.project);
  const st = useEditor.getState();
  const [newName, setNewName] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  useEffect(() => {
    if (open) setCompareIds(project.designs.slice(0, 3).map((d) => d.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const thumbs = useMemo(() => {
    if (!open) return {} as Record<string, { d2: string; d3?: string }>;
    const out: Record<string, { d2: string; d3?: string }> = {};
    for (const d of project.designs) out[d.id] = { d2: planThumbnail(d.plan, 600), d3: loadThumbs(d.id).d3 };
    return out;
  }, [open, project.designs]);
  const stats = useMemo(() => {
    const out: Record<string, { s: ReturnType<typeof computeSummary>; issues: number }> = {};
    if (!open) return out;
    for (const d of project.designs) out[d.id] = { s: computeSummary(d.plan, project.estimate), issues: validatePlan(d.plan).issues.length };
    return out;
  }, [open, project.designs, project.estimate]);

  const exportBoard = async () => {
    const ds = project.designs.filter((d) => compareIds.includes(d.id));
    if (!ds.length) return;
    const W = 900;
    const imgs = ds.map((d) => renderPlanCanvas(d.plan, { width: W, title: d.name + (project.finalDesignId === d.id ? ' ★' : ''), subtitle: project.name, grid: false }));
    const H = Math.max(...imgs.map((c) => c.height));
    const board = document.createElement('canvas');
    board.width = W * imgs.length + 20 * (imgs.length + 1);
    board.height = H + 40;
    const ctx = board.getContext('2d')!;
    ctx.fillStyle = '#3b2a1e';
    ctx.fillRect(0, 0, board.width, board.height);
    // الترتيب من اليمين لليسار
    imgs.forEach((c, i) => ctx.drawImage(c, board.width - (i + 1) * (W + 20), 20));
    const blob = await canvasToBlob(board);
    await shareOrDownload(blob, `${safeFileName(project.name)}-مقارنة.png`, `مقارنة تصاميم ${project.name}`);
  };

  return (
    <Modal
      open={open}
      onClose={() => openDialog(null)}
      wide="xl"
      title="التصاميم والبدائل"
      footer={
        <>
          <Button onClick={exportBoard} disabled={!compareIds.length}><ImageIcon size={15} /> صورة المقارنة (للواتساب)</Button>
          <Button variant="primary" onClick={() => openDialog(null)}>إغلاق</Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-sand-200 bg-white p-3">
          <div className="min-w-48 flex-1">
            <Field label="اسم التصميم الجديد"><TextInput value={newName} onChange={setNewName} placeholder="مثلاً: التصميم B — الخيمة في الزاوية" /></Field>
          </div>
          <Button variant="primary" onClick={() => { st.addDesign(newName, 'copy'); setNewName(''); }} data-testid="design-copy"><Copy size={15} /> نسخ الحالي</Button>
          <Button onClick={() => { st.addDesign(newName, 'blank'); setNewName(''); }}><Plus size={15} /> تصميم فارغ</Button>
          <Button onClick={() => { st.addDesign(newName || 'المثال التجريبي', 'sample'); setNewName(''); }}><Sparkles size={15} /> من المثال</Button>
        </div>
        <p className="text-[12px] text-sand-600">حدد حتى 4 تصاميم للمقارنة جنباً إلى جنب. لحفظ لقطة 3D لأي تصميم: افتحه في العرض 3D واضغط زر الكاميرا 📷.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {project.designs.map((d) => {
            const s = stats[d.id];
            const isActive = d.id === project.activeDesignId;
            const isFinal = project.finalDesignId === d.id;
            return (
              <div key={d.id} className={cx('overflow-hidden rounded-xl border-2 bg-white', isActive ? 'border-gold-500' : 'border-sand-200')}>
                <div className="relative">
                  <img src={thumbs[d.id]?.d2} alt={d.name} className="aspect-[4/3] w-full bg-sand-100 object-contain" />
                  {thumbs[d.id]?.d3 && <img src={thumbs[d.id]?.d3} alt="" className="absolute bottom-2 left-2 w-1/3 rounded border-2 border-white shadow" />}
                  <label className="absolute top-2 right-2 flex items-center gap-1 rounded bg-white/95 px-2 py-1 text-xs">
                    <input type="checkbox" checked={compareIds.includes(d.id)} onChange={(e) => setCompareIds((ids) => (e.target.checked ? [...ids, d.id].slice(-4) : ids.filter((x) => x !== d.id)))} />
                    مقارنة
                  </label>
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-center gap-2">
                    <TextInput value={d.name} onCommit={(n) => st.renameDesign(d.id, n)} ariaLabel="اسم التصميم" />
                    <button type="button" title="تعيين كتصميم نهائي" onClick={() => st.setFinalDesign(isFinal ? undefined : d.id)} className={cx('rounded-lg p-2', isFinal ? 'bg-gold-500 text-dune' : 'bg-sand-100 text-sand-600')}>
                      <Star size={16} />
                    </button>
                  </div>
                  {s && (
                    <div className="grid grid-cols-2 gap-x-2 text-[12px] text-sand-800">
                      <span>الخيام: <b>{s.s.tentCount}</b> ({formatArea(s.s.tentArea, 0)})</span>
                      <span>الممرات: <b>{formatMeters(s.s.pathLength, 0)}</b></span>
                      <span>العشب: <b>{formatArea(s.s.turfArea, 0)}</b></span>
                      <span>الإنارة: <b>{s.s.lights.poles + s.s.lights.floods}</b> وحدة</span>
                      <span>الفارغ: <b>{formatNumber(s.s.freePct, 0)}%</b></span>
                      <span className={s.issues ? 'text-amber-700' : 'text-turf-700'}>التنبيهات: <b>{s.issues}</b></span>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <Button size="sm" variant={isActive ? 'gold' : 'primary'} className="flex-1" onClick={() => { st.switchDesign(d.id); openDialog(null); }}>
                      <Pencil size={14} /> {isActive ? 'مفتوح حالياً' : 'فتح وتعديل'}
                    </Button>
                    <Button size="sm" onClick={() => exportDesignJson(d, project.name)} title="تصدير JSON"><FileJson size={14} /></Button>
                    <Button size="sm" variant="danger" disabled={project.designs.length <= 1} onClick={() => askConfirm(`حذف «${d.name}»؟`) && st.deleteDesign(d.id)} title="حذف"><Trash2 size={14} /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ——— المشاركة والتصدير ———
export function ShareDialog() {
  const open = useEditor((s) => s.dialog === 'share');
  const openDialog = useEditor((s) => s.openDialog);
  const project = useEditor((s) => s.project);
  const design = useActiveDesign();
  const time = useEditor((s) => s.time);
  const view = useEditor((s) => s.view);
  const setView = useEditor((s) => s.setView);
  const requestCapture3d = useEditor((s) => s.requestCapture3d);
  const toast = useEditor((s) => s.toast);
  const [lightMap, setLightMap] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const link = useMemo(() => (open ? buildShareLink(`${project.name} — ${design.name}`, design.plan) : null), [open, project.name, design]);

  const export2d = async (mode: 'download' | 'share') => {
    const c = renderPlanCanvas(design.plan, { width: 2200, title: `${project.name} — ${design.name}`, subtitle: dateLabel(), lightMap, night: lightMap || time === 'night' });
    const blob = await canvasToBlob(c);
    const r = await shareOrDownload(blob, `${safeFileName(project.name)}-${safeFileName(design.name)}-مخطط.png`, `${project.name} — ${design.name}`);
    if (r === 'downloaded' && mode === 'share') toast('تم تنزيل الصورة — أرسلها في قروب الواتساب', 'success');
    else if (r !== 'cancelled') toast('تم تصدير صورة المخطط', 'success');
  };
  const export3d = (mode: 'download' | 'share') => {
    if (view === '2d') {
      setView('3d');
      openDialog(null);
      toast('تم فتح العرض 3D — اختر الزاوية المناسبة ثم اضغط تصدير مرة أخرى', 'info');
      return;
    }
    requestCapture3d(mode);
  };
  const onImport = async (file: File) => {
    try {
      const text = await readFileText(file);
      const res = parseImport(text);
      const st = useEditor.getState();
      if (res.kind === 'project' && res.project) {
        st.importProject(res.project);
        toast(`تم استيراد المشروع «${res.project.name}» (${res.project.designs.length} تصاميم)`, 'success');
      } else if (res.design) {
        st.importDesign(res.design);
        toast(`تمت إضافة «${res.design.name}» كتصميم جديد في هذا المشروع`, 'success');
      }
      if (res.report.dropped) toast(`تم تجاهل ${res.report.dropped} عنصر غير صالح`, 'warning');
      openDialog(null);
      setTimeout(() => useViewport.getState().requestFit(), 50);
    } catch (e) {
      toast(e instanceof ImportError || e instanceof Error ? e.message : 'تعذر استيراد الملف', 'error');
    }
  };
  return (
    <Modal open={open} onClose={() => openDialog(null)} wide title="المشاركة والتصدير" footer={<Button variant="primary" onClick={() => openDialog(null)}>إغلاق</Button>}>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-sand-200 bg-white p-4">
          <h3 className="font-bold text-dune">صور للواتساب</h3>
          <p className="text-[12px] text-sand-600">على الجوال يفتح زر المشاركة قائمة التطبيقات مباشرة (واتساب وغيره). على الكمبيوتر يتم تنزيل الصورة.</p>
          <Button variant="gold" className="w-full" onClick={() => export2d('share')} data-testid="export-2d"><ImageIcon size={16} /> صورة المخطط 2D</Button>
          <Toggle label="مع خريطة الإضاءة الليلية" checked={lightMap} onChange={setLightMap} />
          <Button variant="primary" className="w-full" onClick={() => export3d('share')} data-testid="export-3d"><Box size={16} /> صورة المشهد 3D (الزاوية الحالية)</Button>
          <Button className="w-full" onClick={() => openDialog('compare')}><ImageIcon size={16} /> صورة مقارنة التصاميم</Button>
        </div>
        <div className="space-y-2 rounded-xl border border-sand-200 bg-white p-4">
          <h3 className="font-bold text-dune">رابط مشاركة</h3>
          <p className="text-[12px] text-sand-600">الرابط يحتوي بيانات التصميم مضغوطة بدون أي خادم. يعمل عندما يكون التطبيق منشوراً على رابط يفتحه الشباب.</p>
          {link && (
            <>
              <div className={cx('rounded-lg p-2 text-[11px]', link.tooLong ? 'bg-red-50 text-red-800' : link.risky ? 'bg-amber-50 text-amber-900' : 'bg-turf-500/10 text-turf-700')}>
                طول الرابط: {link.length.toLocaleString('en-US')} حرف {link.tooLong ? '— طويل جداً، استخدم ملف JSON' : link.risky ? '— قد لا تدعمه بعض التطبيقات، يُفضّل ملف JSON' : '— مناسب'}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={link.tooLong} onClick={async () => toast((await copyText(link.url)) ? 'تم نسخ الرابط' : 'تعذر النسخ', 'success')}><Link2 size={15} /> نسخ الرابط</Button>
                <Button className="flex-1" disabled={link.tooLong} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`تصميم العنة: ${design.name}\n${link.url}`)}`, '_blank')}><MessageCircle size={15} /> واتساب</Button>
              </div>
            </>
          )}
        </div>
        <div className="space-y-2 rounded-xl border border-sand-200 bg-white p-4 md:col-span-2">
          <h3 className="font-bold text-dune">ملفات المشروع (JSON)</h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => exportProjectJson(project)} data-testid="export-json"><FileJson size={15} /> تصدير المشروع كاملاً ({project.designs.length} تصاميم)</Button>
            <Button onClick={() => exportDesignJson(design, project.name)}><FileJson size={15} /> تصدير التصميم الحالي فقط</Button>
            <Button variant="primary" onClick={() => fileRef.current?.click()}><Upload size={15} /> استيراد ملف</Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              data-testid="import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = '';
              }}
            />
          </div>
          <p className="text-[11px] text-sand-600">استيراد مشروع كامل يفتحه كمشروع جديد، واستيراد تصميم واحد يضيفه للمشروع الحالي. يتم فحص الملف وتجاهل العناصر غير الصالحة.</p>
        </div>
      </div>
    </Modal>
  );
}

// ——— المشاريع ———
export function ProjectsDialog() {
  const open = useEditor((s) => s.dialog === 'projects');
  const openDialog = useEditor((s) => s.openDialog);
  const projects = useEditor((s) => s.projects);
  const project = useEditor((s) => s.project);
  const st = useEditor.getState();
  const [name, setName] = useState('');
  useEffect(() => {
    if (open) st.refreshProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Modal open={open} onClose={() => openDialog(null)} title="المشاريع المحفوظة في المتصفح" footer={<Button variant="primary" onClick={() => openDialog(null)}>إغلاق</Button>}>
      <div className="space-y-3 p-5">
        <Field label="اسم المشروع الحالي"><TextInput value={project.name} onCommit={(n) => st.renameProject(n)} /></Field>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-sand-200 bg-white p-3">
          <div className="min-w-40 flex-1"><Field label="مشروع جديد"><TextInput value={name} onChange={setName} placeholder="اسم العنة" /></Field></div>
          <Button variant="primary" onClick={() => { st.newProject(name || 'عنة جديدة', emptyPlan(defaultLand())); setName(''); openDialog('land'); }}><FolderPlus size={15} /> أرض فارغة</Button>
          <Button onClick={() => { st.newProject(name || 'عنة تجريبية', createSamplePlan()); setName(''); openDialog(null); }}><Sparkles size={15} /> من المثال</Button>
        </div>
        <ul className="space-y-1.5">
          {projects.map((m) => (
            <li key={m.id} className={cx('flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2', m.id === project.id ? 'border-gold-500' : 'border-sand-200')}>
              <div className="min-w-0">
                <div className="truncate font-semibold">{m.name}</div>
                <div className="text-[11px] text-sand-600">{m.designCount} تصاميم • {new Date(m.updatedAt).toLocaleString('ar-QA')}</div>
              </div>
              <div className="flex gap-1">
                {m.id !== project.id && <Button size="sm" variant="primary" onClick={() => { if (st.openProject(m.id)) { openDialog(null); setTimeout(() => useViewport.getState().requestFit(), 50); } }}>فتح</Button>}
                <Button size="sm" variant="danger" onClick={() => askConfirm(`حذف المشروع «${m.name}» نهائياً من المتصفح؟`) && st.deleteProject(m.id)}><Trash2 size={14} /></Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

// ——— رابط مشترك ———
export function SharedLinkDialog() {
  const pending = useEditor((s) => s.pendingShared);
  const st = useEditor.getState();
  if (!pending) return null;
  return (
    <Modal open onClose={() => st.setPendingShared(null)} title="تم فتح تصميم مشترك">
      <div className="space-y-3 p-5">
        <p className="text-sm">وصلك التصميم <b>«{pending.name}»</b> ({pending.plan.elements.length} عنصر). كيف تريد فتحه؟</p>
        <div className="grid gap-2">
          <Button variant="primary" onClick={() => { st.newProject(pending.name, pending.plan as Plan); st.setPendingShared(null); setTimeout(() => useViewport.getState().requestFit(), 50); }}>فتحه كمشروع جديد</Button>
          <Button onClick={() => { st.importDesign(pending); st.setPendingShared(null); setTimeout(() => useViewport.getState().requestFit(), 50); }}>إضافته كتصميم في مشروعي الحالي</Button>
          <Button variant="ghost" onClick={() => st.setPendingShared(null)}>تجاهل</Button>
        </div>
      </div>
    </Modal>
  );
}

// ——— المساعدة ———
export function HelpDialog() {
  const open = useEditor((s) => s.dialog === 'help');
  const openDialog = useEditor((s) => s.openDialog);
  const rows: [string, string][] = [
    ['V / H / P / T / M', 'تحديد • تحريك العرض • رسم ممر • سلسلة لمبات • قياس'],
    ['Ctrl+Z / Ctrl+Shift+Z', 'تراجع / إعادة'],
    ['Delete', 'حذف المحدد'],
    ['Ctrl+D / Ctrl+C / Ctrl+V', 'تكرار / نسخ / لصق'],
    ['الأسهم (+Shift)', 'تحريك 10 سم (1 م)'],
    ['R / Shift+R', 'تدوير 15° / −15°'],
    ['L', 'قفل / فك قفل'],
    ['Ctrl+A', 'تحديد الكل'],
    ['G / F', 'الشبكة / ملاءمة العرض'],
    ['1 / 2 / 3', 'عرض 2D / 3D / مقسوم'],
    ['N', 'تبديل نهار / ليل'],
    ['Alt أثناء السحب', 'تعطيل الالتصاق بالشبكة'],
    ['Shift + نقر', 'إضافة للتحديد'],
  ];
  return (
    <Modal open={open} onClose={() => openDialog(null)} title="الاختصارات والمساعدة">
      <div className="p-5">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, d]) => (
              <tr key={k} className="border-b border-sand-100"><td className="py-1.5 font-mono text-xs" dir="ltr">{k}</td><td>{d}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[12px] text-sand-600">في 3D: اسحب للدوران، العجلة للتكبير، زر الفأرة الأيمن للتحريك. وضع التجول: W A S D مع الماوس.</p>
        <p className="mt-1 text-[12px] text-sand-600">{activeDesign(useEditor.getState().project).plan.elements.length} عنصر في التصميم الحالي • يتم الحفظ تلقائياً في هذا المتصفح.</p>
      </div>
    </Modal>
  );
}
