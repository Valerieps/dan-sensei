import { useState, type FormEvent } from 'react';
import type { LessonOutcome, PackageSummary, RegisterClassResult } from '../../application/api-contract';
import { dataEmSaoPaulo } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { SelectField } from '../components/SelectField';
import { Link } from '../router';
import { useQuery } from '../use-query';

const NONE = 'none';

/** What the app warns about before the lesson is saved, from the student's live package. */
function warningFor(packages: readonly PackageSummary[] | undefined, outcome: LessonOutcome): string | null {
  if (!packages || outcome === 'missed_waived') return null;
  const t = strings.packages.lesson;
  const live = packages.find((p) => p.status !== 'encerrado');
  if (!live) return t.warnNoPackage;
  if (live.status === 'esgotado') return t.warnExhausted;
  if (live.status === 'vencido') return t.warnExpired;
  if (live.paymentStatus === 'pending') return t.warnPending;
  return null;
}

/** Records a lesson given or an absence for one student or a pair (phase 1a, before the agenda). */
export function RegisterLesson({ studentId = '' }: { studentId?: string }) {
  const { backend } = useServices();
  const t = strings.packages.lesson;
  const students = useQuery('students', {}, ['students']);
  const [first, setFirst] = useState(studentId);
  const [second, setSecond] = useState('');
  const [date, setDate] = useState(dataEmSaoPaulo(new Date()));
  const [outcome, setOutcome] = useState<LessonOutcome>('given');
  const [choice, setChoice] = useState<string>();
  const [result, setResult] = useState<RegisterClassResult>();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const firstPackages = useQuery('studentPackages', { studentId: first }, ['packages', 'payments', 'classes']);

  if (!students.data) return students.error ? <Notice tone="error">{strings.genericError}</Notice> : null;
  const eligible = students.data.filter((s) => s.billing === 'package');
  if (eligible.length === 0) {
    return (
      <section>
        <h1>{t.title}</h1>
        <EmptyState action={<Link className="button" to="/alunos/novo">{strings.students.newTitle}</Link>}>{t.noStudents}</EmptyState>
      </section>
    );
  }

  const today = dataEmSaoPaulo(new Date());
  const choices = result && !result.registered ? result.choose : null;
  const warning = first ? warningFor(firstPackages.error ? undefined : firstPackages.data, outcome) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!first || !date) return;
    setFailed(false);
    setBusy(true);
    const answer = await backend.command('class.register', {
      date,
      outcome,
      studentIds: second ? [first, second] : [first],
      ...(choice === undefined ? {} : { packageId: choice === NONE ? null : choice }),
    });
    setBusy(false);
    if (!answer.ok) {
      setFailed(true);
      return;
    }
    setResult(answer.value);
    if (answer.value.registered) setChoice(undefined);
  }

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setResult(undefined);
      setChoice(undefined);
    };
  }

  return (
    <section>
      <h1>{t.title}</h1>
      <form className="stack" onSubmit={submit}>
        <SelectField label={t.student} required value={first} onChange={(e) => change(setFirst)(e.target.value)}>
          <option value="">{t.none}</option>
          {eligible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label={t.second} value={second} onChange={(e) => change(setSecond)(e.target.value)}>
          <option value="">{t.noSecond}</option>
          {eligible
            .filter((s) => s.id !== first)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </SelectField>
        <div className="row end">
          <Field className="grow" label={t.date} type="date" required max={today} value={date} onChange={(e) => change(setDate)(e.target.value)} />
          <SelectField className="grow" label={t.outcome} value={outcome} onChange={(e) => change(setOutcome)(e.target.value as LessonOutcome)}>
            {(Object.keys(strings.packages.tab.outcome) as LessonOutcome[]).map((o) => (
              <option key={o} value={o}>
                {strings.packages.tab.outcome[o]}
              </option>
            ))}
          </SelectField>
        </div>

        {warning && !result && <Notice>{warning}</Notice>}

        {choices && (
          <fieldset className="addresses">
            <legend className="field-label">{t.chooseTitle}</legend>
            <p className="muted">{t.chooseHint}</p>
            {choices.map((p) => (
              <label key={p.id} className="row">
                <input type="radio" name="package" checked={choice === p.id} onChange={() => setChoice(p.id)} />
                {t.chooseOption(p.holderName, p.planName, p.remaining)}
              </label>
            ))}
            <label className="row">
              <input type="radio" name="package" checked={choice === NONE} onChange={() => setChoice(NONE)} />
              {t.chooseNone}
            </label>
          </fieldset>
        )}

        {result?.registered && (
          <>
            <Notice>{t.saved}</Notice>
            {result.withoutPackage && <Notice>{t.reason[result.withoutPackage]}</Notice>}
            {result.pendingPayment && <Notice>{t.pendingPayment}</Notice>}
          </>
        )}
        {failed && <Notice tone="error">{strings.genericError}</Notice>}

        <div className="row">
          <Button type="submit" disabled={busy || !first || (choices !== null && choice === undefined)}>
            {t.submit}
          </Button>
          {first && (
            <Link className="button secondary" to={`/alunos/${first}/pacotes`}>
              {strings.back}
            </Link>
          )}
        </div>
      </form>
    </section>
  );
}
