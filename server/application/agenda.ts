// The agenda: fixed times, scheduled lessons, rescheduling, cancelling, giving a lesson from the
// grid, the validity forecast and the reads for the day, the week and the Início
// (docs/spec/agenda.md; ADR-010). A scheduled lesson is a `classes` row with status 'scheduled'
// whose students have charge 'waived': it consumes nothing until it is given or missed.
import type {
  AbsenceDecision,
  AgendaClass,
  AgendaHome,
  AgendaWeek,
  CancelClassResult,
  ClassStatus,
  ForecastWarning,
  NextClass,
  PackageForecast,
  PackageSummary,
  RecurrenceView,
  RegisterClassResult,
} from '../../src/application/api-contract';
import {
  type DiaDaSemana,
  aulaAgora,
  cancelarAula,
  datasDaRecorrencia,
  diaDaSemana,
  duracaoValida,
  ehData,
  ehHora,
  horaEmSaoPaulo,
  instanteEmSaoPaulo,
  limiteDeGeracao,
  preverValidade,
  projetarDatas,
  semanaDe,
  sugestaoParaFaltaSemAviso,
} from '../../src/domain/agenda';
import { type Data, dataEmSaoPaulo, diasEntre, somarDias } from '../../src/domain/pacotes';
import { resolveConsumption } from './classes';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import type { Member } from './members';
import { loadPackages, studentNames, todayIn, type PackageState } from './package-data';

type Input = Record<string, unknown>;

interface ClassRow {
  id: string;
  starts_at: string;
  status: ClassStatus;
  duration_min: number;
  address: string | null;
  rescheduled_from: string | null;
  recurrence_id: string | null;
  slot_on: string | null;
  confirmed_at: string | null;
  confirmation_asked_at: string | null;
}

interface RecurrenceRow {
  id: string;
  student_ids: string;
  weekday: number;
  time: string;
  duration_min: number;
  address: string | null;
  starts_on: string;
  ends_on: string | null;
}

const decisionOf = (value: unknown): AbsenceDecision | null | undefined =>
  value === undefined || value === 'charge' || value === 'waive' ? (value as AbsenceDecision | undefined) : null;

const startOfDay = (date: Data) => instanteEmSaoPaulo(date, '00:00');

// ---- shared helpers -------------------------------------------------------------------------

/** One or two distinct students who exist and are not inactive. */
function readStudents(ctx: Context, ids: unknown): string[] | 'invalid' | 'not_found' {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 2 || ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) return 'invalid';
  for (const id of ids as string[]) {
    const [student] = ctx.sql.all<{ status: string }>('SELECT status FROM students WHERE id = ?', id);
    if (!student) return 'not_found';
    if (student.status === 'inactive') return 'invalid';
  }
  return ids as string[];
}

/** The text of an address of one of the students; null when `addressId` is omitted (use the default). */
function readAddress(ctx: Context, studentIds: readonly string[], addressId: unknown): { address: string | null } | 'invalid' {
  if (addressId === undefined || addressId === null) return { address: null };
  if (typeof addressId !== 'string') return 'invalid';
  const [row] = ctx.sql.all<{ student_id: string; address: string }>('SELECT student_id, address FROM student_addresses WHERE id = ?', addressId);
  if (!row || !studentIds.includes(row.student_id)) return 'invalid';
  return { address: row.address };
}

function readDuration(value: unknown): number | 'invalid' {
  if (value === undefined) return 60;
  return duracaoValida(value) ? value : 'invalid';
}

function insertClass(
  ctx: Context,
  row: { startsAt: string; durationMin: number; address: string | null; rescheduledFrom?: string | null; recurrenceId?: string | null; slotOn?: string | null },
  studentIds: readonly string[],
): string {
  const id = ctx.ids.next();
  ctx.sql.run(
    `INSERT INTO classes (id, starts_at, status, created_at, duration_min, address, rescheduled_from, recurrence_id, slot_on)
     VALUES (?, ?, 'scheduled', ?, ?, ?, ?, ?, ?)`,
    id,
    row.startsAt,
    nowIso(ctx),
    row.durationMin,
    row.address,
    row.rescheduledFrom ?? null,
    row.recurrenceId ?? null,
    row.slotOn ?? null,
  );
  for (const studentId of studentIds) {
    ctx.sql.run("INSERT INTO class_students (class_id, student_id, package_id, charge) VALUES (?, ?, NULL, 'waived')", id, studentId);
  }
  return id;
}

