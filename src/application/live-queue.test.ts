// A whole class with no connection: recorded on the device, sent later, applied by the server once.
import { beforeEach, describe, expect, it } from 'vitest';
import { fixedClock, memorySql, sequentialIds } from '../../server/testing/node-sql';
import { GroupService } from '../../server/application/group-service';
import type { ApiResult, CommandName, ExerciseView, LastClassPlan, LiveClassView, PackageSummary, StudentView, WorkoutView } from './api-contract';
import { applyLocal, startLocal, type LiveCache } from './live-local';
import { LiveQueue, memoryQueueStore, type QueueStore } from './live-queue';

const ADMIN = 'h-ana';
let service: GroupService;
let clock: ReturnType<typeof fixedClock>;
/** What the network does: delivers, or fails; `loseAnswers` applies the command but loses the reply. */
const network = { online: true, loseAnswers: false, delivered: [] as string[] };

beforeEach(() => {
  clock = fixedClock('2026-11-16T12:00:00Z');
  service = new GroupService(memorySql(), clock, sequentialIds());
  service.migrate();
  service.signIn({ sub: 's1', email: 'ana@example.com', name: 'Ana', picture: null }, ADMIN, ['ana@example.com']);
  network.online = true;
  network.loseAnswers = false;
  network.delivered = [];
});

async function send(name: CommandName, input: Record<string, unknown>): Promise<ApiResult<unknown>> {
  if (!network.online) return { ok: false, error: 'unavailable' };
  const result = service.command(ADMIN, name, input);
  network.delivered.push(`${name}:${String(input.clientCommandId)}`);
  if (network.loseAnswers) return { ok: false, error: 'unavailable' };
  return result.ok ? { ok: true, value: result.value } : result;
}

