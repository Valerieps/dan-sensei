import { useState, type ReactNode } from 'react';
import type { ExerciseView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { muscleTree, searchKey, type MuscleGroupId } from '../../domain/treinos';
import { useServices } from '../backend-context';
import { useQuery } from '../use-query';
import { Field } from './Field';
import { ListRow, GroupedList } from './GroupedList';
import { Notice } from './Notice';

const groupName = (id: MuscleGroupId) => strings.training.muscleGroups[id];

type ChipProps = { pressed: boolean; onClick: () => void; children: ReactNode; count?: number };

/** A toggle in capsule form: a muscle group, a tag. */
export function Chip({ pressed, onClick, children, count }: ChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
      {count !== undefined && <span className="chip-count">{count}</span>}
    </button>
  );
}

type GroupFieldProps = {
  label: string;
  value: readonly MuscleGroupId[];
  onChange: (value: MuscleGroupId[]) => void;
};

/** The muscle groups as chips, by region, to pick any number of them (the exercise form). */
export function MuscleGroupField({ label, value, onChange }: GroupFieldProps) {
  return (
    <fieldset className="field muscle-field">
      <legend className="field-label">{label}</legend>
      {muscleTree().map((region) => (
        <div key={region.region} className="chip-row" role="group" aria-label={strings.training.muscleRegions[region.region]}>
          {region.groups.map((id) => (
            <Chip key={id} pressed={value.includes(id)} onClick={() => onChange(value.includes(id) ? value.filter((g) => g !== id) : [...value, id])}>
              {groupName(id)}
            </Chip>
          ))}
        </div>
      ))}
    </fieldset>
  );
}

type PickerProps = {
  /** Called with the exercise the trainer chose, or the one just created from the search. */
  onPick: (exercise: ExerciseView) => void;
};

/**
 * The tree walk of docs/spec/treinos-e-exercicios.md, "Escolher um exercício": pick a group
 * (glúteo), then one that works with it (quadríceps), and the exercises that use both are listed.
 * The search by name or nickname works at any step, and when nothing matches it offers to add the
 * exercise. Used by the workout builder and, in C5, by the Ao Vivo "Acrescentar exercício".
 */
export function ExercisePicker({ onPick }: PickerProps) {
  const { backend } = useServices();
  const [picked, setPicked] = useState<MuscleGroupId[]>([]);
  const [search, setSearch] = useState('');
  const [failed, setFailed] = useState(false);
  const choices = useQuery('exerciseChoices', { groups: picked, search }, ['exercises']);
  const data = choices.data;
  const typed = search.trim();
  const exact = (data?.exercises ?? []).some((exercise) => searchKey(exercise.name) === searchKey(typed));
  const walking = picked.length > 0 || typed !== '';

  async function create() {
    const result = await backend.command('exercise.create', { name: typed });
    if (result.ok) onPick(result.value);
    else setFailed(true);
  }

  return (
    <div className="stack">
      <Field label={strings.training.picker.searchLabel} type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      {picked.length > 0 && (
        <div className="chip-row" role="group" aria-label={strings.training.picker.pickedLabel}>
          {picked.map((id) => (
            <button key={id} type="button" className="chip picked" aria-label={strings.training.picker.removeGroup(groupName(id))} onClick={() => setPicked(picked.filter((g) => g !== id))}>
              {groupName(id)}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      {data && data.groups.length > 0 && (
        <div className="stack tight" role="group" aria-label={strings.training.picker.groupsLabel}>
          <p className="list-section-header">{picked.length === 0 ? strings.training.picker.pickGroup : strings.training.picker.alsoWith}</p>
          {muscleTree().map((region) => {
            const offered = region.groups.flatMap((id) => data.groups.filter((choice) => choice.group === id));
            if (offered.length === 0) return null;
            return (
              <div key={region.region} className="chip-row" role="group" aria-label={strings.training.muscleRegions[region.region]}>
                {offered.map((choice) => (
                  <Chip key={choice.group} pressed={false} count={choice.count} onClick={() => setPicked([...picked, choice.group])}>
                    {groupName(choice.group)}
                  </Chip>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      {walking && data && (
        <GroupedList label={strings.training.exercises.listLabel}>
          {data.exercises.map((exercise) => (
            <ListRow
              key={exercise.id}
              title={exercise.name}
              subtitle={exercise.primaryGroups.map(groupName).join(', ') || strings.training.withoutMuscles}
              chevron={false}
              onClick={() => onPick(exercise)}
            />
          ))}
          {data.exercises.length === 0 && typed === '' && <li className="list-row"><p className="list-content muted">{strings.training.picker.none}</p></li>}
          {typed !== '' && !exact && <ListRow title={strings.training.picker.add(typed)} icon="plus" action onClick={() => void create()} />}
        </GroupedList>
      )}
    </div>
  );
}
