import { useState, type FormEvent } from 'react';
import type { StudentView, WorkoutView } from '../../application/api-contract';
import { PROGRAM_NAME_MAX_LENGTH } from '../../domain/treinos';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { ListSection } from '../components/GroupedList';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { Sheet } from '../components/Sheet';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';
import { WorkoutBuilder } from './WorkoutBuilder';

const text = strings.training.workouts;

/** The student's Treinos tab: programs and workouts as tabs of letters, the selected one below as cards. */
export function WorkoutsTab({ student, workoutId }: { student: StudentView; workoutId?: string }) {
  const { backend } = useServices();
  const training = useQuery('studentTraining', { studentId: student.id }, ['training', 'exercises']);
  const [newProgram, setNewProgram] = useState(false);
  const [deleting, setDeleting] = useState<'workout' | 'program' | null>(null);
  const [failed, setFailed] = useState(false);

  const data = training.data;
  if (!data) return training.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />;

  const all = [...data.programs.flatMap((program) => program.workouts), ...data.workouts];
  const selected = all.find((workout) => workout.id === workoutId) ?? all[0];
  const selectedProgram = selected ? data.programs.find((program) => program.id === selected.programId) : undefined;
  const base = `/alunos/${student.id}/treinos`;

  async function createWorkout(programId: string | null) {
    const result = await backend.command('workout.create', { studentId: student.id, programId });
    setFailed(!result.ok);
    if (result.ok) navigate(`${base}/${result.value.id}`);
  }

  async function remove() {
    const target = deleting;
    setDeleting(null);
    if (!target || !selected) return;
    const result =
      target === 'workout' ? await backend.command('workout.delete', { id: selected.id }) : await backend.command('program.delete', { id: selected.programId! });
    setFailed(!result.ok);
    if (result.ok) navigate(base);
  }

  return (
    <div className="stack">
      {all.length === 0 && (
        <EmptyState
          action={
            <Button onClick={() => void createWorkout(null)}>{text.newWorkout}</Button>
          }
        >
          {text.empty}
        </EmptyState>
      )}
      {data.programs.map((program) => (
        <ListSection key={program.id} header={program.name}>
          <WorkoutChips base={base} workouts={program.workouts} selectedId={selected?.id} onNew={() => void createWorkout(program.id)} />
        </ListSection>
      ))}
      {(data.workouts.length > 0 || (all.length > 0 && data.programs.length > 0)) && (
        <ListSection header={text.noProgram}>
          <WorkoutChips base={base} workouts={data.workouts} selectedId={selected?.id} onNew={() => void createWorkout(null)} />
        </ListSection>
      )}
      {data.programs.length === 0 && data.workouts.length > 0 && (
        <div className="chip-row">
          <Button variant="secondary" onClick={() => void createWorkout(null)}>
            {text.newWorkout}
          </Button>
        </div>
      )}
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      {selected && (
        <section className="stack" aria-label={text.workout(selected.label)}>
          <h2 className="detail-title">{text.workout(selected.label)}</h2>
          <WorkoutBuilder key={selected.id} workout={selected} />
          <div className="row">
            <Button variant="secondary-danger" onClick={() => setDeleting('workout')}>
              {text.deleteWorkout}
            </Button>
            {selectedProgram && (
              <Button variant="secondary-danger" onClick={() => setDeleting('program')}>
                {text.deleteProgram}
              </Button>
            )}
          </div>
        </section>
      )}
      <div className="row">
        <Button variant="text" onClick={() => setNewProgram(true)}>
          {text.newProgram}
        </Button>
      </div>
      {newProgram && <NewProgram studentId={student.id} onClose={() => setNewProgram(false)} />}
      {deleting && selected && (
        <ConfirmDialog
          title={deleting === 'workout' ? text.deleteWorkout : text.deleteProgram}
          confirmLabel={deleting === 'workout' ? text.deleteWorkout : text.deleteProgram}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        >
          {deleting === 'workout' ? text.deleteWorkoutConfirm(selected.label) : text.deleteProgramConfirm(selectedProgram?.name ?? '')}
        </ConfirmDialog>
      )}
    </div>
  );
}

/** The letters of a section, one chip each, and the + that adds the next one. */
function WorkoutChips({ base, workouts, selectedId, onNew }: { base: string; workouts: readonly WorkoutView[]; selectedId: string | undefined; onNew: () => void }) {
  return (
    <li className="list-row">
      <nav className="list-content chip-row" aria-label={text.listLabel}>
        {workouts.map((workout) => (
          <Link key={workout.id} className="chip" to={`${base}/${workout.id}`} aria-current={workout.id === selectedId ? 'page' : undefined}>
            {text.workout(workout.label)}
          </Link>
        ))}
        <button type="button" className="chip" onClick={onNew}>
          + {text.newWorkout}
        </button>
      </nav>
    </li>
  );
}

function NewProgram({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { backend } = useServices();
  const [name, setName] = useState('');
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await backend.command('program.create', { studentId, name });
    if (result.ok) onClose();
    else setFailed(true);
  }

  return (
    <Sheet title={text.newProgram} onClose={onClose} onSave={() => (document.getElementById('program-form') as HTMLFormElement | null)?.requestSubmit()} saveDisabled={name.trim() === ''}>
      <form id="program-form" className="stack" onSubmit={submit}>
        <Field label={text.programName} value={name} maxLength={PROGRAM_NAME_MAX_LENGTH} onChange={(event) => setName(event.target.value)} autoFocus />
        {failed && <Notice tone="error">{strings.genericError}</Notice>}
      </form>
    </Sheet>
  );
}
