// Turns the log and the answers into the verdicts P1 to P5 of issue #7.

import { LONG_STEP, type LogEntry, type SoundTechnique } from './log';
import { answerOf, statusOf, type QuestionId, type StepId, type TestState } from './steps';

/** A timer end later than this counts as a failure of P3. */
export const MAX_TIMER_DELAY_MS = 1000;
/** A page clock delay longer than this counts as a failure of P5. */
export const MAX_PAGE_LAG_MS = 500;

export type Verdict = 'pass' | 'fail' | 'unknown';
export type ProofId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export interface ProofResult {
  readonly id: ProofId;
  readonly verdict: Verdict;
  /** Short facts for the report, such as "ouviu 9 de 12". Portuguese, no brackets. */
  readonly facts: readonly string[];
}

export interface SoundResult {
  readonly technique: SoundTechnique;
  readonly verdict: Verdict;
  /** Why it failed, when the log knows (for example "sem voz pt-BR"). */
  readonly note?: string;
}

export interface Evaluation {
  readonly proofs: readonly ProofResult[];
  readonly sounds: readonly SoundResult[];
  readonly comments: readonly string[];
  readonly browser?: string;
  readonly allPassed: boolean;
}

const COMMENT_ORDER: readonly QuestionId[] = [
  'sound-beeps',
  'sound-whistle',
  'sound-words',
  'timers-heard',
  'timers-smooth',
  'airplane-opened',
  'screen-awake',
  'no-lag',
];

function ofKind<K extends LogEntry['kind']>(log: readonly LogEntry[], kind: K) {
  return log.filter((e): e is Extract<LogEntry, { kind: K }> => e.kind === kind);
}

function done(state: TestState, step: StepId): boolean {
  return statusOf(state, step) === 'done';
}

function yesNo(state: TestState, id: QuestionId): boolean | undefined {
  return answerOf(state, id)?.yes;
}

function evaluateP1(state: TestState, log: readonly LogEntry[]): ProofResult {
  if (!done(state, LONG_STEP)) return { id: 'P1', verdict: 'unknown', facts: [] };
  const events = log.filter((e) => e.step === LONG_STEP);
  let hidden = false;
  let lost = 0;
  let granted = 0;
  let unsupported = false;
  for (const e of events) {
    if (e.kind === 'visibility') hidden = e.hidden;
    else if (e.kind === 'wakelock') {
      if (e.state === 'granted') granted++;
      else if (e.state === 'unsupported' || e.state === 'error') unsupported = true;
      else if (e.state === 'released' && !hidden) lost++;
    }
  }
  const awake = yesNo(state, 'screen-awake');
  const facts: string[] = [];
  if (granted === 0) facts.push(unsupported ? 'wake lock indisponível' : 'wake lock não concedido');
  else facts.push(`wake lock concedido, ${lost} ${lost === 1 ? 'solta' : 'soltas'}`);
  if (awake === false) facts.push('o Dan viu a tela apagar');
  const pass = granted > 0 && lost === 0 && awake !== false;
  return { id: 'P1', verdict: pass ? 'pass' : 'fail', facts };
}

function evaluateP2(state: TestState, log: readonly LogEntry[]): ProofResult {
  if (!done(state, LONG_STEP)) return { id: 'P2', verdict: 'unknown', facts: [] };
  const events = log.filter((e) => e.step === LONG_STEP);
  let played = 0;
  let heard = 0;
  let notRunning: { index: number; state: string } | undefined;
  for (const e of events) {
    if (e.kind === 'summary') {
      played += e.noticesPlayed;
      heard += e.noticesHeard;
      if (!notRunning && e.firstNotRunning) notRunning = e.firstNotRunning;
    } else if (e.kind === 'sound' && e.purpose === 'notice') {
      played++;
      if (!notRunning && e.audioState !== undefined && e.audioState !== 'running') {
        notRunning = { index: played, state: e.audioState };
      }
    } else if (e.kind === 'heard') heard++;
  }
  if (played === 0) return { id: 'P2', verdict: 'fail', facts: ['nenhum aviso tocou'] };
  const facts = [`ouviu ${heard} de ${played}`];
  if (notRunning) {
    facts.push(`o ${notRunning.index}º saiu com AudioContext "${notRunning.state}"`);
  }
  return { id: 'P2', verdict: heard >= played ? 'pass' : 'fail', facts };
}

