// «🏗️ متابعة البناء»: شغل كل مرحلة حسب اللي في المخطط (يصحّح عليه)، والدفعات للمقاول مقابل التقدير
import type { BuildLog, Plan } from '../types/plan';

export interface BuildTask {
  id: string;
  text: string;
}
export interface BuildPhase {
  n: 1 | 2 | 3;
  title: string;
  icon: string;
  tasks: BuildTask[];
}

export function buildTasks(plan: Plan): BuildPhase[] {
  const has = (...k: string[]) => plan.elements.some((e) => k.includes(e.kind));
  const rooms = plan.elements.filter((e) => e.kind === 'room');
  const hasRoom = (re: RegExp) => rooms.some((r) => re.test(r.name) || re.test(r.room?.type ?? ''));
  const t = (id: string, text: string, on = true): BuildTask[] => (on ? [{ id, text }] : []);
  const p1: BuildTask[] = [
    ...t('p1-permit', 'رخصة البناء من البلدية ومخطط معتمد'),
    ...t('p1-level', 'تسوية الأرض ودك التربة'),
    ...t('p1-fence', 'السور', !!plan.land.fence?.enabled),
    ...t('p1-gate', 'البوابة الرئيسية'),
    ...t('p1-power', has('generator') ? 'المولد وخزان الديزل' : 'توصيل الكهرباء (كهرماء)'),
    ...t('p1-water', 'خزان الماي والتمديدات', has('water-tank', 'water-bladder')),
    ...t('p1-wc', 'الحمامات الخارجية والمغاسل', has('toilet', 'sink')),
    ...t('p1-worker', 'غرفة / سكن العامل', has('worker-room') || hasRoom(/عامل|العمال/)),
    ...t('p1-parking', 'المواقف والمظلات', has('parking')),
  ];
  const building = rooms.length > 0 || has('majlis-room');
  const p2: BuildTask[] = building
    ? [
        ...t('p2-found', 'الحفر وصبة الأساسات'),
        ...t('p2-walls', 'البلوك (الجدران)'),
        ...t('p2-roof', 'صبة السقف أو تركيب السقف'),
        ...t('p2-mep', 'التمديدات: الكهرباء والسباكة والتكييف'),
        ...t('p2-plaster', 'اللياسة والعزل'),
        ...t('p2-finish', 'الأرضيات والجدران والصبغ'),
        ...t('p2-wet', 'تشطيب الحمامات والمطبخ', hasRoom(/bathroom|kitchen|حمام|مطبخ/)),
        ...t('p2-doors', 'الأبواب والشبابيك'),
        ...t('p2-ac', 'المكيفات'),
        ...t('p2-furn', 'الأثاث والجلسات الداخلية', has('sofa-l', 'bed', 'tv-unit')),
        ...t('p2-women', 'ملحق النساء', hasRoom(/نساء/)),
      ]
    : [];
  const p3: BuildTask[] = [
    ...t('p3-pens', 'الحظاير والمظلات', has('sheep-pen', 'camel-pen', 'animal-shade')),
    ...t('p3-stable', 'إسطبل الخيل', has('horse-stable')),
    ...t('p3-mesh', 'شبك الحلال', has('pen-fence')),
    ...t('p3-trough', 'المعالف والمشارب', has('trough')),
    ...t('p3-feed', 'مخزن العلف', has('feed-store')),
    ...t('p3-irr', 'شبكة الري بالتنقيط', has('palm', 'tree', 'farm-bed', 'greenhouse')),
    ...t('p3-plant', 'زراعة النخل والشجر', has('palm', 'tree')),
    ...t('p3-farm', 'أحواض الزراعة والبيت المحمي', has('farm-bed', 'greenhouse')),
    ...t('p3-pool', 'المسبح', has('pool')),
    ...t('p3-courts', 'الملاعب', has('football', 'volleyball')),
    ...t('p3-paths', 'الممرات والحشيش', has('path')),
    ...t('p3-lights', 'الإنارة الخارجية', has('light-pole', 'flood-light', 'string-lights', 'ground-light')),
    ...t('p3-out', 'الجلسات الخارجية والشوي', has('canopy', 'seating', 'majlis-rug', 'bbq', 'fire-pit', 'tannour', 'outdoor-kitchen')),
  ];
  return (
    [
      { n: 1 as const, title: 'السور والخدمات الأساسية', icon: '🧱', tasks: p1 },
      { n: 2 as const, title: 'المباني والمجلس', icon: '🏠', tasks: p2 },
      { n: 3 as const, title: 'الحلال والزراعة والجلسات', icon: '🌴', tasks: p3 },
    ] as BuildPhase[]
  ).filter((p) => p.tasks.length);
}

export interface BuildProgress {
  total: number;
  done: number;
  pct: number;
  paid: number;
  /** المرحلة الحالية (أول مرحلة فيها شغل ما خلص) */
  current: BuildPhase | null;
}

export function buildProgress(phases: BuildPhase[], log: BuildLog | undefined): BuildProgress {
  const done = new Set(log?.done ?? []);
  const all = phases.flatMap((p) => p.tasks);
  const d = all.filter((x) => done.has(x.id)).length;
  return {
    total: all.length,
    done: d,
    pct: all.length ? Math.round((d / all.length) * 100) : 0,
    paid: (log?.payments ?? []).reduce((t, p) => t + p.amount, 0),
    current: phases.find((p) => p.tasks.some((x) => !done.has(x.id))) ?? null,
  };
}
