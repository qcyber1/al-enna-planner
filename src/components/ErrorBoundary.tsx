// حماية من «الشاشة البيضاء»: لو جزء من الصفحة طاح (مثل المجسم 3D) يطلع بداله شي بسيط وباقي التطبيق يكمل
import { Component, type ReactNode } from 'react';

/** ملف ناقص بعد تحديث الموقع (الصفحة مفتوحة من قبل النشر) */
export function isChunkError(e: unknown): boolean {
  const m = String((e as { message?: string })?.message ?? e);
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically|MIME type/i.test(m);
}

const RELOAD_KEY = 'enna.chunk-reload';
/** نحدّث الصفحة مرة وحدة بس (عشان ما ندخل في حلقة) */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* تجاهل */
  }
  window.location.reload();
  return true;
}

interface Props {
  children: ReactNode;
  fallback: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error) => void;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[ui]', error);
    this.props.onError?.(error);
  }
  reset = () => this.setState({ error: null });
  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children;
  }
}
