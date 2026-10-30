import { create } from 'zustand';
import type {
  CameraPreset,
  Design,
  EstimateSettings,
  Land,
  Measurement,
  Plan,
  PlanElement,
  Project,
  ProjectMeta,
  TimeOfDay,
  Tool,
  Vec2,
  ViewMode,
} from '../types/plan';
import { SCHEMA_VERSION } from '../types/plan';
import { uid } from '../lib/id';
import { createSamplePlan, emptyPlan } from '../lib/sample';
import { DEFAULT_ESTIMATE } from '../lib/quantities';
import { isPolyline } from '../lib/catalog';
import { normalizeAngle, round } from '../lib/geometry';
import * as storage from '../lib/storage';

const HISTORY_LIMIT = 120;
const MERGE_WINDOW_MS = 900;

export type DialogName =
  | 'land'
  | 'summary'
  | 'projects'
  | 'compare'
  | 'share'
  | 'welcome'
  | 'help'
  | 'designs'
  | 'sharedLink'
  | 'generator';

export interface Toast {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  text: string;
}

export interface GridSettings {
  show: boolean;
  snap: boolean;
  size: number;
}

export interface Overlays {
  dims: boolean;
  distances: boolean;
  lightMap: boolean;
  safety: boolean;
  labels: boolean;
}

export type LightQuality = 'low' | 'medium' | 'high';

export interface SetPlanOptions {
  history?: boolean;
  mergeKey?: string;
}

interface State {
  project: Project;
  projects: ProjectMeta[];
  past: Plan[];
  future: Plan[];
  gestureBase: Plan | null;
  lastMergeKey: string | null;
  lastMergeAt: number;

  selection: string[];
  view: ViewMode;
  time: TimeOfDay;
  lightsMaster: boolean;
  lightQuality: LightQuality;
  tool: Tool;
  grid: GridSettings;
  overlays: Overlays;
  camera: { preset: CameraPreset; nonce: number };
  dialog: DialogName | null;
  pendingShared: Design | null;
  toasts: Toast[];
  clipboard: PlanElement[];
  saveState: 'saved' | 'pending' | 'error';
  saveError: string | null;
  /** طلب تصدير صورة 3D (يعالجه المشهد عند تغير الرقم) */
  capture3d: { nonce: number; mode: 'download' | 'share' | 'thumb' };

  // ——— المخطط والتاريخ ———
  setPlan: (fn: (p: Plan) => Plan, opts?: SetPlanOptions) => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;

  // ——— العناصر ———
  addElement: (el: PlanElement, select?: boolean) => void;
  addElements: (els: PlanElement[]) => void;
  updateElement: (id: string, patch: Partial<PlanElement>, opts?: SetPlanOptions) => void;
  updateElements: (patches: Record<string, Partial<PlanElement>>, opts?: SetPlanOptions) => void;
  removeElements: (ids: string[]) => void;
  duplicateElements: (ids: string[]) => void;
  moveElements: (ids: string[], dx: number, dy: number, opts?: SetPlanOptions) => void;
  rotateElements: (ids: string[], delta: number) => void;
  setLocked: (ids: string[], locked: boolean) => void;
  reorder: (id: string, where: 'front' | 'back') => void;
  copySelection: () => void;
  paste: (at?: Vec2) => void;

  // ——— الأرض والقياسات ———
  updateLand: (patch: Partial<Land>, opts?: SetPlanOptions) => void;
  addMeasurement: (a: Vec2, b: Vec2) => void;
  removeMeasurement: (id: string) => void;
  clearMeasurements: () => void;

