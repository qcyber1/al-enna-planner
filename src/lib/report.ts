// تقرير للطباعة / PDF: صفحة فيها المخطط + لقطة 3D + الأرقام + جدول الكميات والتكلفة (يُرسل للمقاول)
import type { Project, Design } from '../types/plan';
import { computeSummary, costLines, DEFAULT_ESTIMATE } from './quantities';
import { renderPlanCanvas, dateLabel } from '../render2d/exportImage';
import { loadThumbs } from './storage';
import { DEV_LINE, OWNER_LINE } from './brand';
import { formatArea, formatMeters, formatNumber, round } from './geometry';
import { isIzba } from './izba';
import { CONTINGENCY_PCT, izbaEstimate, izbaPhases } from './izbaCost';
import { izbaInsights } from './izbaInsights';
import { izbaIrrigation } from './irrigation';
import { computePower } from './power';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export function buildReportHtml(project: Project, design: Design): string {
  const est = project.estimate ?? DEFAULT_ESTIMATE;
  const s = computeSummary(design.plan, est);
  const izba = isIzba(design.plan.land);
  const lines = costLines(s);
  const total = lines.reduce((sum, l) => sum + (project.prices[l.key] ?? 0) * l.qty, 0);
  const ie = izba ? izbaEstimate(design.plan, s, project.prices) : null;
  const ii = izba ? izbaInsights(design.plan, s) : null;
  const ir = izba ? izbaIrrigation(design.plan) : null;
  const pw = izba ? null : computePower(design.plan, project.power);
  const planImg = renderPlanCanvas(design.plan, { width: 1400, footer: false, names: true, dims: true }).toDataURL('image/jpeg', 0.85);
  const d3 = loadThumbs(design.id).d3;
  const stats: [string, string][] = ie ? [
    ['مساحة الأرض', formatArea(s.landArea, 0)],
    ['التكلفة التقديرية', `${money(ie.total)} ر.ق`],
    ['المدى المتوقع', `${money(ie.low)} – ${money(ie.high)} ر.ق`],
    ['المباني', `${ii!.builtArea} م² (${ii!.coveragePct}%)`],
    ['سعة الحلال', [ii!.sheep && `${ii!.sheep} غنم`, ii!.camels && `${ii!.camels} إبل`, ii!.horses && `${ii!.horses} خيل`].filter(Boolean).join(' • ') || '—'],
    ['الماي باليوم', `${money(ii!.waterPerDay)} لتر${ii!.tankDays !== null ? ` (الخزان ${ii!.tankDays} يوم)` : ''}`],
    ['الحمل الكهربائي', `${ii!.powerKw} kW — مولد ${ii!.generatorKva} KVA`],
    ['شبكة الري', ir && ir.flowLph ? `${ir.mainM} م رئيسي + ${ir.lateralM} م تنقيط — مضخة ${ir.pumpHp} حصان، ${ir.zones} محبس` : '—'],
    ['السور', formatMeters(s.fenceLength, 1)],
  ] : [
    ['مساحة الأرض', formatArea(s.landArea, 0)],
    ['الخيام', `${s.tentCount} — ${formatArea(s.tentArea, 1)}`],
    ['السعة التقديرية', s.capacity ? `≈ ${s.capacity} شخص جلوس` : '—'],
    ['أطوال الممرات', formatMeters(s.pathLength, 1)],
    ['العشب الصناعي (تقديري)', formatArea(s.turfArea, 1)],
    ['السياج أو التور', formatMeters(s.fenceLength, 1)],
    ['الحمامات / المغاسل', `${s.toilets} / ${s.sinks}`],
    ['الحمل الكهربائي', pw && pw.peakKw ? `${pw.peakKw} kW — مولد ${pw.generatorKva} kVA` : `${formatNumber(s.lights.totalWatts / 1000, 2)} kW`],
    ['الديزل بالليلة', pw?.litersPerNight ? `≈ ${pw.litersPerNight} لتر` : '—'],
    ['المساحة الفارغة', `${formatArea(s.freeArea, 0)} (${formatNumber(s.freePct, 0)}%)`],
  ];
  const izbaRows = ie
    ? ie.byGroup
        .map((g) => `<tr class="grp"><td colspan="4">${g.icon} ${esc(g.title)}</td><td class="n">${money(g.total)}</td></tr>` + ie.lines.filter((l) => l.group === g.id).map((l) => `<tr><td>${esc(l.label)}</td><td>${esc(l.unit)}</td><td class="n">${round(l.qty, 1)}</td><td class="n">${money(l.unitPrice)}</td><td class="n">${money(l.total)}</td></tr>`).join(''))
        .join('') + `<tr class="grp"><td colspan="4">🛟 احتياطي ${CONTINGENCY_PCT}% (توصيلات، تسوية، رخص)</td><td class="n">${money(ie.contingency)}</td></tr>`
    : '';
  const rows = lines
    .map((l) => {
      const price = project.prices[l.key];
      return `<tr><td>${esc(l.label)}</td><td>${esc(l.unit)}</td><td class="n">${round(l.qty, 2)}</td><td class="n">${price !== undefined ? money(price) : '—'}</td><td class="n">${price !== undefined ? money(price * l.qty) : '—'}</td></tr>`;
    })
    .join('');
  const tents = s.tents.map((t) => `<li>${esc(t.name)}: ${round(t.width, 2)} × ${round(t.depth, 2)} م${t.capacity != null ? ` — يكفي ~${t.capacity} شخص` : ''}</li>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project.name)} — ${esc(design.name)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans Arabic', system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif; color: #2b1d12; margin: 0; padding: 16px; background: #fff; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #c9973f; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { margin: 0; font-size: 22px; } .sub { color: #7a5c3e; font-size: 13px; }
  .imgs { display: grid; grid-template-columns: ${d3 ? '1.15fr 1fr' : '1fr'}; gap: 10px; margin-bottom: 12px; }
  .imgs img { width: 100%; border: 1px solid #e3d5b8; border-radius: 8px; display: block; }
  .cap { font-size: 11px; color: #7a5c3e; margin-top: 3px; text-align: center; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; }
  .stat { border: 1px solid #e3d5b8; border-radius: 8px; padding: 6px 8px; } .stat b { display: block; font-size: 14px; } .stat span { font-size: 11px; color: #7a5c3e; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; } th, td { border-bottom: 1px solid #eee3cc; padding: 5px 6px; text-align: right; }
  th { background: #f6efe0; } td.n, th.n { text-align: left; font-variant-numeric: tabular-nums; direction: ltr; }
  tr.grp td { background: #fbf6ea; font-weight: 700; }
  tfoot td { font-weight: 700; border-top: 2px solid #c9973f; font-size: 14px; }
  .note { font-size: 11px; color: #7a5c3e; margin-top: 8px; } ul { margin: 4px 0 10px; padding-right: 18px; font-size: 12px; columns: 2; }
  .bar { position: sticky; top: 0; background: #3b2a1e; color: #fff; padding: 10px; margin: -16px -16px 12px; display: flex; gap: 8px; align-items: center; justify-content: space-between; font-size: 14px; }
  .bar button { font: inherit; background: #d4a24c; color: #2b1d12; border: 0; border-radius: 8px; padding: 8px 14px; font-weight: 700; }
  @media print { .bar { display: none; } body { padding: 0; } .imgs, .stats, table { break-inside: avoid; } }
</style></head><body>
<div class="bar"><span>اضغط «طباعة» واختر «حفظ كـ PDF» عشان ترسله للمقاول</span><button onclick="window.print()">طباعة / PDF</button></div>
<header><div><h1>${esc(project.name)} — ${esc(design.name)}</h1><div class="sub">${izba ? 'i3enna للعزب' : 'مخطط العنة'} • ${esc(dateLabel())}</div></div><div class="sub">الأرض ${round(design.plan.land.width, 1)} × ${round(design.plan.land.depth, 1)} م</div></header>
<div class="imgs"><div><img src="${planImg}" alt="المخطط"><div class="cap">المخطط (مسقط علوي بالمقاسات)</div></div>${d3 ? `<div><img src="${d3}" alt="المجسم"><div class="cap">المجسم ثلاثي الأبعاد</div></div>` : ''}</div>
<div class="stats">${stats.map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
${tents ? `<b style="font-size:13px">الخيام</b><ul>${tents}</ul>` : ''}
${pw && pw.lines.some((l) => l.watts > 0) ? `<b style="font-size:13px">⚡ الكهرباء (${pw.generatorKva} kVA)</b><ul>${pw.lines.filter((l) => l.watts > 0).map((l) => `<li>${esc(l.name)}: ${formatNumber(l.watts / 1000, 1)} kW${l.cableM ? ` — ${l.cableM} م كيبل ${l.cableMm2 ? l.cableMm2 + ' مم²' : '(لوحة فرعية)'}` : ''}</li>`).join('')}</ul>${pw.cableByMm2.length ? `<div class="note">الكيابل تقريباً: ${pw.cableByMm2.map((c) => `${c.m} م × ${c.mm2} مم²`).join(' • ')}</div>` : ''}` : ''}
<table><thead><tr><th>البند</th><th>الوحدة</th><th class="n">الكمية</th><th class="n">سعر الوحدة (ر.ق)</th><th class="n">الإجمالي (ر.ق)</th></tr></thead>
<tbody>${(ie ? izbaRows : rows) || '<tr><td colspan="5">ما في بنود</td></tr>'}</tbody>
<tfoot><tr><td colspan="4">الإجمالي التقديري${ie ? ` (المتوقع ${money(ie.low)} – ${money(ie.high)})` : total ? '' : ' (ما انكتبت أسعار)'}</td><td class="n">${money(ie ? ie.total : total)}</td></tr></tfoot></table>
${ie && izbaPhases(ie).length > 1 ? `<p class="note"><b>على مراحل:</b> ${izbaPhases(ie).map((p) => `${p.icon} المرحلة ${p.n} (${esc(p.title)}): ${money(p.total)} ر.ق`).join(' • ')}</p>` : ''}
<p class="note">${ie ? 'الكميات محسوبة تلقائياً من المخطط، والأسعار تقريبية لسوق قطر (أو معدّلة من صاحب العزبة) — للتخطيط فقط وما تغني عن عرض سعر رسمي من المقاول.' : 'الكميات محسوبة تلقائياً من المخطط والأسعار مكتوبة من صاحب العنة — للتقدير فقط، والمقاسات النهائية تتأكد في الموقع.'}</p>
<p class="note" style="border-top:1px solid #eee3cc;padding-top:6px">${esc(DEV_LINE)} • ${esc(OWNER_LINE)}</p>
</body></html>`;
}

/** يفتح التقرير في نافذة جديدة (أو يحمّله كملف إذا المتصفح منع النافذة) */
export function openReport(project: Project, design: Design): 'opened' | 'downloaded' {
  const html = buildReportHtml(project, design);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'opened';
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = `al-enna-report-${Date.now()}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
