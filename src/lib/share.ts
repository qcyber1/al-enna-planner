import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Design, Plan } from '../types/plan';
import { sanitizePlan, ImportError } from './sanitize';
import { uid } from './id';

/** الحد الآمن لطول الرابط (أغلب المتصفحات وتطبيقات المراسلة تتعامل معه دون مشاكل) */
export const SAFE_URL_LENGTH = 8000;
export const MAX_URL_LENGTH = 32000;

const HASH_KEY = 'share=';

/** تقريب الأرقام لتقليل حجم الرابط */
function compact(value: unknown): unknown {
  if (typeof value === 'number') return Math.round(value * 100) / 100;
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = compact(v);
    }
    return out;
  }
  return value;
}

export interface ShareLink {
  url: string;
  length: number;
  tooLong: boolean;
  risky: boolean;
}

export function buildShareLink(name: string, plan: Plan, baseUrl = window.location.href): ShareLink {
  const payload = { v: 1, n: name, p: compact(plan) };
  const encoded = compressToEncodedURIComponent(JSON.stringify(payload));
  const base = baseUrl.split('#')[0];
  const url = `${base}#${HASH_KEY}${encoded}`;
  return { url, length: url.length, tooLong: url.length > MAX_URL_LENGTH, risky: url.length > SAFE_URL_LENGTH };
}

/** يقرأ تصميماً مشتركاً من الرابط إن وجد */
export function readShareFromHash(hash = window.location.hash): Design | null {
  const idx = hash.indexOf(HASH_KEY);
  if (idx < 0) return null;
  const encoded = hash.slice(idx + HASH_KEY.length);
  const json = decompressFromEncodedURIComponent(encoded);
  if (!json) throw new ImportError('رابط المشاركة تالف أو غير مكتمل');
  let raw: { n?: unknown; p?: unknown };
  try {
    raw = JSON.parse(json) as { n?: unknown; p?: unknown };
  } catch {
    throw new ImportError('رابط المشاركة تالف');
  }
  const now = Date.now();
  return {
    id: uid('d'),
    name: typeof raw.n === 'string' ? raw.n.slice(0, 80) : 'تصميم مشترك',
    plan: sanitizePlan(raw.p),
    createdAt: now,
    updatedAt: now,
  };
}

export function clearShareHash(): void {
  if (window.location.hash.includes(HASH_KEY)) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
