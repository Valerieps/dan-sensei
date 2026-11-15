// The live class (docs/spec/aula-ao-vivo.md): start, record sets, effort, finish and correct.
// A class is open from `started_at` to `finished_at`; only finishing draws it from the package.
// Every command carries a client-made id so the offline queue can resend it (ADR-009); ids of the
// things it creates (the set, the plan items) are derived from client input, never made here, so a
// command queued offline can refer to what an earlier queued command created.
import type {
  LastClassPlan,
  LiveClassView,
  LiveEntry,
  LiveFinishResult,
  LiveOpenClass,
  LivePlanItem,
  LiveSetView,
  LiveStudentView,
  StudentEffort,
} from '../../src/application/api-contract';
import { cargaDaAula, cargaPorSemana, duracaoEmMinutos, isDuration, isPse, ajustarSerie, proximoItem, serieComoPrescrita, tonelagem, volumePorGrupo, type Medidas } from '../../src/domain/aula';
import { dataEmSaoPaulo } from '../../src/domain/pacotes';
import { defaultPrescription, type GroupKind } from '../../src/domain/treinos';
import { failure, QueryError, type CommandResult, type Context } from './context';
import { findExercise } from './exercises';
import { alertsOf } from './health';
import type { Member } from './members';
import { resolveConsumption } from './classes';
import { todayIn } from './package-data';

type Input = Record<string, unknown>;

interface ClassRow {
  id: string;
  starts_at: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  actual_min: number | null;
}

interface PlanRow {
  id: string;
  class_id: string;
  student_id: string;
  exercise_id: string;
  sort: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  load_g: number | null;
  rest_s: number;
  notes: string;
  group_key: string | null;
  group_kind: GroupKind | null;
}

interface SetRow {
  id: string;
  class_id: string;
  student_id: string;
  plan_id: string;
  exercise_id: string;
  order: number;
  reps: number | null;
  load_g: number | null;
  seconds: number | null;
  meters: number | null;
}

const MAX_ID_LENGTH = 100;
const isId = (value: unknown): value is string => typeof value === 'string' && value.length >= 1 && value.length <= MAX_ID_LENGTH;
const OPEN = "status = 'scheduled' AND started_at IS NOT NULL AND finished_at IS NULL";

/**
 * When the action happened on the device. A command that waited in the offline queue must keep its own
 * time, or a class sent after the fact would last no time at all. Believed only when it is a valid
 * instant that is not in the future and not older than a week; otherwise the server's clock.
 */
function clientTime(ctx: Context, input: Input): string {
  const now = ctx.clock.now();
  if (typeof input.at !== 'string') return now.toISOString();
  const at = new Date(input.at);
  const age = now.getTime() - at.getTime();
  return Number.isNaN(at.getTime()) || age < -60_000 || age > 7 * 86_400_000 ? now.toISOString() : at.toISOString();
}

const findClass = (ctx: Context, id: unknown): ClassRow | null =>
  typeof id === 'string' ? (ctx.sql.all<ClassRow>('SELECT id, starts_at, status, started_at, finished_at, actual_min FROM classes WHERE id = ?', id)[0] ?? null) : null;

/** A class that was started and not cancelled: sets and effort can be recorded in it, also after it ended. */
const isRecordable = (lesson: ClassRow): boolean => lesson.started_at !== null && (lesson.status === 'scheduled' || lesson.status === 'given');

const studentIdsOf = (ctx: Context, classId: string): string[] =>
  ctx.sql.all<{ student_id: string }>('SELECT student_id FROM class_students WHERE class_id = ? ORDER BY rowid', classId).map((r) => r.student_id);

/** The last load the student registered for the exercise in a class other than `exceptClassId`. */
export function previousLoad(ctx: Context, studentId: string, exerciseId: string, exceptClassId: string | null): number | null {
  const [row] = ctx.sql.all<{ load_g: number }>(
    `SELECT s.load_g FROM performed_sets s JOIN classes c ON c.id = s.class_id
      WHERE s.student_id = ? AND s.exercise_id = ? AND s.load_g IS NOT NULL AND s.class_id <> ?
      ORDER BY c.starts_at DESC, s.rowid DESC LIMIT 1`,
    studentId,
    exerciseId,
    exceptClassId ?? '',
  );
  return row?.load_g ?? null;
}

// ---- view -----------------------------------------------------------------------------------

