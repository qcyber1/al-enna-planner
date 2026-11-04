import { useEffect, useState } from 'react';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { Button, Modal } from './ui';
import { TOKEN_KEY } from './LicenseGate';

/** ملاحظة أو اقتراح يوصل مباشرة للوحة الإدارة */
export function FeedbackDialog() {
  const open = useEditor((s) => s.dialog === 'feedback');
  const view = useEditor((s) => s.view);
  const openDialog = useEditor((s) => s.openDialog);
  const toast = useEditor((s) => s.toast);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) setError('');
  }, [open]);
  const send = async () => {
    if (text.trim().length < 3) return setError('اكتب ملاحظتك');
    setBusy(true);
    setError('');
    try {
      let token: string | null = null;
      try {
        token = localStorage.getItem(TOKEN_KEY);
      } catch {
        /* تجاهل */
      }
      const where = `${view.toUpperCase()} • ${window.innerWidth < 768 ? 'جوال' : 'كمبيوتر'}`;
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, text, where }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!j.ok) return setError(j.error || 'ما انرسلت — حاول مرة ثانية');
      setText('');
      openDialog(null);
      toast('وصلتنا ملاحظتك 🙏 شكراً', 'success');
    } catch {
      setError('ما قدرنا نتصل — تأكد من الإنترنت');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={() => openDialog(null)} title={<span className="flex items-center gap-2"><MessageSquarePlus size={18} className="text-gold-600" /> أرسل ملاحظة</span>}>
      <div className="space-y-3 p-5" data-testid="feedback">
        <p className="text-sm text-sand-700">شي ما اشتغل؟ فكرة تبيها؟ اكتبها هني وتوصلنا على طول.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="مثلاً: لما أضغط على الخيمة على الجوال ما تتحرك…"
          className="w-full rounded-lg border border-sand-300 bg-white p-3 text-sm outline-none focus:border-gold-500"
          data-testid="feedback-text"
        />
        {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</div>}
        <Button variant="gold" className="w-full" onClick={send} disabled={busy} data-testid="feedback-send">
          {busy && <Loader2 size={16} className="animate-spin" />} إرسال
        </Button>
      </div>
    </Modal>
  );
}
