import { describe, expect, it } from 'vitest';
import { buildShareLink, readShareFromHash } from '../share';
import { createSamplePlan } from '../sample';

describe('رابط مشاركة التصميم', () => {
  it('ما ينقل ?ref= حق صديق ثاني ولا باراميترات الدفع', () => {
    const l = buildShareLink('تصميم', createSamplePlan(), 'https://www.i3enna.qa/?ref=ABCD1234EFGH&paid=1#old');
    expect(l.url.startsWith('https://www.i3enna.qa/#share=')).toBe(true);
    expect(l.url).not.toContain('ref=');
    expect(l.url).not.toContain('paid=');
  });
  it('الرابط يرجع نفس التصميم', () => {
    const plan = createSamplePlan();
    const l = buildShareLink('عنتنا', plan, 'https://www.i3enna.qa/');
    const d = readShareFromHash(l.url.slice(l.url.indexOf('#')))!;
    expect(d.name).toBe('عنتنا');
    expect(d.plan.elements.length).toBe(plan.elements.length);
  });
});
