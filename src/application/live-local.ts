// The local copy of a live class (ADR-009): the same view the server returns, changed by the same
// commands, so the screen reacts at once and offline. The server stays the source of truth: when the
// queue is sent, the local copy is replaced by the server's answer. Pure; no network, no storage.
import { cargaDaAula, ajustarSerie, duracaoEmMinutos, isPse, proximoItem, serieComoPrescrita, tonelagem, volumePorGrupo } from '../domain/aula';
import { defaultPrescription } from '../domain/treinos';
import type { ExerciseView, LastClassPlan, LiveClassView, LivePlanItem, LiveSetView, LiveStudentView, StudentView, WorkoutView } from './api-contract';

/** What the app keeps before a class starts, so the class can start with no connection (ADR-009). */
export interface LiveCache {
  readonly students: ReadonlyMap<string, Pick<StudentView, 'id' | 'name' | 'healthAlerts'>>;
  readonly workouts: ReadonlyMap<string, WorkoutView>;
  readonly lastPlans: ReadonlyMap<string, LastClassPlan | null>;
  readonly previousLoads: ReadonlyMap<string, Readonly<Record<string, number>>>;
  readonly exercises: ReadonlyMap<string, ExerciseView>;
}

export interface LocalContext {
  readonly now: Date;
  readonly exercises: ReadonlyMap<string, ExerciseView>;
}

type Input = Record<string, unknown>;

/** Everything about a student that follows from the plan and the sets: next item, volume, tonnage, load. */
function derive(student: Omit<LiveStudentView, 'nextPlanId' | 'volume' | 'tonnage' | 'load'>, durationMin: number | null): LiveStudentView {
  const plan = student.plan.map((p) => ({ ...p, done: student.sets.filter((s) => s.planId === p.id).length }));
  const exercises = new Map(plan.map((p) => [p.exercise.id, p.exercise]));
  const tonnage: Record<string, number> = {};
  for (const exerciseId of new Set(student.sets.map((s) => s.exerciseId))) {
    const total = tonelagem(student.sets.filter((s) => s.exerciseId === exerciseId));
    if (total > 0) tonnage[exerciseId] = total;
  }
  return {
    ...student,
    plan,
    nextPlanId: proximoItem(
      plan.map((p) => ({ id: p.id, groupId: p.groupId, sets: p.sets, done: p.done })),
      student.sets.at(-1)?.planId ?? null,
    ),
    volume: volumePorGrupo(student.sets.map((s) => exercises.get(s.exerciseId)!)),
    tonnage,
    load: student.pse !== null && durationMin !== null ? cargaDaAula(student.pse, durationMin) : null,
  };
}

const withStudent = (view: LiveClassView, studentId: string, change: (s: LiveStudentView) => LiveStudentView): LiveClassView => ({
  ...view,
  students: view.students.map((s) => (s.studentId === studentId ? change(s) : s)),
});

const fieldsOf = (input: Input): Input => ({ reps: input.reps, loadG: input.loadG, seconds: input.seconds, meters: input.meters });

/** Builds the class a `live.start` command creates, from what the app cached. Null when something needed is missing. */
export function startLocal(input: Input, cache: LiveCache, now: Date): LiveClassView | null {
  const classId = input.newClassId;
  const entries = input.entries;
  if (typeof classId !== 'string' || !Array.isArray(entries)) return null;
  const students: LiveStudentView[] = [];
  for (const entry of entries as { studentId: string; source: { kind: string; workoutId?: string; fromClassId?: string } }[]) {
    const student = cache.students.get(entry.studentId);
    if (!student) return null;
    const previous = cache.previousLoads.get(entry.studentId) ?? {};
    let seeds: { exerciseId: string; sets: number; repsMin: number; repsMax: number; loadG: number | null; restS: number; notes: string; groupId: string | null; groupKind: LivePlanItem['groupKind'] }[] = [];
    if (entry.source.kind === 'workout') {
      const workout = cache.workouts.get(entry.source.workoutId ?? '');
      if (!workout || workout.studentId !== entry.studentId) return null;
      seeds = workout.exercises.map((e) => ({ exerciseId: e.exercise.id, sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax, loadG: e.loadG, restS: e.restS, notes: e.notes, groupId: e.groupId, groupKind: e.groupKind }));
    } else if (entry.source.kind === 'repeat') {
      const last = cache.lastPlans.get(entry.studentId);
      if (!last) return null;
      seeds = last.exercises.map((e) => ({ ...e, notes: '', groupId: e.groupKey }));
    }
    const plan: LivePlanItem[] = [];
    for (const [index, seed] of seeds.entries()) {
      const exercise = cache.exercises.get(seed.exerciseId);
      if (!exercise) return null;
      plan.push({
        id: `${classId}:${entry.studentId}:${index + 1}`,
        exercise,
        order: index + 1,
        sets: seed.sets,
        repsMin: seed.repsMin,
        repsMax: seed.repsMax,
        loadG: exercise.measure === 'load_reps' ? (previous[seed.exerciseId] ?? seed.loadG) : null,
        restS: seed.restS,
        notes: seed.notes,
        groupId: seed.groupId,
        groupKind: seed.groupKind,
        done: 0,
        previousLoadG: previous[seed.exerciseId] ?? null,
      });
    }
    students.push(derive({ studentId: student.id, name: student.name, healthAlerts: student.healthAlerts, plan, sets: [], pse: null }, null));
  }
  return { classId, date: now.toISOString().slice(0, 10), startedAt: now.toISOString(), finishedAt: null, durationMin: null, students, packageId: null, consumes: false };
}

