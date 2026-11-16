// What the test keeps on the device. The port only says what the screen needs; the
// localStorage adapter is written by the screen's session (T4), with try/catch.

import { MAX_LOG_LINES, type LogEntry } from './log';
import { initialTest, isStepId, STEP_COUNT, type TestState } from './steps';

export const STORAGE_KEY = 'dan-sensei.ipad-test.v1';

export interface SavedTest {
  readonly state: TestState;
  readonly log: readonly LogEntry[];
}

export interface TestStore {
  /** Null when nothing is saved or the saved data cannot be read. */
  load(): SavedTest | null;
  save(saved: SavedTest): void;
  /** "Recomeçar". */
  clear(): void;
}

export function freshTest(): SavedTest {
  return { state: initialTest(), log: [] };
}

export function serializeTest(saved: SavedTest): string {
  return JSON.stringify(saved);
}

/** Reads what `serializeTest` wrote; anything else gives null so the test starts over. */
export function parseTest(raw: string | null): SavedTest | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { state, log } = value as { state?: Partial<TestState>; log?: unknown };
    if (!state || state.version !== 1 || !isStepId(state.current)) return null;
    if (!Array.isArray(state.steps) || state.steps.length !== STEP_COUNT) return null;
    const stepsOk = state.steps.every(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        ['pending', 'done', 'skipped'].includes(s.status) &&
        typeof s.answers === 'object' &&
        s.answers !== null,
    );
    if (!stepsOk || !Array.isArray(log) || log.length > MAX_LOG_LINES) return null;
    const logOk = log.every(
      (e) => typeof e === 'object' && e !== null && typeof e.kind === 'string' && isStepId(e.step),
    );
    return logOk ? { state: state as TestState, log: log as LogEntry[] } : null;
  } catch {
    return null;
  }
}