  // ——— التحديد والواجهة ———
  select: (ids: string[], additive?: boolean) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  setView: (v: ViewMode) => void;
  setTime: (t: TimeOfDay) => void;
  setLightsMaster: (on: boolean) => void;
  setLightQuality: (q: LightQuality) => void;
  setTool: (t: Tool) => void;
  setGrid: (patch: Partial<GridSettings>) => void;
  setOverlays: (patch: Partial<Overlays>) => void;
  setCamera: (preset: CameraPreset) => void;
  openDialog: (d: DialogName | null) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: string) => void;
  requestCapture3d: (mode: 'download' | 'share' | 'thumb') => void;

  // ——— التصاميم ———
  switchDesign: (id: string) => void;
  addDesign: (name: string, source: 'copy' | 'blank' | 'sample') => void;
  renameDesign: (id: string, name: string) => void;
  setDesignNote: (id: string, note: string) => void;
  deleteDesign: (id: string) => void;
  setFinalDesign: (id: string | undefined) => void;
  importDesign: (design: Design) => void;

  // ——— المشاريع ———
  refreshProjects: () => void;
  newProject: (name: string, plan?: Plan) => void;
  openProject: (id: string) => boolean;
  renameProject: (name: string) => void;
  deleteProject: (id: string) => void;
  importProject: (project: Project) => void;
  setPendingShared: (d: Design | null) => void;

  // ——— الأسعار والتقدير ———
  setPrice: (key: string, value: number | null) => void;
  setEstimate: (patch: Partial<EstimateSettings>) => void;

  setSaveState: (s: 'saved' | 'pending' | 'error', err?: string | null) => void;
}

export function makeDesign(name: string, plan: Plan): Design {
  const now = Date.now();
  return { id: uid('d'), name, plan, createdAt: now, updatedAt: now };
}

export function makeProject(name: string, plan: Plan, designName = 'التصميم A'): Project {
  const now = Date.now();
  const d = makeDesign(designName, plan);
  return {
    schema: SCHEMA_VERSION,
    id: uid('p'),
    name,
    createdAt: now,
    updatedAt: now,
    designs: [d],
    activeDesignId: d.id,
    prices: {},
    estimate: { ...DEFAULT_ESTIMATE },
  };
}

export function activeDesign(p: Project): Design {
  return p.designs.find((d) => d.id === p.activeDesignId) ?? p.designs[0];
}

function withPlan(project: Project, plan: Plan): Project {
  const now = Date.now();
  return {
    ...project,
    updatedAt: now,
    designs: project.designs.map((d) => (d.id === project.activeDesignId ? { ...d, plan, updatedAt: now } : d)),
  };
}

function nextDesignName(project: Project): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const l of letters) {
    const n = `التصميم ${l}`;
    if (!project.designs.some((d) => d.name === n)) return n;
  }
  return `تصميم ${project.designs.length + 1}`;
}

function cloneElement(el: PlanElement, dx: number, dy: number): PlanElement {
  const c = JSON.parse(JSON.stringify(el)) as PlanElement;
  c.id = uid(el.kind.slice(0, 3));
  c.x = round(c.x + dx, 3);
  c.y = round(c.y + dy, 3);
  c.locked = false;
  if (c.points) c.points = c.points.map((p) => ({ x: round(p.x + dx, 3), y: round(p.y + dy, 3) }));
  return c;
}

function translate(el: PlanElement, dx: number, dy: number): PlanElement {
  const next: PlanElement = { ...el, x: round(el.x + dx, 3), y: round(el.y + dy, 3) };
  if (el.points) next.points = el.points.map((p) => ({ x: round(p.x + dx, 3), y: round(p.y + dy, 3) }));
  return next;
}

function initialProject(): { project: Project; firstRun: boolean } {
  const lastId = storage.lastProjectId();
  if (lastId) {
    const p = storage.loadProject(lastId);
    if (p) return { project: p, firstRun: false };
  }
  const list = storage.listProjects();
  for (const m of list) {
    const p = storage.loadProject(m.id);
    if (p) return { project: p, firstRun: false };
  }
  return { project: makeProject('عنتنا', createSamplePlan()), firstRun: true };
}

const init = initialProject();