/**
 * Applies one command to the local copy. A command the copy cannot apply (an unknown plan item or an
 * invalid value) leaves it unchanged; the server's answer decides when the queue is sent.
 */
export function applyLocal(view: LiveClassView, name: string, input: Input, context: LocalContext): LiveClassView {
  const duration = view.durationMin;
  switch (name) {
    case 'live.recordSet': {
      const student = view.students.find((s) => s.studentId === input.studentId);
      const item = student?.plan.find((p) => p.id === input.planId);
      if (!student || !item || typeof input.clientCommandId !== 'string') return view;
      const base = serieComoPrescrita({ repsMin: item.repsMin, loadG: item.loadG }, item.exercise.measure);
      const measures = ajustarSerie(base, fieldsOf(input), item.exercise.measure);
      if (!measures) return view;
      const set: LiveSetView = { id: input.clientCommandId, planId: item.id, exerciseId: item.exercise.id, order: student.sets.length + 1, ...measures };
      return withStudent(view, student.studentId, (s) => derive({ ...s, sets: [...s.sets, set] }, duration));
    }
    case 'live.editSet': {
      const owner = view.students.find((s) => s.sets.some((x) => x.id === input.setId));
      const set = owner?.sets.find((x) => x.id === input.setId);
      const item = owner?.plan.find((p) => p.id === set?.planId);
      if (!owner || !set || !item) return view;
      const next = ajustarSerie(set, fieldsOf(input), item.exercise.measure);
      if (!next) return view;
      return withStudent(view, owner.studentId, (s) => derive({ ...s, sets: s.sets.map((x) => (x.id === set.id ? { ...x, ...next } : x)) }, duration));
    }
    case 'live.deleteSet': {
      const owner = view.students.find((s) => s.sets.some((x) => x.id === input.setId));
      if (!owner) return view;
      return withStudent(view, owner.studentId, (s) => derive({ ...s, sets: s.sets.filter((x) => x.id !== input.setId).map((x, index) => ({ ...x, order: index + 1 })) }, duration));
    }
    case 'live.setPse': {
      if (!isPse(input.pse)) return view;
      return withStudent(view, String(input.studentId), (s) => derive({ ...s, pse: input.pse as number }, duration));
    }
    case 'live.addExercise': {
      const exercise = context.exercises.get(String(input.exerciseId));
      const student = view.students.find((s) => s.studentId === input.studentId);
      if (!exercise || !student || typeof input.planId !== 'string' || exercise.archived) return view;
      const base = defaultPrescription(exercise.measure);
      const previousLoadG = student.plan.find((p) => p.exercise.id === exercise.id)?.previousLoadG ?? null;
      const item: LivePlanItem = {
        id: input.planId,
        exercise,
        order: student.plan.length + 1,
        sets: base.sets,
        repsMin: base.repsMin,
        repsMax: base.repsMax,
        loadG: exercise.measure === 'load_reps' ? previousLoadG : null,
        restS: base.restS,
        notes: '',
        groupId: null,
        groupKind: null,
        done: 0,
        previousLoadG,
      };
      return withStudent(view, student.studentId, (s) => derive({ ...s, plan: [...s.plan, item] }, duration));
    }
    case 'live.finish': {
      const finishedAt = context.now.toISOString();
      const durationMin = duracaoEmMinutos(view.startedAt, context.now);
      const pse = (input.pse ?? {}) as Record<string, number>;
      const done = { ...view, finishedAt, durationMin };
      return {
        ...done,
        students: done.students.map((s) => derive({ ...s, pse: isPse(pse[s.studentId]) ? pse[s.studentId]! : s.pse }, durationMin)),
      };
    }
    default:
      return view;
  }
}