function evaluateP3(state: TestState, log: readonly LogEntry[]): ProofResult {
  if (!done(state, 3)) return { id: 'P3', verdict: 'unknown', facts: [] };
  const timerSounds = ofKind(log, 'sound').filter(
    (e) => e.purpose === 'timer-a' || e.purpose === 'timer-b',
  );
  const worst = timerSounds.reduce((max, e) => Math.max(max, Math.abs(e.delayMs)), 0);
  const failed = timerSounds.filter((e) => !e.ok).length;
  const facts = timerSounds.length > 0 ? [`atraso máximo ${Math.round(worst)} ms`] : [];
  if (failed > 0) facts.push(`${failed} sons não tocaram`);
  const pass =
    yesNo(state, 'timers-heard') === true &&
    yesNo(state, 'timers-smooth') !== false &&
    failed === 0 &&
    worst <= MAX_TIMER_DELAY_MS;
  return { id: 'P3', verdict: pass ? 'pass' : 'fail', facts };
}

function evaluateP4(state: TestState, log: readonly LogEntry[]): ProofResult {
  const status = statusOf(state, 4);
  if (status === 'skipped') return { id: 'P4', verdict: 'unknown', facts: [] };
  const events = log.filter((e) => e.step === 4);
  if (status === 'pending') {
    const started = events.some((e) => e.kind === 'step-start');
    return started
      ? { id: 'P4', verdict: 'fail', facts: ['a etapa começou e não terminou: o app não abriu'] }
      : { id: 'P4', verdict: 'unknown', facts: [] };
  }
  const env = ofKind(events, 'env').pop();
  const wentOffline = ofKind(events, 'network').some((e) => !e.online);
  const fromCache = env?.fromCache === true;
  const opened = yesNo(state, 'airplane-opened') === true;
  const facts = [fromCache ? 'abriu do cache' : 'não veio do cache'];
  if (!wentOffline) facts.push('sem registro de modo avião');
  return { id: 'P4', verdict: opened && fromCache && wentOffline ? 'pass' : 'fail', facts };
}

function evaluateP5(state: TestState, log: readonly LogEntry[]): ProofResult {
  if (!done(state, LONG_STEP)) return { id: 'P5', verdict: 'unknown', facts: [] };
  let worst = 0;
  for (const e of log) {
    if (e.kind === 'alive' || e.kind === 'summary') worst = Math.max(worst, e.worstLagMs);
  }
  const facts = [`pior atraso do relógio ${Math.round(worst)} ms`];
  const slow = yesNo(state, 'no-lag') === false;
  if (slow) facts.push('o Dan sentiu toque lento');
  return { id: 'P5', verdict: !slow && worst <= MAX_PAGE_LAG_MS ? 'pass' : 'fail', facts };
}

function evaluateSounds(state: TestState, log: readonly LogEntry[]): SoundResult[] {
  const table: [SoundTechnique, QuestionId][] = [
    ['beeps', 'sound-beeps'],
    ['whistle', 'sound-whistle'],
    ['words', 'sound-words'],
  ];
  return table.map(([technique, question]) => {
    const answer = yesNo(state, question);
    const failure = ofKind(log, 'sound').find(
      (e) => e.technique === technique && e.purpose === 'check' && !e.ok,
    );
    const verdict: Verdict = answer === undefined ? 'unknown' : answer && !failure ? 'pass' : 'fail';
    return failure?.detail ? { technique, verdict, note: failure.detail } : { technique, verdict };
  });
}

export function evaluate(state: TestState, log: readonly LogEntry[]): Evaluation {
  const proofs = [
    evaluateP1(state, log),
    evaluateP2(state, log),
    evaluateP3(state, log),
    evaluateP4(state, log),
    evaluateP5(state, log),
  ];
  const comments: string[] = [];
  for (const id of COMMENT_ORDER) {
    const comment = answerOf(state, id)?.comment;
    if (comment) comments.push(comment);
  }
  const browser = ofKind(log, 'env')[0]?.browser;
  return {
    proofs,
    sounds: evaluateSounds(state, log),
    comments,
    ...(browser ? { browser } : {}),
    allPassed: proofs.every((p) => p.verdict === 'pass'),
  };
}
