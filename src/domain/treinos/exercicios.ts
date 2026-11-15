// The exercise library's rules (docs/spec/treinos-e-exercicios.md). Pure; shared by server and app.
import { isMuscleGroupId, MUSCLE_GROUPS, type MuscleGroupId } from './grupos';

export const MEASURES = ['load_reps', 'bodyweight_reps', 'time', 'distance'] as const;
export type Measure = (typeof MEASURES)[number];

export const EQUIPMENTS = ['dumbbell', 'barbell', 'machine', 'kettlebell', 'band', 'bodyweight'] as const;
export type Equipment = (typeof EQUIPMENTS)[number];

/** The load steps the + and − buttons use, in grams: 1, 2, 2.5 and 5 kg. */
export const LOAD_STEPS_G = [1000, 2000, 2500, 5000] as const;
export const DEFAULT_LOAD_STEP_G = 2500;

export const EXERCISE_NAME_MAX_LENGTH = 80;
export const ALIAS_MAX_LENGTH = 60;
export const MAX_ALIASES = 10;
export const TAG_MAX_LENGTH = 30;
export const MAX_TAGS = 10;
export const MEDIA_URL_MAX_LENGTH = 500;

export interface ExerciseInput {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly primaryGroups: readonly MuscleGroupId[];
  readonly secondaryGroups: readonly MuscleGroupId[];
  readonly tags: readonly string[];
  readonly measure: Measure;
  readonly loadStepG: number;
  readonly equipment: Equipment | null;
  readonly mediaUrl: string | null;
}

export const isMeasure = (value: unknown): value is Measure => (MEASURES as readonly unknown[]).includes(value);
export const isEquipment = (value: unknown): value is Equipment => (EQUIPMENTS as readonly unknown[]).includes(value);

const clean = (text: string) => text.trim().replace(/\s+/g, ' ');

/** Lowercase without accents or case, so "Gluteo" finds "Glúteo" and the same name is the same name. */
export const searchKey = (text: string): string =>
  clean(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/** Trimmed, spaces collapsed; null when empty or too long. */
export function normalizeExerciseName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const value = clean(name);
  return value.length >= 1 && value.length <= EXERCISE_NAME_MAX_LENGTH ? value : null;
}

/** A list of short words without blanks or repeats (compared without case); null when invalid. */
function normalizeWords(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const seen = new Set<string>();
  const words: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const word = clean(item);
    if (word.length > maxLength) return null;
    if (word === '' || seen.has(searchKey(word))) continue;
    seen.add(searchKey(word));
    words.push(word);
  }
  return words;
}

function normalizeGroups(value: unknown): MuscleGroupId[] | null {
  if (!Array.isArray(value) || value.length > MUSCLE_GROUPS.length) return null;
  if (!value.every(isMuscleGroupId)) return null;
  return [...new Set(value)];
}

/** Only an http(s) link: the app never opens another scheme. Empty means no media; undefined is invalid. */
export function normalizeMediaUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text === '') return null;
  if (text.length > MEDIA_URL_MAX_LENGTH) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validates a full exercise. Missing optional fields take their defaults, so "only the name" (an
 * exercise created in the middle of a class) is a valid input: it has no muscle groups.
 * A group cannot be both primary and secondary: the primary one wins.
 */
export function normalizeExerciseInput(input: Record<string, unknown>): ExerciseInput | null {
  const name = normalizeExerciseName(input.name);
  if (!name) return null;
  const aliases = normalizeWords(input.aliases ?? [], MAX_ALIASES, ALIAS_MAX_LENGTH);
  const tags = normalizeWords(input.tags ?? [], MAX_TAGS, TAG_MAX_LENGTH);
  const primary = normalizeGroups(input.primaryGroups ?? []);
  const secondary = normalizeGroups(input.secondaryGroups ?? []);
  if (!aliases || !tags || !primary || !secondary) return null;
  const measure = input.measure ?? 'load_reps';
  const loadStepG = input.loadStepG ?? DEFAULT_LOAD_STEP_G;
  const equipment = input.equipment ?? null;
  if (!isMeasure(measure)) return null;
  if (!(LOAD_STEPS_G as readonly unknown[]).includes(loadStepG)) return null;
  if (equipment !== null && !isEquipment(equipment)) return null;
  const mediaUrl = normalizeMediaUrl(input.mediaUrl);
  if (mediaUrl === undefined) return null;
  return {
    name,
    aliases,
    primaryGroups: primary,
    secondaryGroups: secondary.filter((group) => !primary.includes(group)),
    tags,
    measure,
    loadStepG: loadStepG as number,
    equipment,
    mediaUrl,
  };
}

/** "Exercício sem músculos": it counts in no volume until the primary groups are filled in. */
export const hasNoMuscles = (exercise: { readonly primaryGroups: readonly unknown[] }): boolean => exercise.primaryGroups.length === 0;

interface Searchable {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly primaryGroups: readonly MuscleGroupId[];
  readonly secondaryGroups: readonly MuscleGroupId[];
}

/** Whether the name or an alias contains every word of the search (without case or accents). */
export function matchesSearch(exercise: Searchable, search: string): boolean {
  const words = searchKey(search).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [exercise.name, ...exercise.aliases].map(searchKey).join(' | ');
  return words.every((word) => haystack.includes(word));
}

/** An exercise uses a group when it is primary or secondary in it. */
export const usesGroup = (exercise: Searchable, group: MuscleGroupId): boolean =>
  exercise.primaryGroups.includes(group) || exercise.secondaryGroups.includes(group);

export interface GroupChoice {
  readonly group: MuscleGroupId;
  /** How many of the matching exercises use this group too. */
  readonly count: number;
}

export interface ExerciseChoices<T> {
  /** The groups that can still be added to the picked ones, with how many exercises each leaves. */
  readonly groups: readonly GroupChoice[];
  /** The exercises that use every picked group; those with the first group as primary come first. */
  readonly exercises: readonly T[];
}

const rank = (exercise: Searchable, first: MuscleGroupId | undefined): number => (first && exercise.primaryGroups.includes(first) ? 0 : 1);

/**
 * The tree walk: pick a group (glúteo), then another that works with it (quadríceps), and the
 * exercises that use both are listed. `search` narrows by name or alias at any step. A group with no
 * matching exercise is not offered.
 */
export function exerciseChoices<T extends Searchable>(exercises: readonly T[], picked: readonly MuscleGroupId[], search = ''): ExerciseChoices<T> {
  const matching = exercises
    .filter((exercise) => picked.every((group) => usesGroup(exercise, group)) && matchesSearch(exercise, search))
    .sort((a, b) => rank(a, picked[0]) - rank(b, picked[0]) || a.name.localeCompare(b.name, 'pt-BR'));
  const groups = MUSCLE_GROUPS.filter((g) => !picked.includes(g.id))
    .map((g) => ({ group: g.id as MuscleGroupId, count: matching.filter((exercise) => usesGroup(exercise, g.id)).length }))
    .filter((choice) => choice.count > 0);
  return { groups, exercises: matching };
}
