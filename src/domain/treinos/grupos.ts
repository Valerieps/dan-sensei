// The muscle-group tree (docs/spec/treinos-e-exercicios.md, "Escolher um exercício"). The groups are
// fixed: they are the base of the volume, so the trainer picks from them and never types one.
// Labels live in `strings.training.muscleGroups`, keyed by id.
export const MUSCLE_REGIONS = ['upper', 'trunk', 'lower'] as const;
export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];

export const MUSCLE_GROUPS = [
  { id: 'peitoral', region: 'upper' },
  { id: 'dorsal', region: 'upper' },
  { id: 'trapezio', region: 'upper' },
  { id: 'ombro', region: 'upper' },
  { id: 'biceps', region: 'upper' },
  { id: 'triceps', region: 'upper' },
  { id: 'antebraco', region: 'upper' },
  { id: 'abdomen', region: 'trunk' },
  { id: 'lombar', region: 'trunk' },
  { id: 'gluteo', region: 'lower' },
  { id: 'quadriceps', region: 'lower' },
  { id: 'posterior', region: 'lower' },
  { id: 'adutores', region: 'lower' },
  { id: 'abdutores', region: 'lower' },
  { id: 'panturrilha', region: 'lower' },
] as const satisfies readonly { id: string; region: MuscleRegion }[];

export type MuscleGroupId = (typeof MUSCLE_GROUPS)[number]['id'];

const IDS: readonly string[] = MUSCLE_GROUPS.map((group) => group.id);

export const isMuscleGroupId = (value: unknown): value is MuscleGroupId => typeof value === 'string' && IDS.includes(value);

/** The tree: each region with its groups, in display order. */
export function muscleTree(): { region: MuscleRegion; groups: MuscleGroupId[] }[] {
  return MUSCLE_REGIONS.map((region) => ({ region, groups: MUSCLE_GROUPS.filter((g) => g.region === region).map((g) => g.id) }));
}
