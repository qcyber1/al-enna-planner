// حفظ بيانات العملاء والطلبات في ملف JSON + نسخ احتياطية يومية
import fs from 'node:fs';
import path from 'node:path';

/**
 * يقرأ ملف البيانات. إذا الملف موجود بس خربان (JSON ناقص أو تالف) ما نمسحه:
 * ننقله لملف «corrupt» بجانبه عشان ما ينكتب فوقه، ونبدأ فاضي (الأكواد الموقّعة تظل شغالة).
 */
export function loadDbFile(file, log = console) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return { db: { codes: {}, orders: [] }, corrupt: null };
  }
  try {
    const db = JSON.parse(raw);
    if (!db || typeof db !== 'object' || Array.isArray(db)) throw new Error('شكل غير متوقع');
    if (!db.codes || typeof db.codes !== 'object') db.codes = {};
    return { db, corrupt: null };
  } catch (e) {
    const moved = file.replace(/\.json$/, '') + `.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    try {
      fs.renameSync(file, moved);
    } catch {
      /* لو ما قدرنا ننقله نخليه — المهم ما نكتب فوقه */
    }
    log.error?.(`[enna] ⚠ ملف البيانات تالف (${e.message}) — انحفظ في ${path.basename(moved)} ونبدأ من النسخة الاحتياطية أو فاضي`);
    return { db: null, corrupt: moved };
  }
}

/** أحدث نسخة احتياطية سليمة (إذا الملف الأساسي خربان) */
export function latestBackup(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /^licenses-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
  } catch {
    return null;
  }
  for (const f of files) {
    try {
      const db = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (db && typeof db === 'object' && db.codes) return { db, file: f };
    } catch {
      /* نجرب اللي قبلها */
    }
  }
  return null;
}

/** كتابة آمنة: ملف مؤقت ثم إعادة تسمية (ما يخرب الملف لو انقطع الخادم وسط الكتابة) */
export function writeDbFile(file, db) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(db, null, 2));
  fs.renameSync(file + '.tmp', file);
}

/** نسخة احتياطية وحدة لكل يوم في backups/، ونخلي آخر keep يوم */
export function dailyBackup(file, dir, keep = 14, now = new Date()) {
  try {
    if (!fs.existsSync(file)) return null;
    fs.mkdirSync(dir, { recursive: true });
    const name = `licenses-${now.toISOString().slice(0, 10)}.json`;
    const target = path.join(dir, name);
    fs.copyFileSync(file, target);
    const all = fs.readdirSync(dir).filter((f) => /^licenses-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - keep))) fs.rmSync(path.join(dir, old), { force: true });
    return name;
  } catch {
    return null;
  }
}
