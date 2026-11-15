import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { isHorizontalSwipe, settlesOpen, swipeOffset } from './swipe-logic';

export type SwipeAction = {
  /** The button's text and name: "Remarcar". */
  label: string;
  onClick: () => void;
  tone?: 'brand' | 'danger';
};

type Gesture = { x: number; y: number; startedOpen: boolean; active: boolean; offset: number };

/**
 * A row that swipes to the left to show actions (iOS "swipe actions"). The same actions are real
 * buttons behind the row: Tab reaches them and focusing one opens the row, so the keyboard and
 * screen readers get them without the gesture.
 */
export function SwipeActions({ actions, children }: { actions: readonly SwipeAction[]; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const moved = useRef(false);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const width = () => actionsRef.current?.offsetWidth ?? 0;
  const place = (offset: number) => contentRef.current?.style.setProperty('--swipe-offset', String(offset));

  useEffect(() => {
    place(open ? -width() : 0);
  }, [open]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, startedOpen: open, active: false, offset: open ? -width() : 0 };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.x;
    if (!g.active) {
      if (!isHorizontalSwipe(dx, event.clientY - g.y)) return;
      g.active = true;
      moved.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    g.offset = swipeOffset(dx, g.startedOpen, width());
    place(g.offset);
  }

  function onPointerEnd() {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.active) return;
    setDragging(false);
    const next = settlesOpen(g.offset, width());
    place(next ? -width() : 0);
    setOpen(next);
    // The click that follows a swipe must not open the row.
    window.setTimeout(() => {
      moved.current = false;
    }, 0);
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) setOpen(false);
  }

  return (
    <div className={open ? 'swipe open' : 'swipe'} onKeyDown={onKeyDown}>
      <div ref={actionsRef} className="swipe-actions" onBlur={onBlur}>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.tone === 'danger' ? 'swipe-action danger' : 'swipe-action'}
            onFocus={() => setOpen(true)}
            onClick={() => {
              setOpen(false);
              action.onClick();
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div
        ref={contentRef}
        className={dragging ? 'swipe-content dragging' : 'swipe-content'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          if (moved.current || open) {
            if (open) setOpen(false);
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
