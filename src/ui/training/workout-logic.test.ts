import { describe, expect, it } from 'vitest';
import { adjustReps, blocksOf, formatKg, kgToGrams, moveBlock, nextToJoin, summaryOf } from './workout-logic';

const item = (id: string, groupId: string | null = null) => ({ id, groupId });
const list = [item('a'), item('b', 'g'), item('c', 'g'), item('d')];

describe('blocksOf', () => {
  it('puts the exercises of a group in one block', () => {
    expect(blocksOf(list).map((b) => b.items.map((i) => i.id))).toEqual([['a'], ['b', 'c'], ['d']]);
  });
  it('keeps two groups with different ids apart', () => {
    expect(blocksOf([item('a', 'x'), item('b', 'y')])).toHaveLength(2);
  });
});

describe('moveBlock', () => {
  it('moves a lone exercise past a whole group', () => {
    expect(moveBlock(list, 'a', 1)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('moves a group as one when any of its members is moved', () => {
    expect(moveBlock(list, 'c', -1)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveBlock(list, 'b', 1)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('returns null at the ends and for an unknown id', () => {
    expect(moveBlock(list, 'a', -1)).toBeNull();
    expect(moveBlock(list, 'd', 1)).toBeNull();
    expect(moveBlock(list, 'zz', 1)).toBeNull();
  });
});

describe('nextToJoin', () => {
  it('offers the next exercise', () => expect(nextToJoin(list, 'a')?.id).toBe('b'));
  it('offers none for the last one or when the next is in the same group', () => {
    expect(nextToJoin(list, 'd')).toBeNull();
    expect(nextToJoin(list, 'b')).toBeNull();
  });
  it('offers the exercise after a group to its last member', () => expect(nextToJoin(list, 'c')?.id).toBe('d'));
});

describe('adjustReps', () => {
  it('raises the maximum with the minimum', () => expect(adjustReps({ repsMin: 8, repsMax: 10 }, 'repsMin', 12)).toEqual({ repsMin: 12, repsMax: 12 }));
  it('lowers the minimum with the maximum', () => expect(adjustReps({ repsMin: 8, repsMax: 10 }, 'repsMax', 6)).toEqual({ repsMin: 6, repsMax: 6 }));
  it('leaves the other end alone when the range still holds', () => expect(adjustReps({ repsMin: 8, repsMax: 12 }, 'repsMin', 9)).toEqual({ repsMin: 9, repsMax: 12 }));
});

describe('loads', () => {
  it('turns kilos into grams and zero into no load', () => {
    expect(kgToGrams(2.5)).toBe(2500);
    expect(kgToGrams(0)).toBeNull();
  });
  it('writes the load in Brazilian Portuguese', () => {
    expect(formatKg(2.5)).toBe('2,5 kg');
    expect(formatKg(0)).toBe('Sem carga');
  });
});

describe('summaryOf', () => {
  const base = { sets: 3, repsMin: 8, repsMax: 12, loadG: 20000, restS: 60, method: 'normal', targetKind: null, targetValue: null, notes: '' } as const;
  it('says sets, range, load and rest', () => expect(summaryOf(base, 'load_reps')).toBe('3 × 8–12 · 20 kg · 60 s'));
  it('says the unit of a time exercise and no load', () => expect(summaryOf({ ...base, repsMin: 30, repsMax: 30, loadG: null }, 'time')).toBe('3 × 30 s · 60 s'));
  it('names a method other than normal', () => expect(summaryOf({ ...base, method: 'drop_set' }, 'load_reps')).toContain('Drop-set'));
});
