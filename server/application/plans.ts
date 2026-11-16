// Plans: the models a package is sold from (docs/spec/pacotes-e-pagamentos.md, "Planos").
import type { PlanInput, PlanView } from '../../src/application/api-contract';
import { somarDias } from '../../src/domain/pacotes';
import { failure, type CommandResult, type Context } from './context';
import type { Member } from './members';

export const PLAN_NAME_MAX_LENGTH = 60;
export const MAX_CLASSES = 500;
export const MAX_VALIDITY_DAYS = 3650;
export const MAX_PRICE_CENTS = 10_000_000;

interface PlanRow {
  id: string;
  name: string;
  classes: number;
  price_cents: number;
  validity_days: number;
  active: number;
}

export const toPlanView = (row: PlanRow): PlanView => ({
  id: row.id,
  name: row.name,
  classes: row.classes,
  priceCents: row.price_cents,
  validityDays: row.validity_days,
  active: row.active === 1,
});

export function findPlan(ctx: Context, id: string): PlanView | null {
  const [row] = ctx.sql.all<PlanRow>('SELECT * FROM plans WHERE id = ?', id);
  return row ? toPlanView(row) : null;
}

export const isPositiveInt = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;

/** "YYYY-MM-DD" that is a real calendar day. */
export function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && somarDias(value, 0) === value;
}

function parsePlan(input: Record<string, unknown>): PlanInput | null {
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > PLAN_NAME_MAX_LENGTH) return null;
  if (!isPositiveInt(input.classes, MAX_CLASSES)) return null;
  if (!isPositiveInt(input.validityDays, MAX_VALIDITY_DAYS)) return null;
  const price = input.priceCents;
  if (typeof price !== 'number' || !Number.isInteger(price) || price < 0 || price > MAX_PRICE_CENTS) return null;
  return { name, classes: input.classes, priceCents: price, validityDays: input.validityDays };
}

export function listPlans(ctx: Context, _actor: Member, input: { includeInactive?: unknown }): PlanView[] {
  const where = input.includeInactive === true ? '' : 'WHERE active = 1';
  return ctx.sql.all<PlanRow>(`SELECT * FROM plans ${where} ORDER BY sort, rowid`).map(toPlanView);
}

export function createPlan(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<PlanView> {
  const plan = parsePlan(input);
  if (!plan) return failure('invalid');
  const id = ctx.ids.next();
  const [{ next }] = ctx.sql.all<{ next: number }>('SELECT COALESCE(MAX(sort), 0) + 1 AS next FROM plans');
  ctx.sql.run(
    'INSERT INTO plans (id, name, classes, price_cents, validity_days, active, sort) VALUES (?, ?, ?, ?, ?, 1, ?)',
    id,
    plan.name,
    plan.classes,
    plan.priceCents,
    plan.validityDays,
    next,
  );
  return { ok: true, value: findPlan(ctx, id)!, changed: ['plans'] };
}

/** Editing a plan never changes packages already sold: they keep their own copy. */
export function updatePlan(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<PlanView> {
  if (typeof input.id !== 'string') return failure('invalid');
  const current = findPlan(ctx, input.id);
  if (!current) return failure('not_found');
  const plan = parsePlan(input);
  if (!plan) return failure('invalid');
  if (input.active !== undefined && typeof input.active !== 'boolean') return failure('invalid');
  const active = input.active ?? current.active;
  ctx.sql.run(
    'UPDATE plans SET name = ?, classes = ?, price_cents = ?, validity_days = ?, active = ? WHERE id = ?',
    plan.name,
    plan.classes,
    plan.priceCents,
    plan.validityDays,
    active ? 1 : 0,
    input.id,
  );
  return { ok: true, value: findPlan(ctx, input.id)!, changed: ['plans'] };
}
