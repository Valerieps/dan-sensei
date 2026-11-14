// Monthly students: the fee, its due day and the months paid (docs/spec/mensalistas.md).
// The pending months come from `src/domain/pacotes/mensalidade.ts`; nothing derived is stored.
import type { MonthlyPaymentView, MonthlyView, PaymentMethod } from '../../src/application/api-contract';
import { mensalidadePendente, mesDe, mesesPendentes } from '../../src/domain/pacotes';
import { failure, QueryError, type CommandResult, type Context } from './context';
import type { Member } from './members';
import { todayIn } from './package-data';
import { isPositiveInt, MAX_PRICE_CENTS } from './plans';

const METHODS: readonly PaymentMethod[] = ['pix', 'cash', 'card'];
const isMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

interface FeeRow {
  student_id: string;
  amount_cents: number;
  due_day: number;
  paid_through: string | null;
}

interface PaymentRow {
  id: string;
  student_id: string;
  month: string;
  paid_on: string;
  amount_cents: number;
  method: PaymentMethod;
}

const toPaymentView = (row: PaymentRow): MonthlyPaymentView => ({
  id: row.id,
  month: row.month,
  paidOn: row.paid_on,
  amountCents: row.amount_cents,
  method: row.method,
});

/** The fee view of a monthly student, with what is pending today; null when there is no fee. */
export function loadMonthly(ctx: Context, studentId: string, today: string): MonthlyView | null {
  const [fee] = ctx.sql.all<FeeRow>('SELECT * FROM monthly_fees WHERE student_id = ?', studentId);
  if (!fee) return null;
  const payments = ctx.sql.all<PaymentRow>('SELECT * FROM monthly_payments WHERE student_id = ? ORDER BY month DESC', studentId);
  const latest = payments[0]?.month ?? null;
  const lastPaidMonth = latest !== null && (fee.paid_through === null || latest > fee.paid_through) ? latest : fee.paid_through;
  return {
    studentId,
    amountCents: fee.amount_cents,
    dueDay: fee.due_day,
    lastPaidMonth,
    pendingMonths: mesesPendentes({ diaVencimento: fee.due_day, ultimoMesPago: lastPaidMonth }, today),
    payments: payments.map(toPaymentView),
  };
}

/** The pending months of every monthly student, for the Alunos e pacotes screen. */
export function pendingMonthsByStudent(ctx: Context, today: string): Map<string, readonly string[]> {
  const pending = new Map<string, readonly string[]>();
  for (const { student_id } of ctx.sql.all<{ student_id: string }>('SELECT student_id FROM monthly_fees')) {
    const view = loadMonthly(ctx, student_id, today);
    if (view && mensalidadePendente({ diaVencimento: view.dueDay, ultimoMesPago: view.lastPaidMonth }, today)) pending.set(student_id, view.pendingMonths);
  }
  return pending;
}

/** Monthly fees paid on a day of the given month ("YYYY-MM"), for "Recebi". */
export function monthlyReceivedCents(ctx: Context, month: string): number {
  const [row] = ctx.sql.all<{ total: number | null }>('SELECT SUM(amount_cents) AS total FROM monthly_payments WHERE substr(paid_on, 1, 7) = ?', month);
  return row?.total ?? 0;
}

const student = (ctx: Context, id: unknown) =>
  typeof id === 'string' ? (ctx.sql.all<{ id: string; billing: string }>('SELECT id, billing FROM students WHERE id = ?', id)[0] ?? null) : null;

function parseFee(input: Record<string, unknown>): { amountCents: number; dueDay: number } | null {
  const { amountCents, dueDay } = input;
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents < 1 || amountCents > MAX_PRICE_CENTS) return null;
  if (!isPositiveInt(dueDay, 31)) return null;
  return { amountCents, dueDay };
}

export function monthlyOf(ctx: Context, _actor: Member, input: { studentId?: unknown }): MonthlyView | QueryError {
  if (typeof input.studentId !== 'string') return new QueryError('invalid');
  return loadMonthly(ctx, input.studentId, todayIn(ctx)) ?? new QueryError('not_found');
}

