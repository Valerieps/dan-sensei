// The student's consent, PAR-Q, anamnesis and health alerts (docs/spec/termo-e-lgpd.md, alunos.md).
// Pure rules shared by the server and the app.
import { searchKey } from '../treinos/exercicios';

/** Bumped when the text of the term changes; each signature keeps the version the student read. */
export const TERM_VERSION = 1;
/** The standard PAR-Q has seven yes/no questions. */
export const PARQ_QUESTION_COUNT = 7;
/** A signature is a PNG data URL drawn on the iPad; this keeps one row small. */
export const SIGNATURE_MAX_LENGTH = 200_000;
export const CONDITION_NAME_MAX_LENGTH = 60;
export const ALERT_NOTE_MAX_LENGTH = 200;
export const GOAL_MAX_LENGTH = 120;
export const MAX_SECONDARY_GOALS = 3;

const clean = (text: string) => text.trim().replace(/\s+/g, ' ');

/** A PNG data URL of sensible size; anything else is not a signature. */
export function isSignature(value: unknown): value is string {
  return typeof value === 'string' && value.length > 100 && value.length <= SIGNATURE_MAX_LENGTH && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/** Exactly one yes/no answer per PAR-Q question; null otherwise. */
export function normalizeParqAnswers(raw: unknown): boolean[] | null {
  if (!Array.isArray(raw) || raw.length !== PARQ_QUESTION_COUNT) return null;
  return raw.every((a) => typeof a === 'boolean') ? (raw as boolean[]) : null;
}

/** One "yes" asks for a doctor's clearance before the student trains hard. */
export function parqNeedsClearance(answers: readonly boolean[]): boolean {
  return answers.some(Boolean);
}

/** The condition's name for the list I edit; null when empty or too long. */
export function normalizeConditionName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const value = clean(name);
  return value.length >= 1 && value.length <= CONDITION_NAME_MAX_LENGTH ? value : null;
}

/** The name without case or accents: one condition per name. */
export const conditionKey = (name: string): string => searchKey(name);

/** The note on an alert ("evitar flexão profunda de joelho"); empty is allowed, null when too long. */
export function normalizeAlertNote(note: unknown): string | null {
  if (note === undefined || note === null) return '';
  if (typeof note !== 'string') return null;
  const value = clean(note);
  return value.length <= ALERT_NOTE_MAX_LENGTH ? value : null;
}

export interface Goals {
  readonly main: string;
  readonly secondary: readonly string[];
}

/** One main goal and up to three secondary ones; blanks are dropped, null when invalid. */
export function normalizeGoals(raw: unknown): Goals | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { main, secondary } = raw as { main?: unknown; secondary?: unknown };
  if (main !== undefined && typeof main !== 'string') return null;
  if (secondary !== undefined && !Array.isArray(secondary)) return null;
  const mainGoal = clean(main ?? '');
  const others: string[] = [];
  for (const item of secondary ?? []) {
    if (typeof item !== 'string') return null;
    const goal = clean(item);
    if (goal) others.push(goal);
  }
  if (mainGoal.length > GOAL_MAX_LENGTH || others.length > MAX_SECONDARY_GOALS || others.some((g) => g.length > GOAL_MAX_LENGTH)) return null;
  return { main: mainGoal, secondary: others };
}
