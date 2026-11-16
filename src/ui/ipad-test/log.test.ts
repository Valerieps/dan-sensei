import { describe, expect, it } from 'vitest';
import { appendLog, MAX_LOG_LINES, type LogEntry } from './log';
import { evaluate } from './evaluation';
import { runTest } from './fixtures';

const alive = (at: number): LogEntry => ({
  kind: 'alive',
  at,
  sinceStepMs: at,
  step: 5,
  worstLagMs: at === 7 ? 300 : 10,
  droppedFrames: 1,
});

describe('appendLog', () => {
  it('keeps every line up to the limit', () => {
    let log: LogEntry[] = [];
    for (let i = 0; i < MAX_LOG_LINES; i++) log = appendLog(log, alive(i));
    expect(log).toHaveLength(MAX_LOG_LINES);
    expect(log.some((e) => e.kind === 'summary')).toBe(false);
  });

  it('turns the oldest step 5 lines into one summary past the limit', () => {
    let log: LogEntry[] = [{ kind: 'step-start', at: 0, sinceStepMs: 0, step: 5 }];
    for (let i = 1; i < 2500; i++) log = appendLog(log, alive(i));
    expect(log.length).toBeLessThanOrEqual(MAX_LOG_LINES);
    expect(log[0]?.kind).toBe('step-start');
    const summaries = log.filter((e) => e.kind === 'summary');
    expect(summaries).toHaveLength(1);
    const s = summaries[0]!;
    if (s.kind !== 'summary') throw new Error('unreachable');
    expect(s.worstLagMs).toBe(300);
    const kept = log.filter((e) => e.kind === 'alive').length;
    expect(s.lines + kept + 1).toBe(2500);
    expect(s.droppedFrames).toBe(s.lines);
  });

  it('never compresses lines outside step 5 or the lines that decide P1', () => {
    const wake: LogEntry = { kind: 'wakelock', at: 1, sinceStepMs: 1, step: 5, state: 'released' };
    let log: LogEntry[] = [wake];
    for (let i = 2; i < 2300; i++) log = appendLog(log, alive(i));
    expect(log).toContain(wake);
  });

  it('keeps the verdict when notices are compressed', () => {
    const { state, log } = runTest({ missedNotices: [3], audioStateOf: { 2: 'interrupted' }, noticeCount: 12 });
    let padded = log;
    for (let i = 0; i < 2100; i++) padded = appendLog(padded, alive(10 + i));
    const before = evaluate(state, log).proofs[1]!;
    const after = evaluate(state, padded).proofs[1]!;
    expect(after.facts).toEqual(before.facts);
    expect(after.verdict).toBe('fail');
  });
});
