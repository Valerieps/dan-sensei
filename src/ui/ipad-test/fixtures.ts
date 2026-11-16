// Test helpers: a whole test run, built the way the screen will build it. Used only by tests.

import { appendLog, type LogEntry } from './log';
import {
  answerQuestion,
  completeStep,
  goToStep,
  initialTest,
  skipStep,
  type QuestionId,
  type TestState,
} from './steps';

export const T0 = new Date(2026, 10, 20, 14, 3).getTime();

type Line = LogEntry extends infer E ? (E extends LogEntry ? Omit<E, 'at' | 'sinceStepMs'> : never) : never;

export interface RunOptions {
  /** Notice numbers (1 to 12) the trainer did not hear. */
  missedNotices?: number[];
  /** AudioContext state for a notice, by number. */
  audioStateOf?: Record<number, string>;
  browser?: string;
  noticeCount?: number;
  skipAirplane?: boolean;
  wordsFail?: boolean;
}

export function runTest(options: RunOptions = {}): { state: TestState; log: LogEntry[] } {
  const missed = new Set(options.missedNotices ?? []);
  const notices = options.noticeCount ?? 12;
  let state = initialTest();
  let log: LogEntry[] = [];
  let clock = T0;
  const add = (line: Line, since = 0) => {
    log = appendLog(log, { ...line, at: clock, sinceStepMs: since } as LogEntry);
  };
  const answer = (id: QuestionId, step: Line['step'], yes: boolean, comment?: string) => {
    state = answerQuestion(state, id, yes, comment);
    add({ kind: 'answer', step, question: id, yes, ...(comment ? { comment } : {}) });
  };
  const finish = (step: Line['step']) => {
    state = completeStep(state);
    add({ kind: 'step-end', step, status: 'done' });
  };

  add({
    kind: 'env',
    step: 0,
    browser: options.browser ?? 'Safari',
    version: '26.6',
    device: 'iPad',
    standalone: true,
    width: 1180,
    height: 820,
  });
  finish(0);
  finish(1);

  add({ kind: 'sound', step: 2, technique: 'beeps', purpose: 'check', plannedAt: clock, actualAt: clock, delayMs: 0, ok: true });
  add({ kind: 'sound', step: 2, technique: 'whistle', purpose: 'check', plannedAt: clock, actualAt: clock, delayMs: 0, ok: true });
  add({
    kind: 'sound',
    step: 2,
    technique: 'words',
    purpose: 'check',
    plannedAt: clock,
    actualAt: clock,
    delayMs: 0,
    ok: !options.wordsFail,
    ...(options.wordsFail ? { detail: 'sem voz pt-BR' } : {}),
  });
  answer('sound-beeps', 2, true);
  answer('sound-whistle', 2, true);
  if (options.wordsFail) answer('sound-words', 2, false, 'não ouvi a voz');
  else answer('sound-words', 2, true);
  finish(2);

  for (const [purpose, delay] of [['timer-a', 120], ['timer-b', 180], ['timer-a', 90]] as const) {
    add({
      kind: 'sound',
      step: 3,
      technique: purpose === 'timer-a' ? 'beeps' : 'whistle',
      purpose,
      plannedAt: clock,
      actualAt: clock + delay,
      delayMs: delay,
      ok: true,
    });
  }
  answer('timers-heard', 3, true);
  answer('timers-smooth', 3, true);
  finish(3);

  if (options.skipAirplane) {
    state = skipStep(state);
    add({ kind: 'step-end', step: 4, status: 'skipped' });
  } else {
    add({ kind: 'step-start', step: 4 });
    add({ kind: 'network', step: 4, online: false });
    add({
      kind: 'env',
      step: 4,
      browser: options.browser ?? 'Safari',
      version: '26.6',
      device: 'iPad',
      standalone: true,
      width: 1180,
      height: 820,
      fromCache: true,
    });
    answer('airplane-opened', 4, true);
    finish(4);
  }

  add({ kind: 'step-start', step: 5 });
  add({ kind: 'wakelock', step: 5, state: 'requested' });
  add({ kind: 'wakelock', step: 5, state: 'granted' });
  for (let i = 1; i <= notices; i++) {
    clock += 5 * 60_000;
    const audioState = options.audioStateOf?.[i] ?? 'running';
    add({
      kind: 'sound',
      step: 5,
      technique: 'beeps',
      purpose: 'notice',
      plannedAt: clock,
      actualAt: clock + 40,
      delayMs: 40,
      audioState,
      ok: audioState === 'running',
    });
    if (!missed.has(i)) add({ kind: 'heard', step: 5, noticeIndex: i, reactionMs: 1800 });
    add({ kind: 'alive', step: 5, worstLagMs: 90, droppedFrames: 2 });
  }
  answer('screen-awake', 5, true);
  answer('no-lag', 5, true);
  finish(5);

  state = goToStep(state, 6);
  finish(6);
  return { state, log };
}
