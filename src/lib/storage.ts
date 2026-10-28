import type { Project, ProjectMeta } from '../types/plan';
import { sanitizeProject } from './sanitize';

const PREFIX = 'enna.v1';
const INDEX_KEY = `${PREFIX}.index`;
const LAST_KEY = `${PREFIX}.last`;
const projectKey = (id: string) => `${PREFIX}.project.${id}`;
const thumbKey = (id: string) => `${PREFIX}.thumb.${id}`;

export class StorageError extends Error {}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    throw new StorageError(quota ? 'مساحة التخزين في المتصفح ممتلئة — احذف مشاريع قديمة أو صدّرها كملف' : 'تعذر الحفظ في المتصفح');
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* تجاهل */
  }
}

export function storageAvailable(): boolean {
  try {
    const k = `${PREFIX}.probe`;
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function listProjects(): ProjectMeta[] {
  const raw = safeGet(INDEX_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((m): m is ProjectMeta => !!m && typeof m === 'object' && typeof (m as ProjectMeta).id === 'string')
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeIndex(list: ProjectMeta[]): void {
  safeSet(INDEX_KEY, JSON.stringify(list));
}

export function saveProject(project: Project): void {
  safeSet(projectKey(project.id), JSON.stringify(project));
  const list = listProjects().filter((m) => m.id !== project.id);
  list.unshift({ id: project.id, name: project.name, updatedAt: project.updatedAt, designCount: project.designs.length });
  writeIndex(list);
  safeSet(LAST_KEY, project.id);
}

export function loadProject(id: string): Project | null {
  const raw = safeGet(projectKey(id));
  if (!raw) return null;
  try {
    return sanitizeProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function deleteProject(id: string): void {
  const p = loadProject(id);
  if (p) for (const d of p.designs) safeRemove(thumbKey(d.id));
  safeRemove(projectKey(id));
  writeIndex(listProjects().filter((m) => m.id !== id));
  if (safeGet(LAST_KEY) === id) safeRemove(LAST_KEY);
}

export function lastProjectId(): string | null {
  return safeGet(LAST_KEY);
}

export interface Thumbs {
  d2?: string;
  d3?: string;
}

export function loadThumbs(designId: string): Thumbs {
  const raw = safeGet(thumbKey(designId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Thumbs;
  } catch {
    return {};
  }
}

/** حفظ صور مصغرة للتصميم (اختياري — يُتجاهل عند امتلاء المساحة) */
export function saveThumbs(designId: string, thumbs: Thumbs): boolean {
  try {
    safeSet(thumbKey(designId), JSON.stringify({ ...loadThumbs(designId), ...thumbs }));
    return true;
  } catch {
    return false;
  }
}

export function removeThumbs(designId: string): void {
  safeRemove(thumbKey(designId));
}
