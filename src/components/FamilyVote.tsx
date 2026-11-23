// «👨‍👩‍👦 خلّ الأهل يختارون»: رابط فيه التصاميم المحددة — الأهل يصوّتون بدون حساب، والنتيجة توصلك هنا
import { useEffect, useState } from 'react';
import type { Design } from '../types/plan';
import { useEditor } from '../store/editorStore';
import { planThumbnail } from '../render2d/exportImage';
import { copyText } from '../lib/files';
import { isDemo } from '../lib/demo';
import { Button } from './ui';

interface Room {
  id: string;
  title: string;
  items: { name: string; votes: number }[];
  total: number;
  comments: { i: number; name: string; comment: string; at: number }[];
}

const token = () => {
  try {
    return localStorage.getItem('enna.license.token') || '';
  } catch {
    return '';
  }
};

export function FamilyVote({ designs }: { designs: Design[] }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const toast = useEditor((s) => s.toast);
  const project = useEditor((s) => s.project);

  const load = () => {
    const t = token();
    if (!t) return;
    fetch('/api/vote/mine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: t }) })
      .then((r) => r.json())
      .then((d) => d.ok && setRooms(d.rooms || []))
      .catch(() => {});
  };
  useEffect(load, []);

  const create = async () => {
    if (isDemo() || !token()) return toast('التصويت متاح بعد الشراء — تصميمك ينحفظ لك 👍', 'warning');
    if (designs.length < 2) return toast('حدد تصميمين أو أكثر من «مقارنة» تحت', 'warning');
    setBusy(true);
    try {
      const items = designs.slice(0, 4).map((d) => ({ name: d.name, img: planThumbnail(d.plan, 900) }));
      const r = await fetch('/api/vote/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: token(), title: `${project.name} — أي تصميم أحسن؟`, izba: designs.some((d) => d.plan.land.site === 'izba'), items }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      const url = `${window.location.origin}${d.path}`;
      setLink(url);
      load();
    } catch (e) {
      toast((e as Error).message || 'ما انسوى الرابط — جرّب مرة ثانية', 'error');
    } finally {
      setBusy(false);
    }
  };
  const wa = (url: string) => window.open(`https://wa.me/?text=${encodeURIComponent(`صوّتوا على تصميم ${project.name} 👇 أي واحد أحسن؟\n${url}`)}`, '_blank');

  return (
    <div className="rounded-xl border-2 border-gold-500/60 bg-gold-50 p-3" data-testid="family-vote">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-dune">👨‍👩‍👦 خلّ الأهل يختارون</div>
          <div className="text-[12px] text-sand-700">رابط فيه التصاميم المحددة ({Math.min(4, designs.length)}) — يصوّتون من الجوال بدون حساب ويكتبون رأيهم</div>
        </div>
        <Button variant="gold" size="sm" onClick={() => void create()} disabled={busy || designs.length < 2} data-testid="vote-create">
          {busy ? 'لحظة…' : 'سوّ رابط التصويت'}
        </Button>
      </div>
      {link && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 text-[12px]" data-testid="vote-link">
          <span className="min-w-0 flex-1 truncate font-mono" dir="ltr">{link}</span>
          <Button size="sm" onClick={() => wa(link)}>واتساب</Button>
          <Button size="sm" onClick={async () => toast((await copyText(link)) ? 'تم نسخ الرابط' : 'انسخه يدوياً', 'success')}>نسخ</Button>
        </div>
      )}
      {rooms.length > 0 && (
        <div className="mt-2 space-y-2" data-testid="vote-results">
          {rooms.slice(0, 3).map((r) => {
            const top = Math.max(1, ...r.items.map((x) => x.votes));
            return (
              <div key={r.id} className="rounded-lg bg-white p-2 text-[13px]">
                <div className="mb-1 flex items-center justify-between">
                  <b className="text-dune">🗳️ {r.total} {r.total === 1 ? 'صوت' : 'أصوات'}</b>
                  <button type="button" className="text-[11px] text-gold-700 underline" onClick={() => wa(`${window.location.origin}/v/${r.id}`)}>
                    أرسله ثاني
                  </button>
                </div>
                {r.items.map((it) => (
                  <div key={it.name} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2">
                    <span className="truncate">{it.name}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                      <div className="h-full rounded-full bg-gold-500" style={{ width: `${(it.votes / top) * 100}%` }} />
                    </div>
                    <span className="text-left tabular-nums">{it.votes}</span>
                  </div>
                ))}
                {r.comments.slice(-3).map((c, k) => (
                  <div key={k} className="mt-1 rounded bg-sand-50 px-2 py-1 text-[12px] text-sand-800">
                    💬 {c.name || 'واحد من الأهل'} ({r.items[c.i]?.name}){c.comment ? `: ${c.comment}` : ''}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
