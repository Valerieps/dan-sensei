import { describe, expect, it } from 'vitest';
import {
  answerOf,
  answerQuestion,
  canComplete,
  completeStep,
  goToStep,
  initialTest,
  isFinished,
  progress,
  skipStep,
  statusOf,
  unansweredQuestions,
} from './steps';

describe('steps', () => {
  it('starts at step 0 of 7', () => {
    const state = initialTest();
    expect(progress(state)).toEqual({ number: 1, total: 7 });
    expect(state.steps).toHaveLength(7);
  });

  it('completes a step without questions and moves on', () => {
    const state = completeStep(initialTest());
    expect(statusOf(state, 0)).toBe('done');
    expect(state.current).toBe(1);
  });

  it('refuses to complete while a question is unanswered', () => {
    let state = goToStep(initialTest(), 3);
    expect(unansweredQuestions(state)).toEqual(['timers-heard', 'timers-smooth']);
    expect(completeStep(state)).toBe(state);
    state = answerQuestion(state, 'timers-heard', true);
    state = answerQuestion(state, 'timers-smooth', true);
    expect(canComplete(state)).toBe(true);
    expect(completeStep(state).current).toBe(4);
  });

  it('keeps the comment only for a No, trimmed and limited', () => {
    let state = answerQuestion(initialTest(), 'no-lag', false, '  travou  ');
    expect(answerOf(state, 'no-lag')).toEqual({ yes: false, comment: 'travou' });
    state = answerQuestion(state, 'no-lag', true, 'ignorado');
    expect(answerOf(state, 'no-lag')).toEqual({ yes: true });
    state = answerQuestion(state, 'no-lag', false, 'x'.repeat(900));
    expect(answerOf(state, 'no-lag')?.comment).toHaveLength(500);
  });

  it('skips a step even with questions pending, but not the last one', () => {
    let state = skipStep(goToStep(initialTest(), 4));
    expect(statusOf(state, 4)).toBe('skipped');
    expect(state.current).toBe(5);
    state = goToStep(state, 6);
    expect(skipStep(state)).toBe(state);
  });

  it('is finished only when step 6 is done, and stays on step 6', () => {
    let state = goToStep(initialTest(), 6);
    expect(isFinished(state)).toBe(false);
    state = completeStep(state);
    expect(isFinished(state)).toBe(true);
    expect(state.current).toBe(6);
  });

  it('does not change the previous state', () => {
    const before = initialTest();
    answerQuestion(before, 'sound-beeps', true);
    completeStep(before);
    expect(statusOf(before, 0)).toBe('pending');
    expect(answerOf(before, 'sound-beeps')).toBeUndefined();
  });
});
