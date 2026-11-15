import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { LONG_PRESS_MS, movedPastSlop } from './long-press-logic';

/**
 * Calls `onLongPress` when a touch or a mouse button stays down for `LONG_PRESS_MS` without moving,
 * and on the browser's own context menu gesture (right click). The click that ends a long press is
 * swallowed, so it does not also open the link under the finger.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const latest = useRef(onLongPress);
  latest.current = onLongPress;

  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  useEffect(() => cancel, []);

  return {
    onPointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      fired.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        start.current = null;
        latest.current();
      }, LONG_PRESS_MS);
    },
    onPointerMove(event: PointerEvent) {
      const from = start.current;
      if (from && movedPastSlop(event.clientX - from.x, event.clientY - from.y)) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(event: MouseEvent) {
      event.preventDefault();
      cancel();
      fired.current = true;
      latest.current();
    },
    onClickCapture(event: MouseEvent) {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
