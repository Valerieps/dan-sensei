/** How far a finger must travel before the gesture counts as a swipe rather than a tap. */
export const SWIPE_SLOP = 8;

/** Whether a movement is a sideways swipe: past the slop, and more sideways than vertical. */
export function isHorizontalSwipe(dx: number, dy: number): boolean {
  return Math.abs(dx) > SWIPE_SLOP && Math.abs(dx) > Math.abs(dy);
}

/** Where the content sits while dragging: from -max (actions fully shown) to 0 (closed). */
export function swipeOffset(dx: number, startedOpen: boolean, max: number): number {
  return Math.min(0, Math.max(-max, (startedOpen ? -max : 0) + dx));
}

/** Whether the row stays open when the finger lifts: past half of the actions' width. */
export function settlesOpen(offset: number, max: number): boolean {
  return max > 0 && offset < -max / 2;
}
