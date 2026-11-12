// «ملف العزبة»: كل شي عن العزبة في مكان واحد وبتبويبات بسيطة — الملخص، التكلفة، الري، الكهرباء، والخطوات الجاية
import { useMemo, useState } from 'react';
import { Printer, Share2 } from 'lucide-react';
import { useActiveDesign, useEditor } from '../store/editorStore';
import { useSummary } from '../hooks/useDerived';
import { Button, Modal, cx } from './ui';
import { IzbaInsightsPanel, IzbaIrrigationPanel } from './IzbaInsightsPanel';
import { IzbaCostPanel } from './IzbaCostPanel';
import { IzbaRunningPanel } from './IzbaRunningPanel';
import { izbaRunning } from '../lib/izbaRunning';
import { izbaEstimate } from '../lib/izbaCost';
import { izbaInsights } from '../lib/izbaInsights';
import { izbaMaterials, materialRows } from '../lib/izbaMaterials';
import { MONTHS, monthTasks, yearLoad } from '../lib/izbaCalendar';
import { openReport } from '../lib/report';
import { demoBlock } from './Dialogs';
import { formatNumber } from '../lib/geometry';

type Tab = 'summary' | 'cost' | 'running' | 'materials' | 'water' | 'power' | 'calendar' | 'next';
const TABS: [Tab, string][] = [
  ['summary', '📊 الملخص'],
  ['cost', '💰 التكلفة'],
  ['running', '💵 المصاريف الشهرية'],
  ['materials', '🧱 المواد'],
  ['water', '💧 الري'],
  ['power', '⚡ الكهرباء'],
  ['calendar', '📅 التقويم'],
  ['next', '✅ الخطوات'],
];

export function IzbaHubDialog() {
  const open = useEditor((s) => s.dialog === 'izba');
  if (!open) return null;
  return <Body />;
}

function Body() {
  const openDialog = useEditor((s) => s.openDialog);
  const project = useEditor((s) => s.project);
  const design = useActiveDesign();
  const s = useSummary();
  const [tab, setTab] = useState<Tab>('summary');
  const est = useMemo(() => izbaEstimate(design.plan, s, project.prices), [design.plan, s, project.prices]);
  const ins = useMemo(() => izbaInsights(design.plan, s), [design.plan, s]);
  const run = useMemo(() => izbaRunning(design.plan, s, project.prices, est.total), [design.plan, s, project.prices, est.total]);
  const land = design.plan.land;
  const k = (n: number) => formatNumber(Math.round(n / 1000), 0) + ' ألف';
  const report = () => {
    if (demoBlock('report')) return;
    const r = openReport(project, design);
    useEditor.getState().toast(r === 'opened' ? 'انفتح التقرير — اضغط «طباعة / PDF» واحفظه' : 'نزل التقرير كملف — افتحه واطبعه PDF', 'success');
  };

  return (
    <Modal
      open
      onClose={() => openDialog(null)}
      wide="xl"
      title={`📋 ملف العزبة — ${design.name}`}
      footer={
        <>
          <Button onClick={() => openDialog('share')}>
            <Share2 size={15} /> شاركها مع الأهل
          </Button>
          <Button variant="gold" onClick={report} data-testid="hub-report">
            <Printer size={15} /> تقرير PDF للمقاول
          </Button>
          <Button variant="primary" onClick={() => openDialog(null)}>
            إغلاق
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-4 sm:p-5" data-testid="izba-hub">
        {/* سطر واحد يلخص كل شي */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-dune px-4 py-3 text-sand-50">
          <span>
            📐 <b>{formatNumber(land.width, 0)} × {formatNumber(land.depth, 0)} م</b>
          </span>
          <span>
            💰 تقريباً <b>{k(est.total)} ر.ق</b>
          </span>
          <button type="button" onClick={() => setTab('running')} className="underline-offset-2 hover:underline" data-testid="hub-run-strip">
            💵 تشغيل <b>~{formatNumber(run.monthly, 0)} ر.ق</b>/شهر
          </button>
          <span>
            🏠 مباني <b>{formatNumber(ins.builtArea, 0)} م²</b>
          </span>
          {ins.sheep + ins.camels + ins.horses > 0 && (
            <span>
              🐑 حلال <b>~{ins.sheep + ins.camels + ins.horses}</b>
            </span>
          )}
          <span>
            💧 <b>{formatNumber(ins.waterPerDay, 0)} لتر</b>/يوم
          </span>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-xl bg-sand-100 p-1" role="tablist">
          {TABS.map(([t, l]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`hub-${t}`} className={cx('h-9 shrink-0 rounded-lg px-3 text-sm font-bold', tab === t ? 'bg-white text-dune shadow-sm' : 'text-sand-700 hover:text-dune')}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'summary' && <IzbaInsightsPanel plan={design.plan} summary={s} hideIrrigation />}
        {tab === 'cost' && <IzbaCostPanel plan={design.plan} summary={s} />}
        {tab === 'running' && <IzbaRunningPanel plan={design.plan} summary={s} buildCost={est.total} />}
        {tab === 'water' && (
          <div className="space-y-2">
            <IzbaIrrigationPanel plan={design.plan} />
            <p className="text-[12px] text-sand-600">نصيحة: الري بالليل أو قبل الفجر يوفر لين 30% من الماي بالصيف. وخل لكل محبس مؤقت لحاله.</p>
          </div>
        )}
        {tab === 'materials' && <MaterialsTab plan={design.plan} />}
        {tab === 'calendar' && <CalendarTab plan={design.plan} />}
        {tab === 'power' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Mini icon="❄️" label="التكييف" value={ins.acTons ? `${ins.acTons} طن` : '—'} />
              <Mini icon="⚡" label="الحمل" value={`${ins.powerKw} kW`} />
              <Mini icon="🔌" label="المولد المناسب" value={ins.generatorKva ? `${ins.generatorKva} KVA` : '—'} />
              <Mini icon="🛢️" label="الماي يكفي" value={ins.tankDays === null ? '—' : `${ins.tankDays} يوم`} />
            </div>
            <Button onClick={() => openDialog('power')} data-testid="hub-power-detail">
              ⚡ حاسبة الكهرباء التفصيلية (الأجهزة والكيابل والديزل)
            </Button>
          </div>
        )}
        {tab === 'next' && (
          <NextSteps
            hasCost={est.total > 0}
            go={[() => openDialog('designs'), () => openDialog('share'), () => setTab('summary'), () => setTab('cost'), report, null]}
          />
        )}
      </div>
    </Modal>
  );
}

function MaterialsTab({ plan }: { plan: Parameters<typeof izbaMaterials>[0] }) {
  const rows = useMemo(() => materialRows(izbaMaterials(plan)), [plan]);
  return (
    <div className="space-y-2" data-testid="izba-materials">
      <p className="text-[13px] text-sand-700">كميات تقريبية من المباني والسور اللي في المخطط — خذها معك لما تطلب عروض أسعار من المقاول أو محل مواد البناء.</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2">
            <span className="text-sm">
              {r.icon} {r.label}
              {r.hint && <span className="block text-[11px] text-sand-500">{r.hint}</span>}
            </span>
            <b className="shrink-0 text-dune tabular-nums">{r.value}</b>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-sand-500">بلوك 40×20×20، لياسة 1.5 سم، صبة سقف 20 سم، و5–10% هدر. المهندس أو المقاول يعتمد الكميات النهائية.</p>
    </div>
  );
}

function CalendarTab({ plan }: { plan: Parameters<typeof monthTasks>[0] }) {
  const now = new Date().getMonth() + 1;
  const [m, setM] = useState(now);
  const load = useMemo(() => yearLoad(plan), [plan]);
  const tasks = useMemo(() => monthTasks(plan, m), [plan, m]);
  return (
    <div className="space-y-3" data-testid="izba-calendar">
      <p className="text-[13px] text-sand-700">شغل كل شهر حسب اللي في عزبتك — لمناخ قطر.</p>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {MONTHS.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => setM(i + 1)}
            data-testid={`month-${i + 1}`}
            className={cx('rounded-lg border px-1 py-1.5 text-[12px] font-bold', m === i + 1 ? 'border-gold-500 bg-gold-500 text-dune' : 'border-sand-200 bg-white text-sand-700 hover:border-gold-500')}
          >
            {name}
            {i + 1 === now && <span className="block text-[9px] font-normal">الحين</span>}
            <span className="block text-[10px] font-normal opacity-70">{load[i]} شغلة</span>
          </button>
        ))}
      </div>
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li key={t.text} className="flex gap-2 rounded-xl border border-sand-200 bg-white p-2.5 text-sm">
            <span className="text-lg leading-none">{t.icon}</span>
            <span>{t.text}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-sand-500">تذكيرات عامة — التحصينات والعلاجات يحددها البيطري، ومواعيد النخل تختلف شوي حسب الصنف.</p>
    </div>
  );
}

