// خامات مولدة برمجياً (بدون ملفات خارجية) — تُنشأ مرة واحدة وتُعاد استخدامها.
import * as THREE from 'three';
import type { GroundType, PathMaterial } from '../types/plan';

const cache = new Map<string, THREE.Texture>();

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finish(key: string, canvas: HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean } = {}): THREE.Texture {
  const t = new THREE.CanvasTexture(canvas);
  if (opts.repeat !== false) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  return cache.get(key) ?? make();
}

/** ضوضاء قيمية ناعمة قابلة للتكرار */
function valueNoise(size: number, cells: number, seed: number): Float32Array {
  const r = rng(seed);
  const grid = new Float32Array(cells * cells).map(() => r());
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells;
      const gy = (y / size) * cells;
      const x0 = Math.floor(gx) % cells;
      const y0 = Math.floor(gy) % cells;
      const x1 = (x0 + 1) % cells;
      const y1 = (y0 + 1) % cells;
      const fx = gx - Math.floor(gx);
      const fy = gy - Math.floor(gy);
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = grid[y0 * cells + x0];
      const b = grid[y0 * cells + x1];
      const c = grid[y1 * cells + x0];
      const d = grid[y1 * cells + x1];
      out[y * size + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }
  }
  return out;
}

const GROUND_BASE: Record<GroundType | 'desert', [number, number, number]> = {
  sand: [227, 201, 149],
  soil: [178, 140, 100],
  flat: [214, 202, 178],
  desert: [221, 192, 140],
};

/** رمل/تراب مع تموجات خفيفة — تكرار كل 8 م تقريباً */
export function groundTexture(type: GroundType | 'desert'): THREE.Texture {
  return cached(`ground:${type}`, () => {
    const size = 512;
    const [c, ctx] = makeCanvas(size, size);
    const img = ctx.createImageData(size, size);
    const n1 = valueNoise(size, 8, 11);
    const n2 = valueNoise(size, 32, 23);
    const n3 = valueNoise(size, 128, 37);
    const base = GROUND_BASE[type];
    const ripple = type === 'sand' || type === 'desert' ? 1 : 0.25;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const rip = Math.sin((x * 0.11 + y * 0.045 + n1[i] * 9) * 1.0) * 0.5 + 0.5;
        const v = 0.86 + n1[i] * 0.12 + n2[i] * 0.08 + n3[i] * 0.06 + rip * 0.05 * ripple;
        img.data[i * 4] = Math.min(255, base[0] * v);
        img.data[i * 4 + 1] = Math.min(255, base[1] * v);
        img.data[i * 4 + 2] = Math.min(255, base[2] * v);
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // حصى صغيرة
    const r = rng(type.length * 97);
    for (let k = 0; k < (type === 'soil' ? 900 : 350); k++) {
      ctx.fillStyle = `rgba(${90 + r() * 60},${70 + r() * 40},${40 + r() * 30},${0.15 + r() * 0.25})`;
      ctx.beginPath();
      ctx.arc(r() * size, r() * size, 0.5 + r() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    return finish(`ground:${type}`, c);
  });
}

/** عشب صناعي — قطعة 1 × 1 م */
export function turfTexture(): THREE.Texture {
  return cached('turf', () => {
    const size = 512;
    const [c, ctx] = makeCanvas(size, size);
    ctx.fillStyle = '#3f8a2c';
    ctx.fillRect(0, 0, size, size);
    const r = rng(5);
    for (let i = 0; i < 26000; i++) {
      const x = r() * size;
      const y = r() * size;
      const l = 3 + r() * 7;
      const a = -Math.PI / 2 + (r() - 0.5) * 0.9;
      const g = 110 + r() * 90;
      ctx.strokeStyle = `rgba(${40 + r() * 50},${g},${25 + r() * 35},${0.55 + r() * 0.4})`;
      ctx.lineWidth = 0.8 + r() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    // خطوط تصنيع خفيفة
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let x = 0; x < size; x += 16) ctx.fillRect(x, 0, 2, size);
    return finish('turf', c);
  });
}

/** خشب ألواح */
export function woodTexture(): THREE.Texture {
  return cached('wood', () => {
    const size = 512;
    const [c, ctx] = makeCanvas(size, size);
    const r = rng(17);
    const plank = size / 4;
    for (let p = 0; p < 4; p++) {
      const tone = 125 + r() * 35;
      ctx.fillStyle = `rgb(${tone},${tone * 0.68},${tone * 0.42})`;
      ctx.fillRect(0, p * plank, size, plank);
      for (let k = 0; k < 40; k++) {
        ctx.strokeStyle = `rgba(70,40,20,${0.08 + r() * 0.12})`;
        ctx.lineWidth = 1 + r() * 2;
        const y = p * plank + r() * plank;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y + (r() - 0.5) * 8, size * 0.6, y + (r() - 0.5) * 8, size, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,25,10,0.5)';
      ctx.fillRect(0, p * plank, size, 3);
    }
    return finish('wood', c);
  });
}

export function tilesTexture(): THREE.Texture {
  return cached('tiles', () => {
    const size = 512;
    const [c, ctx] = makeCanvas(size, size);
    const r = rng(29);
    const n = 4;
    const s = size / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const t = 200 + r() * 25;
        ctx.fillStyle = `rgb(${t},${t * 0.95},${t * 0.88})`;
        ctx.fillRect(i * s, j * s, s, s);
      }
    }
    ctx.strokeStyle = 'rgba(110,95,75,0.8)';
    ctx.lineWidth = 5;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, size);
      ctx.moveTo(0, i * s);
      ctx.lineTo(size, i * s);
      ctx.stroke();
    }
    return finish('tiles', c);
  });
}