export const useEditor = create<State>()((set, get) => ({
  project: init.project,
  projects: storage.listProjects(),
  past: [],
  future: [],
  gestureBase: null,
  lastMergeKey: null,
  lastMergeAt: 0,

  selection: [],
  view: typeof window !== 'undefined' && window.innerWidth < 768 ? '3d' : '2d',
  time: 'day',
  lightsMaster: true,
  lightQuality: 'medium',
  tool: 'select',
  grid: { show: true, snap: true, size: 0.5 },
  overlays: { dims: true, distances: true, lightMap: false, safety: true, labels: true },
  camera: { preset: 'oblique', nonce: 0 },
  dialog: init.firstRun ? 'welcome' : null,
  pendingShared: null,
  toasts: [],
  clipboard: [],
  saveState: init.firstRun ? 'pending' : 'saved',
  saveError: null,
  capture3d: { nonce: 0, mode: 'download' },

  setPlan: (fn, opts = {}) => {
    const s = get();
    const current = activeDesign(s.project).plan;
    const next = fn(current);
    if (next === current) return;
    const useHistory = opts.history !== false && !s.gestureBase;
    let past = s.past;
    let future = s.future;
    let lastMergeKey = s.lastMergeKey;
    const now = Date.now();
    if (useHistory) {
      const merge = !!opts.mergeKey && opts.mergeKey === s.lastMergeKey && now - s.lastMergeAt < MERGE_WINDOW_MS;
      if (!merge) past = [...s.past, current].slice(-HISTORY_LIMIT);
      future = [];
      lastMergeKey = opts.mergeKey ?? null;
    }
    set({
      project: withPlan(s.project, next),
      past,
      future,
      lastMergeKey,
      lastMergeAt: now,
    });
  },

  beginGesture: () => {
    const s = get();
    if (!s.gestureBase) set({ gestureBase: activeDesign(s.project).plan });
  },

  endGesture: () => {
    const s = get();
    const base = s.gestureBase;
    if (!base) return;
    const current = activeDesign(s.project).plan;
    if (base !== current) {
      set({ gestureBase: null, past: [...s.past, base].slice(-HISTORY_LIMIT), future: [], lastMergeKey: null });
    } else {
      set({ gestureBase: null });
    }
  },

  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const current = activeDesign(s.project).plan;
    const prev = s.past[s.past.length - 1];
    const ids = new Set(prev.elements.map((e) => e.id));
    set({
      project: withPlan(s.project, prev),
      past: s.past.slice(0, -1),
      future: [current, ...s.future].slice(0, HISTORY_LIMIT),
      selection: s.selection.filter((id) => ids.has(id)),
      lastMergeKey: null,
    });
  },

  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const current = activeDesign(s.project).plan;
    const next = s.future[0];
    const ids = new Set(next.elements.map((e) => e.id));
    set({
      project: withPlan(s.project, next),
      past: [...s.past, current].slice(-HISTORY_LIMIT),
      future: s.future.slice(1),
      selection: s.selection.filter((id) => ids.has(id)),
      lastMergeKey: null,
    });
  },

  addElement: (el, select = true) => {
    get().setPlan((p) => ({ ...p, elements: [...p.elements, el] }));
    if (select) set({ selection: [el.id] });
  },

  addElements: (els) => {
    if (!els.length) return;
    get().setPlan((p) => ({ ...p, elements: [...p.elements, ...els] }));
    set({ selection: els.map((e) => e.id) });
  },

  updateElement: (id, patch, opts) => {
    get().setPlan(
      (p) => ({ ...p, elements: p.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }),
      opts,
    );
  },

  updateElements: (patches, opts) => {
    get().setPlan(
      (p) => ({ ...p, elements: p.elements.map((e) => (patches[e.id] ? { ...e, ...patches[e.id] } : e)) }),
      opts,
    );
  },

  removeElements: (ids) => {
    if (!ids.length) return;
    const set_ = new Set(ids);
    const plan = activeDesign(get().project).plan;
    const removable = plan.elements.filter((e) => set_.has(e.id) && !e.locked).map((e) => e.id);
    if (!removable.length) {
      get().toast('العناصر المحددة مقفلة — ألغِ القفل أولاً', 'warning');
      return;
    }
    const rm = new Set(removable);
    get().setPlan((p) => ({ ...p, elements: p.elements.filter((e) => !rm.has(e.id)) }));
    set({ selection: get().selection.filter((id) => !rm.has(id)) });
  },

  duplicateElements: (ids) => {
    const plan = activeDesign(get().project).plan;
    const src = plan.elements.filter((e) => ids.includes(e.id));
    if (!src.length) return;
    const copies = src.map((e) => {
      const c = cloneElement(e, 1, 1);
      c.name = e.name;
      return c;
    });
    get().addElements(copies);
  },

  moveElements: (ids, dx, dy, opts) => {
    if (!ids.length || (dx === 0 && dy === 0)) return;
    const s = new Set(ids);
    get().setPlan(
      (p) => ({ ...p, elements: p.elements.map((e) => (s.has(e.id) && !e.locked ? translate(e, dx, dy) : e)) }),
      opts,
    );
  },

  rotateElements: (ids, delta) => {
    const s = new Set(ids);
    get().setPlan(
      (p) => ({
        ...p,
        elements: p.elements.map((e) =>
          s.has(e.id) && !e.locked && !isPolyline(e.kind) ? { ...e, rotation: normalizeAngle(e.rotation + delta) } : e,
        ),
      }),
      { mergeKey: `rot:${ids.join(',')}` },
    );
  },

  setLocked: (ids, locked) => {
    const s = new Set(ids);
    get().setPlan((p) => ({ ...p, elements: p.elements.map((e) => (s.has(e.id) ? { ...e, locked } : e)) }));
  },

  reorder: (id, where) => {
    get().setPlan((p) => {
      const el = p.elements.find((e) => e.id === id);
      if (!el) return p;
      const rest = p.elements.filter((e) => e.id !== id);
      return { ...p, elements: where === 'front' ? [...rest, el] : [el, ...rest] };
    });
  },

  copySelection: () => {
    const s = get();
    const plan = activeDesign(s.project).plan;
    const els = plan.elements.filter((e) => s.selection.includes(e.id));
    if (els.length) {
      set({ clipboard: JSON.parse(JSON.stringify(els)) as PlanElement[] });
      get().toast(`تم نسخ ${els.length} عنصر`, 'info');
    }
  },

  paste: (at) => {
    const s = get();
    if (!s.clipboard.length) return;
    let dx = 1;
    let dy = 1;
    if (at) {
      const cx = s.clipboard.reduce((a, e) => a + e.x, 0) / s.clipboard.length;
      const cy = s.clipboard.reduce((a, e) => a + e.y, 0) / s.clipboard.length;
      dx = at.x - cx;
      dy = at.y - cy;
    }
    get().addElements(s.clipboard.map((e) => cloneElement(e, dx, dy)));
  },

  updateLand: (patch, opts) => {
    get().setPlan((p) => {
      const land = { ...p.land, ...patch };
      if (land.shape === 'square') land.depth = land.width;
      return { ...p, land };
    }, opts);
  },

  addMeasurement: (a, b) => {
    const m: Measurement = { id: uid('m'), a, b };
    get().setPlan((p) => ({ ...p, measurements: [...p.measurements, m] }));
  },

  removeMeasurement: (id) => {
    get().setPlan((p) => ({ ...p, measurements: p.measurements.filter((m) => m.id !== id) }));
  },

  clearMeasurements: () => {
    get().setPlan((p) => (p.measurements.length ? { ...p, measurements: [] } : p));
  },

  select: (ids, additive = false) => {
    const s = get();
    set({ selection: additive ? Array.from(new Set([...s.selection, ...ids])) : ids });
  },
  toggleSelect: (id) => {
    const s = get();
    set({ selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] });
  },
  clearSelection: () => set({ selection: [] }),
  setView: (view) => set({ view }),
  setTime: (time) => set({ time }),
  setLightsMaster: (lightsMaster) => set({ lightsMaster }),
  setLightQuality: (lightQuality) => set({ lightQuality }),
  setTool: (tool) => set({ tool }),
  setGrid: (patch) => set({ grid: { ...get().grid, ...patch } }),
  setOverlays: (patch) => set({ overlays: { ...get().overlays, ...patch } }),
  setCamera: (preset) => set({ camera: { preset, nonce: get().camera.nonce + 1 } }),
  openDialog: (dialog) => set({ dialog }),
  toast: (text, kind = 'info') => {
    const t: Toast = { id: uid('t'), kind, text };
    set({ toasts: [...get().toasts.slice(-3), t] });
    setTimeout(() => get().dismissToast(t.id), kind === 'error' ? 6500 : 3500);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  requestCapture3d: (mode) => set({ capture3d: { nonce: get().capture3d.nonce + 1, mode } }),

  switchDesign: (id) => {
    const s = get();
    if (!s.project.designs.some((d) => d.id === id) || s.project.activeDesignId === id) return;
    set({
      project: { ...s.project, activeDesignId: id, updatedAt: Date.now() },
      past: [],
      future: [],
      selection: [],
      gestureBase: null,
    });
  },

  addDesign: (name, source) => {
    const s = get();
    let plan: Plan;
    const current = activeDesign(s.project).plan;
    if (source === 'copy') plan = JSON.parse(JSON.stringify(current)) as Plan;
    else if (source === 'sample') plan = createSamplePlan();
    else plan = emptyPlan(JSON.parse(JSON.stringify(current.land)) as Land);
    const d = makeDesign(name.trim() || nextDesignName(s.project), plan);
    set({
      project: { ...s.project, designs: [...s.project.designs, d], activeDesignId: d.id, updatedAt: Date.now() },
      past: [],
      future: [],
      selection: [],
    });
    get().toast(`تم إنشاء «${d.name}»`, 'success');
  },

  renameDesign: (id, name) => {
    const s = get();
    const n = name.trim();
    if (!n) return;
    set({
      project: {
        ...s.project,
        updatedAt: Date.now(),
        designs: s.project.designs.map((d) => (d.id === id ? { ...d, name: n.slice(0, 80) } : d)),
      },
    });
  },

  setDesignNote: (id, note) => {
    const s = get();
    set({
      project: {
        ...s.project,
        updatedAt: Date.now(),
        designs: s.project.designs.map((d) => (d.id === id ? { ...d, note: note.slice(0, 2000) } : d)),
      },
    });
  },

  deleteDesign: (id) => {
    const s = get();
    if (s.project.designs.length <= 1) {
      get().toast('لا يمكن حذف التصميم الوحيد في المشروع', 'warning');
      return;
    }
    const designs = s.project.designs.filter((d) => d.id !== id);
    const activeDesignId = s.project.activeDesignId === id ? designs[0].id : s.project.activeDesignId;
    storage.removeThumbs(id);
    set({
      project: {
        ...s.project,
        designs,
        activeDesignId,
        finalDesignId: s.project.finalDesignId === id ? undefined : s.project.finalDesignId,
        updatedAt: Date.now(),
      },
      past: activeDesignId === s.project.activeDesignId ? s.past : [],
      future: activeDesignId === s.project.activeDesignId ? s.future : [],
      selection: [],
    });
  },

  setFinalDesign: (id) => {
    const s = get();
    set({ project: { ...s.project, finalDesignId: id, updatedAt: Date.now() } });
  },

  importDesign: (design) => {
    const s = get();
    const d: Design = { ...design, id: uid('d') };
    set({
      project: { ...s.project, designs: [...s.project.designs, d], activeDesignId: d.id, updatedAt: Date.now() },
      past: [],
      future: [],
      selection: [],
    });
  },

  refreshProjects: () => set({ projects: storage.listProjects() }),

  newProject: (name, plan) => {
    flushSave();
    const p = makeProject(name.trim() || 'مشروع جديد', plan ?? emptyPlan());
    set({ project: p, past: [], future: [], selection: [], gestureBase: null, saveState: 'pending' });
  },

  openProject: (id) => {
    flushSave();
    const p = storage.loadProject(id);
    if (!p) {
      get().toast('تعذر فتح المشروع — ربما يكون تالفاً', 'error');
      return false;
    }
    set({ project: p, past: [], future: [], selection: [], gestureBase: null, saveState: 'saved' });
    return true;
  },

  renameProject: (name) => {
    const n = name.trim();
    if (!n) return;
    set({ project: { ...get().project, name: n.slice(0, 80), updatedAt: Date.now() } });
  },

  deleteProject: (id) => {
    storage.deleteProject(id);
    const s = get();
    if (s.project.id === id) {
      const others = storage.listProjects();
      const next = others.length ? storage.loadProject(others[0].id) : null;
      set({
        project: next ?? makeProject('عنتنا', createSamplePlan()),
        past: [],
        future: [],
        selection: [],
        saveState: 'pending',
      });
    }
    set({ projects: storage.listProjects() });
  },

  importProject: (project) => {
    flushSave();
    const exists = storage.listProjects().some((m) => m.id === project.id);
    const p: Project = exists ? { ...project, id: uid('p'), name: `${project.name} (نسخة)` } : project;
    set({ project: p, past: [], future: [], selection: [], gestureBase: null, saveState: 'pending' });
  },

  setPendingShared: (pendingShared) => set({ pendingShared }),

  setPrice: (key, value) => {
    const s = get();
    const prices = { ...s.project.prices };
    if (value === null || !Number.isFinite(value) || value < 0) delete prices[key];
    else prices[key] = value;
    set({ project: { ...s.project, prices, updatedAt: Date.now() } });
  },

  setEstimate: (patch) => {
    const s = get();
    set({
      project: {
        ...s.project,
        estimate: { ...DEFAULT_ESTIMATE, ...s.project.estimate, ...patch },
        updatedAt: Date.now(),
      },
    });
  },

  setSaveState: (saveState, err = null) => set({ saveState, saveError: err }),
}));

