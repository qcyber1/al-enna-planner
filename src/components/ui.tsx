import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-dune text-sand-50 hover:bg-dune-light shadow-sm',
    secondary: 'bg-white text-sand-900 border border-sand-300 hover:bg-sand-50',
    ghost: 'text-sand-800 hover:bg-sand-200/60',
    danger: 'bg-red-700 text-white hover:bg-red-800',
    gold: 'bg-gold-500 text-dune hover:bg-gold-400 shadow-sm',
  };
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        v[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  active,
  className,
  children,
  tone = 'light',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; tone?: 'light' | 'dark' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-2 text-sm transition-colors disabled:opacity-35 disabled:cursor-not-allowed',
        tone === 'dark'
          ? active
            ? 'bg-gold-500 text-dune'
            : 'text-sand-100 hover:bg-white/10'
          : active
            ? 'bg-dune text-sand-50'
            : 'text-sand-800 hover:bg-sand-200/70',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-sand-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-sand-600">{hint}</span>}
    </label>
  );
}

const inputCls =
  'h-9 w-full rounded-lg border border-sand-300 bg-white px-2.5 text-sm text-sand-950 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-300/50 disabled:bg-sand-100 disabled:text-sand-500';

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit,
  disabled,
  digits = 2,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  digits?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const fmt = (n: number) => String(Math.round(n * 10 ** digits) / 10 ** digits);
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace('٫', '.'));
    if (!Number.isFinite(n)) return;
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(v);
  };
  return (
    <div className={cx('relative', className)}>
      <input
        type="number"
        inputMode="decimal"
        dir="ltr"
        aria-label={ariaLabel}
        className={cx(inputCls, unit ? 'pl-8' : '', 'text-left tabular-nums')}
        value={text}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(fmt(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      {unit && <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-sand-500">{unit}</span>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  onCommit,
  ariaLabel,
}: {
  value: string;
  onChange?: (v: string) => void;
  onCommit?: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      className={cx(inputCls, className)}
      value={text}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange?.(e.target.value);
      }}
      onBlur={() => onCommit?.(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onCommit?.(text);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <select
      className={cx(inputCls, 'pr-2.5')}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('flex cursor-pointer items-center justify-between gap-3 py-1', disabled && 'opacity-50')}>
      <span className="text-sm text-sand-900">{label}</span>
      <span className="relative inline-flex">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-5 w-9 rounded-full bg-sand-300 transition-colors peer-checked:bg-turf-500 peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400" />
        <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:-translate-x-4" />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  tone = 'light',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  size?: 'sm' | 'md';
  tone?: 'light' | 'dark';
}) {
  return (
    <div
      className={cx(
        'inline-flex rounded-lg p-0.5',
        tone === 'dark' ? 'bg-black/25' : 'bg-sand-200/80',
      )}
      role="radiogroup"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex items-center gap-1 rounded-md font-medium transition-colors',
            size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-2.5 text-[13px]',
            value === o.value
              ? tone === 'dark'
                ? 'bg-gold-500 text-dune shadow'
                : 'bg-white text-dune shadow'
              : tone === 'dark'
                ? 'text-sand-100 hover:bg-white/10'
                : 'text-sand-700 hover:text-dune',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const SWATCHES = [
  '#efe4cc',
  '#f4ecdb',
  '#ffffff',
  '#d9c49b',
  '#c8a57a',
  '#8a6f4e',
  '#5c4033',
  '#2a2522',
  '#9b2c2c',
  '#8e2a2a',
  '#a0522d',
  '#d4a24c',
  '#2f5d3a',
  '#4f9a35',
  '#2b6cb0',
  '#3a3a3a',
];

export function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <span className="mb-1 block text-[12px] font-medium text-sand-700">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="color"
          aria-label={label}
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#cccccc'}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-sand-300 bg-white p-0.5"
        />
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
            className={cx(
              'h-5 w-5 rounded-full border transition-transform hover:scale-110',
              value.toLowerCase() === c ? 'border-dune ring-2 ring-gold-400' : 'border-sand-300',
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="border-b border-sand-200 px-4 py-3 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold text-dune">{title}</h3>
        {actions}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean | 'xl';
  footer?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-dune/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'print-area flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-sand-50 shadow-2xl sm:rounded-2xl',
          wide === 'xl' ? 'sm:max-w-6xl' : wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-sand-200 bg-white px-5 py-3">
          <h2 className="text-base font-bold text-dune">{title}</h2>
          <button type="button" onClick={onClose} className="no-print rounded-lg p-1.5 text-sand-700 hover:bg-sand-100" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="no-print flex flex-wrap items-center justify-end gap-2 border-t border-sand-200 bg-white px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-sand-200 bg-white px-3 py-2.5">
      <div className="text-[11px] text-sand-600">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-dune tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-sand-600">{sub}</div>}
    </div>
  );
}
