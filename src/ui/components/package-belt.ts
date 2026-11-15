/** Above this many lessons the belt is one continuous bar (docs/UI.md, "Padrão Apple"). */
export const MAX_SEGMENTS = 20;

export type Belt =
  | { readonly kind: 'segments'; readonly total: number; readonly filled: number }
  | { readonly kind: 'bar'; readonly percent: number };

/** How a package draws: one capsule per lesson up to 20 lessons, a continuous bar above. */
export function beltFor(used: number, total: number): Belt {
  const filled = Math.max(0, Math.min(used, total));
  if (total > MAX_SEGMENTS) return { kind: 'bar', percent: Math.round((filled / total) * 100) };
  return { kind: 'segments', total: Math.max(0, total), filled };
}
