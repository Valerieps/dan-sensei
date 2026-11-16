import { beforeEach, describe, expect, it } from 'vitest';
import type { ExerciseView, LiveClassView, LiveFinishResult, LiveOpenClass, PackageSummary, StudentEffort, StudentView, WorkoutView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';

let service: GroupService;
let clock: ReturnType<typeof fixedClock>;
const ADMIN = 'h-ana';
let n = 0;

beforeEach(() => {
  n = 0;
  clock = fixedClock('2026-11-16T12:00:00Z');
  service = new GroupService(memorySql(), clock, sequentialIds());
  service.migrate();
  service.signIn({ sub: 's1', email: 'ana@example.com', name: 'Ana', picture: null }, ADMIN, ['ana@example.com']);
});

function run(name: string, input: Record<string, unknown>) {
  return service.command(ADMIN, name, input);
}
/** A live command with a fresh client id unless one is given. */
const live = <T>(name: string, input: Record<string, unknown>): T => {
  const result = run(name, { clientCommandId: `c${++n}`, ...input });
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as T;
};
const liveFails = (name: string, input: Record<string, unknown>) => {
  const result = run(name, { clientCommandId: `c${++n}`, ...input });
  return result.ok ? 'ok' : result.error;
};
function command<T>(name: string, input: Record<string, unknown>): T {
  const result = run(name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as T;
}
function query<T>(name: string, input: unknown = {}): T {
  const result = service.query(ADMIN, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as T;
}

const addStudent = (name: string) =>
  command<StudentView>('student.create', { name, phone: '(11) 91234-5678', birthDate: null, heightCm: null, emergencyContact: '', addresses: [] }).id;
const exercise = (name: string) => query<ExerciseView[]>('exercises').find((e) => e.name === name)!;
const sell = (holderId: string, extra: Record<string, unknown> = {}) => {
  const plan = query<{ id: string; name: string }[]>('plans').find((p) => p.name === '12 aulas')!;
  return command<PackageSummary>('package.create', { holderId, planId: plan.id, ...extra });
};
const remaining = (id: string) => query<{ summary: PackageSummary }>('package', { id }).summary.remaining;

const BENCH = 'Supino reto com barra';
const ROW = 'Remada curvada com barra';
const SQUAT = 'Agachamento livre';

/** Workout B: a bi-set (bench + row, 2 sets each) and then a squat (2 sets). */
function workoutFor(studentId: string): WorkoutView {
  const w = command<WorkoutView>('workout.create', { studentId, label: 'B' });
  command('prescribed.add', { workoutId: w.id, exerciseId: exercise(BENCH).id, sets: 2, repsMin: 8, repsMax: 10, loadG: 40_000 });
  const two = command<WorkoutView>('prescribed.add', { workoutId: w.id, exerciseId: exercise(ROW).id, sets: 2, repsMin: 10, repsMax: 12, loadG: 30_000 });
  command('prescribed.group', { ids: two.exercises.map((e) => e.id), kind: 'bi_set' });
  return command<WorkoutView>('prescribed.add', { workoutId: w.id, exerciseId: exercise(SQUAT).id, sets: 2, repsMin: 6, repsMax: 8, loadG: 60_000 });
}

const start = (studentId: string, source: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  live<LiveClassView>('live.start', { newClassId: 'class-1', entries: [{ studentId, source }], ...extra });
const tap = (view: LiveClassView, studentId = view.students[0]!.studentId, extra: Record<string, unknown> = {}) =>
  live<LiveClassView>('live.recordSet', { classId: view.classId, studentId, planId: view.students.find((s) => s.studentId === studentId)!.nextPlanId, ...extra });

describe('starting a class', () => {
  it('starts from a workout: copies it, alternates the bi-set and records as prescribed', () => {
    const bia = addStudent('Bia');
    const w = workoutFor(bia);
    let view = start(bia, { kind: 'workout', workoutId: w.id });
    const student = view.students[0]!;
    expect(student.plan.map((p) => [p.exercise.name, p.sets, p.loadG, p.groupKind])).toEqual([
      [BENCH, 2, 40_000, 'bi_set'],
      [ROW, 2, 30_000, 'bi_set'],
      [SQUAT, 2, 60_000, null],
    ]);
    expect(student.plan[0]!.id).toBe(`class-1:${bia}:1`);
  });

  it('alternates exercises of a group and records as prescribed', () => {
    const bia = addStudent('Bia');
    const w = command<WorkoutView>('workout.create', { studentId: bia, label: 'C' });
    command('prescribed.add', { workoutId: w.id, exerciseId: exercise(BENCH).id, sets: 2, repsMin: 8, repsMax: 10, loadG: 40_000 });
    const two = command<WorkoutView>('prescribed.add', { workoutId: w.id, exerciseId: exercise(ROW).id, sets: 2, repsMin: 10, repsMax: 12, loadG: 30_000 });
    command('prescribed.group', { ids: two.exercises.map((e) => e.id), kind: 'bi_set' });
    command('prescribed.add', { workoutId: w.id, exerciseId: exercise(SQUAT).id, sets: 2, repsMin: 6, repsMax: 8, loadG: 60_000 });
    let view = start(bia, { kind: 'workout', workoutId: w.id });
    expect(view.students[0]!.plan.map((p) => p.groupKind)).toEqual(['bi_set', 'bi_set', null]);
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      order.push(view.students[0]!.plan.find((p) => p.id === view.students[0]!.nextPlanId)!.exercise.name.split(' ')[0]!);
      view = tap(view);
    }
    expect(order).toEqual(['Supino', 'Remada', 'Supino', 'Remada', 'Agachamento', 'Agachamento']);
    expect(view.students[0]!.nextPlanId).toBeNull();
    expect(view.students[0]!.sets[0]).toMatchObject({ reps: 8, loadG: 40_000, order: 1 });
    expect(view.students[0]!.sets[1]).toMatchObject({ reps: 10, loadG: 30_000 });
  });

  it('changing the workout later does not reach a class already started', () => {
    const bia = addStudent('Bia');
    const w = workoutFor(bia);
    start(bia, { kind: 'workout', workoutId: w.id });
    command('workout.delete', { id: w.id });
    expect(query<LiveClassView>('liveClass', { classId: 'class-1' }).students[0]!.plan).toHaveLength(3);
  });

  it('suggests the last load used and calculates the previous load', () => {
    const bia = addStudent('Bia');
    const w = workoutFor(bia);
    let view = start(bia, { kind: 'workout', workoutId: w.id });
    view = tap(view, bia, { loadG: 45_000 });
    expect(view.students[0]!.plan[0]!.previousLoadG).toBeNull();
    live('live.finish', { classId: 'class-1' });

    clock.set('2026-11-23T12:00:00Z');
    const second = live<LiveClassView>('live.start', { newClassId: 'class-2', entries: [{ studentId: bia, source: { kind: 'workout', workoutId: w.id } }] });
    expect(second.students[0]!.plan[0]).toMatchObject({ loadG: 45_000, previousLoadG: 45_000 });
    expect(second.students[0]!.plan[1]).toMatchObject({ loadG: 30_000, previousLoadG: null });
    expect(query<Record<string, number>>('previousLoads', { studentId: bia })[exercise(BENCH).id]).toBe(45_000);
  });

  it('repeats the last class, or the one chosen', () => {
    const bia = addStudent('Bia');
    const w = workoutFor(bia);
    start(bia, { kind: 'workout', workoutId: w.id });
    live('live.finish', { classId: 'class-1' });
    clock.set('2026-11-17T12:00:00Z');
    live<LiveClassView>('live.start', { newClassId: 'class-2', entries: [{ studentId: bia, source: { kind: 'free' } }] });
    live('live.addExercise', { classId: 'class-2', studentId: bia, planId: 'p1', exerciseId: exercise('Rosca martelo').id });
    live('live.finish', { classId: 'class-2' });
    clock.set('2026-11-18T12:00:00Z');
    const last = live<LiveClassView>('live.start', { newClassId: 'class-3', entries: [{ studentId: bia, source: { kind: 'repeat' } }] });
    expect(last.students[0]!.plan.map((p) => p.exercise.name)).toEqual(['Rosca martelo']);
    live('live.finish', { classId: 'class-3' });
    clock.set('2026-11-19T12:00:00Z');
    const chosen = live<LiveClassView>('live.start', { newClassId: 'class-4', entries: [{ studentId: bia, source: { kind: 'repeat', fromClassId: 'class-1' } }] });
    expect(chosen.students[0]!.plan).toHaveLength(3);
    expect(query('lastClassPlan', { studentId: bia })).toMatchObject({ classId: 'class-4' });
  });

  it('starts a free class and adds exercises with their defaults', () => {
    const bia = addStudent('Bia');
    let view = start(bia, { kind: 'free' });
    expect(view.students[0]!.plan).toEqual([]);
    view = live('live.addExercise', { classId: 'class-1', studentId: bia, planId: 'p1', exerciseId: exercise('Prancha').id });
    expect(view.students[0]!.plan[0]).toMatchObject({ sets: 3, repsMin: 30, loadG: null });
    view = tap(view);
    expect(view.students[0]!.sets[0]).toMatchObject({ seconds: 30, reps: null, loadG: null });
  });

  it('starts a scheduled class of the day, keeping its students', () => {
    const bia = addStudent('Bia');
    const cris = addStudent('Cris');
    const scheduled = command<{ id: string }>('class.schedule', { studentIds: [bia, cris], date: '2026-11-16', time: '17:00' });
    expect(liveFails('live.start', { classId: scheduled.id, entries: [{ studentId: bia, source: { kind: 'free' } }] })).toBe('invalid');
    const entries = [bia, cris].map((studentId) => ({ studentId, source: { kind: 'free' } }));
    const view = live<LiveClassView>('live.start', { classId: scheduled.id, entries });
    expect(view.students.map((s) => s.name)).toEqual(['Bia', 'Cris']);
    expect(liveFails('live.start', { classId: scheduled.id, entries })).toBe('conflict');
  });

  it('refuses invalid starts', () => {
    const bia = addStudent('Bia');
    const cris = addStudent('Cris');
    const other = workoutFor(cris);
    expect(liveFails('live.start', { entries: [{ studentId: bia, source: { kind: 'free' } }] })).toBe('invalid');
    expect(liveFails('live.start', { newClassId: 'x', entries: [] })).toBe('invalid');
    expect(liveFails('live.start', { newClassId: 'x', entries: [{ studentId: 'nope', source: { kind: 'free' } }] })).toBe('not_found');
    expect(liveFails('live.start', { newClassId: 'x', entries: [{ studentId: bia, source: { kind: 'workout', workoutId: other.id } }] })).toBe('invalid');
    expect(liveFails('live.start', { newClassId: 'x', entries: [{ studentId: bia, source: { kind: 'repeat' } }] })).toBe('not_found');
    start(bia, { kind: 'free' });
    expect(liveFails('live.start', { newClassId: 'class-1', entries: [{ studentId: cris, source: { kind: 'free' } }] })).toBe('conflict');
    expect(liveFails('live.start', { newClassId: 'y', entries: [{ studentId: bia, source: { kind: 'free' } }] })).toBe('conflict');
  });
});

describe('leaving and coming back', () => {
  it('lists the open class and rebuilds it from the server; it leaves the list once finished', () => {
    const bia = addStudent('Bia');
    const view = start(bia, { kind: 'free' });
    live('live.addExercise', { classId: 'class-1', studentId: bia, planId: 'p1', exerciseId: exercise('Prancha').id });
    expect(query<LiveOpenClass[]>('liveOpen')).toEqual([{ classId: 'class-1', startedAt: view.startedAt, students: [{ id: bia, name: 'Bia' }] }]);
    expect(query<LiveClassView>('liveClass', { classId: 'class-1' }).students[0]!.plan).toHaveLength(1);
    live('live.finish', { classId: 'class-1' });
    expect(query<LiveOpenClass[]>('liveOpen')).toEqual([]);
  });
});

describe('sets', () => {
  it('takes adjustments, edits and deletes, and keeps the order', () => {
    const bia = addStudent('Bia');
    let view = start(bia, { kind: 'workout', workoutId: workoutFor(bia).id });
    view = tap(view, bia, { reps: 9, loadG: 42_500 });
    expect(view.students[0]!.sets[0]).toMatchObject({ reps: 9, loadG: 42_500 });
    view = tap(view);
    view = tap(view);
    const [a, b, c] = view.students[0]!.sets;
    view = live('live.editSet', { setId: a!.id, reps: 12 });
    expect(view.students[0]!.sets[0]!.reps).toBe(12);
    view = live('live.deleteSet', { setId: b!.id });
    expect(view.students[0]!.sets.map((s) => [s.id, s.order])).toEqual([
      [a!.id, 1],
      [c!.id, 2],
    ]);
    expect(liveFails('live.editSet', { setId: a!.id, reps: -3 })).toBe('invalid');
    expect(liveFails('live.editSet', { setId: 'nope', reps: 3 })).toBe('not_found');
  });

  it('refuses a set for a plan item, student or class that is not there', () => {
    const bia = addStudent('Bia');
    const cris = addStudent('Cris');
    start(bia, { kind: 'workout', workoutId: workoutFor(bia).id });
    const planId = `class-1:${bia}:1`;
    expect(liveFails('live.recordSet', { classId: 'class-1', studentId: bia, planId: 'nope' })).toBe('not_found');
    expect(liveFails('live.recordSet', { classId: 'class-1', studentId: cris, planId })).toBe('invalid');
    expect(liveFails('live.recordSet', { classId: 'nope', studentId: bia, planId })).toBe('not_found');
    expect(liveFails('live.recordSet', { classId: 'class-1', studentId: bia, planId, reps: 1.5 })).toBe('invalid');
  });

  it('works two students at once, each with their own plan, sets and volume', () => {
    const bia = addStudent('Bia');
    const cris = addStudent('Cris');
    const w = workoutFor(bia);
    let view = live<LiveClassView>('live.start', {
      newClassId: 'class-1',
      entries: [
        { studentId: bia, source: { kind: 'workout', workoutId: w.id } },
        { studentId: cris, source: { kind: 'free' } },
      ],
    });
    view = live('live.addExercise', { classId: 'class-1', studentId: cris, planId: 'c1', exerciseId: exercise('Prancha').id });
    view = tap(view, bia);
    view = tap(view, cris);
    expect(view.students.map((s) => s.sets.length)).toEqual([1, 1]);
    expect(view.students[0]!.volume[exercise(BENCH).primaryGroups[0]!]).toBe(1);
    expect(view.students[1]!.volume).not.toHaveProperty(exercise(BENCH).primaryGroups[0]!);
  });
});

describe('volume and effort', () => {
  it('counts sets per group, tonnage per exercise, and Foster load once PSE and duration are known', () => {
    const bia = addStudent('Bia');
    sell(bia);
    let view = start(bia, { kind: 'workout', workoutId: workoutFor(bia).id });
    for (let i = 0; i < 6; i++) view = tap(view);
    const bench = exercise(BENCH);
    expect(view.students[0]!.volume[bench.primaryGroups[0]!]).toBeGreaterThanOrEqual(2);
    expect(view.students[0]!.tonnage[bench.id]).toBe(8 * 40_000 * 2);
    expect(view.students[0]!.load).toBeNull();

    clock.set('2026-11-16T13:00:00Z');
    const done = live<LiveFinishResult>('live.finish', { classId: 'class-1', pse: { [bia]: 7 } });
    expect(done.durationMin).toBe(60);
    const after = query<LiveClassView>('liveClass', { classId: 'class-1' });
    expect(after.students[0]).toMatchObject({ pse: 7, load: 420 });
    expect(query<StudentEffort>('studentEffort', { studentId: bia }).weeks.at(-1)).toMatchObject({ total: 420, classes: 1 });
  });

  it('"encerrar agora" skips the PSE, which can come later', () => {
    const bia = addStudent('Bia');
    start(bia, { kind: 'free' });
    clock.set('2026-11-16T12:45:00Z');
    live('live.finish', { classId: 'class-1' });
    expect(query<LiveClassView>('liveClass', { classId: 'class-1' }).students[0]).toMatchObject({ pse: null, load: null });
    expect(liveFails('live.setPse', { classId: 'class-1', studentId: bia, pse: 11 })).toBe('invalid');
    expect(live<LiveClassView>('live.setPse', { classId: 'class-1', studentId: bia, pse: 8 }).students[0]).toMatchObject({ pse: 8, load: 360 });
    expect(liveFails('live.finish', { classId: 'class-1', pse: { [bia]: 4 } })).toBe('conflict');
  });
});

describe('the package', () => {
  it('is untouched while the class is open and drawn once, on finishing', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    start(bia, { kind: 'free' });
    expect(remaining(p.id)).toBe(12);
    const done = live<LiveFinishResult>('live.finish', { classId: 'class-1' });
    expect(done).toMatchObject({ packageId: p.id, withoutPackage: null, choose: [] });
    expect(remaining(p.id)).toBe(11);
  });

  it('draws a pair class once', () => {
    const bia = addStudent('Bia');
    const cris = addStudent('Cris');
    const p = sell(bia, { participantId: cris });
    live('live.start', { newClassId: 'class-1', entries: [bia, cris].map((studentId) => ({ studentId, source: { kind: 'free' } })) });
    live('live.finish', { classId: 'class-1' });
    expect(remaining(p.id)).toBe(11);
  });

  it('closes "sem pacote" when the student has none', () => {
    const bia = addStudent('Bia');
    start(bia, { kind: 'free' });
    expect(live<LiveFinishResult>('live.finish', { classId: 'class-1' })).toMatchObject({ packageId: null, withoutPackage: 'sem-pacote-cadastrado' });
  });

  it('corrects an ended class: waive it, draw it again, change the duration', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    start(bia, { kind: 'free' });
    clock.set('2026-11-16T12:30:00Z');
    live('live.finish', { classId: 'class-1', pse: { [bia]: 5 } });
    expect(remaining(p.id)).toBe(11);
    expect(live<LiveFinishResult>('live.correct', { classId: 'class-1', consumes: false }).packageId).toBeNull();
    expect(remaining(p.id)).toBe(12);
    expect(live<LiveFinishResult>('live.correct', { classId: 'class-1', consumes: true })).toMatchObject({ packageId: p.id });
    expect(remaining(p.id)).toBe(11);
    expect(live<LiveFinishResult>('live.correct', { classId: 'class-1', durationMin: 50 }).durationMin).toBe(50);
    expect(query<LiveClassView>('liveClass', { classId: 'class-1' }).students[0]!.load).toBe(250);
    expect(remaining(p.id)).toBe(11);
    expect(liveFails('live.correct', { classId: 'class-1', durationMin: 0 })).toBe('invalid');
    expect(liveFails('live.correct', { classId: 'class-1', consumes: true, packageId: 'nope' })).toBe('invalid');
    expect(remaining(p.id)).toBe(11);
  });

  it('refuses to correct a class that is still open, and lets sets be fixed after it ended', () => {
    const bia = addStudent('Bia');
    let view = start(bia, { kind: 'workout', workoutId: workoutFor(bia).id });
    expect(liveFails('live.correct', { classId: 'class-1', durationMin: 30 })).toBe('conflict');
    view = tap(view);
    live('live.finish', { classId: 'class-1' });
    const set = query<LiveClassView>('liveClass', { classId: 'class-1' }).students[0]!.sets[0]!;
    expect(live<LiveClassView>('live.editSet', { setId: set.id, reps: 10 }).students[0]!.sets[0]!.reps).toBe(10);
    expect(liveFails('live.recordSet', { classId: 'class-1', studentId: bia, planId: `class-1:${bia}:1` })).toBe('ok');
  });
});

describe('resending a command', () => {
  it('applies it once: the same id gets the first answer and changes nothing', () => {
    const bia = addStudent('Bia');
    const view = start(bia, { kind: 'workout', workoutId: workoutFor(bia).id });
    const input = { clientCommandId: 'tap-1', classId: 'class-1', studentId: bia, planId: view.students[0]!.nextPlanId };
    const first = run('live.recordSet', input);
    const again = run('live.recordSet', input);
    expect(first.ok && first.changed.length).toBeGreaterThan(0);
    expect(again.ok && again.changed).toEqual([]);
    expect(again.ok && (again.value as LiveClassView).students[0]!.sets).toHaveLength(1);
    expect(query<LiveClassView>('liveClass', { classId: 'class-1' }).students[0]!.sets).toHaveLength(1);
  });

  it('needs an id, and refuses one already used by another command', () => {
    const bia = addStudent('Bia');
    expect(run('live.start', { newClassId: 'x', entries: [{ studentId: bia, source: { kind: 'free' } }] })).toEqual({ ok: false, error: 'invalid' });
    start(bia, { kind: 'free' });
    expect(run('live.setPse', { clientCommandId: 'c1', classId: 'class-1', studentId: bia, pse: 3 })).toEqual({ ok: false, error: 'conflict' });
  });

  it('does not store a refused command, so it can be sent again once fixed', () => {
    const bia = addStudent('Bia');
    const entry = (kind: string) => [{ studentId: bia, source: { kind } }];
    expect(run('live.start', { clientCommandId: 'again', newClassId: 'class-1', entries: entry('repeat') })).toEqual({ ok: false, error: 'not_found' });
    expect(run('live.start', { clientCommandId: 'again', newClassId: 'class-1', entries: entry('free') }).ok).toBe(true);
  });
});