/** The starting balance: makes an old student monthly, with the fee, the due day and the last month paid. */
export function setupMonthly(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<MonthlyView> {
  const found = student(ctx, input.studentId);
  if (!found) return failure(typeof input.studentId === 'string' ? 'not_found' : 'invalid');
  const fee = parseFee(input);
  if (!fee) return failure('invalid');
  const lastPaidMonth = input.lastPaidMonth ?? null;
  if (lastPaidMonth !== null && (!isMonth(lastPaidMonth) || lastPaidMonth > mesDe(todayIn(ctx)))) return failure('invalid');
  const hasPackages = ctx.sql.all('SELECT 1 FROM packages WHERE holder_id = ? OR participant_id = ?', found.id, found.id).length > 0;
  if (hasPackages) return failure('conflict');
  ctx.sql.run("UPDATE students SET billing = 'monthly' WHERE id = ?", found.id);
  ctx.sql.run(
    `INSERT INTO monthly_fees (student_id, amount_cents, due_day, paid_through) VALUES (?, ?, ?, ?)
     ON CONFLICT (student_id) DO UPDATE SET amount_cents = excluded.amount_cents, due_day = excluded.due_day, paid_through = excluded.paid_through`,
    found.id,
    fee.amountCents,
    fee.dueDay,
    lastPaidMonth,
  );
  return { ok: true, value: loadMonthly(ctx, found.id, todayIn(ctx))!, changed: ['students', 'monthly'] };
}

export function setMonthlyFee(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<MonthlyView> {
  const found = student(ctx, input.studentId);
  if (!found) return failure(typeof input.studentId === 'string' ? 'not_found' : 'invalid');
  const fee = parseFee(input);
  if (!fee) return failure('invalid');
  if (ctx.sql.all('SELECT 1 FROM monthly_fees WHERE student_id = ?', found.id).length === 0) return failure('not_found');
  ctx.sql.run('UPDATE monthly_fees SET amount_cents = ?, due_day = ? WHERE student_id = ?', fee.amountCents, fee.dueDay, found.id);
  return { ok: true, value: loadMonthly(ctx, found.id, todayIn(ctx))!, changed: ['monthly'] };
}

export function registerMonthlyPayment(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<MonthlyPaymentView> {
  const found = student(ctx, input.studentId);
  if (!found) return failure(typeof input.studentId === 'string' ? 'not_found' : 'invalid');
  const { month, paidOn, amountCents, method } = input;
  if (!isMonth(month) || !isDate(paidOn)) return failure('invalid');
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents < 1 || amountCents > MAX_PRICE_CENTS) return failure('invalid');
  if (!METHODS.includes(method as PaymentMethod)) return failure('invalid');
  const today = todayIn(ctx);
  if (month > mesDe(today) || paidOn > today) return failure('invalid');
  if (ctx.sql.all('SELECT 1 FROM monthly_fees WHERE student_id = ?', found.id).length === 0) return failure('not_found');
  if (ctx.sql.all('SELECT 1 FROM monthly_payments WHERE student_id = ? AND month = ?', found.id, month).length > 0) return failure('conflict');
  const id = ctx.ids.next();
  ctx.sql.run(
    'INSERT INTO monthly_payments (id, student_id, month, paid_on, amount_cents, method) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    found.id,
    month,
    paidOn,
    amountCents,
    method as string,
  );
  return { ok: true, value: { id, month, paidOn, amountCents, method: method as PaymentMethod }, changed: ['monthly'] };
}

export function deleteMonthlyPayment(ctx: Context, _actor: Member, input: { id?: unknown }): CommandResult<null> {
  if (typeof input.id !== 'string') return failure('invalid');
  if (ctx.sql.all('SELECT 1 FROM monthly_payments WHERE id = ?', input.id).length === 0) return failure('not_found');
  ctx.sql.run('DELETE FROM monthly_payments WHERE id = ?', input.id);
  return { ok: true, value: null, changed: ['monthly'] };
}
