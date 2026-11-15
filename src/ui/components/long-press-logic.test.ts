import { describe, expect, it } from 'vitest';
import { LONG_PRESS_MS, movedPastSlop } from './long-press-logic';

describe('long press logic', () => {
  it('waits half a second, like iOS', () => {
    expect(LONG_PRESS_MS).toBe(500);
  });

  it('cancels when the finger travels, in any direction', () => {
    expect(movedPastSlop(2, 3)).toBe(false);
    expect(movedPastSlop(0, 20)).toBe(true);
    expect(movedPastSlop(-12, 0)).toBe(true);
  });
});
