// A prescribed exercise and how exercises are grouped in a workout (docs/spec/treinos-e-exercicios.md,
// "Programas e treinos"). Pure; shared by server and app.
import type { Measure } from './exercicios';

/** Single-exercise methods. Bi-set, tri-set and circuit are groups, below. */
export const METHODS = ['normal', 'drop_set', 'rest_pause', 'pyramid'] as const;
export type Method = (typeof METHODS)[number];

export const GROUP_KINDS = ['bi_set', 'tri_set', 'circuit'] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

/** RIR: repetitions left in reserve. PSE: perceived effort, 0 to 10 (CR10). */
export const TARGET_KINDS = ['rir', 'pse'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

export const MAX_SETS = 20;
export const MAX_REST_S = 900;
export const MAX_LOAD_G = 1_000_000;
export const MAX_TARGET = 10;
export const NOTES_MAX_LENGTH = 300;
export const WORKOUT_LABEL_MAX_LENGTH = 20;
export const PROGRAM_NAME_MAX_LENGTH = 60;
export const MAX_EXERCISES_PER_WORKOUT = 40;

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS_MIN = 8;
export const DEFAULT_REPS_MAX = 12;
export const DEFAULT_REST_S = 60;

export const isMethod = (value: unknown): value is Method => (METHODS as readonly unknown[]).includes(value);
export const isGroupKind = (value: unknown): value is GroupKind => (GROUP_KINDS as readonly unknown[]).includes(value);
export const isTargetKind = (value: unknown): value is TargetKind => (TARGET_KINDS as readonly unknown[]).includes(value);

/** What the repetition range means for each measure: repetitions, seconds or meters. */
export function maxRepsFor(measure: Measure): number {
  return measure === 'time' ? 3600 : measure === 'distance' ? 10_000 : 100;
}

export interface Prescription {
  readonly sets: number;
  readonly repsMin: number;
  readonly repsMax: number;
  readonly loadG: number | null;
  readonly restS: number;
  readonly method: Method;
  readonly targetKind: TargetKind | null;
  readonly targetValue: number | null;
  readonly notes: string;
}

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/** Whether a full prescription is valid for an exercise measured as `measure`. */
export function isValidPrescription(p: Prescription, measure: Measure): boolean {
  const maxReps = maxRepsFor(measure);
  if (!isInt(p.sets, 1, MAX_SETS) || !isInt(p.repsMin, 1, maxReps) || !isInt(p.repsMax, 1, maxReps) || p.repsMin > p.repsMax) return false;
  if (p.loadG !== null && !isInt(p.loadG, 0, MAX_LOAD_G)) return false;
  if (!isInt(p.restS, 0, MAX_REST_S) || !isMethod(p.method)) return false;
  if ((p.targetKind === null) !== (p.targetValue === null)) return false;
  if (p.targetKind !== null && (!isTargetKind(p.targetKind) || !isInt(p.targetValue, 0, MAX_TARGET))) return false;
  return typeof p.notes === 'string' && p.notes.length <= NOTES_MAX_LENGTH;
}

/**
 * The kind a group of `size` exercises really is: two are a bi-set and three a tri-set unless the
 * trainer asked for a circuit; four or more are always a circuit. Null below two (not a group).
 */
export function groupKindFor(asked: GroupKind, size: number): GroupKind | null {
  if (size < 2) return null;
  if (asked === 'circuit' || size > 3) return 'circuit';
  return size === 2 ? 'bi_set' : 'tri_set';
}

/** "A", "B", "C"…: the first letter not used yet; null when all 26 are taken. */
export function nextWorkoutLabel(used: readonly string[]): string | null {
  const taken = new Set(used.map((label) => label.trim().toUpperCase()));
  for (let code = 65; code <= 90; code++) if (!taken.has(String.fromCharCode(code))) return String.fromCharCode(code);
  return null;
}

/** Trimmed, spaces collapsed; null when empty, too long or not text. */
export function normalizeLabel(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length >= 1 && text.length <= maxLength ? text : null;
}

/** The range a new prescribed exercise starts with: repetitions, seconds or meters by measure. */
export function defaultRepsRange(measure: Measure): { repsMin: number; repsMax: number } {
  if (measure === 'time') return { repsMin: 30, repsMax: 60 };
  if (measure === 'distance') return { repsMin: 20, repsMax: 50 };
  return { repsMin: DEFAULT_REPS_MIN, repsMax: DEFAULT_REPS_MAX };
}

export function defaultPrescription(measure: Measure): Prescription {
  return { sets: DEFAULT_SETS, ...defaultRepsRange(measure), loadG: null, restS: DEFAULT_REST_S, method: 'normal', targetKind: null, targetValue: null, notes: '' };
}

const FIELDS = ['sets', 'repsMin', 'repsMax', 'loadG', 'restS', 'method', 'targetKind', 'targetValue', 'notes'] as const;

/**
 * Applies the fields present in `patch` over `base` (the + and − of a card send one field). A field
 * that is absent keeps its value; `loadG` and the target accept null to clear. Null when the result
 * is not a valid prescription for the measure.
 */
export function patchPrescription(base: Prescription, patch: Record<string, unknown>, measure: Measure): Prescription | null {
  const next: Record<string, unknown> = { ...base };
  for (const field of FIELDS) if (Object.hasOwn(patch, field) && patch[field] !== undefined) next[field] = patch[field];
  const result = next as unknown as Prescription;
  return isValidPrescription(result, measure) ? result : null;
}
