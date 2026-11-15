import { describe, expect, it } from 'vitest';
import type { AgendaClass } from '../../application/api-contract';
import { lessonSwipeActions } from './class-text';

const lesson = (patch: Partial<AgendaClass>) => ({ date: '2026-11-15', status: 'scheduled', ...patch }) as AgendaClass;
const noop = { reschedule: () => {}, missed: () => {} };

describe('lessonSwipeActions', () => {
  it('offers Remarcar and Falta for a lesson of today', () => {
    expect(lessonSwipeActions(lesson({}), '2026-11-15', noop).map((a) => a.label)).toEqual(['Remarcar', 'Falta']);
  });

  it('offers only Remarcar for a future lesson', () => {
    expect(lessonSwipeActions(lesson({ date: '2026-11-17' }), '2026-11-15', noop).map((a) => a.label)).toEqual(['Remarcar']);
  });

  it('offers nothing once the lesson is no longer scheduled', () => {
    expect(lessonSwipeActions(lesson({ status: 'given' }), '2026-11-15', noop)).toEqual([]);
  });
});
