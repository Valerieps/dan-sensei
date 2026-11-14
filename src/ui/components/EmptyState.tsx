import type { ReactNode } from 'react';

/** What a list says when it has nothing: the fact, and what to do next (the `action`). */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="muted">{children}</p>
      {action && <div className="row">{action}</div>}
    </div>
  );
}