// ——— الحفظ التلقائي ———

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved: Project | null = null;

function doSave(): void {
  const { project } = useEditor.getState();
  if (project === lastSaved) return;
  try {
    storage.saveProject(project);
    lastSaved = project;
    useEditor.setState({ saveState: 'saved', saveError: null, projects: storage.listProjects() });
  } catch (e) {
    useEditor.setState({ saveState: 'error', saveError: e instanceof Error ? e.message : 'تعذر الحفظ' });
  }
}

export function flushSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  doSave();
}

export function startAutosave(): () => void {
  if (!init.firstRun) lastSaved = useEditor.getState().project;
  const unsub = useEditor.subscribe((state, prev) => {
    if (state.project === prev.project) return;
    if (state.gestureBase) {
      // أثناء السحب لا نحفظ في كل حركة
      if (state.saveState !== 'pending') useEditor.setState({ saveState: 'pending' });
      return;
    }
    if (state.saveState !== 'pending') useEditor.setState({ saveState: 'pending' });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 500);
  });
  const unsubGesture = useEditor.subscribe((state, prev) => {
    if (prev.gestureBase && !state.gestureBase) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(doSave, 300);
    }
  });
  const onUnload = () => flushSave();
  window.addEventListener('beforeunload', onUnload);
  window.addEventListener('pagehide', onUnload);
  if (init.firstRun) saveTimer = setTimeout(doSave, 300);
  return () => {
    unsub();
    unsubGesture();
    window.removeEventListener('beforeunload', onUnload);
    window.removeEventListener('pagehide', onUnload);
  };
}

// ——— محددات مساعدة ———

export const usePlan = () => useEditor((s) => activeDesign(s.project).plan);
export const useActiveDesign = () => useEditor((s) => activeDesign(s.project));
export const getPlan = () => activeDesign(useEditor.getState().project).plan;
