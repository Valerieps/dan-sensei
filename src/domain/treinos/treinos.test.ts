import { describe, expect, it } from 'vitest';
import {
  exerciseChoices,
  hasNoMuscles,
  matchesSearch,
  muscleTree,
  MUSCLE_GROUPS,
  normalizeExerciseInput,
  normalizeMediaUrl,
  searchKey,
  type MuscleGroupId,
} from './index';
import { strings } from '../strings';

const ex = (name: string, primary: MuscleGroupId[], secondary: MuscleGroupId[] = [], aliases: string[] = []) => ({ name, aliases, primaryGroups: primary, secondaryGroups: secondary });

describe('muscle groups', () => {
  it('has a label for every group and region', () => {
    for (const { id } of MUSCLE_GROUPS) expect(strings.training.muscleGroups[id]).toBeTruthy();
    for (const { region } of muscleTree()) expect(strings.training.muscleRegions[region]).toBeTruthy();
  });

  it('puts every group in exactly one region', () => {
    expect(muscleTree().flatMap((r) => r.groups).sort()).toEqual(MUSCLE_GROUPS.map((g) => g.id).sort());
  });
});

describe('exercise input', () => {
  it('needs only a name and defaults the rest', () => {
    expect(normalizeExerciseInput({ name: '  Remada   alta ' })).toEqual({
      name: 'Remada alta',
      aliases: [],
      primaryGroups: [],
      secondaryGroups: [],
      tags: [],
      measure: 'load_reps',
      loadStepG: 2500,
      equipment: null,
      mediaUrl: null,
    });
  });

  it('refuses an empty name, an unknown group, load step, measure or equipment', () => {
    expect(normalizeExerciseInput({ name: ' ' })).toBeNull();
    expect(normalizeExerciseInput({ name: 'A', primaryGroups: ['cabelo'] })).toBeNull();
    expect(normalizeExerciseInput({ name: 'A', loadStepG: 3000 })).toBeNull();
    expect(normalizeExerciseInput({ name: 'A', measure: 'x' })).toBeNull();
    expect(normalizeExerciseInput({ name: 'A', equipment: 'x' })).toBeNull();
    expect(normalizeExerciseInput({ name: 'A', tags: [1] })).toBeNull();
  });

  it('keeps a group out of the secondary list when it is primary, and drops repeated words', () => {
    const e = normalizeExerciseInput({ name: 'A', primaryGroups: ['gluteo', 'gluteo'], secondaryGroups: ['gluteo', 'posterior'], tags: ['Equilíbrio', 'equilibrio', ' '], aliases: ['x', 'X'] })!;
    expect(e.primaryGroups).toEqual(['gluteo']);
    expect(e.secondaryGroups).toEqual(['posterior']);
    expect(e.tags).toEqual(['Equilíbrio']);
    expect(e.aliases).toEqual(['x']);
  });

  it('accepts only http(s) media links', () => {
    expect(normalizeMediaUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(normalizeMediaUrl('')).toBeNull();
    expect(normalizeMediaUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeMediaUrl('not a url')).toBeUndefined();
    expect(normalizeMediaUrl(5)).toBeUndefined();
  });

  it('flags an exercise with no primary group', () => {
    expect(hasNoMuscles({ primaryGroups: [] })).toBe(true);
    expect(hasNoMuscles({ primaryGroups: ['gluteo'] })).toBe(false);
  });
});

describe('search', () => {
  it('ignores case and accents and looks at aliases', () => {
    expect(searchKey('  GLÚTEO  ')).toBe('gluteo');
    expect(matchesSearch(ex('Elevação pélvica', ['gluteo'], [], ['hip thrust']), 'hip')).toBe(true);
    expect(matchesSearch(ex('Elevação pélvica', ['gluteo']), 'pelvica elev')).toBe(true);
    expect(matchesSearch(ex('Elevação pélvica', ['gluteo']), 'agach')).toBe(false);
    expect(matchesSearch(ex('Elevação pélvica', ['gluteo']), '  ')).toBe(true);
  });
});

describe('the group tree walk', () => {
  const library = [
    ex('Agachamento', ['quadriceps', 'gluteo'], ['posterior']),
    ex('Elevação pélvica', ['gluteo'], ['posterior']),
    ex('Extensora', ['quadriceps']),
    ex('Rosca', ['biceps']),
    ex('Avanço', ['quadriceps'], ['gluteo']),
  ];

  it('with nothing picked lists everything and every group that has an exercise', () => {
    const { groups, exercises } = exerciseChoices(library, []);
    expect(exercises).toHaveLength(5);
    expect(groups.map((g) => g.group)).toContain('biceps');
    expect(groups.map((g) => g.group)).not.toContain('peitoral');
  });

  it('lists the exercises that use the picked group, primary first', () => {
    const { exercises } = exerciseChoices(library, ['gluteo']);
    expect(exercises.map((e) => e.name)).toEqual(['Agachamento', 'Elevação pélvica', 'Avanço']);
  });

  it('offers only groups that work with the picked one, with the exercise count', () => {
    const { groups } = exerciseChoices(library, ['gluteo']);
    expect(groups).toEqual([
      { group: 'quadriceps', count: 2 },
      { group: 'posterior', count: 2 },
    ]);
  });

  it('a second group keeps the exercises that use both', () => {
    const { exercises, groups } = exerciseChoices(library, ['gluteo', 'quadriceps']);
    expect(exercises.map((e) => e.name)).toEqual(['Agachamento', 'Avanço']);
    expect(groups).toEqual([{ group: 'posterior', count: 1 }]);
  });

  it('combines with the search', () => {
    expect(exerciseChoices(library, ['gluteo'], 'avan').exercises.map((e) => e.name)).toEqual(['Avanço']);
  });
});
