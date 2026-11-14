// Packages: sale and renewal, pauses, and the two package queries (docs/spec/pacotes-e-pagamentos.md).
import type {
  GlobalPauseView,
  LessonOutcome,
  PackageStatement,
  PackageSummary,
  PackagesOverview,
  PaymentInput,
  RenewalPreview,
  StatementPause,
  UrgencyItem,
} from '../../src/application/api-contract';
import {
  anotacaoDoPacoteEncerrado,
  aulasATransferir,
  avaliarPausa,
  avisoDeTransferencia,
  dataEmSaoPaulo,
  mesDe,
  nivelDeUrgencia,
  ordenarPorUrgencia,
  comDestaqueVermelho,
  type ItemDeUrgencia,
} from '../../src/domain/pacotes';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import type { Member } from './members';
import {
  livePackageOf,
  loadGlobalPauses,
  loadPackages,
  studentNames,
  summarize,
  todayIn,
  toPaymentView,
  type PackageState,
} from './package-data';
import { insertPayment, parsePayment } from './payments';
import { findPlan, isDate, isPositiveInt, MAX_CLASSES, MAX_PRICE_CENTS, MAX_VALIDITY_DAYS } from './plans';

interface StudentRow {
  id: string;
  name: string;
  billing: 'package' | 'monthly';
  status: string;
}

const student = (ctx: Context, id: unknown): StudentRow | null =>
  typeof id === 'string' ? (ctx.sql.all<StudentRow>('SELECT id, name, billing, status FROM students WHERE id = ?', id)[0] ?? null) : null;

function summaryOf(ctx: Context, id: string): PackageSummary {
  const today = todayIn(ctx);
  return summarize(ctx, loadPackages(ctx, today).get(id)!, studentNames(ctx), today);
}

// ---------- commands ----------

/**
 * Sells a package from a plan. If the holder still has a live package, it closes in the same
 * transaction and its leftover lessons move here ("Renovação"). With `usedBeforeApp` it is the
 * starting balance of a package already under way ("Saldo inicial").
 */
