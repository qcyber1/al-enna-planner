import { useEffect, useState } from 'react';
import { Gift, Copy, MessageCircle } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { Button, Modal } from './ui';
import { copyText } from '../lib/files';
import { TOKEN_KEY } from './LicenseGate';

interface RefInfo {
  ref: string;
  discount: number;
  reward: number;
  count: number;
  earned: number;
  price: number;
}

/** رابط الإحالة الخاص بالعميل: صديقه ياخذ خصم وهو ياخذ مكافأة */
export function InviteDialog() {
  const open = useEditor((s) => s.dialog === 'invite');
  const openDialog = useEditor((s) => s.openDialog);
  const toast = useEditor((s) => s.toast);
  const [info, setInfo] = useState<RefInfo | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setError('');
    let token: string | null = null;
    try {
      token = localStorage.getItem(TOKEN_KEY);
    } catch {
      /* تجاهل */
    }
    fetch('/api/myref', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
      .then((r) => r.json())
      .then((j: RefInfo & { ok?: boolean; error?: string }) => (j.ok ? setInfo(j) : setError(j.error || 'رابط الدعوة متاح للمشتركين فقط')))
      .catch(() => setError('تعذر الاتصال'));
  }, [open]);
  const link = info ? `${window.location.origin}/?ref=${info.ref}` : '';
  const text = info
    ? `صمّمت عنتي ثلاثي الأبعاد قبل التركيب مع «مخطط العنة» ⛺🔥\nخيام، ملعب، ممرات، وإنارة الليل — كلها قبل ما تشتري شي.\n\nمن رابطي تاخذ خصم ${info.discount} ريال 🎁\n${link}`
    : '';
  return (
    <Modal open={open} onClose={() => openDialog(null)} title={<span className="flex items-center gap-2"><Gift size={18} className="text-gold-600" /> ادعُ أصحابك</span>}>
      <div className="space-y-4 p-5" data-testid="invite">
        {error && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}
        {info && (
          <>
            <div className="rounded-xl bg-dune p-4 text-center text-sand-50">
              <div className="text-sm text-sand-200">صديقك ياخذ</div>
              <div className="text-2xl font-bold text-gold-400">خصم {info.discount} ر.ق</div>
              <div className="mt-2 text-sm text-sand-200">وأنت تاخذ</div>
              <div className="text-2xl font-bold text-gold-400">{info.reward} ر.ق عن كل واحد يشتري</div>
            </div>
            <div className="rounded-lg border border-sand-300 bg-white p-2 text-center font-mono text-sm break-all" dir="ltr">
              {link}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="gold" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')}>
                <MessageCircle size={16} /> أرسل في الواتساب
              </Button>
              <Button onClick={async () => toast((await copyText(text)) ? 'تم نسخ رسالة الدعوة' : 'تعذر النسخ', 'success')}>
                <Copy size={16} /> نسخ الرسالة
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-white p-2">
                <div className="text-[11px] text-sand-600">اشتروا من رابطك</div>
                <div className="text-xl font-bold">{info.count}</div>
              </div>
              <div className="rounded-lg bg-white p-2">
                <div className="text-[11px] text-sand-600">مكافآتك</div>
                <div className="text-xl font-bold">{info.earned} ر.ق</div>
              </div>
            </div>
            <p className="text-[12px] text-sand-600">المكافأة تُحوَّل لك بعد ما يدفع صديقك. أرسل الرابط في قروب العنة 😉</p>
          </>
        )}
      </div>
    </Modal>
  );
}