function studentIdsOf(ctx: Context, classId: string): string[] {
  return ctx.sql.all<{ student_id: string }>('SELECT student_id FROM class_students WHERE class_id = ? ORDER BY rowid', classId).map((r) => r.student_id);
}

function scheduledClass(ctx: Context, classId: unknown): ClassRow | null {
  if (typeof classId !== 'string') return null;
  return ctx.sql.all<ClassRow>('SELECT * FROM classes WHERE id = ?', classId)[0] ?? null;
}

// ---- views ----------------------------------------------------------------------------------

function defaultAddresses(ctx: Context): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of ctx.sql.all<{ student_id: string; address: string }>('SELECT student_id, address FROM student_addresses ORDER BY is_default DESC, rowid')) {
    if (!map.has(r.student_id)) map.set(r.student_id, r.address);
  }
  return map;
}

/** The lessons that start in [from, to) with their students, in time order. */
function loadAgenda(ctx: Context, from: Data, to: Data): AgendaClass[] {
  const lower = startOfDay(from);
  const upper = startOfDay(to);
  const rows = ctx.sql.all<ClassRow>('SELECT * FROM classes WHERE starts_at >= ? AND starts_at < ? ORDER BY starts_at, rowid', lower, upper);
  const links = ctx.sql.all<{ class_id: string; student_id: string; package_id: string | null; charge: string }>(
    `SELECT class_id, student_id, package_id, charge FROM class_students
      WHERE class_id IN (SELECT id FROM classes WHERE starts_at >= ? AND starts_at < ?) ORDER BY rowid`,
    lower,
    upper,
  );
  const names = studentNames(ctx);
  const addresses = defaultAddresses(ctx);
  return rows.map((row) => {
    const mine = links.filter((l) => l.class_id === row.id);
    const consumes = mine.some((l) => l.charge === 'consumes');
    const packageId = mine.find((l) => l.package_id !== null)?.package_id ?? null;
    return {
      id: row.id,
      startsAt: row.starts_at,
      date: dataEmSaoPaulo(row.starts_at),
      time: horaEmSaoPaulo(row.starts_at),
      durationMin: row.duration_min,
      status: row.status,
      absenceCharged: row.status === 'missed' ? consumes : null,
      confirmed: row.confirmed_at !== null,
      confirmationAsked: row.confirmation_asked_at !== null,
      address: row.address ?? (mine[0] ? (addresses.get(mine[0].student_id) ?? null) : null),
      students: mine.map((l) => ({ id: l.student_id, name: names.get(l.student_id) ?? '' })),
      recurrenceId: row.recurrence_id,
      rescheduledFrom: row.rescheduled_from,
      packageId,
      withoutPackage: consumes && packageId === null,
    };
  });
}

function classView(ctx: Context, classId: string): AgendaClass {
  const [row] = ctx.sql.all<{ starts_at: string }>('SELECT starts_at FROM classes WHERE id = ?', classId);
  const date = dataEmSaoPaulo(row!.starts_at);
  return loadAgenda(ctx, date, somarDias(date, 1)).find((c) => c.id === classId)!;
}

const toRecurrence = (ctx: Context, row: RecurrenceRow): RecurrenceView => {
  const names = studentNames(ctx);
  const ids = JSON.parse(row.student_ids) as string[];
  return {
    id: row.id,
    studentIds: ids,
    studentNames: ids.map((id) => names.get(id) ?? ''),
    weekday: row.weekday,
    time: row.time,
    durationMin: row.duration_min,
    address: row.address,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  };
};

// ---- generation (ADR-010) -------------------------------------------------------------------

/**
 * Makes the scheduled lessons of every running fixed time from today through the generation
 * horizon. Safe to repeat: a day that already has a row (in any status) is skipped. Returns how
 * many lessons it made.
 */
