import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { Plan } from '../types/plan';
import { validatePlan, type ValidationResult } from '../lib/validation';
import { computeSummary, DEFAULT_ESTIMATE, type Summary } from '../lib/quantities';
import { usePlan, useEditor } from '../store/editorStore';

const validationCache = new WeakMap<Plan, ValidationResult>();

export function getValidation(plan: Plan): ValidationResult {
  let v = validationCache.get(plan);
  if (!v) {
    v = validatePlan(plan);
    validationCache.set(plan, v);
  }
  return v;
}

let lastStable: ValidationResult | null = null;
/**
 * أثناء السحب (gesture) نرجّع آخر نتيجة بدل ما نعيد الفحص كل حركة إصبع — الفحص يرجع أول ما يترك.
 * هذا يخلي السحب أنعم بوايد على الجوال.
 */
export function getValidationLive(plan: Plan, gesturing: boolean): ValidationResult {
  if (gesturing && lastStable) return lastStable;
  lastStable = getValidation(plan);
  return lastStable;
}

export function useValidation(): ValidationResult {
  const plan = usePlan();
  const gesturing = useEditor((s) => !!s.gestureBase);
  return useMemo(() => getValidationLive(plan, gesturing), [plan, gesturing]);
}

export function useSummary(): Summary {
  const plan = usePlan();
  const est = useEditor((s) => s.project.estimate);
  return useMemo(() => computeSummary(plan, est ?? DEFAULT_ESTIMATE), [plan, est]);
}

export function useElementSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** قيمة مؤجلة لتقليل الحسابات الثقيلة أثناء السحب */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
