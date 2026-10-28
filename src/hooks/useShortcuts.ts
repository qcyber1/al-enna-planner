import { useEffect } from 'react';
import { getPlan, useEditor } from '../store/editorStore';
import { drawingState, useViewport } from '../editor2d/viewport';

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      const st = useEditor.getState();
      if (st.dialog) return;
      if (st.camera.preset === 'walk' && st.view !== '2d' && /^(Key[WASDQE]|Arrow)/.test(e.code)) return;
      const mod = e.ctrlKey || e.metaKey;
      const sel = st.selection;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && k === 'd') {
        e.preventDefault();
        st.duplicateElements(sel);
        return;
      }
      if (mod && k === 'c') {
        st.copySelection();
        return;
      }
      if (mod && k === 'v') {
        e.preventDefault();
        st.paste();
        return;
      }
      if (mod && k === 'a') {
        e.preventDefault();
        st.select(getPlan().elements.map((x) => x.id));
        return;
      }
      if (mod) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length && !drawingState.active) {
        e.preventDefault();
        st.removeElements(sel);
        return;
      }
      if (e.key === 'Escape') {
        if (st.tool !== 'select') st.setTool('select');
        else st.clearSelection();
        return;
      }
      if (e.key.startsWith('Arrow') && sel.length) {
        e.preventDefault();
        const s = e.shiftKey ? 1 : 0.1;
        const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0;
        const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
        st.moveElements(sel, dx, dy, { mergeKey: `nudge:${sel.join(',')}` });
        return;
      }
      switch (k) {
        case 'r':
          if (sel.length) st.rotateElements(sel, e.shiftKey ? -15 : 15);
          break;
        case 'l':
          if (sel.length) {
            const els = getPlan().elements.filter((x) => sel.includes(x.id));
            st.setLocked(sel, !els.every((x) => x.locked));
          }
          break;
        case 'v':
          st.setTool('select');
          break;
        case 'h':
          st.setTool('pan');
          break;
        case 'p':
          st.setTool('path');
          if (st.view === '3d') st.setView('2d');
          break;
        case 't':
          st.setTool('string-lights');
          if (st.view === '3d') st.setView('2d');
          break;
        case 'm':
          st.setTool('measure');
          if (st.view === '3d') st.setView('2d');
          break;
        case 'g':
          st.setGrid({ show: !st.grid.show });
          break;
        case 'f':
          useViewport.getState().requestFit();
          break;
        case '1':
          st.setView('2d');
          break;
        case '2':
          st.setView('3d');
          break;
        case '3':
          st.setView('split');
          break;
        case 'n':
          st.setTime(st.time === 'night' ? 'day' : 'night');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
