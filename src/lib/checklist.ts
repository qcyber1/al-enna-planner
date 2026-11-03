// قائمة التجهيز قبل التركيب: مستخرجة من المخطط (تتشيّك وتنحفظ لكل تصميم)
import type { ElementKind } from '../types/plan';
import type { Summary } from './quantities';
import { CATALOG_BY_KIND, PATH_MATERIAL_LABELS } from './catalog';

export interface CheckItem {
  id: string;
  text: string;
  hint?: string;
}
export interface CheckGroup {
  title: string;
  icon: string;
  items: CheckItem[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildChecklist(s: Summary): CheckGroup[] {
  const c = s.counts;
  const label = (k: ElementKind) => CATALOG_BY_KIND[k].label;
  const groups: CheckGroup[] = [];
  const g = (title: string, icon: string, items: (CheckItem | false | null | undefined)[]) => {
    const list = items.filter(Boolean) as CheckItem[];
    if (list.length) groups.push({ title, icon, items: list });
  };

  g('الخيام والجلسات', '⛺', [
    ...s.tents.map((t) => ({ id: `tent:${t.id}`, text: `${t.name} — ${r1(t.width)} × ${r1(t.depth)} م`, hint: t.capacity != null ? `يكفي ~${t.capacity} شخص` : undefined })),
    c['canopy'] > 0 && { id: 'canopy', text: `${label('canopy')} × ${c['canopy']}` },
    c['majlis-rug'] > 0 && { id: 'rug', text: `سجاد وجلسات أرضية × ${c['majlis-rug']}` },
    c['seating'] > 0 && { id: 'seating', text: `${label('seating')} × ${c['seating']}` },
    c['dakka'] > 0 && { id: 'dakka', text: `${label('dakka')} × ${c['dakka']}` },
    c['partition'] > 0 && { id: 'partition', text: `${label('partition')} × ${c['partition']}` },
    s.tentCount > 0 && { id: 'pegs', text: 'أوتاد وحبال احتياط + مطرقة', hint: 'للرياح الشمالية' },
  ]);

  g('الملعب والترفيه', '🏐', [
    s.courts.length > 0 && { id: 'court', text: `ملعب طائرة ${r1(s.courts[0].width)} × ${r1(s.courts[0].depth)} م + شبكة وأعمدة وكورة`, hint: 'شريط تخطيط للخطوط' },
    c['screen'] > 0 && { id: 'screen', text: `${label('screen')} + سماعات`, hint: 'وصلة HDMI ورسيفر' },
    c['kids-area'] > 0 && { id: 'kids', text: `${label('kids-area')} + أرضية مطاطية` },
  ]);

  const kw = s.lights.totalWatts / 1000;
  g('الإنارة والكهرباء', '💡', [
    s.lights.poles > 0 && { id: 'poles', text: `أعمدة إنارة × ${s.lights.poles}` },
    s.lights.floods > 0 && { id: 'floods', text: `كشافات LED × ${s.lights.floods}` },
    s.lights.stringLength > 0 && { id: 'strings', text: `سلاسل ليتات ≈ ${Math.ceil(s.lights.stringLength)} م`, hint: `≈ ${s.lights.bulbs} ليت` },
    s.lights.groundLights + s.lights.pathEdgeLights > 0 && { id: 'ground', text: `ليتات أرضية للممرات × ${s.lights.groundLights + s.lights.pathEdgeLights}` },
    s.lights.entranceLights > 0 && { id: 'entrance', text: `إنارة المدخل × ${s.lights.entranceLights}` },
    s.lights.lanterns + s.lights.tentEntranceLights > 0 && { id: 'lanterns', text: `فوانيس مداخل الخيام × ${s.lights.lanterns + s.lights.tentEntranceLights}` },
    kw > 0 && { id: 'genpower', text: `مولد لا يقل عن ${Math.max(5, Math.ceil((kw * 1.5) / 0.8))} kVA`, hint: `حمل الإنارة ≈ ${r1(kw)} kW + احتياط للمكيفات والمطبخ` },
    c['generator'] > 0 && { id: 'diesel', text: c['diesel-tank'] > 0 ? 'تعبئة خزان الديزل' : 'ديزل للمولد (جوالين)' },
    kw > 0 && { id: 'cables', text: 'أسلاك تمديد خارجية + مشتركات مقاومة للماء + لوحة قواطع' },
  ]);

  g('الممرات والأرضيات', '🟩', [
    ...Object.entries(s.pathByMaterial)
      .filter(([m, v]) => v.area > 0 && m !== 'wood-turf')
      .map(([m, v]) => ({ id: `path:${m}`, text: `${PATH_MATERIAL_LABELS[m as keyof typeof PATH_MATERIAL_LABELS]} ≈ ${Math.ceil(v.area)} م²`, hint: `طول ${r1(v.length)} م` })),
    s.woodTurf.area > 0 && { id: 'woodturf', text: `ممر خشب + عشب: ${s.woodTurf.totalBeams} خشبة + ${s.woodTurf.sheets} لوح + ${Math.ceil(s.woodTurf.turfArea)} م² عشب` },
    s.fenceLength > 0 && { id: 'fence', text: `سياج أو تور ≈ ${Math.ceil(s.fenceLength)} م` },
  ]);

  g('المرافق', '🚿', [
    s.toilets > 0 && { id: 'toilets', text: `كبائن حمام × ${s.toilets}`, hint: 'مناديل ومعطر' },
    s.sinks > 0 && { id: 'sinks', text: `مغاسل × ${s.sinks}`, hint: 'صابون ومناشف' },
    c['water-tank'] > 0 && { id: 'water', text: `تعبئة خزان الماء × ${c['water-tank']}` },
    c['sleep-cabin'] > 0 && { id: 'sleep', text: `كبائن رقدة × ${c['sleep-cabin']} + فرش وبطانيات` },
    c['kitchen-cabin'] + c['outdoor-kitchen'] > 0 && { id: 'kitchen', text: 'أدوات المطبخ + غاز + ثلاجة' },
    c['bbq'] > 0 && { id: 'bbq', text: 'فحم وشواية وملاقط' },
    c['fire-pit'] > 0 && { id: 'fire', text: 'حطب للضو + دلال وفناجين' },
    c['tannour'] > 0 && { id: 'tannour', text: 'تنور + حطب وطحين للخبز' },
    c['prayer-area'] > 0 && { id: 'prayer', text: 'سجاد صلاة + بوصلة/تطبيق القبلة' },
    s.parkingSlots > 0 && { id: 'parking', text: `تسوية مواقف السيارات (${s.parkingSlots} مواقف)` },
  ]);

  const extinguishers = Math.max(1, s.tentCount + (c['kitchen-cabin'] + c['outdoor-kitchen'] > 0 ? 1 : 0) + (c['generator'] > 0 ? 1 : 0));
  g('السلامة', '🧯', [
    { id: 'ext', text: `طفايات حريق × ${extinguishers}`, hint: 'وحدة لكل خيمة + المطبخ + المولد' },
    { id: 'firstaid', text: 'شنطة إسعافات أولية' },
    c['fire-pit'] > 0 && { id: 'sand', text: 'رمل أو بطانية إطفاء جنب الضو' },
    { id: 'permit', text: 'تصريح التخييم (إذا مطلوب في المنطقة)' },
  ]);

  return groups;
}

export const checklistCount = (groups: CheckGroup[]) => groups.reduce((n, g) => n + g.items.length, 0);
