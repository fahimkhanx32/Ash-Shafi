import { useEffect, useState } from 'react';

const MIN_SELECTION_LENGTH = 1;

/**
 * FET-18 — "Read selected content". Tracks the live browser text
 * selection anywhere in the document and exposes its text plus a
 * viewport-relative bounding rect, so a caller (`ReadSelectionButton`)
 * can position a floating affordance right next to it — the same
 * pattern browsers' own native "Search Google for…" selection
 * popover uses.
 *
 * Deliberately global (`document`-level `selectionchange`), not
 * scoped to a ref — a person can select text inside any card, table
 * cell, or dialog across the app, and this should work everywhere
 * without every page having to opt in individually.
 */
export function useTextSelection() {
  const [selection, setSelection] = useState({ text: '', rect: null });

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection?.();
      const text = sel?.toString().trim() || '';

      if (!sel || sel.isCollapsed || text.length < MIN_SELECTION_LENGTH) {
        setSelection({ text: '', rect: null });
        return;
      }

      // Ignore selections inside form controls (an input's own text
      // selection isn't reachable via `window.getSelection()` in most
      // browsers anyway, but a contentEditable-adjacent edge case
      // could be) — read-aloud is for *content*, not for text a
      // person is actively editing.
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
        setSelection({ text: '', rect: null });
        return;
      }

      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setSelection({ text: '', rect: null });
          return;
        }
        setSelection({ text, rect });
      } catch {
        setSelection({ text: '', rect: null });
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  return selection;
}