export function createPackage(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<PackageSummary> {
  const holder = student(ctx, input.holderId);
  if (!holder) return failure(typeof input.holderId === 'string' ? 'not_found' : 'invalid');
  if (holder.billing !== 'package' || holder.status === 'inactive') return failure('invalid');
  const participantId = input.participantId ?? null;
  if (participantId !== null) {
    if (typeof participantId !== 'string' || participantId === holder.id) return failure('invalid');
    if (!student(ctx, participantId)) return failure('not_found');
  }
  if (typeof input.planId !== 'string') return failure('invalid');
  const plan = findPlan(ctx, input.planId);
  if (!plan) return failure('not_found');
  if (!plan.active) return failure('invalid');

  const classes = input.classes ?? plan.classes;
  const validityDays = input.validityDays ?? plan.validityDays;
  const priceCents = input.priceCents ?? plan.priceCents;
  if (!isPositiveInt(classes, MAX_CLASSES) || !isPositiveInt(validityDays, MAX_VALIDITY_DAYS)) return failure('invalid');
  if (typeof priceCents !== 'number' || !Number.isInteger(priceCents) || priceCents < 0 || priceCents > MAX_PRICE_CENTS) return failure('invalid');

  const today = todayIn(ctx);
  const usedBeforeApp = input.usedBeforeApp ?? 0;
  const firstClassOn = input.firstClassOn ?? null;
  if (typeof usedBeforeApp !== 'number' || !Number.isInteger(usedBeforeApp) || usedBeforeApp < 0 || usedBeforeApp > classes) return failure('invalid');
  if (firstClassOn !== null && (!isDate(firstClassOn) || firstClassOn > today)) return failure('invalid');
  if (usedBeforeApp > 0 && firstClassOn === null) return failure('invalid');

  const payments: PaymentInput[] = [];
  if (input.payments !== undefined) {
    if (!Array.isArray(input.payments) || input.payments.length > 20) return failure('invalid');
    for (const raw of input.payments) {
      const payment = parsePayment((raw ?? {}) as Record<string, unknown>);
      if (!payment) return failure('invalid');
      payments.push(payment);
    }
  }

  const states = loadPackages(ctx, today);
  const previous = livePackageOf(states, holder.id);
  const transferred = previous ? aulasATransferir(previous.dados) : 0;

  const id = ctx.ids.next();
  ctx.sql.run(
    `INSERT INTO packages (id, holder_id, participant_id, plan_id, classes, price_cents, validity_days, transferred_in,
       used_before_app, first_class_on, previous_package_id, created_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    holder.id,
    participantId,
    plan.id,
    classes,
    priceCents,
    validityDays,
    transferred,
    usedBeforeApp,
    firstClassOn,
    previous?.row.id ?? null,
    today,
  );
  if (previous) {
    ctx.sql.run('UPDATE packages SET closed_at = ?, closed_note = ? WHERE id = ?', nowIso(ctx), anotacaoDoPacoteEncerrado(transferred, today), previous.row.id);
  }
  for (const payment of payments) insertPayment(ctx, id, payment);
  return { ok: true, value: summaryOf(ctx, id), changed: ['packages', 'payments'] };
}

/** Adds a pause of one package; past 30 own days the trainer must give a reason. */
export function pausePackage(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<StatementPause> {
  if (typeof input.packageId !== 'string') return failure('invalid');
  if (!isDate(input.startsOn) || !isDate(input.endsOn)) return failure('invalid');
  if (input.reason !== undefined && typeof input.reason !== 'string') return failure('invalid');
  const reason = input.reason?.trim().slice(0, 500) || null;
  const state = loadPackages(ctx, todayIn(ctx)).get(input.packageId);
  if (!state) return failure('not_found');
  if (state.row.closed_at !== null) return failure('conflict');
  const nova = { inicio: input.startsOn, fim: input.endsOn, geral: false, motivo: reason };
  if (!avaliarPausa(state.pausas, nova, reason).ok) return failure('invalid');
  const id = ctx.ids.next();
  ctx.sql.run('INSERT INTO package_pauses (id, package_id, starts_on, ends_on, reason) VALUES (?, ?, ?, ?, ?)', id, state.row.id, input.startsOn, input.endsOn, reason);
  return { ok: true, value: { id, startsOn: input.startsOn, endsOn: input.endsOn, reason, general: false }, changed: ['packages'] };
}

export function removePackagePause(ctx: Context, _actor: Member, input: { id?: unknown }): CommandResult<null> {
  if (typeof input.id !== 'string') return failure('invalid');
  if (ctx.sql.all('SELECT 1 FROM package_pauses WHERE id = ?', input.id).length === 0) return failure('not_found');
  ctx.sql.run('DELETE FROM package_pauses WHERE id = ?', input.id);
  return { ok: true, value: null, changed: ['packages'] };
}

/** "Pausar todos os pacotes": one period that applies to every package, never against the 30 days. */
export function createGlobalPause(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<GlobalPauseView> {
  if (!isDate(input.startsOn) || !isDate(input.endsOn) || input.endsOn < input.startsOn) return failure('invalid');
  const id = ctx.ids.next();
  ctx.sql.run('INSERT INTO global_pauses (id, starts_on, ends_on, created_at) VALUES (?, ?, ?, ?)', id, input.startsOn, input.endsOn, nowIso(ctx));
  return { ok: true, value: { id, startsOn: input.startsOn, endsOn: input.endsOn }, changed: ['packages'] };
}

export function removeGlobalPause(ctx: Context, _actor: Member, input: { id?: unknown }): CommandResult<null> {
  if (typeof input.id !== 'string') return failure('invalid');
  if (ctx.sql.all('SELECT 1 FROM global_pauses WHERE id = ?', input.id).length === 0) return failure('not_found');
  ctx.sql.run('DELETE FROM global_pauses WHERE id = ?', input.id);
  return { ok: true, value: null, changed: ['packages'] };
}

// ---------- queries ----------

export function renewalPreview(ctx: Context, _actor: Member, input: { holderId?: unknown }): RenewalPreview | QueryError {
  if (typeof input.holderId !== 'string') return new QueryError('invalid');
  const previous = livePackageOf(loadPackages(ctx, todayIn(ctx)), input.holderId);
  const transferred = previous ? aulasATransferir(previous.dados) : 0;
  return { previousPackageId: previous?.row.id ?? null, transferred, notice: avisoDeTransferencia(transferred) };
}

export function studentPackages(ctx: Context, _actor: Member, input: { studentId?: unknown }): PackageSummary[] | QueryError {
  if (typeof input.studentId !== 'string') return new QueryError('invalid');
  const today = todayIn(ctx);
  const names = studentNames(ctx);
  return [...loadPackages(ctx, today).values()]
    .filter((s) => s.row.holder_id === input.studentId || s.row.participant_id === input.studentId)
    .reverse()
    .map((s) => summarize(ctx, s, names, today));
}

function outcomeOf(status: string, charge: string): LessonOutcome {
  if (status === 'given') return 'given';
  return charge === 'consumes' ? 'missed_charged' : 'missed_waived';
}

export function getPackage(ctx: Context, _actor: Member, input: { id?: unknown }): PackageStatement | QueryError {
  if (typeof input.id !== 'string') return new QueryError('invalid');
  const today = todayIn(ctx);
  const states = loadPackages(ctx, today);
  const state = states.get(input.id);
  if (!state) return new QueryError('not_found');
  const names = studentNames(ctx);

  const rows = ctx.sql.all<{ class_id: string; starts_at: string; status: string; charge: string; student_id: string }>(
    `SELECT c.id AS class_id, c.starts_at, c.status, cs.charge, cs.student_id
       FROM class_students cs JOIN classes c ON c.id = cs.class_id
      WHERE cs.package_id = ? ORDER BY c.starts_at DESC, c.rowid DESC, cs.rowid`,
    input.id,
  );
  const lessons = new Map<string, PackageStatement['lessons'][number] & { studentIds: string[]; studentNames: string[] }>();
  for (const r of rows) {
    let lesson = lessons.get(r.class_id);
    if (!lesson) {
      lesson = { classId: r.class_id, date: dataEmSaoPaulo(r.starts_at), outcome: outcomeOf(r.status, r.charge), studentIds: [], studentNames: [] };
      lessons.set(r.class_id, lesson);
    }
    lesson.studentIds.push(r.student_id);
    lesson.studentNames.push(names.get(r.student_id) ?? '');
  }

  const pauses: StatementPause[] = [
    ...state.ownPauses.map((p) => ({ id: p.id, startsOn: p.starts_on, endsOn: p.ends_on, reason: p.reason, general: false })),
    ...loadGlobalPauses(ctx).map((p) => ({ id: p.id, startsOn: p.starts_on, endsOn: p.ends_on, reason: null, general: true })),
  ].sort((a, b) => a.startsOn.localeCompare(b.startsOn));

  const next = [...states.values()].find((s) => s.row.previous_package_id === state.row.id);
  return {
    summary: summarize(ctx, state, names, today),
    lessons: [...lessons.values()],
    pauses,
    payments: state.payments.map(toPaymentView),
    transferredFrom: state.row.previous_package_id ? { packageId: state.row.previous_package_id, count: state.row.transferred_in } : null,
    transferredTo: next && state.row.closed_note ? { packageId: next.row.id, count: next.row.transferred_in, note: state.row.closed_note } : null,
  };
}

interface Candidate extends ItemDeUrgencia {
  readonly view: UrgencyItem;
}

/** The "Alunos e pacotes" screen: every non-inactive student in urgency order, plus the month's numbers. */
export function packagesOverview(ctx: Context, _actor: Member): PackagesOverview {
  const today = todayIn(ctx);
  const states = loadPackages(ctx, today);
  const names = studentNames(ctx);
  const students = ctx.sql.all<StudentRow>("SELECT id, name, billing, status FROM students WHERE status <> 'inactive'");
  const unlinked = new Map(
    ctx.sql
      .all<{ student_id: string; n: number }>(
        "SELECT student_id, COUNT(*) AS n FROM class_students WHERE charge = 'consumes' AND package_id IS NULL GROUP BY student_id",
      )
      .map((r) => [r.student_id, r.n]),
  );

  let expectedRenewals = 0;
  const candidates: Candidate[] = students.map((s) => {
    const mensalista = s.billing === 'monthly';
    let current: PackageState | null = mensalista ? null : livePackageOf(states, s.id);
    let asParticipant = false;
    if (!mensalista && !current) {
      const shared = [...states.values()].filter((p) => p.row.participant_id === s.id && p.row.closed_at === null);
      current = shared.length > 0 ? shared[shared.length - 1]! : null;
      asParticipant = current !== null;
    }
    // Only the holder owes the payment; the participant just sees the shared package.
    const pagamentoPendente = current !== null && !asParticipant && current.pagamento.situacao === 'pendente';
    const base: ItemDeUrgencia = {
      id: s.id,
      nome: s.name,
      mensalista,
      avulso: current !== null && current.row.classes === 1,
      pagamentoPendente,
      situacao: current?.resumo.situacao ?? null,
      restantes: current?.resumo.restantes ?? 0,
      vencimento: current?.resumo.vencimento ?? null,
      // The next scheduled lesson exists from phase 1b on.
      proximaAula: null,
    };
    const nivel = nivelDeUrgencia({ ...base, pagamentoPendente: false }, today);
    if (!mensalista && current !== null && (nivel === 2 || nivel === 3)) expectedRenewals += 1;
    const view: UrgencyItem = {
      studentId: s.id,
      name: s.name,
      billing: s.billing,
      asParticipant,
      package: current ? summarize(ctx, current, names, today) : null,
      urgency: nivelDeUrgencia(base, today),
      highlighted: comDestaqueVermelho(base, today),
      lessonsWithoutPackage: unlinked.get(s.id) ?? 0,
    };
    return { ...base, view };
  });

  const month = mesDe(today);
  const receivedCents = [...states.values()]
    .flatMap((s) => s.payments)
    .filter((p) => mesDe(p.paid_on) === month)
    .reduce((sum, p) => sum + p.amount_cents, 0);

  return {
    month,
    receivedCents,
    expectedRenewals,
    items: ordenarPorUrgencia(candidates, today).map((c) => c.view),
    globalPauses: loadGlobalPauses(ctx)
      .filter((p) => p.ends_on >= today)
      .map((p) => ({ id: p.id, startsOn: p.starts_on, endsOn: p.ends_on })),
  };
}

