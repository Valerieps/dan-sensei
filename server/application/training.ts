// Programs, workouts and prescribed exercises (docs/spec/treinos-e-exercicios.md, "Programas e
// treinos"). A workout belongs to a student and, optionally, to a program. Editing never reaches past
// classes: they keep their own copy of what was done (phase 1c), so nothing points back here.
import type { PrescribedExerciseView, ProgramView, StudentTraining, WorkoutView } from '../../src/application/api-contract';
import {
  defaultPrescription,
  groupKindFor,
  isGroupKind,
  MAX_EXERCISES_PER_WORKOUT,
  nextWorkoutLabel,
  normalizeLabel,
  patchPrescription,
  PROGRAM_NAME_MAX_LENGTH,
  WORKOUT_LABEL_MAX_LENGTH,
  type GroupKind,
  type Method,
  type Prescription,
  type TargetKind,
} from '../../src/domain/treinos';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import { findExercise, toExerciseView, type ExerciseRow } from './exercises';
import type { Member } from './members';
import { isDate } from './plans';

interface WorkoutRow {
  id: string;
  student_id: string;
  program_id: string | null;
  label: string;
}

interface PrescribedRow {
  id: string;
  workout_id: string;
  exercise_id: string;
  sort: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  load_g: number | null;
  rest_s: number;
  method: Method;
  target_kind: TargetKind | null;
  target_value: number | null;
  notes: string;
  group_id: string | null;
  group_kind: GroupKind | null;
}

const prescriptionOf = (row: PrescribedRow): Prescription => ({
  sets: row.sets,
  repsMin: row.reps_min,
  repsMax: row.reps_max,
  loadG: row.load_g,
  restS: row.rest_s,
  method: row.method,
  targetKind: row.target_kind,
  targetValue: row.target_value,
  notes: row.notes,
});

/** The workouts with these ids, in the order given, each with its exercises in order. */
function loadWorkouts(ctx: Context, where: string, ...bindings: string[]): WorkoutView[] {
  const workouts = ctx.sql.all<WorkoutRow>(`SELECT id, student_id, program_id, label FROM workouts WHERE ${where} ORDER BY sort, rowid`, ...bindings);
  if (workouts.length === 0) return [];
  const exercises = new Map(
    ctx.sql.all<ExerciseRow>('SELECT * FROM exercises').map((row) => [row.id, toExerciseView(row)] as const),
  );
  const rows = ctx.sql.all<PrescribedRow>(
    `SELECT p.*, g.kind AS group_kind FROM prescribed_exercises p LEFT JOIN workout_groups g ON g.id = p.group_id
     WHERE p.workout_id IN (SELECT id FROM workouts WHERE ${where}) ORDER BY p.workout_id, p.sort`,
    ...bindings,
  );
  return workouts.map((workout) => ({
    id: workout.id,
    studentId: workout.student_id,
    programId: workout.program_id,
    label: workout.label,
    exercises: rows
      .filter((row) => row.workout_id === workout.id)
      .map(
        (row, index): PrescribedExerciseView => ({
          id: row.id,
          exercise: exercises.get(row.exercise_id)!,
          order: index + 1,
          ...prescriptionOf(row),
          groupId: row.group_id,
          groupKind: row.group_kind,
        }),
      ),
  }));
}

const loadWorkout = (ctx: Context, id: string): WorkoutView | null => loadWorkouts(ctx, 'id = ?', id)[0] ?? null;

interface ProgramRow {
  id: string;
  student_id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
}

function programsOf(ctx: Context, where: string, ...bindings: string[]): ProgramView[] {
  const workouts = loadWorkouts(ctx, `program_id IN (SELECT id FROM programs WHERE ${where})`, ...bindings);
  return ctx.sql
    .all<ProgramRow>(`SELECT * FROM programs WHERE ${where} ORDER BY COALESCE(starts_on, created_at) DESC, rowid DESC`, ...bindings)
    .map((p) => ({ id: p.id, studentId: p.student_id, name: p.name, startsOn: p.starts_on, endsOn: p.ends_on, workouts: workouts.filter((w) => w.programId === p.id) }));
}

