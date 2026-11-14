import { beforeEach, describe, expect, it } from 'vitest';
import type { Commands, MonthlyView, PackagesOverview, StudentView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';

let service: GroupService;
let clock: ReturnType<typeof fixedClock>;
const ADMIN = 'h-ana';

beforeEach(() => {
  clock = fixedClock('2026-10-21T12:00:00Z');
  service = new GroupService(memorySql(), clock, sequentialIds());
  service.migrate();
  service.signIn({ sub: 's1', email: 'ana@example.com', name: 'Ana', picture: null }, ADMIN, ['ana@example.com']);
});

function command<N extends keyof Commands>(name: N, input: Commands[N]['input']): Commands[N]['output'] {
  const result = service.command(ADMIN, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as Commands[N]['output'];
}

const fail = (name: string, input: unknown) => {
  const result = service.command(ADMIN, name, input);
  if (result.ok) throw new Error(`${name} should have failed`);
  return result.error;
};

function query<T>(name: string, input: unknown = {}): T {
  const result = service.query(ADMIN, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as T;
}

function addStudent(name: string): string {
  const result = service.command(ADMIN, 'student.create', { name, phone: '(11) 91234-5678', birthDate: null, heightCm: null, emergencyContact: '', addresses: [] });
  if (!result.ok) throw new Error(result.error);
  return (result.value as StudentView).id;
}

const monthly = (studentId: string) => query<MonthlyView>('monthly', { studentId });
const item = (studentId: string) => query<PackagesOverview>('packagesOverview').items.find((i) => i.studentId === studentId)!;

describe('monthly students', () => {
  it('setup makes the student monthly with the fee, the due day and the last month paid', () => {
    const id = addStudent('Bia');
    const view = command('monthly.setup', { studentId: id, amountCents: 40000, dueDay: 10, lastPaidMonth: '2026-09' });
    expect(view).toMatchObject({ amountCents: 40000, dueDay: 10, lastPaidMonth: '2026-09' });
    expect(query<StudentView>('student', { id }).billing).toBe('monthly');
  });

  it('a monthly student with an overdue month is pending, and stops being once the month is registered', () => {
    const id = addStudent('Bia');
    command('monthly.setup', { studentId: id, amountCents: 40000, dueDay: 10, lastPaidMonth: '2026-09' });
    expect(item(id).pendingMonths).toEqual(['2026-10']);
    expect(item(id).urgency).toBe(1);
    expect(item(id).package).toBeNull();

    command('monthly.registerPayment', { studentId: id, month: '2026-10', paidOn: '2026-10-21', amountCents: 40000, method: 'pix' });
    expect(item(id).pendingMonths).toEqual([]);
    expect(item(id).urgency).toBe(4);
    expect(monthly(id)!.lastPaidMonth).toBe('2026-10');
  });

  it('counts every month after the last paid one, and only the current month when none was ever paid', () => {
    const late = addStudent('Caio');
    command('monthly.setup', { studentId: late, amountCents: 30000, dueDay: 5, lastPaidMonth: '2026-07' });
    expect(monthly(late)!.pendingMonths).toEqual(['2026-08', '2026-09', '2026-10']);
    const fresh = addStudent('Duda');
    command('monthly.setup', { studentId: fresh, amountCents: 30000, dueDay: 5, lastPaidMonth: null });
    expect(monthly(fresh)!.pendingMonths).toEqual(['2026-10']);
  });

  it('is not pending before or on the due day', () => {
    const id = addStudent('Eva');
    command('monthly.setup', { studentId: id, amountCents: 30000, dueDay: 21, lastPaidMonth: '2026-09' });
    expect(monthly(id)!.pendingMonths).toEqual([]);
    clock.set('2026-10-22T12:00:00Z');
    expect(monthly(id)!.pendingMonths).toEqual(['2026-10']);
  });

  it('adds paid fees to "Recebi" and lists them newest first', () => {
    const id = addStudent('Bia');
    command('monthly.setup', { studentId: id, amountCents: 40000, dueDay: 10, lastPaidMonth: '2026-08' });
    command('monthly.registerPayment', { studentId: id, month: '2026-09', paidOn: '2026-10-02', amountCents: 40000, method: 'cash' });
    command('monthly.registerPayment', { studentId: id, month: '2026-10', paidOn: '2026-10-21', amountCents: 40000, method: 'pix' });
    expect(query<PackagesOverview>('packagesOverview').receivedCents).toBe(80000);
    expect(monthly(id)!.payments.map((p) => p.month)).toEqual(['2026-10', '2026-09']);
  });

  it('deleting a payment makes the month pending again', () => {
    const id = addStudent('Bia');
    command('monthly.setup', { studentId: id, amountCents: 40000, dueDay: 10, lastPaidMonth: '2026-09' });
    const payment = command('monthly.registerPayment', { studentId: id, month: '2026-10', paidOn: '2026-10-21', amountCents: 40000, method: 'pix' });
    command('monthly.deletePayment', { id: payment.id });
    expect(monthly(id)!.pendingMonths).toEqual(['2026-10']);
  });

  it('setFee changes the amount and the due day', () => {
    const id = addStudent('Bia');
    command('monthly.setup', { studentId: id, amountCents: 40000, dueDay: 10, lastPaidMonth: '2026-09' });
    expect(command('monthly.setFee', { studentId: id, amountCents: 45000, dueDay: 25 })).toMatchObject({ amountCents: 45000, dueDay: 25, pendingMonths: [] });
  });

  it('rejects what makes no sense', () => {
    const id = addStudent('Bia');
    expect(fail('monthly.setup', { studentId: id, amountCents: 0, dueDay: 10, lastPaidMonth: null })).toBe('invalid');
    expect(fail('monthly.setup', { studentId: id, amountCents: 100, dueDay: 32, lastPaidMonth: null })).toBe('invalid');
    expect(fail('monthly.setup', { studentId: id, amountCents: 100, dueDay: 10, lastPaidMonth: '2027-01' })).toBe('invalid');
    expect(fail('monthly.setup', { studentId: 'nope', amountCents: 100, dueDay: 10, lastPaidMonth: null })).toBe('not_found');
    expect(fail('monthly.registerPayment', { studentId: id, month: '2026-10', paidOn: '2026-10-21', amountCents: 100, method: 'pix' })).toBe('not_found');
    command('monthly.setup', { studentId: id, amountCents: 40000, dueDay: 10, lastPaidMonth: null });
    const payment = { studentId: id, month: '2026-10', paidOn: '2026-10-21', amountCents: 40000, method: 'pix' };
    expect(fail('monthly.registerPayment', { ...payment, month: '2026-11' })).toBe('invalid');
    expect(fail('monthly.registerPayment', { ...payment, method: 'boleto' })).toBe('invalid');
    command('monthly.registerPayment', payment as never);
    expect(fail('monthly.registerPayment', payment)).toBe('conflict');
  });

  it('refuses a student who already has packages', () => {
    const id = addStudent('Bia');
    const plan = query<{ id: string }[]>('plans')[0]!;
    command('package.create', { holderId: id, planId: plan.id });
    expect(fail('monthly.setup', { studentId: id, amountCents: 40000, dueDay: 10, lastPaidMonth: null })).toBe('conflict');
  });

  it('monthly is not_found for a package student', () => {
    const result = service.query(ADMIN, 'monthly', { studentId: addStudent('Bia') });
    expect(result).toEqual({ ok: false, error: 'not_found' });
  });
});