export function stoneTexture(): THREE.Texture {
  return cached('stone', () => {
    const size = 512;
    const [c, ctx] = makeCanvas(size, size);
    ctx.fillStyle = '#8f8576';
    ctx.fillRect(0, 0, size, size);
    const r = rng(41);
    for (let y = 0; y < size + 60; y += 70) {
      for (let x = (y / 70) % 2 ? 35 : 0; x < size + 60; x += 80) {
        const t = 160 + r() * 50;
        ctx.fillStyle = `rgb(${t},${t * 0.94},${t * 0.85})`;
        ctx.beginPath();
        const cx0 = x + (r() - 0.5) * 10;
        const cy0 = y + (r() - 0.5) * 10;
        const pts = 7;
        for (let k = 0; k < pts; k++) {
          const a = (k / pts) * Math.PI * 2;
          const rr = 28 + r() * 10;
          const px = cx0 + Math.cos(a) * rr * 1.1;
          const py = cy0 + Math.sin(a) * rr * 0.85;
          if (k) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(60,50,40,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    return finish('stone', c);
  });
}

export function pathTexture(m: PathMaterial): { tex: THREE.Texture; tile: number } {
  switch (m) {
    case 'turf':
    case 'wood-turf':
      return { tex: turfTexture(), tile: 1 };
    case 'tiles':
      return { tex: tilesTexture(), tile: 2.4 };
    case 'stone':
      return { tex: stoneTexture(), tile: 2.2 };
    case 'sand':
      return { tex: groundTexture('sand'), tile: 6 };
  }
}

/** شريط السدو (حزام زخرفي) — يتكرر أفقياً كل متر */
export function saduTexture(accent = '#8e2a2a'): THREE.Texture {
  return cached(`sadu:${accent}`, () => {
    const w = 512;
    const h = 128;
    const [c, ctx] = makeCanvas(w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b1411';
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 14, w, 14);
    ctx.fillStyle = '#f1e2c2';
    ctx.fillRect(0, 14, w, 6);
    ctx.fillRect(0, h - 20, w, 6);
    // مثلثات متقابلة
    const tw = 32;
    for (let x = 0; x < w; x += tw) {
      ctx.fillStyle = '#f1e2c2';
      ctx.beginPath();
      ctx.moveTo(x, 26);
      ctx.lineTo(x + tw / 2, 60);
      ctx.lineTo(x + tw, 26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1b1411';
      ctx.beginPath();
      ctx.moveTo(x, h - 26);
      ctx.lineTo(x + tw / 2, h - 60);
      ctx.lineTo(x + tw, h - 26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2f5d3a';
      ctx.fillRect(x + tw / 2 - 3, 58, 6, 12);
    }
    return finish(`sadu:${accent}`, c);
  });
}

/** سجاد سدو (للأرضيات والجلسات) */
export function carpetTexture(base = '#8e2a2a', border = '#1f3d2b'): THREE.Texture {
  return cached(`carpet:${base}:${border}`, () => {
    const size = 512;
    const [c, ctx] = makeCanvas(size, size);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    // صفوف زخرفية
    const rows = 8;
    const rh = size / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      ctx.fillStyle = r % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, y, size, rh);
      ctx.fillStyle = r % 3 === 0 ? '#f1e2c2' : r % 3 === 1 ? border : '#1b1411';
      for (let x = 0; x < size; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x + 16, y + 8);
        ctx.lineTo(x + 28, y + rh / 2);
        ctx.lineTo(x + 16, y + rh - 8);
        ctx.lineTo(x + 4, y + rh / 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#f1e2c2';
      ctx.fillRect(0, y, size, 2);
    }
    return finish(`carpet:${base}:${border}`, c);
  });
}

/** نسيج القماش (رمادي فاتح ليُلوَّن بلون الخامة) */
export function fabricTexture(): THREE.Texture {
  return cached('fabric', () => {
    const size = 256;
    const [c, ctx] = makeCanvas(size, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const r = rng(53);
    for (let i = 0; i < size; i += 2) {
      ctx.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.03})`;
      ctx.fillRect(i, 0, 1, size);
      ctx.fillRect(0, i, size, 1);
    }
    // درزات القماش
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, 3, size);
    return finish('fabric', c);
  });
}

/** قماش بيت الشعر (أسود مع خطوط فاتحة) */
export function bedouinTexture(): THREE.Texture {
  return cached('bedouin', () => {
    const size = 512;
    const [c, ctx] = makeCanvas(size, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    const r = rng(61);
    for (let y = 0; y < size; y += 1) {
      const v = 0.85 + r() * 0.15;
      ctx.fillStyle = `rgba(0,0,0,${1 - v})`;
      ctx.fillRect(0, y, size, 1);
    }
    for (let y = 0; y < size; y += 64) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(0, y, size, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, y + 3, size, 2);
    }
    return finish('bedouin', c);
  });
}

/** بطانة داخلية ملونة للخيام */
export function liningTexture(accent = '#8e2a2a'): THREE.Texture {
  return cached(`lining:${accent}`, () => {
    const w = 512;
    const h = 512;
    const [c, ctx] = makeCanvas(w, h);
    ctx.fillStyle = '#f3e6c9';
    ctx.fillRect(0, 0, w, h);
    // ألواح عمودية بتطريز
    for (let x = 0; x < w; x += 128) {
      ctx.fillStyle = accent;
      ctx.fillRect(x, 0, 18, h);
      ctx.fillStyle = '#2f5d3a';
      ctx.fillRect(x + 18, 0, 6, h);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      for (let y = 40; y < h; y += 110) {
        ctx.beginPath();
        ctx.moveTo(x + 64, y);
        ctx.lineTo(x + 100, y + 40);
        ctx.lineTo(x + 64, y + 80);
        ctx.lineTo(x + 28, y + 40);
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.fillStyle = accent;
    ctx.fillRect(0, h - 70, w, 70);
    ctx.fillStyle = '#f1e2c2';
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, h - 70);
      ctx.lineTo(x + 16, h - 40);
      ctx.lineTo(x + 32, h - 70);
      ctx.fill();
    }
    return finish(`lining:${accent}`, c);
  });
}

/** شبكة كرة الطائرة (بشفافية) */
export function netTexture(): THREE.Texture {
  return cached('net', () => {
    const size = 128;
    const [c, ctx] = makeCanvas(size, size);
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(20,20,20,1)';
    ctx.lineWidth = 5;
    for (let i = 0; i <= size; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    return finish('net', c);
  });
}

/** توهج دائري للأضواء وبقع الإنارة على الأرض */
export function glowTexture(): THREE.Texture {
  return cached('glow', () => {
    const size = 256;
    const [c, ctx] = makeCanvas(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return finish('glow', c, { repeat: false });
  });
}

export function corrugatedTexture(): THREE.Texture {
  return cached('corrugated', () => {
    const size = 256;
    const [c, ctx] = makeCanvas(size, size);
    for (let x = 0; x < size; x++) {
      const v = 200 + Math.sin((x / size) * Math.PI * 2 * 16) * 45;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 0, 1, size);
    }
    return finish('corrugated', c);
  });
}

/** لافتة نصية صغيرة (مثل WC) */
export function labelTexture(text: string, bg = '#2b6cb0', fg = '#ffffff'): THREE.Texture {
  return cached(`label:${text}:${bg}:${fg}`, () => {
    const [c, ctx] = makeCanvas(256, 128);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = fg;
    ctx.font = "700 64px 'IBM Plex Sans Arabic', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 68);
    return finish(`label:${text}:${bg}:${fg}`, c, { repeat: false });
  });
}

/** خطوط أرضية للسماء الليلية (تدرج) */
export function skyGradientTexture(top: string, bottom: string): THREE.Texture {
  return cached(`sky:${top}:${bottom}`, () => {
    const [c, ctx] = makeCanvas(4, 256);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    return finish(`sky:${top}:${bottom}`, c, { repeat: false });
  });
}