export function generateAhead(ctx: Context): number {
  const today = todayIn(ctx);
  const limit = limiteDeGeracao(today);
  let made = 0;
  const recurrences = ctx.sql.all<RecurrenceRow>('SELECT * FROM recurrences WHERE ends_on IS NULL OR ends_on >= ? ORDER BY rowid', today);
  for (const recurrence of recurrences) {
    const ids = JSON.parse(recurrence.student_ids) as string[];
    const inactive = ids.some((id) => ctx.sql.all<{ status: string }>('SELECT status FROM students WHERE id = ?', id)[0]?.status === 'inactive');
    if (inactive) continue;
    const dates = datasDaRecorrencia({ diaDaSemana: recurrence.weekday as DiaDaSemana, inicio: recurrence.starts_on, fim: recurrence.ends_on }, today, limit);
    for (const date of dates) {
      const taken = ctx.sql.all('SELECT 1 FROM classes WHERE recurrence_id = ? AND slot_on = ?', recurrence.id, date).length > 0;
      if (taken) continue;
      insertClass(ctx, { startsAt: instanteEmSaoPaulo(date, recurrence.time), durationMin: recurrence.duration_min, address: recurrence.address, recurrenceId: recurrence.id, slotOn: date }, ids);
      made += 1;
    }
  }
  return made;
}

// ---- commands -------------------------------------------------------------------------------

/** A one-off lesson. */
export function scheduleClass(ctx: Context, _actor: Member, input: Input): CommandResult<AgendaClass> {
  const students = readStudents(ctx, input.studentIds);
  if (typeof students === 'string') return failure(students);
  if (!ehData(input.date) || input.date < todayIn(ctx) || !ehHora(input.time)) return failure('invalid');
  const durationMin = readDuration(input.durationMin);
  const address = readAddress(ctx, students, input.addressId);
  if (durationMin === 'invalid' || address === 'invalid') return failure('invalid');
  const id = insertClass(ctx, { startsAt: instanteEmSaoPaulo(input.date, input.time), durationMin, address: address.address }, students);
  return { ok: true, value: classView(ctx, id), changed: ['classes', 'packages'] };
}

export function createRecurrence(ctx: Context, _actor: Member, input: Input): CommandResult<RecurrenceView> {
  const students = readStudents(ctx, input.studentIds);
  if (typeof students === 'string') return failure(students);
  const today = todayIn(ctx);
  const startsOn = input.startsOn === undefined ? today : input.startsOn;
  if (!ehData(startsOn) || startsOn < today || !ehHora(input.time)) return failure('invalid');
  if (typeof input.weekday !== 'number' || !Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) return failure('invalid');
  const durationMin = readDuration(input.durationMin);
  const address = readAddress(ctx, students, input.addressId);
  if (durationMin === 'invalid' || address === 'invalid') return failure('invalid');
  const id = ctx.ids.next();
  ctx.sql.run(
    'INSERT INTO recurrences (id, student_ids, weekday, time, duration_min, address, starts_on, ends_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)',
    id,
    JSON.stringify(students),
    input.weekday,
    input.time,
    durationMin,
    address.address,
    startsOn,
    nowIso(ctx),
  );
  generateAhead(ctx);
  const [row] = ctx.sql.all<RecurrenceRow>('SELECT * FROM recurrences WHERE id = ?', id);
  return { ok: true, value: toRecurrence(ctx, row!), changed: ['classes', 'packages'] };
}

/** Deletes the scheduled lessons of a fixed time that start after `lastDay`; nothing was consumed. */
function dropScheduledAfter(ctx: Context, recurrenceId: string, lastDay: Data): void {
  const ids = ctx.sql
    .all<{ id: string }>("SELECT id FROM classes WHERE recurrence_id = ? AND status = 'scheduled' AND starts_at >= ?", recurrenceId, startOfDay(somarDias(lastDay, 1)))
    .map((r) => r.id);
  for (const id of ids) {
    ctx.sql.run('UPDATE classes SET rescheduled_from = NULL WHERE rescheduled_from = ?', id);
    ctx.sql.run('DELETE FROM class_students WHERE class_id = ?', id);
    ctx.sql.run('DELETE FROM classes WHERE id = ?', id);
  }
}