function Mini({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sand-200 bg-white p-2.5">
      <div className="text-[11px] text-sand-600">
        {icon} {label}
      </div>
      <div className="text-lg font-bold text-dune tabular-nums">{value}</div>
    </div>
  );
}

/** الخطوات الجاية بعد التصميم — بلغة بسيطة */
function NextSteps({ hasCost, go }: { hasCost: boolean; go: ((() => void) | null)[] }) {
  const steps: [string, string][] = [
    ['جرّب أكثر من فكرة', 'من «التصاميم» سوّ نسخة وجرّب توزيع ثاني، وقارن بينهم'],
    ['شاركها مع الأهل', 'أرسل لهم رابط يفتحون فيه المخطط والمجسم ويعطونك رأيهم'],
    ['شيّك التنبيهات', 'الحلال تحت الريح، الخزان يكفي، المولد بعيد عن الجلسات'],
    [hasCost ? 'راجع التكلفة' : 'حط الأسعار', 'عدّل الأسعار حسب عروض المقاولين اللي عندك'],
    ['طلّع تقرير المقاول', 'PDF فيه المخطط والمقاسات والكميات والتكلفة — يسهّل عليك عروض الأسعار'],
    ['البلدية', 'خذ المخطط معك لما تطلب الرخصة وتأكد من نسبة البناء والارتدادات'],
  ];
  return (
    <ol className="space-y-2" data-testid="izba-next">
      {steps.map(([t, d], i) => (
        <li key={t}>
          <button type="button" disabled={!go[i]} onClick={() => go[i]?.()} className="flex w-full items-center gap-3 rounded-xl border border-sand-200 bg-white p-3 text-right transition enabled:hover:border-gold-500 enabled:hover:bg-sand-50">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-500 font-bold text-dune">{i + 1}</span>
            <span className="flex-1">
              <b className="block text-dune">{t}</b>
              <span className="text-[13px] text-sand-700">{d}</span>
            </span>
            {go[i] && <span className="text-gold-700">←</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}
