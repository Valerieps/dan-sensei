import type { UrgencyItem } from '../../application/api-contract';

/** The views of the Alunos tab. `inactive` comes from another query, so it has no items here. */
export type StudentFilter = 'all' | 'attention' | 'monthly' | 'inactive';

export const FILTERS: readonly StudentFilter[] = ['all', 'attention', 'monthly', 'inactive'];

/** The active students a filter shows, in the urgency order the server gave. */
export function filterItems(items: readonly UrgencyItem[], filter: StudentFilter): UrgencyItem[] {
  if (filter === 'attention') return items.filter((item) => item.highlighted);
  if (filter === 'monthly') return items.filter((item) => item.billing === 'monthly');
  if (filter === 'inactive') return [];
  return [...items];
}

/** Where a tap on the card goes. */
export function cardDestination(item: UrgencyItem): string {
  if (item.billing === 'monthly') return `/alunos/${item.studentId}/mensalidades`;
  return item.package ? `/alunos/${item.studentId}/pacotes` : `/alunos/${item.studentId}/pacotes/novo`;
}

export interface CardMenu {
  /** The student's next lesson, on the agenda's day view; null when none is scheduled. */
  readonly reschedule: string | null;
  /** The payment form; null when there is nothing to pay (no package, and not monthly). */
  readonly registerPayment: string | null;
  /** The package tab, where the statement link lives; only the holder of a package has one. */
  readonly sendStatement: string | null;
}

/** The destinations of the card's context menu (docs/spec/telas-de-gestao.md, "Alunos"). */
export function cardMenu(item: UrgencyItem): CardMenu {
  const pkg = item.package;
  const registerPayment =
    item.billing === 'monthly' ? `/mensalidades/registrar/${item.studentId}` : pkg ? `/pagamentos/registrar/${item.studentId}/${pkg.id}` : null;
  const holds = item.billing !== 'monthly' && pkg !== null && pkg.holderId === item.studentId && pkg.status !== 'aguardando-inicio';
  return {
    reschedule: item.nextClass ? `/agenda/${item.nextClass.date}` : null,
    registerPayment,
    sendStatement: holds ? `/alunos/${item.studentId}/pacotes` : null,
  };
}