function query<T>(name: string, input: unknown = {}): T {
  const result = service.query(ADMIN, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as T;
}
function command<T>(name: string, input: Record<string, unknown>): T {
  const result = service.command(ADMIN, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as T;
}

/** The trainer's data before the class, on the device: what ADR-009 says the app keeps. */
function prepare() {
  const bia = command<StudentView>('student.create', { name: 'Bia', phone: '(11) 91234-5678', birthDate: null, heightCm: null, emergencyContact: '', addresses: [] });
  const plan = query<{ id: string; name: string }[]>('plans').find((p) => p.name === '12 aulas')!;
  const pkg = command<PackageSummary>('package.create', { holderId: bia.id, planId: plan.id });
  const exercises = query<ExerciseView[]>('exercises');
  const named = (name: string) => exercises.find((e) => e.name === name)!;
  const w = command<WorkoutView>('workout.create', { studentId: bia.id, label: 'A' });
  command('prescribed.add', { workoutId: w.id, exerciseId: named('Supino reto com barra').id, sets: 2, repsMin: 8, repsMax: 10, loadG: 40_000 });
  const workout = command<WorkoutView>('prescribed.add', { workoutId: w.id, exerciseId: named('Remada curvada com barra').id, sets: 2, repsMin: 10, repsMax: 12, loadG: 30_000 });
  command('prescribed.group', { ids: workout.exercises.map((e) => e.id), kind: 'bi_set' });
  const cache: LiveCache = {
    students: new Map([[bia.id, bia]]),
    workouts: new Map([[w.id, query<WorkoutView>('workout', { id: w.id })]]),
    lastPlans: new Map<string, LastClassPlan | null>([[bia.id, null]]),
    previousLoads: new Map([[bia.id, {}]]),
    exercises: new Map(exercises.map((e) => [e.id, e])),
  };
  return { bia: bia.id, pkg, workoutId: w.id, cache, prancha: named('Prancha').id };
}

const queueOver = (store: QueueStore = memoryQueueStore()) => {
  let n = 0;
  return new LiveQueue(store, send, () => `cmd-${++n}`, () => clock.now());
};
const remaining = (id: string) => query<{ summary: PackageSummary }>('package', { id }).summary.remaining;

/** The trainer's side: change the local copy and queue the command, as the screen will. */
function trainer(queue: LiveQueue, cache: LiveCache) {
  let view: LiveClassView | null = null;
  const context = () => ({ now: clock.now(), exercises: cache.exercises });
  return {
    get view() {
      return view!;
    },
    async start(input: Record<string, unknown>) {
      view = startLocal(input, cache, clock.now());
      await queue.enqueue('live.start', input);
    },
    async do(name: CommandName, input: Record<string, unknown>) {
      const id = await queue.enqueue(name, input);
      view = applyLocal(view!, name, { ...input, clientCommandId: id }, context());
    },
    async tap(extra: Record<string, unknown> = {}) {
      const student = view!.students[0]!;
      await this.do('live.recordSet', { classId: view!.classId, studentId: student.studentId, planId: student.nextPlanId, ...extra });
    },
  };
}

async function wholeClass(queue: LiveQueue, cache: LiveCache, bia: string, workoutId: string, prancha: string) {
  const t = trainer(queue, cache);
  await t.start({ newClassId: 'class-1', entries: [{ studentId: bia, source: { kind: 'workout', workoutId } }] });
  clock.set('2026-11-16T12:05:00Z');
  await t.tap();
  await t.tap({ loadG: 42_500 });
  await t.tap();
  await t.tap({ reps: 9 });
  await t.do('live.addExercise', { classId: 'class-1', studentId: bia, planId: 'extra-1', exerciseId: prancha });
  await t.tap();
  await t.do('live.deleteSet', { setId: t.view.students[0]!.sets[1]!.id });
  clock.set('2026-11-16T12:50:00Z');
  await t.do('live.finish', { classId: 'class-1', pse: { [bia]: 8 } });
  return t;
}

describe('a whole class with no internet', () => {
  it('is recorded on the device, then reaches the server once and the same as the local copy', async () => {
    const { bia, pkg, workoutId, cache, prancha } = prepare();
    const queue = queueOver();
    network.online = false;
    const t = await wholeClass(queue, cache, bia, workoutId, prancha);

    expect(queue.snapshot.pending).toHaveLength(9);
    expect(await queue.flush()).toEqual({ sent: 0, refused: 0, stopped: true });
    expect(network.delivered).toEqual([]);
    expect(query('liveOpen')).toEqual([]);
    expect(remaining(pkg.id)).toBe(12);

    network.online = true;
    expect(await queue.flush()).toEqual({ sent: 9, refused: 0, stopped: false });
    expect(queue.snapshot).toEqual({ pending: [], refused: [] });
    expect(new Set(network.delivered).size).toBe(network.delivered.length);

    const server = query<LiveClassView>('liveClass', { classId: 'class-1' });
    const local = t.view;
    expect(server.students[0]!.sets).toHaveLength(4);
    expect(server.students[0]!.sets).toEqual(local.students[0]!.sets);
    expect(server.students[0]!.plan.map((p) => [p.id, p.done])).toEqual(local.students[0]!.plan.map((p) => [p.id, p.done]));
    expect(server.students[0]).toMatchObject({ pse: 8, nextPlanId: local.students[0]!.nextPlanId, volume: local.students[0]!.volume, tonnage: local.students[0]!.tonnage });
    // The device's times were kept: 12:00 to 12:50, not the moment of the send.
    expect(server).toMatchObject({ durationMin: 50, startedAt: '2026-11-16T12:00:00.000Z', finishedAt: '2026-11-16T12:50:00.000Z' });
    expect(server.students[0]!.load).toBe(400);
    expect(local.students[0]!.load).toBe(400);
    expect(remaining(pkg.id)).toBe(11);
  });

  it('sends nothing twice when the answers are lost and everything is sent again', async () => {
    const { bia, pkg, workoutId, cache, prancha } = prepare();
    const queue = queueOver();
    network.online = false;
    await wholeClass(queue, cache, bia, workoutId, prancha);

    network.online = true;
    network.loseAnswers = true;
    expect(await queue.flush()).toMatchObject({ sent: 0, stopped: true });
    // The first command reached the server, but the app does not know: it is still queued.
    expect(queue.snapshot.pending).toHaveLength(9);
    network.loseAnswers = false;
    expect(await queue.flush()).toMatchObject({ sent: 9, stopped: false });

    const server = query<LiveClassView>('liveClass', { classId: 'class-1' });
    expect(server.students[0]!.sets).toHaveLength(4);
    expect(remaining(pkg.id)).toBe(11);
    expect(query<{ n: number }[]>('liveOpen')).toEqual([]);
  });

  it('survives closing the app: a new queue over the same store sends what was left', async () => {
    const { bia, pkg, workoutId, cache, prancha } = prepare();
    const store = memoryQueueStore();
    network.online = false;
    await wholeClass(queueOver(store), cache, bia, workoutId, prancha);

    network.online = true;
    const reopened = queueOver(store);
    await reopened.init();
    expect(reopened.snapshot.pending).toHaveLength(9);
    await reopened.flush();
    expect(remaining(pkg.id)).toBe(11);
    // Opening the app again and sending again changes nothing.
    await reopened.flush();
    expect(query<LiveClassView>('liveClass', { classId: 'class-1' }).students[0]!.sets).toHaveLength(4);
  });

  it('works while the connection comes and goes in the middle of the class', async () => {
    const { bia, pkg, workoutId, cache } = prepare();
    const queue = queueOver();
    const t = trainer(queue, cache);
    await t.start({ newClassId: 'class-1', entries: [{ studentId: bia, source: { kind: 'workout', workoutId } }] });
    await t.tap();
    expect(await queue.flush()).toMatchObject({ sent: 2 });
    network.online = false;
    await t.tap();
    await t.tap();
    expect(await queue.flush()).toMatchObject({ sent: 0, stopped: true });
    network.online = true;
    await t.tap();
    await queue.flush();
    expect(query<LiveClassView>('liveClass', { classId: 'class-1' }).students[0]!.sets).toHaveLength(4);
    expect(remaining(pkg.id)).toBe(12);
  });
});

describe('a command the server refuses', () => {
  it('is kept and shown, and the commands after it still go through', async () => {
    const { bia, cache, workoutId } = prepare();
    const queue = queueOver();
    const t = trainer(queue, cache);
    await t.start({ newClassId: 'class-1', entries: [{ studentId: bia, source: { kind: 'workout', workoutId } }] });
    await queue.enqueue('live.recordSet', { classId: 'class-1', studentId: bia, planId: 'class-1:nobody:9' });
    await t.tap();
    const result = await queue.flush();
    expect(result).toEqual({ sent: 2, refused: 1, stopped: false });
    expect(queue.snapshot.refused).toMatchObject([{ name: 'live.recordSet', error: 'not_found' }]);
    expect(query<LiveClassView>('liveClass', { classId: 'class-1' }).students[0]!.sets).toHaveLength(1);
    await queue.dismissRefused(queue.snapshot.refused[0]!.id);
    expect(queue.snapshot.refused).toEqual([]);
  });

  it('flushing twice at once sends each command once', async () => {
    const { bia, cache, workoutId } = prepare();
    const queue = queueOver();
    const t = trainer(queue, cache);
    await t.start({ newClassId: 'class-1', entries: [{ studentId: bia, source: { kind: 'workout', workoutId } }] });
    await t.tap();
    await Promise.all([queue.flush(), queue.flush()]);
    expect(network.delivered).toHaveLength(2);
  });
});
