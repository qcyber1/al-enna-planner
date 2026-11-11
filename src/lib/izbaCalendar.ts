// تقويم العزبة: شغل كل شهر حسب اللي فيها (نخل، حلال، خيل، هجن، زراعة، مسبح، ري) — لمناخ قطر
// تذكيرات عامة للتخطيط — التحصينات والعلاجات يحددها البيطري.
import type { Plan } from '../types/plan';

export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

type Need = 'palm' | 'sheep' | 'camel' | 'horse' | 'farm' | 'pool' | 'irrigation' | 'generator' | 'ac' | 'any';

interface Task {
  months: number[]; // 1..12
  need: Need;
  icon: string;
  text: string;
}

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const TASKS: Task[] = [
  // النخل
  { months: [1, 2], need: 'palm', icon: '🌴', text: 'نظّف النخل من السعف اليابس والكرب، وسمّد سماد عضوي' },
  { months: [2, 3], need: 'palm', icon: '🌼', text: 'موسم التلقيح (التنبيت) — جهّز اللقاح من الفحل' },
  { months: [4, 5], need: 'palm', icon: '🌴', text: 'خف العذوق وتدليتها، وزوّد الري تدريجياً' },
  { months: [6, 7, 8, 9], need: 'palm', icon: '🍯', text: 'موسم الرطب والتمر — غطّ العذوق بالشبك عن الطيور واجنِ أول بأول' },
  { months: [10, 11], need: 'palm', icon: '✂️', text: 'تقليم النخل بعد الصرام، وتسميد قبل الشتا' },
  // الغنم
  { months: [3, 4], need: 'sheep', icon: '🐑', text: 'جز الصوف قبل الحر' },
  { months: [3, 9], need: 'sheep', icon: '💉', text: 'التحصينات الموسمية للحلال — راجع البيطري' },
  { months: [6, 7, 8, 9], need: 'sheep', icon: '☀️', text: 'الحر: ظل كافي وماي بارد دايم، ورش الحظاير ومكافحة الذباب' },
  { months: [10, 11, 12], need: 'sheep', icon: '🍼', text: 'موسم المواليد غالباً — جهّز ركن دافي للمواليد وعلف إضافي للأمهات' },
  { months: [1, 4, 7, 10], need: 'sheep', icon: '🧹', text: 'تنظيف الحظاير وتغيير الفرشة، وتطهير المعالف والمشارب' },
  // الهجن والإبل
  { months: [10, 11, 12, 1, 2, 3], need: 'camel', icon: '🐪', text: 'موسم السباقات — تمرين يومي على المضمار وعلف الهجن' },
  { months: [6, 7, 8], need: 'camel', icon: '☀️', text: 'الصيف: راحة للهجن، ظل وماي، وتمرين خفيف الصبح بدري' },
  { months: [4, 9], need: 'camel', icon: '💉', text: 'فحص بيطري وتحصينات قبل الصيف وقبل الموسم' },
  // الخيل
  { months: [1, 3, 5, 7, 9, 11], need: 'horse', icon: '🐎', text: 'البيطار (تقليم الحوافر والحدوة) كل 6–8 أسابيع' },
  { months: [3, 9], need: 'horse', icon: '💉', text: 'تطعيم الخيل وطارد الديدان — راجع البيطري' },
  { months: [6, 7, 8], need: 'horse', icon: '☀️', text: 'الحر: التمرين الصبح بدري أو بالليل، ومراوح وتهوية في الإسطبل' },
  // الزراعة
  { months: [9, 10], need: 'farm', icon: '🌱', text: 'جهّز الأحواض وازرع الخضار الشتوية (طماط، خيار، بقدونس…)' },
  { months: [12, 1, 2, 3], need: 'farm', icon: '🥬', text: 'موسم حصاد الخضار — ازرع دفعات جديدة كل شهر' },
  { months: [5, 6, 7, 8], need: 'farm', icon: '🌡️', text: 'الحر: غطّ الأحواض بشبك تظليل، والبيت المحمي يحتاج تبريد' },
  // الري
  { months: [3, 6, 9, 12], need: 'irrigation', icon: '💧', text: 'نظّف فلاتر الري والنقاطات المسدودة، وشيّك التسريبات' },
  { months: [5], need: 'irrigation', icon: '⏱️', text: 'زوّد مدة الري للصيف (تقريباً الضعف) وخلها بالليل أو قبل الفجر' },
  { months: [10], need: 'irrigation', icon: '⏱️', text: 'رجّع مدة الري للشتا — الماي الزايد يضر النخل والزرع' },
  // المسبح
  { months: [4], need: 'pool', icon: '🏊', text: 'افتح المسبح للصيف: تنظيف، فلتر، وفحص المضخة' },
  { months: [5, 6, 7, 8, 9], need: 'pool', icon: '🧪', text: 'تنظيف أسبوعي وفحص الكلور' },
  { months: [11], need: 'pool', icon: '🏊', text: 'غطّ المسبح للشتا أو خفّف تشغيل المضخة' },
  // المولد والتكييف
  { months: [4], need: 'ac', icon: '❄️', text: 'صيانة المكيفات وغسيل الفلاتر قبل الصيف' },
  { months: [10], need: 'generator', icon: '🔧', text: 'صيانة المولد (زيت وفلاتر) قبل موسم الشتا والطلعات' },
  // عام
  { months: [11], need: 'any', icon: '🌧️', text: 'قبل المطر: شيّك تصريف المياه والأسطح والمزاريب' },
  { months: [12, 1, 2], need: 'any', icon: '🔥', text: 'موسم الشتا والطلعات: جهّز الحطب والضو والجلسات الشتوية، وشيّك الدفايات' },
  { months: [5], need: 'any', icon: '🔥', text: 'قبل الصيف: طفايات الحريق، والأسلاك المكشوفة، وتظليل الجلسات' },
];

export function izbaHas(plan: Plan): Record<Need, boolean> {
  const k = new Set(plan.elements.map((e) => e.kind));
  return {
    palm: k.has('palm'),
    sheep: k.has('sheep-pen') || k.has('animal-shade'),
    camel: k.has('camel-pen'),
    horse: k.has('horse-stable'),
    farm: k.has('farm-bed') || k.has('greenhouse'),
    pool: k.has('pool'),
    irrigation: k.has('palm') || k.has('tree') || k.has('farm-bed') || k.has('greenhouse'),
    generator: k.has('generator'),
    ac: k.has('room') || k.has('majlis-room') || k.has('worker-room'),
    any: true,
  };
}

/** شغل شهر معيّن (1..12) لهالعزبة */
export function monthTasks(plan: Plan, month: number): { icon: string; text: string }[] {
  const has = izbaHas(plan);
  return TASKS.filter((t) => t.months.includes(month) && has[t.need]).map(({ icon, text }) => ({ icon, text }));
}

/** عدد المهام لكل شهر (للشريط) */
export function yearLoad(plan: Plan): number[] {
  return ALL.map((m) => monthTasks(plan, m).length);
}
