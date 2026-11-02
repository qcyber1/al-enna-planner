import type { Land, Plan } from '../types/plan';
import { DEFAULT_GEN, generateDesigns, type GenInput } from './generator';
import { defaultLand } from './sample';

export interface Template {
  id: 'youth' | 'family' | 'sea';
  title: string;
  icon: string;
  blurb: string;
  land: () => Land;
  input: GenInput;
}

function square(size: number): Land {
  const l = defaultLand();
  return { ...l, width: size, depth: size, entrance: { ...l.entrance, offset: size / 2 } };
}

export const TEMPLATES: Template[] = [
  {
    id: 'youth',
    title: 'عنة شباب 50×50',
    icon: '🏐',
    blurb: 'مجلس + 3 خيام، ملعب طائرة بكشافاته، شاشة مباريات، ضو وشوي',
    land: () => square(50),
    input: { ...DEFAULT_GEN, tents: 3, court: true, screen: true, firePit: true, bbq: true, parking: 4, kids: false },
  },
  {
    id: 'family',
    title: 'عنة عائلية 25×25',
    icon: '👨‍👩‍👧',
    blurb: 'مجلس وخيمة، ألعاب أطفال، رقدة ومطبخ، مصلى وضو',
    land: () => square(25),
    input: { ...DEFAULT_GEN, tents: 1, court: false, kids: true, screen: false, bbq: false, parking: 2, toilets: 2, sinks: 1, sleepCabins: 1, kitchenCabins: 1 },
  },
  {
    id: 'sea',
    title: 'عنة بحرية',
    icon: '🌊',
    blurb: 'المجلس يطل على البحر مع جلسة بحرية، والحزم على الجوانب',
    land: () => ({ ...square(50), surroundings: ['sea', 'hazm', 'open', 'hazm'] }),
    input: { ...DEFAULT_GEN, tents: 3, court: true, firePit: true, bbq: true, parking: 3 },
  },
];

/** يبني مخطط القالب: أفضل فكرة من المولّد (أقل تنبيهات) */
export function buildTemplate(t: Template): Plan {
  const res = generateDesigns(t.land(), t.input);
  const best = [...res].sort((a, b) => a.issues - b.issues || a.skipped.length - b.skipped.length)[0];
  return best.plan;
}
