import { describe, expect, it } from 'vitest';
import { isHorizontalSwipe, settlesOpen, swipeOffset } from './swipe-logic';

describe('swipe logic', () => {
  it('treats small or mostly vertical movements as a tap or a scroll', () => {
    expect(isHorizontalSwipe(-4, 0)).toBe(false);
    expect(isHorizontalSwipe(-30, 40)).toBe(false);
    expect(isHorizontalSwipe(-30, 10)).toBe(true);
    expect(isHorizontalSwipe(30, 10)).toBe(true);
  });

  it('follows the finger to the left and stops at the actions width', () => {
    expect(swipeOffset(-40, false, 176)).toBe(-40);
    expect(swipeOffset(-400, false, 176)).toBe(-176);
    expect(swipeOffset(60, false, 176)).toBe(0);
  });

  it('lets an open row be dragged closed', () => {
    expect(swipeOffset(0, true, 176)).toBe(-176);
    expect(swipeOffset(100, true, 176)).toBe(-76);
    expect(swipeOffset(300, true, 176)).toBe(0);
  });

  it('stays open only past half of the actions', () => {
    expect(settlesOpen(-100, 176)).toBe(true);
    expect(settlesOpen(-88, 176)).toBe(false);
    expect(settlesOpen(-20, 176)).toBe(false);
    expect(settlesOpen(-20, 0)).toBe(false);
  });
});
