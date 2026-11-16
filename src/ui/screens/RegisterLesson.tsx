import { useState, type FormEvent, type ReactNode } from 'react';
import type { LessonOutcome, PackageSummary, RegisterClassResult } from '../../application/api-contract';
import { dataEmSaoPaulo } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Loading } from '../components/Loading';
import { ButtonLink } from '../components/Button';
import { Notice } from '../components/Notice';
import { ChoiceField, RouteSheet } from '../components/RouteSheet';
import { SelectField } from '../components/SelectField';
import { useQuery } from '../use-query';

const NONE = 'none';
const FORM_ID = 'lesson-form';

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
export function RegisterLesson({ studentId = '', behind }: { studentId?: string; behind?: ReactNode }) {
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

  const choices = result && !result.registered ? result.choose : null;
  const sheet = (children: ReactNode, saveable = false) => (
    <RouteSheet title={t.title} back={studentId ? `/alunos/${studentId}/pacotes` : '/'} behind={behind} formId={saveable ? FORM_ID : undefined} busy={busy} saveDisabled={!first || (choices !== null && choice === undefined)}>
      {children}
    </RouteSheet>
  );

  if (!students.data) return sheet(students.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />);
  const eligible = students.data.filter((s) => s.billing === 'package');
  if (eligible.length === 0) {
    return sheet(<EmptyState action={<ButtonLink to="/alunos/novo">{strings.students.newTitle}</ButtonLink>}>{t.noStudents}</EmptyState>);
  }

  const today = dataEmSaoPaulo(new Date());
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

  return sheet(
      <form id={FORM_ID} className="stack" onSubmit={submit}>
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
        </div>
        <ChoiceField
          label={t.outcome}
          options={(Object.keys(strings.packages.tab.outcome) as LessonOutcome[]).map((o) => ({ value: o, label: strings.packages.tab.outcome[o] }))}
          value={outcome}
          onChange={change(setOutcome)}
        />

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

      </form>,
    true,
  );
}
