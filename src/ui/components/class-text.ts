import type { AgendaClass } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import type { SwipeAction } from './SwipeActions';

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

/**
 * What swiping a lesson to the left offers (docs/spec/telas-de-gestao.md): only a scheduled lesson
 * can be rescheduled, and only one of today or of a past day can be marked as missed.
 */
export function lessonSwipeActions(c: AgendaClass, today: string, on: { reschedule: () => void; missed: () => void }): SwipeAction[] {
  if (c.status !== 'scheduled') return [];
  const t = strings.agenda;
  const actions: SwipeAction[] = [{ label: t.swipeReschedule, onClick: on.reschedule }];
  if (c.date <= today) actions.push({ label: t.swipeMissed, onClick: on.missed, tone: 'danger' });
  return actions;
}
