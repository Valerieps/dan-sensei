import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PrescribedExerciseView, PrescriptionPatch, WorkoutView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { MAX_LOAD_G, MAX_SETS, METHODS, maxRepsFor, type Method } from '../../domain/treinos';
import { useServices } from '../backend-context';
import { Button, IconButton } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SegmentedControl, Stepper } from '../components/Controls';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { ExercisePicker } from '../components/MuscleTree';
import { Notice } from '../components/Notice';
import { Sheet } from '../components/Sheet';
import { adjustReps, blocksOf, formatKg, gramsToKg, kgToGrams, moveBlock, nextToJoin, prescriptionOf, REST_STEP_S, repsKind, repsStep, summaryOf } from '../training/workout-logic';

const text = strings.training.workouts;

/**
 * A workout as cards, one per exercise, built almost without typing (docs/spec/treinos-e-exercicios.md,
 * "Programas e treinos"): the exercise comes from the muscle tree, the numbers from − and +. A card
 * is compact until it is touched; the exercises of a bi-set, tri-set or circuit share a side band.
 */
export function WorkoutBuilder({ workout }: { workout: WorkoutView }) {
  const { backend } = useServices();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run<T>(call: Promise<{ ok: true; value: T } | { ok: false; error: string }>) {
    const result = await call;
    setFailed(!result.ok);
    return result;
  }

  async function add(exerciseId: string) {
    setAdding(false);
    const result = await run(backend.command('prescribed.add', { workoutId: workout.id, exerciseId }));
    if (result.ok) setOpen(result.value.exercises[result.value.exercises.length - 1]?.id ?? null);
  }

  const blocks = blocksOf(workout.exercises);
  return (
    <div className="stack">
      {workout.exercises.length === 0 ? (
        <EmptyState>{text.emptyWorkout}</EmptyState>
      ) : (
        <ul className="workout-cards" aria-label={text.exercisesLabel}>
          {blocks.map((block) => (
            <li key={block.items[0].id} className={block.groupId ? 'workout-block grouped' : 'workout-block'}>
              {block.groupId && <span className="workout-group-label">{strings.training.groupKinds[block.items[0].groupKind ?? 'bi_set']}</span>}
              <ul className="workout-block-cards">
                {block.items.map((item) => (
                  <PrescribedCard
                    key={item.id}
                    item={item}
                    workout={workout}
                    open={open === item.id}
                    onToggle={() => setOpen(open === item.id ? null : item.id)}
                    run={run}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      <div className="row">
        <Button size="large" onClick={() => setAdding(true)}>
          {text.addExercise}
        </Button>
      </div>
      {adding && (
        <Sheet title={strings.training.picker.title} detent="large" onClose={() => setAdding(false)}>
          <ExercisePicker onPick={(exercise) => void add(exercise.id)} />
        </Sheet>
      )}
    </div>
  );
}

type Run = <T>(call: Promise<{ ok: true; value: T } | { ok: false; error: string }>) => Promise<{ ok: boolean }>;

/**
 * The numbers of a card live here while they are edited, and go to the server half a second after
 * the last tap (and when the card closes), so a run of + taps is one command and each tap starts
 * from the number on screen, not from the one the server last answered with.
 */
function useDraft(item: PrescribedExerciseView, send: (patch: PrescriptionPatch) => void) {
  const base = prescriptionOf(item);
  const baseKey = JSON.stringify(base);
  const [draft, setDraft] = useState(base);
  const pending = useRef<PrescriptionPatch>({});
  const timer = useRef<number | undefined>(undefined);
  const sendRef = useRef(send);
  sendRef.current = send;

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    sendRef.current(patch);
  }, []);

  useEffect(() => flush, [flush]);

  useEffect(() => {
    // Changed somewhere else (or answered by the server): take it while nothing here is unsent.
    if (Object.keys(pending.current).length === 0) setDraft(JSON.parse(baseKey));
  }, [baseKey]);

  const change = (patch: PrescriptionPatch) => {
    pending.current = { ...pending.current, ...patch };
    setDraft((current) => ({ ...current, ...patch }) as typeof current);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 500);
  };
  return { draft, change, flush };
}

function PrescribedCard({ item, workout, open, onToggle, run }: { item: PrescribedExerciseView; workout: WorkoutView; open: boolean; onToggle: () => void; run: Run }) {
  const { backend } = useServices();
  const [removing, setRemoving] = useState(false);
  const { draft, change, flush } = useDraft(item, (patch) => void run(backend.command('prescribed.update', { id: item.id, ...patch })));
  const measure = item.exercise.measure;
  const kind = repsKind(measure);
  const hasLoad = measure === 'load_reps' || measure === 'bodyweight_reps';
  const next = nextToJoin(workout.exercises, item.id);
  const groupSize = item.groupId ? workout.exercises.filter((e) => e.groupId === item.groupId).length : 0;
  const upIds = moveBlock(workout.exercises, item.id, -1);
  const downIds = moveBlock(workout.exercises, item.id, 1);

  const reorder = (ids: string[] | null) => ids && void run(backend.command('workout.reorder', { workoutId: workout.id, ids }));
  const groupMembers = workout.exercises.filter((e) => e.groupId === item.groupId).map((e) => e.id);

  return (
    <li className="workout-card" data-open={open}>
      <button
        type="button"
        className="workout-card-head"
        aria-expanded={open}
        onClick={() => {
          if (open) flush();
          onToggle();
        }}
      >
        <span className="list-row-text">
          <span className="list-row-title">{item.exercise.name}</span>
          <span className="list-row-subtitle">{summaryOf(draft, measure)}</span>
        </span>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} />
      </button>
      {open && (
        <div className="workout-card-body">
          <div className="workout-controls">
            <ControlRow label={text.sets}>
              <Stepper label={text.sets} value={draft.sets} min={1} max={MAX_SETS} onChange={(sets) => change({ sets })} />
            </ControlRow>
            <ControlRow label={text.repsOf(kind)}>
              <Stepper
                label={`${text.repsMin} ${text.repsOf(kind).toLowerCase()}`}
                value={draft.repsMin}
                min={1}
                max={maxRepsFor(measure)}
                step={repsStep(measure)}
                onChange={(value) => change(adjustReps(draft, 'repsMin', value))}
              />
              <Stepper
                label={`${text.repsMax} ${text.repsOf(kind).toLowerCase()}`}
                value={draft.repsMax}
                min={1}
                max={maxRepsFor(measure)}
                step={repsStep(measure)}
                onChange={(value) => change(adjustReps(draft, 'repsMax', value))}
              />
            </ControlRow>
            {hasLoad && (
              <ControlRow label={text.load}>
                <Stepper
                  label={text.load}
                  value={gramsToKg(draft.loadG)}
                  min={0}
                  max={MAX_LOAD_G / 1000}
                  step={item.exercise.loadStepG / 1000}
                  format={formatKg}
                  onChange={(kg) => change({ loadG: kgToGrams(kg) })}
                />
              </ControlRow>
            )}
            <ControlRow label={text.rest}>
              <Stepper label={text.rest} value={draft.restS} min={0} max={900} step={REST_STEP_S} format={(s) => `${s} s`} onChange={(restS) => change({ restS })} />
            </ControlRow>
          </div>
          <SegmentedControl
            label={text.method}
            options={METHODS.map((m) => ({ value: m, label: strings.training.methods[m] }))}
            value={draft.method}
            onChange={(method: Method) => change({ method })}
          />
          <div className="workout-controls">
            <SegmentedControl
              label={text.target}
              options={[
                { value: 'none', label: text.targetNone },
                { value: 'rir', label: strings.training.targetKinds.rir },
                { value: 'pse', label: strings.training.targetKinds.pse },
              ]}
              value={draft.targetKind ?? 'none'}
              onChange={(value) => change(value === 'none' ? { targetKind: null, targetValue: null } : { targetKind: value, targetValue: draft.targetValue ?? 2 })}
            />
            {draft.targetKind && (
              <Stepper label={text.targetValue} value={draft.targetValue ?? 2} min={0} max={10} onChange={(targetValue) => change({ targetKind: draft.targetKind, targetValue })} />
            )}
          </div>
          <Field label={text.notes} value={draft.notes} maxLength={300} onChange={(event) => change({ notes: event.target.value })} />
          <div className="row">
            <IconButton icon="chevron-up" label={text.moveUp} disabled={!upIds} onClick={() => reorder(upIds)} />
            <IconButton icon="chevron-down" label={text.moveDown} disabled={!downIds} onClick={() => reorder(downIds)} />
            {next && (
              <Button variant="secondary" onClick={() => void run(backend.command('prescribed.group', { ids: [item.id, next.id], kind: 'bi_set' }))}>
                {text.groupWithNext}
              </Button>
            )}
            {item.groupId && groupSize < 4 && item.groupKind !== 'circuit' && (
              <Button variant="secondary" onClick={() => void run(backend.command('prescribed.group', { ids: groupMembers, kind: 'circuit' }))}>
                {text.makeCircuit}
              </Button>
            )}
            {item.groupId && (
              <Button variant="secondary" onClick={() => void run(backend.command('prescribed.ungroup', { groupId: item.groupId! }))}>
                {text.ungroup}
              </Button>
            )}
            <Button variant="secondary-danger" onClick={() => setRemoving(true)}>
              {text.remove}
            </Button>
          </div>
        </div>
      )}
      {removing && (
        <ConfirmDialog
          title={text.remove}
          confirmLabel={text.remove}
          onCancel={() => setRemoving(false)}
          onConfirm={() => {
            setRemoving(false);
            void run(backend.command('prescribed.remove', { id: item.id }));
          }}
        >
          {text.removeConfirm(item.exercise.name)}
        </ConfirmDialog>
      )}
    </li>
  );
}

function ControlRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="control-row">
      <span className="control-label">{label}</span>
      <div className="control-steppers">{children}</div>
    </div>
  );
}
