import { Languages } from 'lucide-react';
import { getLang, setLang } from '../lib/i18n';
import { cx } from './ui';

/** زر عربي / English */
export function LangToggle({ className, dark }: { className?: string; dark?: boolean }) {
  const en = getLang() === 'en';
  return (
    <button
      type="button"
      data-no-tr
      onClick={() => setLang(en ? 'ar' : 'en')}
      className={cx(
        'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold ring-1',
        dark ? 'bg-white/10 text-sand-50 ring-white/20 hover:bg-white/15' : 'bg-white text-dune ring-sand-300 hover:bg-sand-50',
        className,
      )}
      aria-label={en ? 'التبديل إلى العربية' : 'Switch to English'}
      data-testid="lang-toggle"
    >
      <Languages size={14} /> {en ? 'عربي' : 'EN'}
    </button>
  );
}