export function endRecurrence(ctx: Context, _actor: Member, input: Input): CommandResult<null> {
  if (typeof input.id !== 'string' || !ehData(input.endsOn)) return failure('invalid');
  const [row] = ctx.sql.all<RecurrenceRow>('SELECT * FROM recurrences WHERE id = ?', input.id);
  if (!row) return failure('not_found');
  ctx.sql.run('UPDATE recurrences SET ends_on = ? WHERE id = ?', input.endsOn, input.id);
  dropScheduledAfter(ctx, input.id, input.endsOn);
  return { ok: true, value: null, changed: ['classes', 'packages'] };
}

export function rescheduleClass(ctx: Context, _actor: Member, input: Input): CommandResult<AgendaClass> {
  const lesson = scheduledClass(ctx, input.classId);
  if (!lesson) return failure(typeof input.classId === 'string' ? 'not_found' : 'invalid');
  if (!ehData(input.date) || input.date < todayIn(ctx) || !ehHora(input.time)) return failure('invalid');
  if (input.scope !== 'this' && input.scope !== 'following') return failure('invalid');
  if (lesson.status !== 'scheduled') return failure('conflict');
  const students = studentIdsOf(ctx, lesson.id);

  if (input.scope === 'this') {
    const id = insertClass(ctx, { startsAt: instanteEmSaoPaulo(input.date, input.time), durationMin: lesson.duration_min, address: lesson.address, rescheduledFrom: lesson.id, recurrenceId: lesson.recurrence_id }, students);
    ctx.sql.run("UPDATE classes SET status = 'rescheduled', confirmed_at = NULL WHERE id = ?", lesson.id);
    return { ok: true, value: classView(ctx, id), changed: ['classes', 'packages'] };
  }

  // "Esta e as seguintes": the fixed time itself changes from this lesson on (ADR-010).
  if (!lesson.recurrence_id) return failure('invalid');
  const [old] = ctx.sql.all<RecurrenceRow>('SELECT * FROM recurrences WHERE id = ?', lesson.recurrence_id);
  if (!old) return failure('not_found');
  const anchor = dataEmSaoPaulo(lesson.starts_at);
  const shift = diasEntre(anchor, input.date);
  const newRecurrenceId = ctx.ids.next();
  ctx.sql.run(
    'INSERT INTO recurrences (id, student_ids, weekday, time, duration_min, address, starts_on, ends_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    newRecurrenceId,
    old.student_ids,
    diaDaSemana(input.date),
    input.time,
    old.duration_min,
    old.address,
    input.date,
    old.ends_on === null ? null : somarDias(old.ends_on, shift),
    nowIso(ctx),
  );
  // Days already settled (cancelled, rescheduled, given, missed) keep their place in the new fixed time.
  const markers = ctx.sql.all<{ id: string; slot_on: string }>(
    "SELECT id, slot_on FROM classes WHERE recurrence_id = ? AND slot_on >= ? AND status <> 'scheduled' ORDER BY slot_on DESC",
    old.id,
    anchor,
  );
  for (const m of markers) ctx.sql.run('UPDATE classes SET recurrence_id = ?, slot_on = ? WHERE id = ?', newRecurrenceId, somarDias(m.slot_on, shift), m.id);
  const moving = ctx.sql.all<ClassRow>("SELECT * FROM classes WHERE recurrence_id = ? AND status = 'scheduled' AND starts_at >= ? ORDER BY starts_at, rowid", old.id, lesson.starts_at);
  let first: string | null = null;
  for (const item of moving) {
    const date = somarDias(dataEmSaoPaulo(item.starts_at), shift);
    const created = insertClass(
      ctx,
      {
        startsAt: instanteEmSaoPaulo(date, input.time),
        durationMin: item.duration_min,
        address: item.address,
        rescheduledFrom: item.id,
        recurrenceId: newRecurrenceId,
        slotOn: item.slot_on === null ? null : somarDias(item.slot_on, shift),
      },
      studentIdsOf(ctx, item.id),
    );
    ctx.sql.run("UPDATE classes SET status = 'rescheduled', confirmed_at = NULL WHERE id = ?", item.id);
    if (item.id === lesson.id) first = created;
  }
  ctx.sql.run('UPDATE recurrences SET ends_on = ? WHERE id = ?', somarDias(anchor, -1), old.id);
  generateAhead(ctx);
  return { ok: true, value: classView(ctx, first!), changed: ['classes', 'packages'] };
}

