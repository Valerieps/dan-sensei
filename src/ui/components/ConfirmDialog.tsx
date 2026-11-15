import { useId, useRef, type ReactNode } from 'react';
import { strings } from '../../domain/strings';
import { Button } from './Button';
import { useDialog } from './use-dialog';

type ConfirmDialogProps = {
  title: string;
  /** What will happen, and that it cannot be undone when that is so. */
  children: ReactNode;
  /** The destructive action, named by its verb: "Excluir pagamento". */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

/**
 * The confirmation of a destructive action: red button and "Cancelar" (docs/UI.md). The focus
 * starts on Cancelar, so an Enter by reflex does not destroy anything.
 */
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel, busy = false }: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const box = useRef<HTMLDivElement>(null);
  useDialog(box, onCancel);

  return (
    <div className="panel-backdrop centered">
      <div ref={box} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} tabIndex={-1}>
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        <div id={messageId} className="dialog-message">
          {children}
        </div>
        <div className="dialog-actions">
          <Button variant="secondary" size="large" autoFocus onClick={onCancel}>
            {strings.cancel}
          </Button>
          <Button variant="danger" size="large" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
