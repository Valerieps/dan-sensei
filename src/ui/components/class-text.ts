import type { AgendaClass } from '../../application/api-contract';
import { strings } from '../../domain/strings';

/** The names of a lesson's students: "Maria e João". */
export const classNames = (c: AgendaClass): string => c.students.map((s) => s.name).join(strings.agenda.and);

/** The situation as text, so the color is never the only signal. */
export function classStatusText(c: AgendaClass): string {
  const t = strings.agenda.status;
  if (c.status === 'missed') return c.absenceCharged ? t.missedCharged : t.missedWaived;
  return t[c.status];
}

/** The CSS modifier that colors the lesson by its situation. */
export function classTone(c: AgendaClass): 'scheduled' | 'given' | 'missed' | 'cancelled' {
  if (c.status === 'given') return 'given';
  if (c.status === 'missed') return 'missed';
  if (c.status === 'scheduled') return 'scheduled';
  return 'cancelled';
}
