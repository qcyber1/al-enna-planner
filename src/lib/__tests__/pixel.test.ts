import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Meta Pixel', () => {
  let calls: unknown[][];
  beforeEach(() => {
    calls = [];
    const store = new Map<string, string>();
    Object.assign(globalThis, {
      window: { fbq: (...a: unknown[]) => calls.push(a) },
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
    });
    vi.resetModules();
  });

  it('الشراء ينحسب مرة وحدة لكل طلب حتى لو تحدّثت الصفحة', async () => {
    const { trackPurchase } = await import('../pixel');
    trackPurchase('EN-1001', 299);
    trackPurchase('EN-1001', 299);
    expect(calls).toHaveLength(1);
    expect(calls[0].slice(0, 3)).toEqual(['track', 'Purchase', expect.objectContaining({ value: 299, currency: 'QAR' })]);
    expect(calls[0][3]).toEqual({ eventID: 'EN-1001' });
  });

  it('بدء الدفع والتجربة', async () => {
    const { trackCheckout, trackTrial } = await import('../pixel');
    trackCheckout(299);
    trackTrial();
    expect(calls.map((c) => c[1])).toEqual(['InitiateCheckout', 'StartTrial']);
  });

  it('ما يخرب شي لو البكسل محجوب (مانع إعلانات)', async () => {
    Object.assign(globalThis, { window: {} });
    const { trackPurchase } = await import('../pixel');
    expect(() => trackPurchase('EN-1', 1)).not.toThrow();
  });

  it('المطابقة المتقدمة: الجوال يصير بمفتاح قطر، والإيميل بحروف صغيرة', async () => {
    const { setBuyer, PIXEL_ID } = await import('../pixel');
    setBuyer({ phone: '5512 3456', email: ' Ali@Mail.com ', name: 'علي العوض' });
    expect(calls[0][0]).toBe('init');
    expect(calls[0][1]).toBe(PIXEL_ID);
    expect(calls[0][2]).toEqual({ country: 'qa', ph: '97455123456', em: 'ali@mail.com', fn: 'علي' });
  });

  it('أحداث مسار التجربة', async () => {
    const { trackTrialEnded, trackExportBlocked, trackDemoBuyClick } = await import('../pixel');
    trackTrialEnded();
    trackExportBlocked('report');
    trackDemoBuyClick();
    expect(calls.map((c) => [c[0], c[1]])).toEqual([
      ['trackCustom', 'TrialEnded'],
      ['trackCustom', 'ExportBlocked'],
      ['trackCustom', 'DemoBuyClick'],
    ]);
    expect(calls[1][2]).toEqual({ what: 'report' });
  });
});
