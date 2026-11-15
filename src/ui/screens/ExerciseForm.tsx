import { useState, type FormEvent } from 'react';
import type { ExerciseFormInput, ExerciseView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { EQUIPMENTS, LOAD_STEPS_G, MEASURES, type Equipment, type Measure, type MuscleGroupId } from '../../domain/treinos';
import { useServices } from '../backend-context';
import { ChoiceField } from '../components/RouteSheet';
import { Field } from '../components/Field';
import { Chip, MuscleGroupField } from '../components/MuscleTree';
import { Notice } from '../components/Notice';
import { SelectField } from '../components/SelectField';
import { useQuery } from '../use-query';

export const EXERCISE_FORM_ID = 'exercise-form';

const words = (text: string): string[] =>
  text
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean);

type Props = {
  formId?: string;
  /** The exercise being edited; leave out to create one. */
  exercise?: ExerciseView;
  onSaved: (exercise: ExerciseView) => void;
};

/** The exercise's fields, for the "Criar exercício" panel and the detail of the library. */
export function ExerciseForm({ formId = EXERCISE_FORM_ID, exercise, onSaved }: Props) {
  const { backend } = useServices();
  const tagSuggestions = useQuery('exerciseTags', {}, ['exercises']);
  const [name, setName] = useState(exercise?.name ?? '');
  const [aliases, setAliases] = useState((exercise?.aliases ?? []).join(', '));
  const [primary, setPrimary] = useState<MuscleGroupId[]>([...(exercise?.primaryGroups ?? [])]);
  const [secondary, setSecondary] = useState<MuscleGroupId[]>([...(exercise?.secondaryGroups ?? [])]);
  const [tags, setTags] = useState((exercise?.tags ?? []).join(', '));
  const [measure, setMeasure] = useState<Measure>(exercise?.measure ?? 'load_reps');
  const [equipment, setEquipment] = useState<Equipment | ''>(exercise?.equipment ?? '');
  const [loadStepG, setLoadStepG] = useState(exercise?.loadStepG ?? 2500);
  const [mediaUrl, setMediaUrl] = useState(exercise?.mediaUrl ?? '');
  const [state, setState] = useState<'idle' | 'saved' | 'taken' | 'invalid' | 'failed'>('idle');

  const currentTags = words(tags);
  const toggleTag = (tag: string) => setTags((currentTags.includes(tag) ? currentTags.filter((t) => t !== tag) : [...currentTags, tag]).join(', '));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input: ExerciseFormInput = {
      name,
      aliases: words(aliases),
      primaryGroups: primary,
      // A group is never both: the primary one wins.
      secondaryGroups: secondary.filter((group) => !primary.includes(group)),
      tags: currentTags,
      measure,
      loadStepG,
      equipment: equipment === '' ? null : equipment,
      mediaUrl: mediaUrl.trim() === '' ? null : mediaUrl.trim(),
    };
    const result = exercise ? await backend.command('exercise.update', { ...input, id: exercise.id }) : await backend.command('exercise.create', input);
    if (result.ok) {
      setState('saved');
      onSaved(result.value);
    } else setState(result.error === 'conflict' ? 'taken' : result.error === 'invalid' ? 'invalid' : 'failed');
  }

  return (
    <form id={formId} className="stack" onSubmit={submit}>
      <Field
        label={strings.training.exercises.form.name}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setState('idle');
        }}
        error={state === 'taken' ? strings.training.exercises.form.nameTaken : null}
        required
      />
      <MuscleGroupField label={strings.training.exercises.form.primary} value={primary} onChange={setPrimary} />
      <MuscleGroupField label={strings.training.exercises.form.secondary} value={secondary.filter((g) => !primary.includes(g))} onChange={setSecondary} />
      <Field label={strings.training.exercises.form.aliases} value={aliases} onChange={(event) => setAliases(event.target.value)} />
      <Field label={strings.training.exercises.form.tags} value={tags} onChange={(event) => setTags(event.target.value)} />
      {(tagSuggestions.data ?? []).length > 0 && (
        <div className="chip-row" role="group" aria-label={strings.training.exercises.form.tagSuggestions}>
          {(tagSuggestions.data ?? []).map((tag) => (
            <Chip key={tag} pressed={currentTags.includes(tag)} onClick={() => toggleTag(tag)}>
              {tag}
            </Chip>
          ))}
        </div>
      )}
      <SelectField label={strings.training.exercises.form.measure} value={measure} onChange={(event) => setMeasure(event.target.value as Measure)}>
        {MEASURES.map((m) => (
          <option key={m} value={m}>
            {strings.training.measures[m]}
          </option>
        ))}
      </SelectField>
      <SelectField label={strings.training.exercises.form.equipment} value={equipment} onChange={(event) => setEquipment(event.target.value as Equipment | '')}>
        <option value="">{strings.training.exercises.form.noEquipment}</option>
        {EQUIPMENTS.map((e) => (
          <option key={e} value={e}>
            {strings.training.equipments[e]}
          </option>
        ))}
      </SelectField>
      <ChoiceField
        label={strings.training.exercises.form.loadStep}
        options={LOAD_STEPS_G.map((g) => ({ value: String(g), label: `${(g / 1000).toLocaleString('pt-BR')} kg` }))}
        value={String(loadStepG)}
        onChange={(value) => setLoadStepG(Number(value))}
      />
      <Field label={strings.training.exercises.form.mediaUrl} type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} />
      {state === 'invalid' && <Notice tone="error">{strings.training.exercises.form.invalid}</Notice>}
      {state === 'failed' && <Notice tone="error">{strings.genericError}</Notice>}
      {state === 'saved' && exercise && <Notice>{strings.training.exercises.form.saved}</Notice>}
    </form>
  );
}

