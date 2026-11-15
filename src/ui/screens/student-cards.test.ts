import { describe, expect, it } from 'vitest';
import type { PackageSummary, UrgencyItem } from '../../application/api-contract';
import { cardDestination, cardMenu, filterItems } from './student-cards';

const pkg = { id: 'p1', holderId: 's1', status: 'ativo' } as PackageSummary;

function item(patch: Partial<UrgencyItem>): UrgencyItem {
  return {
    studentId: 's1',
    name: 'Ana',
    billing: 'package',
    pendingMonths: [],
    asParticipant: false,
    package: pkg,
    urgency: 4,
    highlighted: false,
    lessonsWithoutPackage: 0,
    nextClass: { date: '2026-03-02', time: '08:00' },
    ...patch,
  } as UrgencyItem;
}

describe('filterItems', () => {
  const items = [item({ studentId: 'a', highlighted: true }), item({ studentId: 'b', billing: 'monthly', package: null }), item({ studentId: 'c' })];

  it('keeps the urgency order for all', () => {
    expect(filterItems(items, 'all').map((i) => i.studentId)).toEqual(['a', 'b', 'c']);
  });
  it('shows only the highlighted ones in Atenção', () => {
    expect(filterItems(items, 'attention').map((i) => i.studentId)).toEqual(['a']);
  });
  it('shows only monthly students in Mensalistas', () => {
    expect(filterItems(items, 'monthly').map((i) => i.studentId)).toEqual(['b']);
  });
  it('leaves the inactive to their own query', () => {
    expect(filterItems(items, 'inactive')).toEqual([]);
  });
});

describe('cardDestination', () => {
  it('opens the tab that matters for the billing', () => {
    expect(cardDestination(item({}))).toBe('/alunos/s1/pacotes');
    expect(cardDestination(item({ billing: 'monthly', package: null }))).toBe('/alunos/s1/mensalidades');
    expect(cardDestination(item({ package: null }))).toBe('/alunos/s1/pacotes/novo');
  });
});

describe('cardMenu', () => {
  it('offers the three actions of a holder with a package and a next lesson', () => {
    expect(cardMenu(item({}))).toEqual({
      reschedule: '/agenda/2026-03-02',
      registerPayment: '/pagamentos/registrar/s1/p1',
      sendStatement: '/alunos/s1/pacotes',
    });
  });
  it('drops Remarcar without a next lesson', () => {
    expect(cardMenu(item({ nextClass: null })).reschedule).toBeNull();
  });
  it('sends a monthly student to the monthly payment, with no statement', () => {
    const menu = cardMenu(item({ billing: 'monthly', package: null }));
    expect(menu.registerPayment).toBe('/mensalidades/registrar/s1');
    expect(menu.sendStatement).toBeNull();
  });
  it('has no payment or statement without a package', () => {
    const menu = cardMenu(item({ package: null }));
    expect(menu.registerPayment).toBeNull();
    expect(menu.sendStatement).toBeNull();
  });
  it('gives the statement only to the holder, once the package has started', () => {
    expect(cardMenu(item({ package: { ...pkg, holderId: 'other' } })).sendStatement).toBeNull();
    expect(cardMenu(item({ package: { ...pkg, status: 'aguardando-inicio' } })).sendStatement).toBeNull();
  });
});