/** Marks a scheduled lesson given or missed and attaches the consumption (rules of 1a). */
function settle(ctx: Context, lesson: ClassRow, outcome: 'given' | 'missed', consumes: boolean, explicit: string | null | undefined): CommandResult<RegisterClassResult> | { choose: PackageSummary[] } {
  const studentIds = studentIdsOf(ctx, lesson.id);
  const resolved = resolveConsumption(ctx, studentIds, dataEmSaoPaulo(lesson.starts_at), consumes, explicit);
  if (resolved === null) return failure('invalid');
  if ('choose' in resolved) return { choose: resolved.choose };
  ctx.sql.run('UPDATE classes SET status = ? WHERE id = ?', outcome, lesson.id);
  ctx.sql.run('UPDATE class_students SET package_id = ?, charge = ? WHERE class_id = ?', resolved.packageId, consumes ? 'consumes' : 'waived', lesson.id);
  return {
    ok: true,
    value: { registered: true, classId: lesson.id, packageId: resolved.packageId, withoutPackage: resolved.withoutPackage, pendingPayment: resolved.pendingPayment },
    changed: ['classes', 'packages'],
  };
}

const packageChoice = (value: unknown): string | null | undefined | 'invalid' =>
  value === undefined || value === null || typeof value === 'string' ? (value as string | null | undefined) : 'invalid';

export function completeClass(ctx: Context, _actor: Member, input: Input): CommandResult<RegisterClassResult> {
  const lesson = scheduledClass(ctx, input.classId);
  if (!lesson) return failure(typeof input.classId === 'string' ? 'not_found' : 'invalid');
  const explicit = packageChoice(input.packageId);
  if (explicit === 'invalid') return failure('invalid');
  if (lesson.status !== 'scheduled') return failure('conflict');
  if (dataEmSaoPaulo(lesson.starts_at) > todayIn(ctx)) return failure('invalid');
  const result = settle(ctx, lesson, 'given', true, explicit);
  return 'choose' in result ? { ok: true, value: { registered: false, choose: result.choose }, changed: [] } : result;
}

export function markMissed(ctx: Context, _actor: Member, input: Input): CommandResult<RegisterClassResult> {
  const lesson = scheduledClass(ctx, input.classId);
  if (!lesson) return failure(typeof input.classId === 'string' ? 'not_found' : 'invalid');
  const decision = decisionOf(input.decision);
  const explicit = packageChoice(input.packageId);
  if (decision === null || explicit === 'invalid') return failure('invalid');
  if (lesson.status !== 'scheduled') return failure('conflict');
  const charged = (decision ?? (sugestaoParaFaltaSemAviso === 'cobrar' ? 'charge' : 'waive')) === 'charge';
  const result = settle(ctx, lesson, 'missed', charged, explicit);
  return 'choose' in result ? { ok: true, value: { registered: false, choose: result.choose }, changed: [] } : result;
}

export function cancelClass(ctx: Context, _actor: Member, input: Input): CommandResult<CancelClassResult> {
  const lesson = scheduledClass(ctx, input.classId);
  if (!lesson) return failure(typeof input.classId === 'string' ? 'not_found' : 'invalid');
  const decision = decisionOf(input.decision);
  const explicit = packageChoice(input.packageId);
  if (decision === null || explicit === 'invalid') return failure('invalid');
  if (input.byTrainer !== undefined && typeof input.byTrainer !== 'boolean') return failure('invalid');
  if (lesson.status !== 'scheduled') return failure('conflict');

  const outcome = cancelarAula(lesson.starts_at, ctx.clock.now(), {
    peloTreinador: input.byTrainer === true,
    decisao: decision === undefined ? null : decision === 'charge' ? 'cobrar' : 'abonar',
  });
  if (outcome.tipo === 'decidir') {
    return { ok: true, value: { done: false, needsDecision: true, suggested: outcome.sugestao === 'cobrar' ? 'charge' : 'waive' }, changed: [] };
  }
  if (outcome.tipo === 'cancelada') {
    ctx.sql.run("UPDATE classes SET status = 'cancelled', confirmed_at = NULL WHERE id = ?", lesson.id);
    return { ok: true, value: { done: true, status: 'cancelled', charged: false }, changed: ['classes', 'packages'] };
  }
  const result = settle(ctx, lesson, 'missed', outcome.cobrada, explicit);
  if ('choose' in result) {
    return { ok: true, value: { done: false, needsPackage: true, choose: result.choose }, changed: [] };
  }
  if (!result.ok) return result;
  return { ok: true, value: { done: true, status: 'missed', charged: outcome.cobrada }, changed: result.changed };
}

