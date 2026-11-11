import { describe, expect, it } from 'vitest';
import { buildIzba } from '../izba';
import { monthTasks, yearLoad } from '../izbaCalendar';

describe('تقويم العزبة', () => {
  it('الزراعة فيها تلقيح النخل بفبراير وما فيها شغل حلال', () => {
    const p = buildIzba('farm', 1);
    expect(monthTasks(p, 2).some((t) => t.text.includes('التلقيح'))).toBe(true);
    expect(monthTasks(p, 3).some((t) => t.text.includes('الصوف'))).toBe(false);
  });
  it('الحلال فيها جز الصوف، والخيل فيها البيطار، والهجن فيها السباقات', () => {
    expect(monthTasks(buildIzba('livestock', 1), 3).some((t) => t.text.includes('الصوف'))).toBe(true);
    expect(monthTasks(buildIzba('horses', 1), 1).some((t) => t.text.includes('البيطار'))).toBe(true);
    expect(monthTasks(buildIzba('camels', 2), 11).some((t) => t.text.includes('السباقات'))).toBe(true);
  });
  it('كل شهر فيه شغل والمسبح بس في الاستراحات', () => {
    const rest = buildIzba('family', 1);
    expect(yearLoad(rest).every((n) => n > 0)).toBe(true);
    expect(monthTasks(rest, 7).some((t) => t.text.includes('الكلور'))).toBe(true);
    expect(monthTasks(buildIzba('livestock', 1), 7).some((t) => t.text.includes('الكلور'))).toBe(false);
  });
});
