// The test's state on screen: the saved state and log, the helpers that change them, and the
// page-wide listeners that write to the log. Every change is saved at once through the TestStore.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Environment } from './environment';
import { appendLog, type LogEntry } from './log';
import { freshTest, type SavedTest, type TestStore } from './store';
import { answerQuestion, completeStep, LAST_STEP, skipStep, statusOf, type QuestionId, type TestState } from './steps';

/** A log line without the fields the session fills in. */
export type Line = LogEntry extends infer E ? (E extends LogEntry ? Omit<E, 'at' | 'sinceStepMs' | 'step'> : never) : never;

export interface PageFacts extends Environment {
  readonly standalone: boolean;
  readonly width: number;
  readonly height: number;
  readonly fromCache: boolean;
}

export interface TestSession {
  readonly saved: SavedTest;
  log(line: Line): void;
  answer(id: QuestionId, yes: boolean, comment?: string): void;
  /** Marks the current step done and moves on. */
  finish(): void;
  skip(): void;
  restart(): void;
}

export function useTestSession(store: TestStore, facts: () => PageFacts): TestSession {
  const latest = useRef<SavedTest | null>(null);
  latest.current ??= store.load() ?? freshTest();
  const [saved, setSaved] = useState<SavedTest>(latest.current);
  const stepStartedAt = useRef(Date.now());

  const commit = useCallback(
    (next: SavedTest) => {
      latest.current = next;
      setSaved(next);
      store.save(next);
    },
    [store],
  );

  const log = useCallback(
    (line: Line) => {
      const current = latest.current!;
      const now = Date.now();
      const entry = { ...line, at: now, sinceStepMs: now - stepStartedAt.current, step: current.state.current } as LogEntry;
      commit({ ...current, log: appendLog(current.log, entry) });
    },
    [commit],
  );

  const change = useCallback(
    (fn: (state: TestState) => TestState) => {
      const current = latest.current!;
      commit({ ...current, state: fn(current.state) });
    },
    [commit],
  );

  const answer = useCallback(
    (id: QuestionId, yes: boolean, comment?: string) => {
      change((s) => answerQuestion(s, id, yes, comment));
      log({ kind: 'answer', question: id, yes, ...(!yes && comment?.trim() ? { comment: comment.trim() } : {}) });
    },
    [change, log],
  );

  const finish = useCallback(() => {
    log({ kind: 'step-end', status: 'done' });
    change(completeStep);
    stepStartedAt.current = Date.now();
  }, [change, log]);

  const skip = useCallback(() => {
    log({ kind: 'step-end', status: 'skipped' });
    change(skipStep);
    stepStartedAt.current = Date.now();
  }, [change, log]);

  const restart = useCallback(() => {
    store.clear();
    stepStartedAt.current = Date.now();
    commit(freshTest());
  }, [commit, store]);

  // Each step logs its start once, so a step that began and never ended (step 4 with no screen) shows.
  const current = saved.state.current;
  useEffect(() => {
    const before = latest.current!.log.find((e) => e.kind === 'step-start' && e.step === current);
    if (before) stepStartedAt.current = before.at;
    else log({ kind: 'step-start' });
    // The last step only shows the result: it is done as soon as it opens.
    if (current === LAST_STEP && statusOf(latest.current!.state, LAST_STEP) === 'pending') finish();
  }, [current, log, finish]);

  // What the page itself reports, from the first screen to the last.
  useEffect(() => {
    const f = facts();
    log({
      kind: 'env',
      browser: f.browser,
      version: f.version,
      device: f.device,
      standalone: f.standalone,
      width: f.width,
      height: f.height,
      fromCache: f.fromCache,
    });
    if (latest.current!.state.current === 4) log({ kind: 'network', online: navigator.onLine });
    const onVisibility = () => log({ kind: 'visibility', hidden: document.visibilityState === 'hidden' });
    const onOnline = () => log({ kind: 'network', online: true });
    const onOffline = () => log({ kind: 'network', online: false });
    const onError = (event: ErrorEvent) => log({ kind: 'page-error', message: event.message });
    const onRejection = (event: PromiseRejectionEvent) => log({ kind: 'page-error', message: String(event.reason) });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [facts, log]);

  return { saved, log, answer, finish, skip, restart };
}
