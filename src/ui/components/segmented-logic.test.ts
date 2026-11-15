import { describe, expect, it } from 'vitest';
import { nextSegmentIndex } from './segmented-logic';
import { stepValue } from './stepper-logic';

describe('nextSegmentIndex', () => {
  it('moves with the arrows and wraps', () => {
    expect(nextSegmentIndex('ArrowRight', 2, 3)).toBe(0);
    expect(nextSegmentIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(nextSegmentIndex('ArrowDown', 0, 3)).toBe(1);
    expect(nextSegmentIndex('ArrowUp', 1, 3)).toBe(0);
  });
  it('jumps with Home and End', () => {
    expect(nextSegmentIndex('Home', 2, 4)).toBe(0);
    expect(nextSegmentIndex('End', 0, 4)).toBe(3);
  });
  it('ignores other keys and empty groups', () => {
    expect(nextSegmentIndex('a', 0, 3)).toBeNull();
    expect(nextSegmentIndex('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('stepValue', () => {
  it('stays inside the limits', () => {
    expect(stepValue(5, -10, 0, 100)).toBe(0);
    expect(stepValue(95, 10, 0, 100)).toBe(100);
  });
  it('adds without floating point dust', () => expect(stepValue(0.1, 0.2, 0, 10)).toBe(0.3));
});
