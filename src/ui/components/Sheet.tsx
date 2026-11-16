import { useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { strings } from '../../domain/strings';
import { IconButton } from './Button';
import { dragOffset, settleDrag, type Detent } from './sheet-logic';
import { useDialog } from './use-dialog';

type SheetProps = {
  title: string;
  /** Cancel (×), Esc, a swipe down and a tap on the dimmed background all call it. */
  onClose: () => void;
  /** Save (✓), the panel's one primary action. Leave it out for a panel that only shows something. */
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  /** The height it opens at on the phone: medium, which a drag up turns into large. */
  detent?: Detent;
  children: ReactNode;
};

/**
 * The panel (docs/UI.md, "Padrão Apple"): a short task that keeps the person where they are. It
 * rises from the bottom on the phone, with a grabber, a medium and a large height, and closes when
 * swiped down; on the iPad it opens in the center. The focus stays inside and Esc closes it.
 * Render it only while it is open, and only one at a time.
 */
export function Sheet({ title, onClose, onSave, saveLabel = strings.save, saveDisabled = false, detent = 'medium', children }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; time: number } | null>(null);
  const [current, setCurrent] = useState<Detent>(detent);
  const [dragging, setDragging] = useState(false);
  useDialog(panel, onClose);

  function setOffset(value: number) {
    panel.current?.style.setProperty('--drag', String(value));
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    // The buttons in the header are taps, not the start of a swipe.
    if ((event.target as HTMLElement).closest('button')) return;
    start.current = { y: event.clientY, time: event.timeStamp };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (start.current) setOffset(dragOffset(event.clientY - start.current.y));
  }

  function onPointerEnd(event: PointerEvent<HTMLElement>) {
    const from = start.current;
    start.current = null;
    if (!from) return;
    setDragging(false);
    setOffset(0);
    const dy = event.clientY - from.y;
    const height = panel.current?.offsetHeight ?? 0;
    const velocity = height > 0 ? dy / height / Math.max(1, event.timeStamp - from.time) : 0;
    const result = settleDrag(dy, height, velocity, current);
    if (result === 'dismiss') onClose();
    else if (result === 'expand') setCurrent('large');
  }

  return (
    <div className="panel-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panel}
        className={['panel', current === 'large' ? 'large' : '', dragging ? 'dragging' : ''].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header
          className="panel-top"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <span className="panel-grabber" aria-hidden="true" />
          <div className="panel-header">
            <IconButton icon="xmark" label={strings.cancel} onClick={onClose} />
            <h2 id={titleId} className="panel-title">
              {title}
            </h2>
            {onSave ? <IconButton icon="checkmark" tone="brand" label={saveLabel} disabled={saveDisabled} onClick={onSave} /> : <span />}
          </div>
        </header>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}
