import { describe, expect, it } from 'vitest';
import { defaultPrescription, groupKindFor, isValidPrescription, nextWorkoutLabel, patchPrescription } from './index';

describe('prescriptions', () => {
  const base = defaultPrescription('load_reps');

  it('starts with 3 sets of 8 to 12, 60 s of rest and no load', () => {
    expect(base).toEqual({ sets: 3, repsMin: 8, repsMax: 12, loadG: null, restS: 60, method: 'normal', targetKind: null, targetValue: null, notes: '' });
    expect(isValidPrescription(base, 'load_reps')).toBe(true);
  });

  it('gives a time or distance exercise a range of seconds or meters', () => {
    expect(defaultPrescription('time').repsMax).toBe(60);
    expect(isValidPrescription(defaultPrescription('time'), 'time')).toBe(true);
    expect(isValidPrescription(defaultPrescription('distance'), 'distance')).toBe(true);
  });

  it('refuses a reversed range, too many reps for the measure, and a half target', () => {
    expect(patchPrescription(base, { repsMin: 13 }, 'load_reps')).toBeNull();
    expect(patchPrescription(base, { repsMax: 101 }, 'load_reps')).toBeNull();
    expect(patchPrescription(base, { repsMax: 600 }, 'time')).not.toBeNull();
    expect(patchPrescription(base, { targetKind: 'rir' }, 'load_reps')).toBeNull();
    expect(patchPrescription(base, { targetKind: 'rir', targetValue: 11 }, 'load_reps')).toBeNull();
    expect(patchPrescription(base, { method: 'magic' }, 'load_reps')).toBeNull();
    expect(patchPrescription(base, { sets: 0 }, 'load_reps')).toBeNull();
    expect(patchPrescription(base, { restS: 1000 }, 'load_reps')).toBeNull();
  });

  it('patches only the fields sent and clears with null', () => {
    const withLoad = patchPrescription(base, { loadG: 20000, targetKind: 'rir', targetValue: 2 }, 'load_reps')!;
    expect(withLoad).toMatchObject({ loadG: 20000, targetKind: 'rir', targetValue: 2, sets: 3 });
    const cleared = patchPrescription(withLoad, { loadG: null, targetKind: null, targetValue: null }, 'load_reps')!;
    expect(cleared).toMatchObject({ loadG: null, targetKind: null, targetValue: null });
  });

  it('names the group kind by its size unless it is a circuit', () => {
    expect(groupKindFor('bi_set', 1)).toBeNull();
    expect(groupKindFor('bi_set', 2)).toBe('bi_set');
    expect(groupKindFor('bi_set', 3)).toBe('tri_set');
    expect(groupKindFor('tri_set', 2)).toBe('bi_set');
    expect(groupKindFor('bi_set', 4)).toBe('circuit');
    expect(groupKindFor('circuit', 2)).toBe('circuit');
  });

  it('suggests the next free workout letter', () => {
    expect(nextWorkoutLabel([])).toBe('A');
    expect(nextWorkoutLabel(['A', 'b'])).toBe('C');
    expect(nextWorkoutLabel(['A', 'C'])).toBe('B');
  });
});
