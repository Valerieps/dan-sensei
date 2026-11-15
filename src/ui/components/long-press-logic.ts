import { SWIPE_SLOP } from './swipe-logic';

/** How long a finger must stay down before the touch counts as a long press (as in iOS). */
export const LONG_PRESS_MS = 500;

/** Whether the finger moved far enough to be a scroll or a swipe, which cancels the long press. */
export function movedPastSlop(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > SWIPE_SLOP;
}
