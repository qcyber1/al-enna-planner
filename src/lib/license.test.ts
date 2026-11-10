import { beforeEach, describe, expect, it } from 'vitest';
import { getProducts, izbaAccess, landingSite, markDemoSite, saveProducts, setIzbaLive } from './license';

// بيئة node: localStorage ورابط الصفحة بسيطين
const store = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
const loc = { pathname: '/', search: '' };
const window = {
  location: loc,
  history: {
    replaceState: (_: unknown, __: string, url: string) => {
      const u = new URL(url, 'http://x');
      loc.pathname = u.pathname;
      loc.search = u.search;
    },
  },
};
Object.assign(globalThis, { localStorage, window });

describe('ترخيص العزبة', () => {
  beforeEach(() => {
    localStorage.clear();
    setIzbaLive(false);
    window.history.replaceState(null, '', '/');
  });
  it('عميل قديم بدون منتجات = عنة', () => {
    localStorage.setItem('enna.license.token', 'x.y');
    expect(getProducts()).toEqual(['enna']);
    expect(izbaAccess()).toBe('hidden');
  });
  it('صاحب العزبة تنفتح له', () => {
    localStorage.setItem('enna.license.token', 'x.y');
    saveProducts(['enna', 'izba', 'hack']);
    expect(getProducts()).toEqual(['enna', 'izba']);
    expect(izbaAccess()).toBe('full');
  });
  it('رابط ?izba=1 ما يفتح العزبة', () => {
    window.history.replaceState(null, '', '/?izba=1');
    expect(izbaAccess()).toBe('hidden');
  });
  it('صفحة /izba', () => {
    window.history.replaceState(null, '', '/izba/');
    expect(landingSite()).toBe('izba');
    window.history.replaceState(null, '', '/');
    expect(landingSite()).toBe('enna');
  });
  it('التجربة من صفحة العنة ما تفتح العزبة', () => {
    markDemoSite('enna');
    expect(izbaAccess()).toBe('hidden');
  });
  it('بعد الإطلاق: تطلع مقفلة مع زر الترقية، وصاحبها تنفتح له', () => {
    setIzbaLive(true);
    localStorage.setItem('enna.license.token', 'x.y');
    expect(izbaAccess()).toBe('locked');
    saveProducts(['enna', 'izba']);
    expect(izbaAccess()).toBe('full');
  });
  it('قبل الإطلاق: صاحب كود العزبة (الفريق) تنفتح له', () => {
    localStorage.setItem('enna.license.token', 'x.y');
    saveProducts(['enna', 'izba']);
    expect(izbaAccess()).toBe('full');
  });
});
