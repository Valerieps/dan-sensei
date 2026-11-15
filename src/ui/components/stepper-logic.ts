/** `value` moved by `delta`, kept between `min` and `max` and free of floating point dust. */
export function stepValue(value: number, delta: number, min: number, max: number): number {
  const next = Math.min(max, Math.max(min, value + delta));
  return Math.round(next * 1000) / 1000;
}
