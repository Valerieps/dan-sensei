import { useState } from 'react';
import type { AbsenceDecision, AgendaClass, CancelClassResult, PackageSummary, RegisterClassResult } from '../../application/api-contract';
import { ANTECEDENCIA_MINIMA_H, horasDeAntecedencia } from '../../domain/agenda';
import { dataEmSaoPaulo, formatarData } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button } from '../components/Button';
import { classNames, classStatusText } from '../components/class-text';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { ChoiceField } from '../components/RouteSheet';
import { Sheet } from '../components/Sheet';

type Mode = 'menu' | 'cancel' | 'missed';
const NONE = 'none';

type Outcome =
  | { kind: 'done'; message: string; extra?: string }
  | { kind: 'choose'; packages: readonly PackageSummary[] }
  | { kind: 'decide'; suggested: AbsenceDecision };

type Attempt = { ok: true; value: Outcome } | { ok: false };

function fromRegister(result: RegisterClassResult, done: string): Outcome {
  if (!result.registered) return { kind: 'choose', packages: result.choose };
  return { kind: 'done', message: done, extra: result.pendingPayment ? strings.agenda.sheet.pendingPayment : undefined };
}

function fromCancel(result: CancelClassResult): Outcome {
  const t = strings.agenda.sheet;
  if (result.done) {
    if (result.status === 'cancelled') return { kind: 'done', message: t.cancelled };
    return { kind: 'done', message: result.charged ? t.cancelledCharged : t.cancelledWaived };
  }
  if ('needsDecision' in result) return { kind: 'decide', suggested: result.suggested };
  return { kind: 'choose', packages: result.choose };
}

