import type { Design, Project } from '../types/plan';

export function safeFileName(name: string): string {
  return (name || 'enna').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 60);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export function canShareFiles(): boolean {
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'probe.png', { type: 'image/png' });
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * مشاركة صورة عبر قائمة المشاركة في الجوال (واتساب وغيره) — وإن لم تتوفر يتم التنزيل.
 * تعيد 'shared' أو 'downloaded' أو 'cancelled'.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  title: string,
  text?: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export interface ExportEnvelope<T> {
  app: 'al-enna-planner';
  type: 'project' | 'design';
  version: number;
  exportedAt: string;
  payload: T;
}

export function exportProjectJson(project: Project): void {
  const env: ExportEnvelope<Project> = {
    app: 'al-enna-planner',
    type: 'project',
    version: project.schema,
    exportedAt: new Date().toISOString(),
    payload: project,
  };
  downloadBlob(new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' }), `${safeFileName(project.name)}.enna.json`);
}

export function exportDesignJson(design: Design, projectName: string): void {
  const env: ExportEnvelope<Design> = {
    app: 'al-enna-planner',
    type: 'design',
    version: 1,
    exportedAt: new Date().toISOString(),
    payload: design,
  };
  downloadBlob(
    new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' }),
    `${safeFileName(projectName)}-${safeFileName(design.name)}.enna.json`,
  );
}

export function readFileText(file: File, maxBytes = 15 * 1024 * 1024): Promise<string> {
  if (file.size > maxBytes) return Promise.reject(new Error('حجم الملف كبير جداً'));
  return file.text();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** تأكيد آمن: داخل إطار مضمّن لا تظهر نوافذ confirm فنتابع مباشرة */
export function askConfirm(message: string): boolean {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  return window.confirm(message);
}
