import { describe, expect, it } from 'vitest';
import { parseBuyerPhone, parsePhone } from '../buyer';

describe('رقم جوال الشراء (اللي يقبله نظام الدفع)', () => {
  it('القطري 8 أرقام يمشي ويصير 974', () => {
    expect(parseBuyerPhone('5512 3456').phone).toBe('97455123456');
    expect(parseBuyerPhone('+974 5512 3456').phone).toBe('97455123456');
    expect(parseBuyerPhone('٥٥١٢٣٤٥٦').phone).toBe('97455123456');
  });
  it('الأرقام الغلط من العملاء الحقيقيين ترجع رسالة واضحة', () => {
    expect(parseBuyerPhone('8897796495').error).toMatch(/8 أرقام/);
    expect(parseBuyerPhone('555188699').error).toMatch(/8 أرقام/);
    expect(parseBuyerPhone('0501234567').error).toBeTruthy();
  });
  it('الخليجي برمز دولته، والدولي بـ + يمشون', () => {
    expect(parseBuyerPhone('+965 5000 1234').phone).toBe('96550001234');
    expect(parseBuyerPhone('00966501234567').phone).toBe('966501234567');
    expect(parseBuyerPhone('+91 98765 43210').phone).toBe('919876543210');
    expect(parseBuyerPhone('96612345678').error).toBeTruthy();
  });
  it('الدخول برقم الجوال ما تغيّر (العملاء القدام ما يتأثرون)', () => {
    expect(parsePhone('8897796495').phone).toBe('8897796495');
  });
});