function viewOf(ctx: Context, lesson: ClassRow): LiveClassView {
  const names = new Map(ctx.sql.all<{ id: string; name: string }>('SELECT id, name FROM students').map((s) => [s.id, s.name]));
  const links = ctx.sql.all<{ student_id: string; package_id: string | null; charge: string; pse: number | null }>(
    'SELECT student_id, package_id, charge, pse FROM class_students WHERE class_id = ? ORDER BY rowid',
    lesson.id,
  );
  const plan = ctx.sql.all<PlanRow>('SELECT * FROM class_plan WHERE class_id = ? ORDER BY sort, rowid', lesson.id);
  const sets = ctx.sql.all<SetRow>('SELECT * FROM performed_sets WHERE class_id = ? ORDER BY rowid', lesson.id);
  const durationMin = lesson.finished_at === null ? null : (lesson.actual_min ?? duracaoEmMinutos(lesson.started_at!, lesson.finished_at));

  const students = links.map((link): LiveStudentView => {
    const studentSets = sets.filter((s) => s.student_id === link.student_id);
    const items = plan.filter((p) => p.student_id === link.student_id);
    const planViews = items.map((p, index): LivePlanItem => ({
      id: p.id,
      exercise: findExercise(ctx, p.exercise_id)!,
      order: index + 1,
      sets: p.sets,
      repsMin: p.reps_min,
      repsMax: p.reps_max,
      loadG: p.load_g,
      restS: p.rest_s,
      notes: p.notes,
      groupId: p.group_key,
      groupKind: p.group_kind,
      done: studentSets.filter((s) => s.plan_id === p.id).length,
      previousLoadG: previousLoad(ctx, link.student_id, p.exercise_id, lesson.id),
    }));
    const lastSet = studentSets[studentSets.length - 1];
    const exercises = new Map(planViews.map((p) => [p.exercise.id, p.exercise]));
    const withGroups = studentSets.map((s) => {
      const exercise = exercises.get(s.exercise_id) ?? findExercise(ctx, s.exercise_id)!;
      return { primaryGroups: exercise.primaryGroups, secondaryGroups: exercise.secondaryGroups };
    });
    const tonnage: Record<string, number> = {};
    for (const exerciseId of new Set(studentSets.map((s) => s.exercise_id))) {
      const total = tonelagem(studentSets.filter((s) => s.exercise_id === exerciseId).map((s) => ({ loadG: s.load_g, reps: s.reps })));
      if (total > 0) tonnage[exerciseId] = total;
    }
    return {
      studentId: link.student_id,
      name: names.get(link.student_id) ?? '',
      healthAlerts: alertsOf(ctx, link.student_id),
      plan: planViews,
      sets: studentSets.map(toSetView),
      nextPlanId: proximoItem(
        planViews.map((p) => ({ id: p.id, groupId: p.groupId, sets: p.sets, done: p.done })),
        lastSet?.plan_id ?? null,
      ),
      pse: link.pse,
      load: link.pse !== null && durationMin !== null ? cargaDaAula(link.pse, durationMin) : null,
      volume: volumePorGrupo(withGroups),
      tonnage,
    };
  });
  return {
    classId: lesson.id,
    date: dataEmSaoPaulo(lesson.starts_at),
    startedAt: lesson.started_at!,
    finishedAt: lesson.finished_at,
    durationMin,
    students,
    packageId: links[0]?.package_id ?? null,
    consumes: links[0]?.charge === 'consumes',
  };
}

const toSetView = (s: SetRow): LiveSetView => ({
  id: s.id,
  planId: s.plan_id,
  exerciseId: s.exercise_id,
  order: s.order,
  reps: s.reps,
  loadG: s.load_g,
  seconds: s.seconds,
  meters: s.meters,
});

const ok = (ctx: Context, classId: string): CommandResult<LiveClassView> => ({
  ok: true,
  value: viewOf(ctx, findClass(ctx, classId)!),
  changed: ['classes', 'training'],
});

export function liveClass(ctx: Context, _actor: Member, input: Input): LiveClassView | QueryError {
  const lesson = findClass(ctx, input.classId);
  if (!lesson) return new QueryError(typeof input.classId === 'string' ? 'not_found' : 'invalid');
  return lesson.started_at === null ? new QueryError('not_found') : viewOf(ctx, lesson);
}

