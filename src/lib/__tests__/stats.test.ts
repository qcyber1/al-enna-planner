import { describe, it, expect, vi, beforeEach } from 'vitest';
import { statsSid, track } from '../stats';

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

describe('إحصائيات مسار البيع', () => {
  beforeEach(() => {
    Object.assign(globalThis, { localStorage: new MemStorage() });
  });
  it('معرّف عشوائي ثابت لنفس المتصفح', () => {
    const a = statsSid();
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(statsSid()).toBe(a);
  });
  it('يرسل الحدث مع المعرّف بس (بدون بيانات شخصية)', () => {
    const spy = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: spy });
    track('trial_start');
    expect(spy).toHaveBeenCalledOnce();
    expect((spy.mock.calls[0] as unknown[])[0]).toBe('/api/track');
  });
});
