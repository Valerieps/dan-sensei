import { describe, expect, it } from 'vitest';
import { dragOffset, nextFocusIndex, settleDrag } from './sheet-logic';

describe('settleDrag', () => {
  it('closes after a long drag down', () => expect(settleDrag(300, 600, 0, 'medium')).toBe('dismiss'));
  it('closes after a quick flick down', () => expect(settleDrag(40, 600, 0.01, 'medium')).toBe('dismiss'));
  it('settles back after a short slow drag down', () => expect(settleDrag(60, 600, 0.0001, 'medium')).toBe('settle'));
  it('opens the medium panel to large on a drag up', () => expect(settleDrag(-120, 600, 0, 'medium')).toBe('expand'));
  it('keeps the large panel in place on a drag up', () => expect(settleDrag(-120, 600, 0, 'large')).toBe('settle'));
  it('ignores a zero height', () => expect(settleDrag(100, 0, 1, 'medium')).toBe('settle'));
  it('does not close on a flick upwards', () => expect(settleDrag(-10, 600, 0.01, 'large')).toBe('settle'));
});

describe('dragOffset', () => {
  it('follows the finger down and never above the resting place', () => {
    expect(dragOffset(50)).toBe(50);
    expect(dragOffset(-50)).toBe(0);
  });
});

describe('nextFocusIndex', () => {
  it('wraps forwards and backwards', () => {
    expect(nextFocusIndex(3, 2, false)).toBe(0);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
    expect(nextFocusIndex(3, 0, false)).toBe(1);
  });
  it('enters the trap from outside', () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
  });
  it('has nowhere to go without controls', () => expect(nextFocusIndex(0, -1, false)).toBe(-1));
});