export function confirmClass(ctx: Context, _actor: Member, input: Input): CommandResult<null> {
  const lesson = scheduledClass(ctx, input.classId);
  if (!lesson) return failure(typeof input.classId === 'string' ? 'not_found' : 'invalid');
  if (input.confirmed !== undefined && typeof input.confirmed !== 'boolean') return failure('invalid');
  if (lesson.status !== 'scheduled') return failure('conflict');
  ctx.sql.run('UPDATE classes SET confirmed_at = ? WHERE id = ?', input.confirmed === false ? null : nowIso(ctx), lesson.id);
  return { ok: true, value: null, changed: ['classes'] };
}

/** The confirmation was opened in WhatsApp; the app cannot know it was sent (ADR-008). */
export function markConfirmationAsked(ctx: Context, _actor: Member, input: Input): CommandResult<null> {
  const lesson = scheduledClass(ctx, input.classId);
  if (!lesson) return failure(typeof input.classId === 'string' ? 'not_found' : 'invalid');
  if (lesson.status !== 'scheduled') return failure('conflict');
  ctx.sql.run('UPDATE classes SET confirmation_asked_at = ? WHERE id = ?', nowIso(ctx), lesson.id);
  return { ok: true, value: null, changed: ['classes'] };
}

/** The next scheduled lesson of each student (from now on), as the Alunos e pacotes cards show it. */
export function nextClassByStudent(ctx: Context): Map<string, NextClass> {
  const next = new Map<string, NextClass>();
  const rows = ctx.sql.all<{ student_id: string; id: string; starts_at: string }>(
    `SELECT cs.student_id, c.id, c.starts_at FROM classes c JOIN class_students cs ON cs.class_id = c.id
      WHERE c.status = 'scheduled' AND c.starts_at >= ? ORDER BY c.starts_at, c.rowid`,
    ctx.clock.now().toISOString(),
  );
  for (const row of rows) {
    if (!next.has(row.student_id)) next.set(row.student_id, { id: row.id, date: dataEmSaoPaulo(row.starts_at), time: horaEmSaoPaulo(row.starts_at) });
  }
  return next;
}

// ---- validity forecast ----------------------------------------------------------------------

function forecastOf(ctx: Context, state: PackageState, states: Map<string, PackageState>, today: Data): PackageForecast {
  const { row, dados, resumo } = state;
  // The participant's solo lessons draw from the participant's own package, when there is one.
  const ownsPackage = (studentId: string) => [...states.values()].some((s) => s.row.closed_at === null && s.row.holder_id === studentId);
  const watched = [row.holder_id, ...(row.participant_id && !ownsPackage(row.participant_id) ? [row.participant_id] : [])];
  const marks = watched.map(() => '?').join(', ');
  const upcoming = ctx.sql
    .all<{ starts_at: string }>(
      `SELECT DISTINCT c.id, c.starts_at FROM classes c JOIN class_students cs ON cs.class_id = c.id
        WHERE c.status = 'scheduled' AND c.starts_at >= ? AND cs.student_id IN (${marks}) ORDER BY c.starts_at`,
      startOfDay(today),
      ...watched,
    )
    .map((r) => dataEmSaoPaulo(r.starts_at));
  // Past the generated horizon the fixed times are projected, so a long package is still forecast.
  const missing = resumo.restantes - upcoming.length;
  let dates = upcoming;
  if (missing > 0) {
    const running = ctx.sql
      .all<RecurrenceRow>('SELECT * FROM recurrences WHERE ends_on IS NULL OR ends_on >= ?', today)
      .filter((r) => (JSON.parse(r.student_ids) as string[]).some((id) => watched.includes(id)))
      .map((r) => ({ diaDaSemana: r.weekday as DiaDaSemana, inicio: r.starts_on, fim: r.ends_on }));
    const after = [limiteDeGeracao(today), ...upcoming].reduce((a, b) => (a >= b ? a : b));
    dates = [...upcoming, ...projetarDatas(running, after, missing)];
  }
  const forecast = preverValidade({
    restantes: resumo.restantes,
    total: resumo.total,
    validadeDias: row.validity_days,
    primeiraAula: dados.primeiraAula,
    pausas: state.pausas,
    aulasPrevistas: dates,
  });
  return {
    packageId: row.id,
    lastClassOn: forecast.ultimaAula,
    dueOn: forecast.vencimento,
    dueOnForecast: forecast.vencimentoPrevisto,
    exceedsValidity: forecast.passaDaValidade,
    missingClasses: forecast.faltamAulas,
    warning: forecast.aviso,
  };
}

