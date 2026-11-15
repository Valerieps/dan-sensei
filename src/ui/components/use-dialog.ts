import { useEffect, useRef, type RefObject } from 'react';
import { nextFocusIndex } from './sheet-logic';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * What a modal needs: the focus goes inside when it opens, Tab stays inside, Esc closes, and the
 * focus returns to where it was when it closes. A control with `autoFocus` keeps the focus it took.
 */
export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controls = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!root.contains(document.activeElement)) (controls()[0] ?? root).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const list = controls();
      const target = nextFocusIndex(list.length, list.indexOf(document.activeElement as HTMLElement), event.shiftKey);
      list[target]?.focus();
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      before?.focus();
    };
  }, [ref]);
}
