/** The pure rules behind the panel (Sheet) and the confirmation box: swiping and the focus trap. */

export type Detent = 'medium' | 'large';
export type DragResult = 'dismiss' | 'expand' | 'settle';

/** Past this share of the panel's height, a downward drag closes it. */
export const DISMISS_FRACTION = 0.3;
/** A quick flick (share of the height per millisecond) closes it too. */
export const DISMISS_VELOCITY = 0.0015;
/** Past this share of the height, an upward drag on the medium panel opens it to the large height. */
export const EXPAND_FRACTION = 0.12;

/**
 * What a finished drag on the panel's header does. `dy` is how far the finger moved (positive is
 * down), `height` the panel's height, `velocity` the share of the height per ms at release.
 */
export function settleDrag(dy: number, height: number, velocity: number, detent: Detent): DragResult {
  if (height <= 0) return 'settle';
  const share = dy / height;
  if (share > DISMISS_FRACTION || (dy > 0 && velocity > DISMISS_VELOCITY)) return 'dismiss';
  if (detent === 'medium' && share < -EXPAND_FRACTION) return 'expand';
  return 'settle';
}

/** How far the panel follows the finger: it never rises above its place, and does not stretch. */
export function dragOffset(dy: number): number {
  return Math.max(0, dy);
}

/** The index Tab moves the focus to inside a trap of `count` controls (`current` is -1 outside it). */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}