const studentExists = (ctx: Context, id: string): boolean => ctx.sql.all('SELECT id FROM students WHERE id = ?', id).length > 0;

/** Newest program first, then the workouts outside any program. */
export function studentTraining(ctx: Context, _actor: Member, input: { studentId?: unknown }): StudentTraining | QueryError {
  if (typeof input.studentId !== 'string') return new QueryError('invalid');
  if (!studentExists(ctx, input.studentId)) return new QueryError('not_found');
  return {
    programs: programsOf(ctx, 'student_id = ?', input.studentId),
    workouts: loadWorkouts(ctx, 'student_id = ? AND program_id IS NULL', input.studentId),
  };
}

export function getWorkout(ctx: Context, _actor: Member, input: { id?: unknown }): WorkoutView | QueryError {
  if (typeof input.id !== 'string') return new QueryError('invalid');
  return loadWorkout(ctx, input.id) ?? new QueryError('not_found');
}

// --- programs ---------------------------------------------------------------------------------

interface ParsedProgram {
  name: string;
  startsOn: string | null;
  endsOn: string | null;
}

function parseProgram(input: Record<string, unknown>): ParsedProgram | null {
  const name = normalizeLabel(input.name, PROGRAM_NAME_MAX_LENGTH);
  const date = (value: unknown): string | null | undefined => (value === undefined || value === null || value === '' ? null : isDate(value) ? value : undefined);
  const startsOn = date(input.startsOn);
  const endsOn = date(input.endsOn);
  if (!name || startsOn === undefined || endsOn === undefined) return null;
  if (startsOn && endsOn && endsOn < startsOn) return null;
  return { name, startsOn, endsOn };
}

const loadProgram = (ctx: Context, id: string): ProgramView | null => programsOf(ctx, 'id = ?', id)[0] ?? null;

