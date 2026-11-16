// The test's log: one line per event, kept on the device only, never with student data.

import type { QuestionId, StepId } from './steps';

export const MAX_LOG_LINES = 2000;
export const LONG_STEP: StepId = 5;

export type SoundTechnique = 'beeps' | 'whistle' | 'words';
export type SoundPurpose = 'check' | 'notice' | 'timer-a' | 'timer-b';
export type WakeLockState = 'unsupported' | 'requested' | 'granted' | 'released' | 'error';

interface Base {
  /** Device clock, epoch milliseconds. */
  readonly at: number;
  /** Milliseconds since the current step started. */
  readonly sinceStepMs: number;
  readonly step: StepId;
}

/** Replaces the oldest step 5 lines when the log is full; keeps what the evaluation needs. */
export interface StepFiveSummary extends Base {
  readonly kind: 'summary';
  readonly fromAt: number;
  readonly toAt: number;
  readonly lines: number;
  readonly worstLagMs: number;
  readonly droppedFrames: number;
  readonly noticesPlayed: number;
  readonly noticesHeard: number;
  /** Notices whose AudioContext was not "running". */
  readonly noticesNotRunning: number;
  /** The first of them, numbered from 1 in the order played. */
  readonly firstNotRunning?: { readonly index: number; readonly state: string };
}

export type LogEntry = Base &
  (
    | { readonly kind: 'step-start' }
    | { readonly kind: 'step-end'; readonly status: 'done' | 'skipped' }
    | {
        readonly kind: 'answer';
        readonly question: QuestionId;
        readonly yes: boolean;
        readonly comment?: string;
      }
    | { readonly kind: 'wakelock'; readonly state: WakeLockState; readonly detail?: string }
    | { readonly kind: 'audio-state'; readonly state: string }
    | {
        readonly kind: 'sound';
        readonly technique: SoundTechnique;
        readonly purpose: SoundPurpose;
        readonly plannedAt: number;
        readonly actualAt: number;
        readonly delayMs: number;
        readonly audioState?: string;
        readonly ok: boolean;
        readonly detail?: string;
      }
    | { readonly kind: 'heard'; readonly noticeIndex: number; readonly reactionMs: number }
    | { readonly kind: 'visibility'; readonly hidden: boolean }
    | { readonly kind: 'network'; readonly online: boolean }
    | { readonly kind: 'page-error'; readonly message: string }
    | { readonly kind: 'alive'; readonly worstLagMs: number; readonly droppedFrames: number }
    | {
        readonly kind: 'env';
        readonly browser: string;
        readonly version: string;
        readonly device: string;
        readonly standalone: boolean;
        readonly width: number;
        readonly height: number;
        /** Whether the page came from the service worker's cache (step 4). */
        readonly fromCache?: boolean;
      }
    | Omit<StepFiveSummary, keyof Base>
  );

type Compressible = Extract<LogEntry, { kind: 'alive' | 'heard' | 'summary' | 'sound' }>;

function isCompressible(entry: LogEntry): entry is Compressible {
  if (entry.step !== LONG_STEP) return false;
  if (entry.kind === 'sound') return entry.purpose === 'notice';
  return entry.kind === 'alive' || entry.kind === 'heard' || entry.kind === 'summary';
}

function summarize(chunk: readonly Compressible[]): StepFiveSummary {
  const first = chunk[0]!;
  const out = {
    kind: 'summary' as const,
    at: first.at,
    sinceStepMs: first.sinceStepMs,
    step: LONG_STEP,
    fromAt: first.at,
    toAt: chunk[chunk.length - 1]!.at,
    lines: 0,
    worstLagMs: 0,
    droppedFrames: 0,
    noticesPlayed: 0,
    noticesHeard: 0,
    noticesNotRunning: 0,
    firstNotRunning: undefined as StepFiveSummary['firstNotRunning'],
  };
  for (const e of chunk) {
    if (e.kind === 'summary') {
      out.fromAt = Math.min(out.fromAt, e.fromAt);
      out.lines += e.lines;
      out.worstLagMs = Math.max(out.worstLagMs, e.worstLagMs);
      out.droppedFrames += e.droppedFrames;
      out.noticesHeard += e.noticesHeard;
      out.noticesNotRunning += e.noticesNotRunning;
      out.firstNotRunning ??= e.firstNotRunning;
      out.noticesPlayed += e.noticesPlayed;
      continue;
    }
    out.lines += 1;
    if (e.kind === 'alive') {
      out.worstLagMs = Math.max(out.worstLagMs, e.worstLagMs);
      out.droppedFrames += e.droppedFrames;
    } else if (e.kind === 'heard') {
      out.noticesHeard += 1;
    } else {
      out.noticesPlayed += 1;
      if (e.audioState !== undefined && e.audioState !== 'running') {
        out.noticesNotRunning += 1;
        out.firstNotRunning ??= { index: out.noticesPlayed, state: e.audioState };
      }
    }
  }
  const { firstNotRunning, ...rest } = out;
  return firstNotRunning ? { ...rest, firstNotRunning } : rest;
}

/** Adds a line; past 2.000 lines the oldest step 5 lines become one summary line. */
export function appendLog(log: readonly LogEntry[], entry: LogEntry): LogEntry[] {
  const next = [...log, entry];
  if (next.length <= MAX_LOG_LINES) return next;

  const indexes: number[] = [];
  next.forEach((e, i) => {
    if (isCompressible(e)) indexes.push(i);
  });
  const needed = next.length - MAX_LOG_LINES + 1;
  const take = Math.min(indexes.length, Math.max(needed, Math.ceil(indexes.length / 2)));
  // Not enough step 5 lines to make room: drop the oldest lines of any kind.
  if (take < needed || take < 2) return next.slice(next.length - MAX_LOG_LINES);

  const chosen = indexes.slice(0, take);
  const chosenSet = new Set(chosen);
  const summary = summarize(chosen.map((i) => next[i] as Compressible));
  const out: LogEntry[] = [];
  next.forEach((e, i) => {
    if (i === chosen[0]) out.push(summary);
    else if (!chosenSet.has(i)) out.push(e);
  });
  return out;
}
