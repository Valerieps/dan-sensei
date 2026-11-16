// Payments of a package (docs/spec/pacotes-e-pagamentos.md, "Pagamentos"). Money is integer cents.
import type { PaymentInput, PaymentMethod, PaymentView } from '../../src/application/api-contract';
import { failure, type CommandResult, type Context } from './context';
import type { Member } from './members';
import { toPaymentView, type PaymentRow } from './package-data';
import { isDate } from './plans';

const METHODS: readonly PaymentMethod[] = ['pix', 'cash', 'card'];
export const MAX_PAYMENT_CENTS = 100_000_000;

export function parsePayment(input: Record<string, unknown>): PaymentInput | null {
  const { paidOn, amountCents, method } = input;
  if (!isDate(paidOn)) return null;
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents < 1 || amountCents > MAX_PAYMENT_CENTS) return null;
  if (!METHODS.includes(method as PaymentMethod)) return null;
  return { paidOn, amountCents, method: method as PaymentMethod };
}

export function insertPayment(ctx: Context, packageId: string, payment: PaymentInput): string {
  const id = ctx.ids.next();
  ctx.sql.run(
    'INSERT INTO payments (id, package_id, paid_on, amount_cents, method) VALUES (?, ?, ?, ?, ?)',
    id,
    packageId,
    payment.paidOn,
    payment.amountCents,
    payment.method,
  );
  return id;
}

function find(ctx: Context, id: string): PaymentView | null {
  const [row] = ctx.sql.all<PaymentRow>('SELECT * FROM payments WHERE id = ?', id);
  return row ? toPaymentView(row) : null;
}

export function createPayment(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<PaymentView> {
  if (typeof input.packageId !== 'string') return failure('invalid');
  const payment = parsePayment(input);
  if (!payment) return failure('invalid');
  if (ctx.sql.all('SELECT 1 FROM packages WHERE id = ?', input.packageId).length === 0) return failure('not_found');
  const id = insertPayment(ctx, input.packageId, payment);
  return { ok: true, value: find(ctx, id)!, changed: ['payments', 'packages'] };
}

/** Corrects the date, amount or method of a payment; it stays on the same package. */
export function updatePayment(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<PaymentView> {
  if (typeof input.id !== 'string') return failure('invalid');
  if (!find(ctx, input.id)) return failure('not_found');
  const payment = parsePayment(input);
  if (!payment) return failure('invalid');
  ctx.sql.run('UPDATE payments SET paid_on = ?, amount_cents = ?, method = ? WHERE id = ?', payment.paidOn, payment.amountCents, payment.method, input.id);
  return { ok: true, value: find(ctx, input.id)!, changed: ['payments', 'packages'] };
}

export function deletePayment(ctx: Context, _actor: Member, input: { id?: unknown }): CommandResult<null> {
  if (typeof input.id !== 'string') return failure('invalid');
  if (!find(ctx, input.id)) return failure('not_found');
  ctx.sql.run('DELETE FROM payments WHERE id = ?', input.id);
  return { ok: true, value: null, changed: ['payments', 'packages'] };
}
