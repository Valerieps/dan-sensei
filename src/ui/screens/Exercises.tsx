import { useState, type ReactNode } from 'react';
import type { ExerciseView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { matchesSearch } from '../../domain/treinos';
import { useServices } from '../backend-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { GroupedList, ListContent, ListRow, ListSection } from '../components/GroupedList';
import { Loading } from '../components/Loading';
import { Chip } from '../components/MuscleTree';
import { Notice } from '../components/Notice';
import { RouteSheet } from '../components/RouteSheet';
import { Switch } from '../components/Controls';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';
import { EXERCISE_FORM_ID, ExerciseForm } from './ExerciseForm';

const groupNames = (exercise: ExerciseView) => exercise.primaryGroups.map((id) => strings.training.muscleGroups[id]).join(', ');

/** "Criar exercício": the panel over the library. */
export function NewExercise({ behind }: { behind?: ReactNode }) {
  return (
    <RouteSheet title={strings.training.exercises.createTitle} back="/exercicios" behind={behind} formId={EXERCISE_FORM_ID}>
      <ExerciseForm onSaved={(exercise) => navigate(`/exercicios/${exercise.id}`)} />
    </RouteSheet>
  );
}

/**
 * The Exercícios tab (docs/spec/treinos-e-exercicios.md, "Biblioteca de exercícios"): the list on
 * the left with search and tag filters, the selected exercise on the right. On a narrow screen only
 * one of the two shows.
 */
export function Exercises({ selectedId }: { selectedId?: string }) {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const exercises = useQuery('exercises', { includeArchived: showArchived }, ['exercises']);
  const allTags = useQuery('exerciseTags', {}, ['exercises']);
  const warnings = useQuery('exerciseWarnings', {}, ['exercises']);

  const shown = (exercises.data ?? []).filter((exercise) => matchesSearch(exercise, search) && tags.every((tag) => exercise.tags.includes(tag)));
  const withoutMuscles = warnings.data?.withoutMuscles.length ?? 0;

  return (
    <div className={selectedId ? 'split has-detail' : 'split'}>
      <section className="split-list" aria-label={strings.training.exercises.listLabel}>
        <div className="row spread">
          <Button onClick={() => navigate('/exercicios/novo')}>{strings.training.exercises.create}</Button>
        </div>
        <Field label={strings.training.exercises.searchLabel} type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        {(allTags.data ?? []).length > 0 && (
          <div className="chip-row" role="group" aria-label={strings.training.exercises.tagFilter}>
            {(allTags.data ?? []).map((tag) => (
              <Chip key={tag} pressed={tags.includes(tag)} onClick={() => setTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag])}>
                {tag}
              </Chip>
            ))}
          </div>
        )}
        <Switch label={strings.training.exercises.showArchived} checked={showArchived} onChange={setShowArchived} />
        {withoutMuscles > 0 && <Notice>{strings.training.withoutMusclesReminder(withoutMuscles)}</Notice>}
        {!exercises.data ? (
          exercises.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />
        ) : shown.length === 0 ? (
          <p className="muted">{strings.training.exercises.empty}</p>
        ) : (
          <GroupedList label={strings.training.exercises.listLabel}>
            {shown.map((exercise) => (
              <ListRow
                key={exercise.id}
                title={exercise.name}
                subtitle={groupNames(exercise) || strings.training.withoutMuscles}
                href={`/exercicios/${exercise.id}`}
                trailing={exercise.archived ? <Badge>{strings.training.exercises.archived}</Badge> : undefined}
              />
            ))}
          </GroupedList>
        )}
      </section>
      <section className="split-detail">
        {selectedId ? <ExerciseDetail key={selectedId} id={selectedId} /> : <p className="muted">{strings.training.exercises.choose}</p>}
      </section>
    </div>
  );
}

function ExerciseDetail({ id }: { id: string }) {
  const { backend } = useServices();
  const exercise = useQuery('exercise', { id }, ['exercises']);
  const [failed, setFailed] = useState(false);

  if (exercise.error === 'not_found') {
    return (
      <>
        <Notice tone="error">{strings.training.exercises.notFound}</Notice>
        <Link to="/exercicios">{strings.training.exercises.back}</Link>
      </>
    );
  }
  const data = exercise.data;
  if (!data) return exercise.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />;

  async function setArchived(archived: boolean) {
    const result = await backend.command('exercise.setArchived', { id, archived });
    setFailed(!result.ok);
  }

  return (
    <div className="stack">
      <Link className="split-back" to="/exercicios">
        {strings.training.exercises.back}
      </Link>
      <h2 className="detail-title">{data.name}</h2>
      {data.withoutMuscles && (
        <Notice>
          {strings.training.withoutMuscles}. {strings.training.withoutMusclesHint}
        </Notice>
      )}
      <ExerciseForm key={`${data.id}:${JSON.stringify(data)}`} exercise={data} onSaved={() => undefined} formId={`${EXERCISE_FORM_ID}-edit`} />
      <div className="row">
        <Button onClick={() => (document.getElementById(`${EXERCISE_FORM_ID}-edit`) as HTMLFormElement | null)?.requestSubmit()}>{strings.save}</Button>
      </div>
      <ListSection footer={strings.training.exercises.form.archiveHint}>
        <ListContent>
          <Switch label={strings.training.exercises.form.archive} checked={data.archived} onChange={(value) => void setArchived(value)} />
        </ListContent>
      </ListSection>
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
    </div>
  );
}