export function liveOpen(ctx: Context): LiveOpenClass[] {
  const names = new Map(ctx.sql.all<{ id: string; name: string }>('SELECT id, name FROM students').map((s) => [s.id, s.name]));
  return ctx.sql.all<ClassRow>(`SELECT id, starts_at, status, started_at, finished_at, actual_min FROM classes WHERE ${OPEN} ORDER BY started_at`).map((c) => ({
    classId: c.id,
    startedAt: c.started_at!,
    students: studentIdsOf(ctx, c.id).map((id) => ({ id, name: names.get(id) ?? '' })),
  }));
}

export function previousLoads(ctx: Context, _actor: Member, input: Input): Record<string, number> | QueryError {
  if (typeof input.studentId !== 'string') return new QueryError('invalid');
  const loads: Record<string, number> = {};
  const rows = ctx.sql.all<{ exercise_id: string; load_g: number }>(
    `SELECT s.exercise_id, s.load_g FROM performed_sets s JOIN classes c ON c.id = s.class_id
      WHERE s.student_id = ? AND s.load_g IS NOT NULL ORDER BY c.starts_at, s.rowid`,
    input.studentId,
  );
  for (const row of rows) loads[row.exercise_id] = row.load_g;
  return loads;
}

/** The plan of the student's most recent class that has one (it must be a class already open or ended). */
export function lastClassPlan(ctx: Context, _actor: Member, input: Input): LastClassPlan | null | QueryError {
  if (typeof input.studentId !== 'string') return new QueryError('invalid');
  return lastPlanOf(ctx, input.studentId, undefined, null);
}

function lastPlanOf(ctx: Context, studentId: string, fromClassId: string | undefined, exceptClassId: string | null): LastClassPlan | null {
  const [source] = ctx.sql.all<{ class_id: string; starts_at: string }>(
    `SELECT DISTINCT p.class_id, c.starts_at FROM class_plan p JOIN classes c ON c.id = p.class_id
      WHERE p.student_id = ? AND c.started_at IS NOT NULL AND p.class_id <> ? AND (? IS NULL OR p.class_id = ?)
      ORDER BY c.starts_at DESC, c.rowid DESC LIMIT 1`,
    studentId,
    exceptClassId ?? '',
    fromClassId ?? null,
    fromClassId ?? null,
  );
  if (!source) return null;
  const rows = ctx.sql.all<PlanRow>('SELECT * FROM class_plan WHERE class_id = ? AND student_id = ? ORDER BY sort, rowid', source.class_id, studentId);
  return {
    classId: source.class_id,
    date: dataEmSaoPaulo(source.starts_at),
    exercises: rows.map((r) => ({ exerciseId: r.exercise_id, sets: r.sets, repsMin: r.reps_min, repsMax: r.reps_max, loadG: r.load_g, restS: r.rest_s, groupKey: r.group_key, groupKind: r.group_kind })),
  };
}

export function studentEffort(ctx: Context, _actor: Member, input: Input): StudentEffort | QueryError {
  if (typeof input.studentId !== 'string') return new QueryError('invalid');
  const rows = ctx.sql.all<{ id: string; starts_at: string; started_at: string; finished_at: string; actual_min: number | null; pse: number | null }>(
    `SELECT c.id, c.starts_at, c.started_at, c.finished_at, c.actual_min, cs.pse
       FROM class_students cs JOIN classes c ON c.id = cs.class_id
      WHERE cs.student_id = ? AND c.finished_at IS NOT NULL AND c.status = 'given' ORDER BY c.starts_at DESC, c.rowid DESC`,
    input.studentId,
  );
  const classes = rows.map((r) => {
    const durationMin = r.actual_min ?? duracaoEmMinutos(r.started_at, r.finished_at);
    return { classId: r.id, date: dataEmSaoPaulo(r.starts_at), durationMin, pse: r.pse, load: r.pse === null ? null : cargaDaAula(r.pse, durationMin) };
  });
  const weeks = cargaPorSemana(
    classes.filter((c) => c.load !== null).map((c) => ({ data: c.date, carga: c.load! })),
    todayIn(ctx),
    8,
  ).map((w) => ({ monday: w.segunda, total: w.total, classes: w.aulas }));
  return { weeks, classes };
}

// ---- start ----------------------------------------------------------------------------------

