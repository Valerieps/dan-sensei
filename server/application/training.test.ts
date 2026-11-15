import { beforeEach, describe, expect, it } from 'vitest';
import type { ExerciseView, ProgramView, StudentTraining, WorkoutView } from '../../src/application/api-contract';
import { isEquipment, isMeasure, isMuscleGroupId, LOAD_STEPS_G, MUSCLE_GROUPS, searchKey } from '../../src/domain/treinos';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { SEED_EXERCISES } from './exercise-seed';
import { GroupService } from './group-service';

let service: GroupService;
const ADMIN = 'h-ana';

beforeEach(() => {
  service = new GroupService(memorySql(), fixedClock('2026-11-15T12:00:00Z'), sequentialIds());
  service.migrate();
  service.signIn({ sub: 's1', email: 'ana@example.com', name: 'Ana', picture: null }, ADMIN, ['ana@example.com']);
});

function command<T>(name: string, input: unknown): T {
  const result = service.command(ADMIN, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as T;
}

function query<T>(name: string, input: unknown = {}): T {
  const result = service.query(ADMIN, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as T;
}

const fails = (name: string, input: unknown) => {
  const result = service.command(ADMIN, name, input);
  return result.ok ? 'ok' : result.error;
};

const student = () => command<{ id: string }>('student.create', { name: 'Bia Lima', phone: '(11) 91234-5678', birthDate: null, heightCm: null, emergencyContact: '', addresses: [] }).id;
const exerciseNamed = (name: string) => query<ExerciseView[]>('exercises').find((e) => e.name === name)!;

describe('the ready-made library', () => {
  it('has 150 to 250 exercises with valid data and a unique name each', () => {
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(150);
    expect(SEED_EXERCISES.length).toBeLessThanOrEqual(250);
    expect(new Set(SEED_EXERCISES.map((e) => searchKey(e.name))).size).toBe(SEED_EXERCISES.length);
    for (const e of SEED_EXERCISES) {
      expect(e.primaryGroups.length, e.name).toBeGreaterThan(0);
      expect([...e.primaryGroups, ...e.secondaryGroups].every(isMuscleGroupId), e.name).toBe(true);
      expect(e.primaryGroups.filter((g) => e.secondaryGroups.includes(g)), e.name).toEqual([]);
      expect(isMeasure(e.measure) && isEquipment(e.equipment), e.name).toBe(true);
      expect(LOAD_STEPS_G as readonly number[], e.name).toContain(e.loadStepG);
    }
  });

  it('is in the database after migrating, none without muscles, and reaches every group', () => {
    const all = query<ExerciseView[]>('exercises');
    expect(all).toHaveLength(SEED_EXERCISES.length);
    expect(all.some((e) => e.withoutMuscles)).toBe(false);
    const used = new Set(all.flatMap((e) => e.primaryGroups));
    for (const { id } of MUSCLE_GROUPS) expect(used.has(id), id).toBe(true);
  });
});

describe('exercises', () => {
  it('creates an exercise from the name alone, flagged "sem músculos"', () => {
    const created = command<ExerciseView>('exercise.create', { name: '  Remada   do Dan ' });
    expect(created).toMatchObject({ name: 'Remada do Dan', primaryGroups: [], measure: 'load_reps', loadStepG: 2500, withoutMuscles: true, archived: false });
    expect(query<{ withoutMuscles: { id: string }[] }>('exerciseWarnings').withoutMuscles).toEqual([{ id: created.id, name: 'Remada do Dan' }]);
  });

  it('clears the warning once the muscles are filled in', () => {
    const created = command<ExerciseView>('exercise.create', { name: 'Remada do Dan' });
    const updated = command<ExerciseView>('exercise.update', { id: created.id, name: 'Remada do Dan', primaryGroups: ['dorsal'], secondaryGroups: ['biceps'], tags: ['unilateral'], equipment: 'dumbbell', loadStepG: 2000 });
    expect(updated).toMatchObject({ withoutMuscles: false, primaryGroups: ['dorsal'], secondaryGroups: ['biceps'], tags: ['unilateral'], equipment: 'dumbbell', loadStepG: 2000 });
    expect(query<{ withoutMuscles: unknown[] }>('exerciseWarnings').withoutMuscles).toEqual([]);
  });

  it('refuses a name already taken, ignoring case and accents, and an invalid input', () => {
    expect(fails('exercise.create', { name: 'AGACHAMENTO LIVRE' })).toBe('conflict');
    expect(fails('exercise.create', { name: 'Elevacao pelvica com barra' })).toBe('conflict');
    expect(fails('exercise.create', { name: '' })).toBe('invalid');
    expect(fails('exercise.create', { name: 'X', primaryGroups: ['x'] })).toBe('invalid');
    expect(fails('exercise.create', { name: 'X', mediaUrl: 'javascript:alert(1)' })).toBe('invalid');
    const a = command<ExerciseView>('exercise.create', { name: 'Um exercício' });
    expect(fails('exercise.update', { id: a.id, name: 'Agachamento livre' })).toBe('conflict');
    expect(fails('exercise.update', { id: a.id, name: 'Um exercício' })).toBe('ok');
    expect(fails('exercise.update', { id: 'nope', name: 'X' })).toBe('not_found');
  });

  it('archives instead of deleting: it leaves the lists and the choices', () => {
    const squat = exerciseNamed('Agachamento livre');
    command('exercise.setArchived', { id: squat.id, archived: true });
    expect(query<ExerciseView[]>('exercises').some((e) => e.id === squat.id)).toBe(false);
    expect(query<ExerciseView[]>('exercises', { includeArchived: true }).some((e) => e.id === squat.id)).toBe(true);
    expect(query<{ exercises: ExerciseView[] }>('exerciseChoices', { search: 'agachamento livre' }).exercises.map((e) => e.id)).not.toContain(squat.id);
    expect(query<ExerciseView>('exercise', { id: squat.id }).archived).toBe(true);
    expect(fails('exercise.setArchived', { id: squat.id, archived: 'yes' })).toBe('invalid');
  });

  it('lists the tags in use without repeats', () => {
    const tags = query<string[]>('exerciseTags');
    expect(tags).toContain('equilíbrio');
    expect(new Set(tags.map(searchKey)).size).toBe(tags.length);
  });

  it('walks the group tree: glúteo, then quadríceps', () => {
    const glute = query<{ groups: { group: string; count: number }[]; exercises: ExerciseView[] }>('exerciseChoices', { groups: ['gluteo'] });
    expect(glute.exercises.length).toBeGreaterThan(5);
    expect(glute.exercises.every((e) => [...e.primaryGroups, ...e.secondaryGroups].includes('gluteo'))).toBe(true);
    expect(glute.groups.find((g) => g.group === 'quadriceps')!.count).toBeGreaterThan(0);
    expect(glute.groups.some((g) => g.group === 'gluteo')).toBe(false);
    const both = query<{ exercises: ExerciseView[] }>('exerciseChoices', { groups: ['gluteo', 'quadriceps'] });
    expect(both.exercises.map((e) => e.name)).toContain('Agachamento livre');
    expect(both.exercises.length).toBeLessThan(glute.exercises.length);
    expect(both.exercises.every((e) => [...e.primaryGroups, ...e.secondaryGroups].includes('quadriceps'))).toBe(true);
  });

  it('finds by alias, without accents, and rejects a bad group', () => {
    expect(query<{ exercises: ExerciseView[] }>('exerciseChoices', { search: 'hip thrust' }).exercises.map((e) => e.name)).toContain('Elevação pélvica com barra');
    expect(service.query(ADMIN, 'exerciseChoices', { groups: ['x'] })).toEqual({ ok: false, error: 'invalid' });
  });

  it('tells the open screens what changed, and is closed to strangers', () => {
    expect(service.command(ADMIN, 'exercise.create', { name: 'Novo' })).toMatchObject({ ok: true, changed: ['exercises'] });
    expect(service.command('nobody', 'exercise.create', { name: 'Novo 2' })).toEqual({ ok: false, error: 'unauthenticated' });
    expect(service.query('nobody', 'exercises', {})).toEqual({ ok: false, error: 'unauthenticated' });
  });
});

describe('programs and workouts', () => {
  it('creates a program with workouts A, B and C, lettered by default', () => {
    const studentId = student();
    const program = command<ProgramView>('program.create', { studentId, name: 'Hipertrofia — fase 1', startsOn: '2026-11-16' });
    expect(program).toMatchObject({ name: 'Hipertrofia — fase 1', startsOn: '2026-11-16', endsOn: null, workouts: [] });
    const labels = [1, 2, 3].map(() => command<WorkoutView>('workout.create', { studentId, programId: program.id }).label);
    expect(labels).toEqual(['A', 'B', 'C']);
    const training = query<StudentTraining>('studentTraining', { studentId });
    expect(training.programs[0].workouts.map((w) => w.label)).toEqual(['A', 'B', 'C']);
    expect(training.workouts).toEqual([]);
  });

  it('allows workouts outside a program, with their own letters', () => {
    const studentId = student();
    const program = command<ProgramView>('program.create', { studentId, name: 'P' });
    command('workout.create', { studentId, programId: program.id });
    const loose = command<WorkoutView>('workout.create', { studentId });
    expect(loose).toMatchObject({ label: 'A', programId: null });
    expect(query<StudentTraining>('studentTraining', { studentId }).workouts).toHaveLength(1);
  });

  it('refuses a repeated letter in the same place, a program of another student, and bad dates', () => {
    const studentId = student();
    const other = command<{ id: string }>('student.create', { name: 'Caio Dias', phone: '(11) 98888-7777', birthDate: null, heightCm: null, emergencyContact: '', addresses: [] }).id;
    const program = command<ProgramView>('program.create', { studentId, name: 'P' });
    command('workout.create', { studentId, programId: program.id, label: 'Peito' });
    expect(fails('workout.create', { studentId, programId: program.id, label: 'peito' })).toBe('conflict');
    expect(fails('workout.create', { studentId: other, programId: program.id })).toBe('not_found');
    expect(fails('workout.create', { studentId, label: ' ' })).toBe('invalid');
    expect(fails('program.create', { studentId, name: 'P', startsOn: '2026-12-01', endsOn: '2026-11-01' })).toBe('invalid');
    expect(fails('program.create', { studentId, name: 'P', startsOn: '2026-02-31' })).toBe('invalid');
    expect(fails('program.create', { studentId: 'nope', name: 'P' })).toBe('not_found');
  });

  it('renames a workout, refusing a letter already in use', () => {
    const studentId = student();
    const a = command<WorkoutView>('workout.create', { studentId });
    const b = command<WorkoutView>('workout.create', { studentId });
    expect(fails('workout.rename', { id: b.id, label: 'a' })).toBe('conflict');
    expect(command<WorkoutView>('workout.rename', { id: a.id, label: 'Peito e tríceps' }).label).toBe('Peito e tríceps');
    expect(command<WorkoutView>('workout.rename', { id: a.id, label: 'Peito e tríceps' }).label).toBe('Peito e tríceps');
  });

  it('edits a program and deletes it with its workouts and exercises', () => {
    const studentId = student();
    const program = command<ProgramView>('program.create', { studentId, name: 'P' });
    expect(command<ProgramView>('program.update', { id: program.id, name: 'Q', endsOn: '2027-01-31' })).toMatchObject({ name: 'Q', endsOn: '2027-01-31' });
    const w = command<WorkoutView>('workout.create', { studentId, programId: program.id });
    command('prescribed.add', { workoutId: w.id, exerciseId: exerciseNamed('Rosca martelo').id });
    command('program.delete', { id: program.id });
    expect(query<StudentTraining>('studentTraining', { studentId })).toEqual({ programs: [], workouts: [] });
    expect(service.query(ADMIN, 'workout', { id: w.id })).toEqual({ ok: false, error: 'not_found' });
    expect(fails('program.delete', { id: program.id })).toBe('not_found');
  });
});

describe('prescribed exercises', () => {
  let studentId: string;
  let workout: WorkoutView;
  const squat = () => exerciseNamed('Agachamento livre').id;
  const press = () => exerciseNamed('Supino reto com barra').id;
  const row = () => exerciseNamed('Remada curvada com barra').id;
  const curl = () => exerciseNamed('Rosca direta com barra').id;

  beforeEach(() => {
    studentId = student();
    workout = command<WorkoutView>('workout.create', { studentId });
  });

  const add = (exerciseId: string, extra: Record<string, unknown> = {}) => command<WorkoutView>('prescribed.add', { workoutId: workout.id, exerciseId, ...extra });

  it('adds with defaults and keeps the order', () => {
    add(squat());
    const w = add(press());
    expect(w.exercises.map((e) => [e.exercise.name, e.order])).toEqual([['Agachamento livre', 1], ['Supino reto com barra', 2]]);
    expect(w.exercises[0]).toMatchObject({ sets: 3, repsMin: 8, repsMax: 12, loadG: null, restS: 60, method: 'normal', targetKind: null, targetValue: null, notes: '', groupId: null, groupKind: null });
  });

  it('adds with a full prescription: sets, range, load, rest, method, RIR and notes', () => {
    const w = add(squat(), { sets: 4, repsMin: 6, repsMax: 8, loadG: 60000, restS: 120, method: 'drop_set', targetKind: 'rir', targetValue: 2, notes: 'Pés afastados' });
    expect(w.exercises[0]).toMatchObject({ sets: 4, repsMin: 6, repsMax: 8, loadG: 60000, restS: 120, method: 'drop_set', targetKind: 'rir', targetValue: 2, notes: 'Pés afastados' });
  });

  it('uses seconds for a time exercise', () => {
    const w = add(exerciseNamed('Prancha').id);
    expect(w.exercises[0]).toMatchObject({ repsMin: 30, repsMax: 60 });
    expect(fails('prescribed.add', { workoutId: workout.id, exerciseId: squat(), repsMax: 101 })).toBe('invalid');
    expect(fails('prescribed.add', { workoutId: workout.id, exerciseId: exerciseNamed('Prancha').id, repsMax: 120 })).toBe('ok');
  });

  it('refuses an invalid prescription, an unknown or archived exercise and a missing workout', () => {
    expect(fails('prescribed.add', { workoutId: workout.id, exerciseId: squat(), sets: 0 })).toBe('invalid');
    expect(fails('prescribed.add', { workoutId: workout.id, exerciseId: squat(), repsMin: 12, repsMax: 8 })).toBe('invalid');
    expect(fails('prescribed.add', { workoutId: workout.id, exerciseId: squat(), targetKind: 'rir' })).toBe('invalid');
    expect(fails('prescribed.add', { workoutId: workout.id, exerciseId: 'nope' })).toBe('not_found');
    expect(fails('prescribed.add', { workoutId: 'nope', exerciseId: squat() })).toBe('not_found');
    const id = squat();
    command('exercise.setArchived', { id, archived: true });
    expect(fails('prescribed.add', { workoutId: workout.id, exerciseId: id })).toBe('conflict');
  });

  it('changes only the fields sent (the + and − of a card) and clears the load and target', () => {
    const id = add(squat(), { loadG: 40000, targetKind: 'pse', targetValue: 8 }).exercises[0].id;
    let w = command<WorkoutView>('prescribed.update', { id, loadG: 42500 });
    expect(w.exercises[0]).toMatchObject({ loadG: 42500, sets: 3, targetKind: 'pse', targetValue: 8 });
    w = command<WorkoutView>('prescribed.update', { id, repsMin: 10, repsMax: 10, restS: 90 });
    expect(w.exercises[0]).toMatchObject({ repsMin: 10, repsMax: 10, restS: 90, loadG: 42500 });
    w = command<WorkoutView>('prescribed.update', { id, loadG: null, targetKind: null, targetValue: null });
    expect(w.exercises[0]).toMatchObject({ loadG: null, targetKind: null, targetValue: null });
    expect(fails('prescribed.update', { id, repsMin: 99 })).toBe('invalid');
    expect(fails('prescribed.update', { id, method: 'magic' })).toBe('invalid');
    expect(fails('prescribed.update', { id: 'nope', sets: 3 })).toBe('not_found');
  });

  it('removes an exercise and renumbers the rest', () => {
    const [first] = add(squat()).exercises;
    add(press());
    const w = command<WorkoutView>('prescribed.remove', { id: first.id });
    expect(w.exercises.map((e) => [e.exercise.name, e.order])).toEqual([['Supino reto com barra', 1]]);
  });

  it('reorders, and refuses a list that is not the workout\'s exercises', () => {
    const [a, b, c] = [add(squat()), add(press()), add(row())].map((w) => w.exercises.at(-1)!.id);
    const w = command<WorkoutView>('workout.reorder', { workoutId: workout.id, ids: [c, a, b] });
    expect(w.exercises.map((e) => e.id)).toEqual([c, a, b]);
    expect(fails('workout.reorder', { workoutId: workout.id, ids: [a, b] })).toBe('invalid');
    expect(fails('workout.reorder', { workoutId: workout.id, ids: [a, a, b] })).toBe('invalid');
    expect(fails('workout.reorder', { workoutId: workout.id, ids: [a, b, 'nope'] })).toBe('invalid');
  });

  it('groups two exercises into a bi-set at the place of the first, and ungroups', () => {
    const [a, b, c] = [add(squat()), add(press()), add(row())].map((w) => w.exercises.at(-1)!.id);
    const w = command<WorkoutView>('prescribed.group', { ids: [c, a], kind: 'bi_set' });
    expect(w.exercises.map((e) => e.id)).toEqual([a, c, b]);
    expect(w.exercises.map((e) => e.groupKind)).toEqual(['bi_set', 'bi_set', null]);
    expect(w.exercises[0].groupId).toBe(w.exercises[1].groupId);
    const free = command<WorkoutView>('prescribed.ungroup', { groupId: w.exercises[0].groupId });
    expect(free.exercises.map((e) => e.groupId)).toEqual([null, null, null]);
    expect(fails('prescribed.ungroup', { groupId: 'nope' })).toBe('not_found');
  });

  it('names the group by its size: a third exercise turns a bi-set into a tri-set, four make a circuit', () => {
    const ids = [add(squat()), add(press()), add(row()), add(curl())].map((w) => w.exercises.at(-1)!.id);
    let w = command<WorkoutView>('prescribed.group', { ids: ids.slice(0, 2), kind: 'bi_set' });
    expect(w.exercises[0].groupKind).toBe('bi_set');
    w = command<WorkoutView>('prescribed.group', { ids: [ids[0], ids[2]], kind: 'bi_set' });
    expect(w.exercises.map((e) => e.groupKind)).toEqual(['tri_set', 'tri_set', 'tri_set', null]);
    expect(new Set(w.exercises.map((e) => e.groupId)).size).toBe(2);
    w = command<WorkoutView>('prescribed.group', { ids: [ids[3], ids[0]], kind: 'tri_set' });
    expect(w.exercises.map((e) => e.groupKind)).toEqual(['circuit', 'circuit', 'circuit', 'circuit']);
    w = command<WorkoutView>('prescribed.group', { ids: ids.slice(0, 2), kind: 'circuit' });
    expect(w.exercises[0].groupKind).toBe('circuit');
  });

  it('dissolves a group left with one exercise, and renames one that shrinks', () => {
    const ids = [add(squat()), add(press()), add(row())].map((w) => w.exercises.at(-1)!.id);
    command('prescribed.group', { ids, kind: 'tri_set' });
    let w = command<WorkoutView>('prescribed.remove', { id: ids[2] });
    expect(w.exercises.map((e) => e.groupKind)).toEqual(['bi_set', 'bi_set']);
    w = command<WorkoutView>('prescribed.remove', { id: ids[1] });
    expect(w.exercises.map((e) => e.groupKind)).toEqual([null]);
  });

  it('refuses to group a single exercise, strangers\' exercises or two workouts', () => {
    const [a] = add(squat()).exercises.map((e) => e.id);
    const other = command<WorkoutView>('workout.create', { studentId });
    const b = command<WorkoutView>('prescribed.add', { workoutId: other.id, exerciseId: press() }).exercises[0].id;
    expect(fails('prescribed.group', { ids: [a], kind: 'bi_set' })).toBe('invalid');
    expect(fails('prescribed.group', { ids: [a, a], kind: 'bi_set' })).toBe('invalid');
    expect(fails('prescribed.group', { ids: [a, b], kind: 'bi_set' })).toBe('invalid');
    expect(fails('prescribed.group', { ids: [a, 'nope'], kind: 'bi_set' })).toBe('not_found');
    expect(fails('prescribed.group', { ids: [a, b], kind: 'duo' })).toBe('invalid');
  });

  it('keeps a group together when reordering', () => {
    const ids = [add(squat()), add(press()), add(row()), add(curl())].map((w) => w.exercises.at(-1)!.id);
    command('prescribed.group', { ids: [ids[0], ids[1]], kind: 'bi_set' });
    expect(fails('workout.reorder', { workoutId: workout.id, ids: [ids[0], ids[2], ids[1], ids[3]] })).toBe('invalid');
    const w = command<WorkoutView>('workout.reorder', { workoutId: workout.id, ids: [ids[2], ids[1], ids[0], ids[3]] });
    expect(w.exercises.map((e) => e.groupKind)).toEqual([null, 'bi_set', 'bi_set', null]);
  });

  it('shows an exercise edited in the library, and a smaller range when its measure changes', () => {
    const id = add(exerciseNamed('Prancha').id, { repsMin: 30, repsMax: 600 }).exercises[0].id;
    const prancha = exerciseNamed('Prancha');
    command('exercise.update', { id: prancha.id, name: 'Prancha frontal longa', measure: 'load_reps', primaryGroups: ['abdomen'] });
    const w = query<WorkoutView>('workout', { id: workout.id });
    expect(w.exercises[0].exercise.name).toBe('Prancha frontal longa');
    expect(w.exercises[0]).toMatchObject({ id, repsMin: 30, repsMax: 100 });
  });

  it('answers with the topic training and caps a workout at 40 exercises', () => {
    expect(service.command(ADMIN, 'prescribed.add', { workoutId: workout.id, exerciseId: squat() })).toMatchObject({ ok: true, changed: ['training'] });
    for (let i = 0; i < 39; i++) add(squat());
    expect(fails('prescribed.add', { workoutId: workout.id, exerciseId: squat() })).toBe('conflict');
  });
});