export function packageForecast(ctx: Context, _actor: Member, input: Input): PackageForecast | QueryError {
  if (typeof input.packageId !== 'string') return new QueryError('invalid');
  const today = todayIn(ctx);
  const states = loadPackages(ctx, today);
  const state = states.get(input.packageId);
  if (!state || state.row.closed_at !== null) return new QueryError('not_found');
  return forecastOf(ctx, state, states, today);
}

// ---- queries --------------------------------------------------------------------------------

export function agendaDay(ctx: Context, _actor: Member, input: Input): AgendaClass[] | QueryError {
  if (!ehData(input.date)) return new QueryError('invalid');
  return loadAgenda(ctx, input.date, somarDias(input.date, 1)).filter((c) => c.status !== 'rescheduled');
}

export function agendaWeek(ctx: Context, _actor: Member, input: Input): AgendaWeek | QueryError {
  if (!ehData(input.date)) return new QueryError('invalid');
  const { segunda, domingo } = semanaDe(input.date);
  return { from: segunda, to: domingo, classes: loadAgenda(ctx, segunda, somarDias(domingo, 1)).filter((c) => c.status !== 'rescheduled') };
}

export function recurrencesOf(ctx: Context, _actor: Member, input: Input): RecurrenceView[] | QueryError {
  if (input.studentId !== undefined && typeof input.studentId !== 'string') return new QueryError('invalid');
  const rows = ctx.sql.all<RecurrenceRow>('SELECT * FROM recurrences WHERE ends_on IS NULL OR ends_on >= ? ORDER BY weekday, time, rowid', todayIn(ctx));
  return rows
    .filter((r) => input.studentId === undefined || (JSON.parse(r.student_ids) as string[]).includes(input.studentId as string))
    .map((r) => toRecurrence(ctx, r));
}

export function agendaHome(ctx: Context): AgendaHome {
  const today = todayIn(ctx);
  const now = ctx.clock.now();
  const tomorrow = somarDias(today, 1);
  const day = loadAgenda(ctx, today, tomorrow).filter((c) => c.status !== 'rescheduled' && c.status !== 'cancelled');
  const scheduled = day.filter((c) => c.status === 'scheduled');
  const states = loadPackages(ctx, today);
  const names = studentNames(ctx);
  const warnings: ForecastWarning[] = [];
  for (const state of states.values()) {
    if (state.row.closed_at !== null || state.resumo.restantes === 0) continue;
    const forecast = forecastOf(ctx, state, states, today);
    if (forecast.warning) warnings.push({ packageId: state.row.id, holderId: state.row.holder_id, holderName: names.get(state.row.holder_id) ?? '', message: forecast.warning });
  }
  return {
    today,
    classes: day,
    currentClassId: scheduled.find((c) => aulaAgora(c.startsAt, c.durationMin, now))?.id ?? null,
    nextClassId: scheduled.find((c) => new Date(c.startsAt).getTime() > now.getTime())?.id ?? null,
    tomorrow: loadAgenda(ctx, tomorrow, somarDias(tomorrow, 1)).filter((c) => c.status === 'scheduled'),
    forecastWarnings: warnings,
  };
}