function parseEntries(value: unknown): LiveEntry[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return null;
  const entries: LiveEntry[] = [];
  for (const item of value as Input[]) {
    const source = item?.source as Input | undefined;
    if (typeof item?.studentId !== 'string' || typeof source !== 'object' || source === null) return null;
    if (source.kind === 'workout' && typeof source.workoutId === 'string') entries.push({ studentId: item.studentId, source: { kind: 'workout', workoutId: source.workoutId } });
    else if (source.kind === 'repeat' && (source.fromClassId === undefined || typeof source.fromClassId === 'string')) entries.push({ studentId: item.studentId, source: { kind: 'repeat', fromClassId: source.fromClassId as string | undefined } });
    else if (source.kind === 'free') entries.push({ studentId: item.studentId, source: { kind: 'free' } });
    else return null;
  }
  return new Set(entries.map((e) => e.studentId)).size === entries.length ? entries : null;
}

interface PlanSeed {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  loadG: number | null;
  restS: number;
  notes: string;
  groupKey: string | null;
  groupKind: GroupKind | null;
}

/** The items to copy for one student, or a failure. Loads start from the last time, else the prescribed one. */
function seedsFor(ctx: Context, classId: string, entry: LiveEntry): PlanSeed[] | 'invalid' | 'not_found' {
  const { studentId, source } = entry;
  if (source.kind === 'free') return [];
  if (source.kind === 'workout') {
    const [workout] = ctx.sql.all<{ id: string }>('SELECT id FROM workouts WHERE id = ? AND student_id = ?', source.workoutId, studentId);
    if (!workout) return 'invalid';
    return ctx.sql
      .all<{ exercise_id: string; sets: number; reps_min: number; reps_max: number; load_g: number | null; rest_s: number; notes: string; group_id: string | null; group_kind: GroupKind | null }>(
        `SELECT p.exercise_id, p.sets, p.reps_min, p.reps_max, p.load_g, p.rest_s, p.notes, p.group_id, g.kind AS group_kind
           FROM prescribed_exercises p LEFT JOIN workout_groups g ON g.id = p.group_id WHERE p.workout_id = ? ORDER BY p.sort`,
        source.workoutId,
      )
      .map((r) => ({ exerciseId: r.exercise_id, sets: r.sets, repsMin: r.reps_min, repsMax: r.reps_max, loadG: r.load_g, restS: r.rest_s, notes: r.notes, groupKey: r.group_id, groupKind: r.group_kind }));
  }
  const last = lastPlanOf(ctx, studentId, source.fromClassId, classId);
  if (!last) return source.fromClassId === undefined ? 'not_found' : 'invalid';
  return last.exercises.map((e) => ({ ...e, notes: '' }));
}

