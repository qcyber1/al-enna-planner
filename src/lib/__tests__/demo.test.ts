import { beforeEach, describe, expect, it } from 'vitest';

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe('التجربة المجانية', () => {
  beforeEach(() => {
    Object.assign(globalThis, { localStorage: new MemStorage(), sessionStorage: new MemStorage() });
  });

  it('ما تتجدد بفتح تبويب جديد (تنحفظ في localStorage)', async () => {
    const { startDemo, demoLeft, DEMO_MS } = await import('../demo');
    startDemo(1_000);
    // تبويب جديد = sessionStorage فاضي
    Object.assign(globalThis, { sessionStorage: new MemStorage() });
    expect(demoLeft(1_000 + 60_000)).toBe(DEMO_MS - 60_000);
    startDemo(5_000_000); // محاولة بداية ثانية ما تغيّر شي
    expect(demoLeft(1_000 + DEMO_MS + 1)).toBe(0);
  });

  it('بعد ما تخلص تبان إنها انستخدمت حتى بعد إعادة التحميل', async () => {
    const { startDemo, demoUsed, DEMO_MS } = await import('../demo');
    expect(demoUsed(0)).toBe(false);
    startDemo(10);
    expect(demoUsed(10 + DEMO_MS - 1)).toBe(false);
    expect(demoUsed(10 + DEMO_MS + 1)).toBe(true);
  });

  it('يقرأ التجارب القديمة المحفوظة في sessionStorage', async () => {
    const { demoLeft, DEMO_MS } = await import('../demo');
    (globalThis as unknown as { sessionStorage: MemStorage }).sessionStorage.setItem('enna.demo.start', '100');
    expect(demoLeft(100)).toBe(DEMO_MS);
  });
});
