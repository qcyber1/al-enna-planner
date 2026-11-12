// «📸 صورة حقيقية»: نحوّل لقطة المجسم لصورة كأنها مصوّرة بالدرون — بنفس التوزيع والزاوية
// المفتاح في Railway: OPENAI_API_KEY (ما يطلع للمتصفح أبداً). الموديل: OPENAI_IMAGE_MODEL (افتراضي gpt-image-1)

const MOODS = {
  day: 'bright clear daylight, crisp sunlight and soft natural shadows, blue sky glow',
  sunset: 'golden-hour sunset, warm low sun, long soft shadows, orange and pink sky glow on the horizon',
  night: 'night time, deep blue sky, warm glowing string lights and lamps, cozy lit tents and paths, realistic night photography',
};

const clean = (s) =>
  String(s || '')
    .replace(/[^\p{L}\p{N}\s×x.,()\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

/** الوصف اللي يحافظ على التوزيع: نوع المكان + العناصر الموجودة */
export function buildPrompt({ mood, hints, izba }) {
  const m = MOODS[mood] || MOODS.day;
  const items = (Array.isArray(hints) ? hints : [])
    .map(clean)
    .filter(Boolean)
    .slice(0, 30)
    .join(', ');
  const place = izba
    ? 'a private Qatari izba (desert farm estate) with plastered block walls'
    : 'a Qatari winter desert camp (enna / mukhayyam) with traditional Bedouin-style tents';
  return [
    `Turn this 3D planning render into a photorealistic aerial drone photograph of ${place}.`,
    'Keep EXACTLY the same layout, camera angle, framing and the position, size and count of every object. Do not add or remove buildings, tents, courts, cars or paths.',
    items ? `Objects in the scene: ${items}.` : '',
    'Make every material look real: fine desert sand with subtle footprints, real canvas tent fabric with traditional Sadu patterned trim, real artificial turf, real cars, real trees and palms, clear water.',
    `Lighting: ${m}.`,
    'Natural colors, high detail, professional architectural photography. No text, no watermark, no people.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** يقرأ الصورة من data URL (jpeg/png فقط) */
export function parseImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 1000 || buf.length > 3_000_000) return null;
  return { mime: m[1], buf };
}

/** يطلب الصورة من OpenAI (تعديل صورة مع وصف) ويرجع base64 */
export async function generatePhoto({ key, base = 'https://api.openai.com', model = 'gpt-image-1', image, prompt, timeoutMs = 120_000 }) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', '1536x1024');
  form.append('quality', 'medium');
  form.append('n', '1');
  form.append('image', new Blob([image.buf], { type: image.mime }), image.mime === 'image/png' ? 'scene.png' : 'scene.jpg');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/v1/images/edits`, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form, signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) throw new Error('ما رجعت صورة');
    return b64;
  } finally {
    clearTimeout(t);
  }
}