export function createProgram(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<ProgramView> {
  if (typeof input.studentId !== 'string') return failure('invalid');
  const program = parseProgram(input);
  if (!program) return failure('invalid');
  if (!studentExists(ctx, input.studentId)) return failure('not_found');
  const id = ctx.ids.next();
  ctx.sql.run('INSERT INTO programs (id, student_id, name, starts_on, ends_on, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, input.studentId, program.name, program.startsOn, program.endsOn, nowIso(ctx));
  return { ok: true, value: loadProgram(ctx, id)!, changed: ['training'] };
}

export function updateProgram(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<ProgramView> {
  if (typeof input.id !== 'string') return failure('invalid');
  if (!loadProgram(ctx, input.id)) return failure('not_found');
  const program = parseProgram(input);
  if (!program) return failure('invalid');
  ctx.sql.run('UPDATE programs SET name = ?, starts_on = ?, ends_on = ? WHERE id = ?', program.name, program.startsOn, program.endsOn, input.id);
  return { ok: true, value: loadProgram(ctx, input.id)!, changed: ['training'] };
}

/** Deletes the program with its workouts. */
export function deleteProgram(ctx: Context, _actor: Member, input: { id?: unknown }): CommandResult<null> {
  if (typeof input.id !== 'string') return failure('invalid');
  if (!loadProgram(ctx, input.id)) return failure('not_found');
  for (const { id } of ctx.sql.all<{ id: string }>('SELECT id FROM workouts WHERE program_id = ?', input.id)) removeWorkoutRows(ctx, id);
  ctx.sql.run('DELETE FROM programs WHERE id = ?', input.id);
  return { ok: true, value: null, changed: ['training'] };
}

// --- workouts ---------------------------------------------------------------------------------

function removeWorkoutRows(ctx: Context, id: string): void {
  ctx.sql.run('DELETE FROM prescribed_exercises WHERE workout_id = ?', id);
  ctx.sql.run('DELETE FROM workout_groups WHERE workout_id = ?', id);
  ctx.sql.run('DELETE FROM workouts WHERE id = ?', id);
}

const labelsIn = (ctx: Context, studentId: string, programId: string | null): string[] =>
  ctx.sql.all<{ label: string }>("SELECT label FROM workouts WHERE student_id = ? AND COALESCE(program_id, '') = ?", studentId, programId ?? '').map((r) => r.label);

export function createWorkout(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<WorkoutView> {
  if (typeof input.studentId !== 'string') return failure('invalid');
  if (input.programId !== undefined && input.programId !== null && typeof input.programId !== 'string') return failure('invalid');
  if (!studentExists(ctx, input.studentId)) return failure('not_found');
  const programId = (input.programId as string | null | undefined) ?? null;
  if (programId !== null && ctx.sql.all('SELECT id FROM programs WHERE id = ? AND student_id = ?', programId, input.studentId).length === 0) return failure('not_found');
  const used = labelsIn(ctx, input.studentId, programId);
  const label = input.label === undefined ? nextWorkoutLabel(used) : normalizeLabel(input.label, WORKOUT_LABEL_MAX_LENGTH);
  if (!label) return failure('invalid');
  if (used.some((u) => u.toLowerCase() === label.toLowerCase())) return failure('conflict');
  const [{ next }] = ctx.sql.all<{ next: number }>('SELECT COALESCE(MAX(sort), 0) + 1 AS next FROM workouts WHERE student_id = ?', input.studentId);
  const id = ctx.ids.next();
  ctx.sql.run('INSERT INTO workouts (id, student_id, program_id, label, sort, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, input.studentId, programId, label, next, nowIso(ctx));
  return { ok: true, value: loadWorkout(ctx, id)!, changed: ['training'] };
}

export function renameWorkout(ctx: Context, _actor: Member, input: { id?: unknown; label?: unknown }): CommandResult<WorkoutView> {
  if (typeof input.id !== 'string') return failure('invalid');
  const workout = loadWorkout(ctx, input.id);
  if (!workout) return failure('not_found');
  const label = normalizeLabel(input.label, WORKOUT_LABEL_MAX_LENGTH);
  if (!label) return failure('invalid');
  const others = labelsIn(ctx, workout.studentId, workout.programId).filter((l) => l !== workout.label);
  if (others.some((o) => o.toLowerCase() === label.toLowerCase())) return failure('conflict');
  ctx.sql.run('UPDATE workouts SET label = ? WHERE id = ?', label, input.id);
  return { ok: true, value: loadWorkout(ctx, input.id)!, changed: ['training'] };
}

export function deleteWorkout(ctx: Context, _actor: Member, input: { id?: unknown }): CommandResult<null> {
  if (typeof input.id !== 'string') return failure('invalid');
  if (!loadWorkout(ctx, input.id)) return failure('not_found');
  removeWorkoutRows(ctx, input.id);
  return { ok: true, value: null, changed: ['training'] };
}

/**
 * Renumbers the workout's exercises and tidies its groups after any change: a group left with one
 * exercise (or none) dissolves, and a bi-set or tri-set takes the name of its new size.
 */
function tidy(ctx: Context, workoutId: string): void {
  const rows = ctx.sql.all<{ id: string; group_id: string | null }>('SELECT id, group_id FROM prescribed_exercises WHERE workout_id = ? ORDER BY sort, rowid', workoutId);
  rows.forEach((row, index) => ctx.sql.run('UPDATE prescribed_exercises SET sort = ? WHERE id = ?', index + 1, row.id));
  for (const group of ctx.sql.all<{ id: string; kind: GroupKind }>('SELECT id, kind FROM workout_groups WHERE workout_id = ?', workoutId)) {
    const size = rows.filter((row) => row.group_id === group.id).length;
    const kind = groupKindFor(group.kind, size);
    if (kind === null) {
      ctx.sql.run('UPDATE prescribed_exercises SET group_id = NULL WHERE group_id = ?', group.id);
      ctx.sql.run('DELETE FROM workout_groups WHERE id = ?', group.id);
    } else if (kind !== group.kind) {
      ctx.sql.run('UPDATE workout_groups SET kind = ? WHERE id = ?', kind, group.id);
    }
  }
}

const done = (ctx: Context, workoutId: string): CommandResult<WorkoutView> => {
  tidy(ctx, workoutId);
  return { ok: true, value: loadWorkout(ctx, workoutId)!, changed: ['training'] };
};

/** `ids` must be exactly the workout's exercises; the members of a group must stay side by side. */
export function reorderWorkout(ctx: Context, _actor: Member, input: { workoutId?: unknown; ids?: unknown }): CommandResult<WorkoutView> {
  if (typeof input.workoutId !== 'string' || !Array.isArray(input.ids) || !input.ids.every((id) => typeof id === 'string')) return failure('invalid');
  const workout = loadWorkout(ctx, input.workoutId);
  if (!workout) return failure('not_found');
  const ids = input.ids as string[];
  const current = workout.exercises.map((e) => e.id);
  if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => current.includes(id))) return failure('invalid');
  const groupOf = new Map(workout.exercises.map((e) => [e.id, e.groupId] as const));
  const closed = new Set<string>();
  let open: string | null = null;
  for (const id of ids) {
    const group = groupOf.get(id) ?? null;
    if (group !== open && open !== null) closed.add(open);
    if (group !== null && closed.has(group)) return failure('invalid');
    open = group;
  }
  ids.forEach((id, index) => ctx.sql.run('UPDATE prescribed_exercises SET sort = ? WHERE id = ?', index + 1, id));
  return done(ctx, input.workoutId);
}

// --- prescribed exercises ---------------------------------------------------------------------

function loadPrescribed(ctx: Context, id: string): PrescribedRow | null {
  const [row] = ctx.sql.all<PrescribedRow>('SELECT p.*, NULL AS group_kind FROM prescribed_exercises p WHERE p.id = ?', id);
  return row ?? null;
}

/** Adds the exercise at the end of the workout, with the defaults for its measure and then the fields sent. */
export function addPrescribed(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<WorkoutView> {
  if (typeof input.workoutId !== 'string' || typeof input.exerciseId !== 'string') return failure('invalid');
  if (!loadWorkout(ctx, input.workoutId)) return failure('not_found');
  const exercise = findExercise(ctx, input.exerciseId);
  if (!exercise) return failure('not_found');
  if (exercise.archived) return failure('conflict');
  const [{ count }] = ctx.sql.all<{ count: number }>('SELECT COUNT(*) AS count FROM prescribed_exercises WHERE workout_id = ?', input.workoutId);
  if (count >= MAX_EXERCISES_PER_WORKOUT) return failure('conflict');
  const p = patchPrescription(defaultPrescription(exercise.measure), input, exercise.measure);
  if (!p) return failure('invalid');
  ctx.sql.run(
    'INSERT INTO prescribed_exercises (id, workout_id, exercise_id, sort, sets, reps_min, reps_max, load_g, rest_s, method, target_kind, target_value, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ctx.ids.next(),
    input.workoutId,
    input.exerciseId,
    count + 1,
    p.sets,
    p.repsMin,
    p.repsMax,
    p.loadG,
    p.restS,
    p.method,
    p.targetKind,
    p.targetValue,
    p.notes,
  );
  return done(ctx, input.workoutId);
}

/** Changes only the fields sent: the + and − of a card send one. */
export function updatePrescribed(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<WorkoutView> {
  if (typeof input.id !== 'string') return failure('invalid');
  const row = loadPrescribed(ctx, input.id);
  if (!row) return failure('not_found');
  const exercise = findExercise(ctx, row.exercise_id)!;
  const p = patchPrescription(prescriptionOf(row), input, exercise.measure);
  if (!p) return failure('invalid');
  ctx.sql.run(
    'UPDATE prescribed_exercises SET sets = ?, reps_min = ?, reps_max = ?, load_g = ?, rest_s = ?, method = ?, target_kind = ?, target_value = ?, notes = ? WHERE id = ?',
    p.sets,
    p.repsMin,
    p.repsMax,
    p.loadG,
    p.restS,
    p.method,
    p.targetKind,
    p.targetValue,
    p.notes,
    input.id,
  );
  return done(ctx, row.workout_id);
}

export function removePrescribed(ctx: Context, _actor: Member, input: { id?: unknown }): CommandResult<WorkoutView> {
  if (typeof input.id !== 'string') return failure('invalid');
  const row = loadPrescribed(ctx, input.id);
  if (!row) return failure('not_found');
  ctx.sql.run('DELETE FROM prescribed_exercises WHERE id = ?', input.id);
  return done(ctx, row.workout_id);
}

/**
 * Puts the exercises side by side in one group, at the place of the first of them. Exercises that
 * were in a group bring the rest of that group along, so grouping a third exercise with a bi-set
 * makes a tri-set. The kind follows the size (`groupKindFor`).
 */
export function groupPrescribed(ctx: Context, _actor: Member, input: { ids?: unknown; kind?: unknown }): CommandResult<WorkoutView> {
  if (!Array.isArray(input.ids) || !input.ids.every((id) => typeof id === 'string') || !isGroupKind(input.kind)) return failure('invalid');
  const picked = [...new Set(input.ids as string[])];
  if (picked.length < 2) return failure('invalid');
  const rows = picked.map((id) => loadPrescribed(ctx, id));
  if (rows.some((row) => row === null)) return failure('not_found');
  const workoutId = rows[0]!.workout_id;
  if (rows.some((row) => row!.workout_id !== workoutId)) return failure('invalid');
  const all = ctx.sql.all<{ id: string; group_id: string | null }>('SELECT id, group_id FROM prescribed_exercises WHERE workout_id = ? ORDER BY sort, rowid', workoutId);
  const touched = new Set(rows.map((row) => row!.group_id).filter((g): g is string => g !== null));
  const members = new Set([...picked, ...all.filter((row) => row.group_id !== null && touched.has(row.group_id)).map((row) => row.id)]);
  const first = all.findIndex((row) => members.has(row.id));
  const order = [...all.slice(0, first).map((r) => r.id), ...all.filter((r) => members.has(r.id)).map((r) => r.id), ...all.slice(first).filter((r) => !members.has(r.id)).map((r) => r.id)];
  order.forEach((id, index) => ctx.sql.run('UPDATE prescribed_exercises SET sort = ? WHERE id = ?', index + 1, id));
  for (const group of touched) ctx.sql.run('UPDATE prescribed_exercises SET group_id = NULL WHERE group_id = ?', group);
  const kind = groupKindFor(input.kind, members.size)!;
  const groupId = ctx.ids.next();
  ctx.sql.run('INSERT INTO workout_groups (id, workout_id, kind) VALUES (?, ?, ?)', groupId, workoutId, kind);
  for (const id of members) ctx.sql.run('UPDATE prescribed_exercises SET group_id = ? WHERE id = ?', groupId, id);
  for (const group of touched) ctx.sql.run('DELETE FROM workout_groups WHERE id = ?', group);
  return done(ctx, workoutId);
}

export function ungroupPrescribed(ctx: Context, _actor: Member, input: { groupId?: unknown }): CommandResult<WorkoutView> {
  if (typeof input.groupId !== 'string') return failure('invalid');
  const [group] = ctx.sql.all<{ workout_id: string }>('SELECT workout_id FROM workout_groups WHERE id = ?', input.groupId);
  if (!group) return failure('not_found');
  ctx.sql.run('UPDATE prescribed_exercises SET group_id = NULL WHERE group_id = ?', input.groupId);
  ctx.sql.run('DELETE FROM workout_groups WHERE id = ?', input.groupId);
  return done(ctx, group.workout_id);
}