interface ClassSheetProps {
  readonly lesson: AgendaClass;
  /** Where the lesson was dropped: the reschedule form opens filled in. */
  readonly initial?: { readonly date: string; readonly time: string };
  /** Opens straight on the absence step (the "Falta" swipe action). */
  readonly startMissed?: boolean;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

/**
 * What one lesson of the agenda offers: reschedule (a date, a time and the scope: 3 taps from the
 * lesson), mark as given, register an absence, cancel and confirm. Opened by tapping the lesson,
 * or by dropping it somewhere (`initial`).
 */
export function ClassSheet({ lesson, initial, startMissed = false, onClose, onChanged }: ClassSheetProps) {
  const { backend } = useServices();
  const t = strings.agenda.sheet;
  const [mode, setMode] = useState<Mode>(startMissed ? 'missed' : 'menu');
  const [date, setDate] = useState(initial?.date ?? lesson.date);
  const [time, setTime] = useState(initial?.time ?? lesson.time);
  const [scope, setScope] = useState<'this' | 'following'>('this');
  const [byTrainer, setByTrainer] = useState(false);
  const [decision, setDecision] = useState<AbsenceDecision>('charge');
  const [choose, setChoose] = useState<readonly PackageSummary[] | null>(null);
  const [choice, setChoice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<{ message: string; extra?: string }>();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const today = dataEmSaoPaulo(new Date());
  const scheduled = lesson.status === 'scheduled';
  const late = horasDeAntecedencia(lesson.startsAt, new Date()) < ANTECEDENCIA_MINIMA_H;
  const askDecision = mode === 'missed' || (mode === 'cancel' && !byTrainer && late);
  const packageId = choice === undefined ? {} : { packageId: choice === NONE ? null : choice };
  const dateChanged = date !== lesson.date || time !== lesson.time;

  async function run(call: () => Promise<Attempt>) {
    setBusy(true);
    setFailed(false);
    const result = await call();
    setBusy(false);
    setConfirmingCancel(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    const outcome = result.value;
    if (outcome.kind === 'done') {
      setDone(outcome);
      setChoose(null);
      onChanged();
    } else if (outcome.kind === 'choose') {
      setChoose(outcome.packages);
    } else {
      setMode('cancel');
      setDecision(outcome.suggested);
    }
  }

  const reschedule = () =>
    run(async () => {
      const result = await backend.command('class.reschedule', { classId: lesson.id, date, time, scope });
      return result.ok ? { ok: true, value: { kind: 'done', message: t.done } } : { ok: false };
    });

  const complete = () =>
    run(async () => {
      const result = await backend.command('class.complete', { classId: lesson.id, ...packageId });
      return result.ok ? { ok: true, value: fromRegister(result.value, t.completed) } : { ok: false };
    });

  const missed = () =>
    run(async () => {
      const result = await backend.command('class.markMissed', { classId: lesson.id, decision, ...packageId });
      return result.ok ? { ok: true, value: fromRegister(result.value, decision === 'charge' ? t.cancelledCharged : t.cancelledWaived) } : { ok: false };
    });

  const cancel = () =>
    run(async () => {
      const result = await backend.command('class.cancel', { classId: lesson.id, byTrainer, ...(askDecision ? { decision } : {}), ...packageId });
      return result.ok ? { ok: true, value: fromCancel(result.value) } : { ok: false };
    });

  async function setConfirmed(confirmed: boolean) {
    setBusy(true);
    const result = await backend.command('class.confirm', { classId: lesson.id, confirmed });
    setBusy(false);
    setFailed(!result.ok);
    if (result.ok) {
      onChanged();
      onClose();
    }
  }

  function backToMenu() {
    setMode('menu');
    setChoose(null);
    setChoice(undefined);
    setFailed(false);
  }

  return (
    <Sheet title={t.title(classNames(lesson))} detent="large" onClose={onClose}>
      <div className="stack">
        <p className="strong">
          {classStatusText(lesson)} · {t.when(formatarData(lesson.date), lesson.time, lesson.durationMin)}
        </p>
        <p className="muted small">{lesson.address ? t.address(lesson.address) : t.noAddress}</p>
        {lesson.recurrenceId && <p className="muted small">{strings.agenda.fixedTime}</p>}

        {done && (
          <>
            <Notice>{done.message}</Notice>
            {done.extra && <Notice>{done.extra}</Notice>}
            <div className="row">
              <Button onClick={onClose}>{t.close}</Button>
            </div>
          </>
        )}

        {!done && scheduled && mode === 'menu' && (
          <div className="stack">
            <h3>{t.rescheduleTitle}</h3>
            <div className="row end">
              <Field className="grow" label={t.date} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
              <Field className="grow" label={t.time} type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            {lesson.recurrenceId && (
              <ChoiceField
                label={t.scope}
                options={[
                  { value: 'this', label: t.scopeThis },
                  { value: 'following', label: t.scopeFollowing },
                ]}
                value={scope}
                onChange={setScope}
              />
            )}
            {failed && <Notice tone="error">{t.failed}</Notice>}
            <div className="row">
              <Button disabled={busy || !date || !time || !dateChanged} onClick={() => void reschedule()}>
                {initial ? t.confirmDrop(time) : t.reschedule}
              </Button>
            </div>
            <div className="row">
              {lesson.date <= today && (
                <>
                  <Button variant="secondary" disabled={busy} onClick={() => void complete()}>
                    {t.complete}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setMode('missed')}>
                    {t.missed}
                  </Button>
                </>
              )}
              <Button variant="secondary" disabled={busy} onClick={() => void setConfirmed(!lesson.confirmed)}>
                {lesson.confirmed ? t.unconfirm : t.confirm}
              </Button>
              <Button variant="secondary-danger" disabled={busy} onClick={() => setMode('cancel')}>
                {t.cancel}
              </Button>
            </div>
            {choose && <PackageChoice packages={choose} choice={choice} onChoice={setChoice} onConfirm={() => void complete()} busy={busy} />}
          </div>
        )}

        {!done && scheduled && mode !== 'menu' && (
          <div className="stack">
            {mode === 'cancel' && (
              <>
                <ChoiceField
                  label={t.cancelWho}
                  options={[
                    { value: 'student', label: t.cancelByStudent },
                    { value: 'trainer', label: t.cancelByTrainer },
                  ]}
                  value={byTrainer ? 'trainer' : 'student'}
                  onChange={(who) => setByTrainer(who === 'trainer')}
                />
                {byTrainer && <p className="muted small">{t.cancelByTrainerHint}</p>}
              </>
            )}
            {askDecision && (
              <ChoiceField
                label={mode === 'missed' ? t.missedTitle : t.lateTitle}
                options={[
                  { value: 'charge', label: t.charge },
                  { value: 'waive', label: t.waive },
                ]}
                value={decision}
                onChange={setDecision}
              />
            )}
            {choose && <PackageChoice packages={choose} choice={choice} onChoice={setChoice} />}
            {failed && <Notice tone="error">{t.failed}</Notice>}
            <div className="row">
              <Button
                variant={mode === 'cancel' ? 'danger' : 'primary'}
                disabled={busy || (choose !== null && choice === undefined)}
                onClick={() => (mode === 'cancel' ? setConfirmingCancel(true) : void missed())}
              >
                {mode === 'cancel' ? t.confirmCancel : t.confirmMissed}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={backToMenu}>
                {strings.back}
              </Button>
            </div>
          </div>
        )}
      </div>
      {confirmingCancel && (
        <ConfirmDialog title={t.cancel} confirmLabel={t.confirmCancel} busy={busy} onCancel={() => setConfirmingCancel(false)} onConfirm={() => void cancel()}>
          {t.cancelConfirmBody}
        </ConfirmDialog>
      )}
    </Sheet>
  );
}

/** The packages a charged lesson may draw from, when the app cannot pick one alone. */
function PackageChoice({ packages, choice, onChoice, onConfirm, busy }: { packages: readonly PackageSummary[]; choice: string | undefined; onChoice: (id: string) => void; onConfirm?: () => void; busy?: boolean }) {
  const t = strings.agenda.sheet;
  return (
    <fieldset className="addresses">
      <legend className="field-label">{t.choosePackage}</legend>
      {packages.map((p) => (
        <label key={p.id} className="row tight">
          <input type="radio" name="package" checked={choice === p.id} onChange={() => onChoice(p.id)} />
          {t.packageOption(p.holderName, p.planName, p.remaining)}
        </label>
      ))}
      <label className="row tight">
        <input type="radio" name="package" checked={choice === NONE} onChange={() => onChoice(NONE)} />
        {t.chooseNone}
      </label>
      {onConfirm && (
        <div className="row">
          <Button disabled={busy || choice === undefined} onClick={onConfirm}>
            {t.complete}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
