import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

type Pending = {
  /** The destructive action named by its verb: "Apagar pagamento". */
  title: string;
  /** What will happen, and that it cannot be undone when that is so. */
  message: string;
  run: () => void | Promise<void>;
};

/**
 * The confirmation of a destructive action (docs/UI.md): `confirm({...})` opens the red-button
 * dialog; render `dialog` once in the screen.
 */
export function useConfirm(): { confirm: (pending: Pending) => void; dialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null);
  const dialog = pending && (
    <ConfirmDialog
      title={pending.title}
      confirmLabel={pending.title}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        setPending(null);
        void pending.run();
      }}
    >
      {pending.message}
    </ConfirmDialog>
  );
  return { confirm: setPending, dialog };
}