function insertPlan(ctx: Context, classId: string, studentId: string, id: string, sort: number, seed: PlanSeed): void {
  const exercise = findExercise(ctx, seed.exerciseId);
  const suggested = exercise?.measure === 'load_reps' ? previousLoad(ctx, studentId, seed.exerciseId, classId) ?? seed.loadG : null;
  ctx.sql.run(
    `INSERT INTO class_plan (id, class_id, student_id, exercise_id, sort, sets, reps_min, reps_max, load_g, rest_s, notes, group_key, group_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, classId, studentId, seed.exerciseId, sort, seed.sets, seed.repsMin, seed.repsMax, suggested, seed.restS, seed.notes, seed.groupKey, seed.groupKind,
  );
}

export function startClass(ctx: Context, _actor: Member, input: Input): CommandResult<LiveClassView> {
  const entries = parseEntries(input.entries);
  if (!entries) return failure('invalid');
  for (const entry of entries) {
    if (ctx.sql.all('SELECT 1 FROM students WHERE id = ?', entry.studentId).length === 0) return failure('not_found');
  }

  let classId: string;
  const existing = input.classId === undefined ? null : findClass(ctx, input.classId);
  if (input.classId !== undefined) {
    if (!existing) return failure(typeof input.classId === 'string' ? 'not_found' : 'invalid');
    if (existing.status !== 'scheduled' || existing.started_at !== null) return failure('conflict');
    if (dataEmSaoPaulo(existing.starts_at) > todayIn(ctx)) return failure('invalid');
    const own = studentIdsOf(ctx, existing.id);
    if (own.length !== entries.length || !entries.every((e) => own.includes(e.studentId))) return failure('invalid');
    classId = existing.id;
  } else {
    if (!isId(input.newClassId)) return failure('invalid');
    if (findClass(ctx, input.newClassId)) return failure('conflict');
    classId = input.newClassId;
  }
  for (const entry of entries) {
    const busy = ctx.sql.all(
      `SELECT 1 FROM class_students cs JOIN classes c ON c.id = cs.class_id WHERE cs.student_id = ? AND c.${OPEN} AND c.id <> ?`,
      entry.studentId,
      classId,
    );
    if (busy.length > 0) return failure('conflict');
  }

  const now = clientTime(ctx, input);
  // Seeds are read before the class row exists so "repeat" never copies this very class.
  const seeds = new Map<string, PlanSeed[]>();
  for (const entry of entries) {
    const found = seedsFor(ctx, classId, entry);
    if (found === 'invalid' || found === 'not_found') return failure(found);
    seeds.set(entry.studentId, found);
  }
  if (existing) {
    ctx.sql.run('UPDATE classes SET started_at = ? WHERE id = ?', now, classId);
  } else {
    ctx.sql.run('INSERT INTO classes (id, starts_at, status, created_at, started_at) VALUES (?, ?, ?, ?, ?)', classId, now, 'scheduled', now, now);
    for (const entry of entries) {
      ctx.sql.run('INSERT INTO class_students (class_id, student_id, package_id, charge) VALUES (?, ?, NULL, ?)', classId, entry.studentId, 'waived');
    }
  }
  for (const entry of entries) {
    seeds.get(entry.studentId)!.forEach((seed, index) => insertPlan(ctx, classId, entry.studentId, `${classId}:${entry.studentId}:${index + 1}`, index + 1, seed));
  }
  return ok(ctx, classId);
}

// ---- during the class -------------------------------------------------------------------------

function recordable(ctx: Context, classId: unknown, studentId: unknown): { lesson: ClassRow } | 'invalid' | 'not_found' | 'conflict' {
  if (typeof classId !== 'string' || typeof studentId !== 'string') return 'invalid';
  const lesson = findClass(ctx, classId);
  if (!lesson) return 'not_found';
  if (!isRecordable(lesson)) return 'conflict';
  if (!studentIdsOf(ctx, classId).includes(studentId)) return 'invalid';
  return { lesson };
}

export function addExercise(ctx: Context, _actor: Member, input: Input): CommandResult<LiveClassView> {
  const target = recordable(ctx, input.classId, input.studentId);
  if (typeof target === 'string') return failure(target);
  if (!isId(input.planId) || typeof input.exerciseId !== 'string') return failure('invalid');
  if (ctx.sql.all('SELECT 1 FROM class_plan WHERE id = ?', input.planId).length > 0) return failure('conflict');
  const exercise = findExercise(ctx, input.exerciseId);
  if (!exercise) return failure('not_found');
  if (exercise.archived) return failure('invalid');
  const classId = target.lesson.id;
  const studentId = input.studentId as string;
  const [{ sort }] = ctx.sql.all<{ sort: number }>('SELECT COALESCE(MAX(sort), 0) AS sort FROM class_plan WHERE class_id = ? AND student_id = ?', classId, studentId);
  const base = defaultPrescription(exercise.measure);
  insertPlan(ctx, classId, studentId, input.planId, sort + 1, { exerciseId: exercise.id, ...base, notes: '', groupKey: null, groupKind: null });
  return ok(ctx, classId);
}

const setFields = (input: Input): Input => ({ reps: input.reps, loadG: input.loadG, seconds: input.seconds, meters: input.meters });

export function recordSet(ctx: Context, _actor: Member, input: Input): CommandResult<LiveClassView> {
  const target = recordable(ctx, input.classId, input.studentId);
  if (typeof target === 'string') return failure(target);
  const [plan] = typeof input.planId === 'string' ? ctx.sql.all<PlanRow>('SELECT * FROM class_plan WHERE id = ? AND class_id = ? AND student_id = ?', input.planId, input.classId as string, input.studentId as string) : [];
  if (!plan) return failure('not_found');
  const exercise = findExercise(ctx, plan.exercise_id)!;
  const base = serieComoPrescrita({ repsMin: plan.reps_min, loadG: plan.load_g }, exercise.measure);
  const measures = ajustarSerie(base, setFields(input), exercise.measure);
  if (!measures) return failure('invalid');
  const classId = target.lesson.id;
  const [{ next }] = ctx.sql.all<{ next: number }>('SELECT COUNT(*) + 1 AS next FROM performed_sets WHERE class_id = ? AND student_id = ?', classId, input.studentId as string);
  const id = input.clientCommandId as string;
  ctx.sql.run(
    `INSERT INTO performed_sets (id, class_id, student_id, plan_id, exercise_id, "order", reps, load_g, seconds, meters, client_command_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, classId, input.studentId as string, plan.id, plan.exercise_id, next, measures.reps, measures.loadG, measures.seconds, measures.meters, id, clientTime(ctx, input),
  );
  return ok(ctx, classId);
}

function findSet(ctx: Context, id: unknown): SetRow | null {
  return typeof id === 'string' ? (ctx.sql.all<SetRow>('SELECT * FROM performed_sets WHERE id = ?', id)[0] ?? null) : null;
}

export function editSet(ctx: Context, _actor: Member, input: Input): CommandResult<LiveClassView> {
  const row = findSet(ctx, input.setId);
  if (!row) return failure(typeof input.setId === 'string' ? 'not_found' : 'invalid');
  const exercise = findExercise(ctx, row.exercise_id)!;
  const current: Medidas = { reps: row.reps, loadG: row.load_g, seconds: row.seconds, meters: row.meters };
  const next = ajustarSerie(current, setFields(input), exercise.measure);
  if (!next) return failure('invalid');
  ctx.sql.run('UPDATE performed_sets SET reps = ?, load_g = ?, seconds = ?, meters = ? WHERE id = ?', next.reps, next.loadG, next.seconds, next.meters, row.id);
  return ok(ctx, row.class_id);
}

export function deleteSet(ctx: Context, _actor: Member, input: Input): CommandResult<LiveClassView> {
  const row = findSet(ctx, input.setId);
  if (!row) return failure(typeof input.setId === 'string' ? 'not_found' : 'invalid');
  ctx.sql.run('DELETE FROM performed_sets WHERE id = ?', row.id);
  // Keeps the order a plain 1, 2, 3… for the student in this class.
  const rest = ctx.sql.all<{ id: string }>('SELECT id FROM performed_sets WHERE class_id = ? AND student_id = ? ORDER BY "order", rowid', row.class_id, row.student_id);
  rest.forEach((s, index) => ctx.sql.run('UPDATE performed_sets SET "order" = ? WHERE id = ?', index + 1, s.id));
  return ok(ctx, row.class_id);
}

export function setPse(ctx: Context, _actor: Member, input: Input): CommandResult<LiveClassView> {
  const target = recordable(ctx, input.classId, input.studentId);
  if (typeof target === 'string') return failure(target);
  if (!isPse(input.pse)) return failure('invalid');
  ctx.sql.run('UPDATE class_students SET pse = ? WHERE class_id = ? AND student_id = ?', input.pse, target.lesson.id, input.studentId as string);
  return ok(ctx, target.lesson.id);
}

// ---- finish and correct -------------------------------------------------------------------------

const packageChoice = (value: unknown): string | null | undefined | 'invalid' =>
  value === undefined || value === null || typeof value === 'string' ? (value as string | null | undefined) : 'invalid';

/**
 * Draws the class from the package (rules of 1a). When the rules need the trainer's answer the class
 * still closes, "sem pacote", and the packages to choose from come back for `class.linkToPackage`:
 * the offline queue cannot ask a question.
 */
function consume(ctx: Context, lesson: ClassRow, explicit: string | null | undefined, durationMin: number): CommandResult<LiveFinishResult> | 'invalid' {
  const resolved = resolveConsumption(ctx, studentIdsOf(ctx, lesson.id), dataEmSaoPaulo(lesson.starts_at), true, explicit);
  if (resolved === null) return 'invalid';
  if ('choose' in resolved) {
    ctx.sql.run("UPDATE class_students SET package_id = NULL, charge = 'consumes' WHERE class_id = ?", lesson.id);
    return { ok: true, value: { classId: lesson.id, durationMin, packageId: null, withoutPackage: 'escolhido', pendingPayment: false, choose: resolved.choose }, changed: ['classes', 'packages', 'training'] };
  }
  ctx.sql.run("UPDATE class_students SET package_id = ?, charge = 'consumes' WHERE class_id = ?", resolved.packageId, lesson.id);
  return { ok: true, value: { classId: lesson.id, durationMin, packageId: resolved.packageId, withoutPackage: resolved.withoutPackage, pendingPayment: resolved.pendingPayment, choose: [] }, changed: ['classes', 'packages', 'training'] };
}

export function finishClass(ctx: Context, _actor: Member, input: Input): CommandResult<LiveFinishResult> {
  const lesson = findClass(ctx, input.classId);
  if (!lesson) return failure(typeof input.classId === 'string' ? 'not_found' : 'invalid');
  if (lesson.started_at === null || lesson.status !== 'scheduled' || lesson.finished_at !== null) return failure('conflict');
  const explicit = packageChoice(input.packageId);
  if (explicit === 'invalid') return failure('invalid');
  const students = studentIdsOf(ctx, lesson.id);
  const pse = input.pse === undefined ? {} : (input.pse as Record<string, unknown>);
  if (typeof pse !== 'object' || pse === null || Array.isArray(pse)) return failure('invalid');
  for (const [studentId, value] of Object.entries(pse)) {
    if (!students.includes(studentId) || !isPse(value)) return failure('invalid');
  }
  const at = clientTime(ctx, input);
  const now = new Date(at < lesson.started_at ? lesson.started_at : at);
  const durationMin = duracaoEmMinutos(lesson.started_at, now);
  const result = consume(ctx, lesson, explicit, durationMin);
  if (result === 'invalid') return failure('invalid');
  ctx.sql.run("UPDATE classes SET status = 'given', finished_at = ?, actual_min = ? WHERE id = ?", now.toISOString(), durationMin, lesson.id);
  for (const [studentId, value] of Object.entries(pse)) {
    ctx.sql.run('UPDATE class_students SET pse = ? WHERE class_id = ? AND student_id = ?', value as number, lesson.id, studentId);
  }
  return result;
}

export function correctClass(ctx: Context, _actor: Member, input: Input): CommandResult<LiveFinishResult> {
  const lesson = findClass(ctx, input.classId);
  if (!lesson) return failure(typeof input.classId === 'string' ? 'not_found' : 'invalid');
  if (lesson.finished_at === null || lesson.status !== 'given') return failure('conflict');
  const explicit = packageChoice(input.packageId);
  if (explicit === 'invalid') return failure('invalid');
  if (input.durationMin !== undefined && !isDuration(input.durationMin)) return failure('invalid');
  if (input.consumes !== undefined && typeof input.consumes !== 'boolean') return failure('invalid');
  const durationMin = (input.durationMin as number | undefined) ?? lesson.actual_min ?? duracaoEmMinutos(lesson.started_at!, lesson.finished_at);
  const [link] = ctx.sql.all<{ package_id: string | null; charge: string }>('SELECT package_id, charge FROM class_students WHERE class_id = ? LIMIT 1', lesson.id);
  const wasConsuming = link?.charge === 'consumes';
  const consumes = (input.consumes as boolean | undefined) ?? wasConsuming;
  const setDuration = () => ctx.sql.run('UPDATE classes SET actual_min = ? WHERE id = ?', durationMin, lesson.id);
  if (!consumes) {
    setDuration();
    ctx.sql.run("UPDATE class_students SET package_id = NULL, charge = 'waived' WHERE class_id = ?", lesson.id);
    return { ok: true, value: { classId: lesson.id, durationMin, packageId: null, withoutPackage: null, pendingPayment: false, choose: [] }, changed: ['classes', 'packages', 'training'] };
  }
  if (input.consumes === undefined && explicit === undefined) {
    setDuration();
    return { ok: true, value: { classId: lesson.id, durationMin, packageId: link?.package_id ?? null, withoutPackage: null, pendingPayment: false, choose: [] }, changed: ['classes', 'training'] };
  }
  // The class's own consumption must not count against the package it is being drawn from again.
  ctx.sql.run("UPDATE class_students SET package_id = NULL, charge = 'waived' WHERE class_id = ?", lesson.id);
  const result = consume(ctx, lesson, explicit, durationMin);
  if (result === 'invalid') return restoreAndFail(ctx, lesson.id, link);
  setDuration();
  return result;
}

function restoreAndFail(ctx: Context, classId: string, link: { package_id: string | null; charge: string } | undefined): CommandResult<LiveFinishResult> {
  ctx.sql.run('UPDATE class_students SET package_id = ?, charge = ? WHERE class_id = ?', link?.package_id ?? null, link?.charge ?? 'waived', classId);
  return failure('invalid');
}
