// Volume: valid sets per muscle group; the primary group counts 1 and a secondary one 0.5
// (docs/spec/aula-ao-vivo.md, "Volume"). Tonnage is complementary and only for loaded sets.
export interface SerieComGrupos {
  readonly primaryGroups: readonly string[];
  readonly secondaryGroups: readonly string[];
}

export const PESO_PRIMARIO = 1;
export const PESO_SECUNDARIO = 0.5;

/** Sets per group; groups with no set are absent. Bodyweight, time and distance sets count the same. */
export function volumePorGrupo(series: readonly SerieComGrupos[]): Record<string, number> {
  const volume: Record<string, number> = {};
  for (const serie of series) {
    for (const group of serie.primaryGroups) volume[group] = (volume[group] ?? 0) + PESO_PRIMARIO;
    for (const group of serie.secondaryGroups) {
      if (!serie.primaryGroups.includes(group)) volume[group] = (volume[group] ?? 0) + PESO_SECUNDARIO;
    }
  }
  return volume;
}

/** Load (g) × repetitions of the sets that have both, in grams. */
export function tonelagem(series: readonly { readonly loadG: number | null; readonly reps: number | null }[]): number {
  return series.reduce((soma, s) => soma + (s.loadG !== null && s.reps !== null ? s.loadG * s.reps : 0), 0);
}
