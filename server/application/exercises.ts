// The exercise library (docs/spec/treinos-e-exercicios.md). Both admins use it; there is no hard
// delete, because workouts and past classes point at exercises: an exercise is archived instead.
import type { ExerciseView, ExerciseWarnings } from '../../src/application/api-contract';
import {
  exerciseChoices,
  hasNoMuscles,
  isMuscleGroupId,
  maxRepsFor,
  normalizeExerciseInput,
  searchKey,
  type Equipment,
  type ExerciseInput,
  type Measure,
  type MuscleGroupId,
} from '../../src/domain/treinos';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import type { Member } from './members';

export interface ExerciseRow {
  id: string;
  name: string;
  name_key: string;
  aliases: string;
  primary_groups: string;
  secondary_groups: string;
  tags: string;
  measure: Measure;
  load_step_g: number;
  equipment: Equipment | null;
  media_url: string | null;
  archived: number;
}

const list = (json: string): string[] => {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export function toExerciseView(row: ExerciseRow): ExerciseView {
  const primaryGroups = list(row.primary_groups).filter(isMuscleGroupId) as MuscleGroupId[];
  return {
    id: row.id,
    name: row.name,
    aliases: list(row.aliases),
    primaryGroups,
    secondaryGroups: list(row.secondary_groups).filter(isMuscleGroupId) as MuscleGroupId[],
    tags: list(row.tags),
    measure: row.measure,
    loadStepG: row.load_step_g,
    equipment: row.equipment,
    mediaUrl: row.media_url,
    archived: row.archived === 1,
    withoutMuscles: hasNoMuscles({ primaryGroups }),
  };
}

export function findExercise(ctx: Context, id: string): ExerciseView | null {
  const [row] = ctx.sql.all<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', id);
  return row ? toExerciseView(row) : null;
}

function allExercises(ctx: Context, includeArchived: boolean): ExerciseView[] {
  const where = includeArchived ? '' : 'WHERE archived = 0';
  return ctx.sql
    .all<ExerciseRow>(`SELECT * FROM exercises ${where}`)
    .map(toExerciseView)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function listExercises(ctx: Context, _actor: Member, input: { includeArchived?: unknown }): ExerciseView[] {
  return allExercises(ctx, input.includeArchived === true);
}

export function getExercise(ctx: Context, _actor: Member, input: { id?: unknown }): ExerciseView | QueryError {
  if (typeof input.id !== 'string') return new QueryError('invalid');
  return findExercise(ctx, input.id) ?? new QueryError('not_found');
}

/** The tree walk; archived exercises are not offered. Unknown groups in the input are invalid. */
export function exerciseChoicesQuery(ctx: Context, _actor: Member, input: { groups?: unknown; search?: unknown }) {
  const picked = input.groups ?? [];
  if (!Array.isArray(picked) || !picked.every(isMuscleGroupId)) return new QueryError('invalid');
  if (input.search !== undefined && typeof input.search !== 'string') return new QueryError('invalid');
  return exerciseChoices(allExercises(ctx, false), [...new Set(picked)], input.search ?? '');
}

/** Every tag in use, case-insensitively unique, by name. */
export function exerciseTags(ctx: Context): string[] {
  const tags = new Map<string, string>();
  for (const row of ctx.sql.all<{ tags: string }>('SELECT tags FROM exercises WHERE archived = 0'))
    for (const tag of list(row.tags)) if (!tags.has(searchKey(tag))) tags.set(searchKey(tag), tag);
  return [...tags.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** "Exercício sem músculos": the reminder when a class ends and on the library. */
export function exerciseWarnings(ctx: Context): ExerciseWarnings {
  return { withoutMuscles: allExercises(ctx, false).filter((e) => e.withoutMuscles).map((e) => ({ id: e.id, name: e.name })) };
}

const nameTaken = (ctx: Context, name: string, exceptId: string | null): boolean =>
  ctx.sql.all('SELECT id FROM exercises WHERE name_key = ? AND id IS NOT ?', searchKey(name), exceptId).length > 0;

const json = (list: readonly string[]) => JSON.stringify(list);

/** Needs only a name; a second exercise with the same name (ignoring case and accents) is a conflict. */
export function createExercise(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<ExerciseView> {
  const exercise = normalizeExerciseInput(input);
  if (!exercise) return failure('invalid');
  if (nameTaken(ctx, exercise.name, null)) return failure('conflict');
  const id = ctx.ids.next();
  ctx.sql.run(
    'INSERT INTO exercises (id, name, name_key, aliases, primary_groups, secondary_groups, tags, measure, load_step_g, equipment, media_url, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
    ...values(id, exercise),
    nowIso(ctx),
  );
  return { ok: true, value: findExercise(ctx, id)!, changed: ['exercises'] };
}

const values = (id: string, e: ExerciseInput) =>
  [id, e.name, searchKey(e.name), json(e.aliases), json(e.primaryGroups), json(e.secondaryGroups), json(e.tags), e.measure, e.loadStepG, e.equipment, e.mediaUrl] as const;

/**
 * Replaces the exercise. Workouts show the exercise by reference, so a rename or a new measure
 * reaches them; what past classes did is kept in their own sets (phase 1c).
 */
export function updateExercise(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<ExerciseView> {
  if (typeof input.id !== 'string') return failure('invalid');
  if (!findExercise(ctx, input.id)) return failure('not_found');
  const exercise = normalizeExerciseInput(input);
  if (!exercise) return failure('invalid');
  if (nameTaken(ctx, exercise.name, input.id)) return failure('conflict');
  // A new measure changes what the range means (repetitions, seconds, meters): keep workouts valid.
  const max = maxRepsFor(exercise.measure);
  ctx.sql.run('UPDATE prescribed_exercises SET reps_max = MIN(reps_max, ?), reps_min = MIN(reps_min, ?) WHERE exercise_id = ?', max, max, input.id);
  ctx.sql.run(
    'UPDATE exercises SET name = ?, name_key = ?, aliases = ?, primary_groups = ?, secondary_groups = ?, tags = ?, measure = ?, load_step_g = ?, equipment = ?, media_url = ? WHERE id = ?',
    ...values(input.id, exercise).slice(1),
    input.id,
  );
  return { ok: true, value: findExercise(ctx, input.id)!, changed: ['exercises', 'training'] };
}

export function setExerciseArchived(ctx: Context, _actor: Member, input: { id?: unknown; archived?: unknown }): CommandResult<ExerciseView> {
  if (typeof input.id !== 'string' || typeof input.archived !== 'boolean') return failure('invalid');
  if (!findExercise(ctx, input.id)) return failure('not_found');
  ctx.sql.run('UPDATE exercises SET archived = ? WHERE id = ?', input.archived ? 1 : 0, input.id);
  return { ok: true, value: findExercise(ctx, input.id)!, changed: ['exercises'] };
}
