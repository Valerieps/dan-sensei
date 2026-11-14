import { useState, type FormEvent } from 'react';
import { diaDaSemana, DURACAO_MAXIMA_MIN } from '../../domain/agenda';
import { dataEmSaoPaulo } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { SelectField } from '../components/SelectField';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';

type Kind = 'oneOff' | 'fixed';

/** "Nova aula": a one-off lesson or a fixed weekly time (docs/spec/agenda.md). */
export function NewClass({ date: initialDate, time: initialTime }: { date?: string; time?: string }) {
  const { backend } = useServices();
  const f = strings.agenda.form;
  const today = dataEmSaoPaulo(new Date());
  const students = useQuery('students', {}, ['students']);
  const fixedTimes = useQuery('recurrences', {}, ['classes', 'students']);
  const [kind, setKind] = useState<Kind>('oneOff');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [date, setDate] = useState(initialDate && initialDate >= today ? initialDate : today);
  const [weekday, setWeekday] = useState(String(diaDaSemana(date)));
  const [time, setTime] = useState(initialTime ?? '07:00');
  const [duration, setDuration] = useState(String(DURACAO_MAXIMA_MIN));
  const [addressId, setAddressId] = useState('');
  const [startsOn, setStartsOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [savedFixed, setSavedFixed] = useState(false);

  if (!students.data) return students.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />;
  const eligible = students.data.filter((s) => s.status !== 'inactive');
  if (eligible.length === 0) {
    return (
      <section>
        <h1>{f.title}</h1>
        <EmptyState action={<Link className="button" to="/alunos/novo">{strings.students.newTitle}</Link>}>{f.noStudents}</EmptyState>
      </section>
    );
  }

  const student = eligible.find((s) => s.id === first);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!first) return;
    setFailed(false);
    setSavedFixed(false);
    setBusy(true);
    const common = { studentIds: second ? [first, second] : [first], time, durationMin: Number(duration), addressId: addressId || null };
    if (kind === 'oneOff') {
      const result = await backend.command('class.schedule', { ...common, date });
      setBusy(false);
      if (result.ok) navigate(`/agenda/${date}`);
      else setFailed(true);
      return;
    }
    const result = await backend.command('recurrence.create', { ...common, weekday: Number(weekday), startsOn });
    setBusy(false);
    if (result.ok) {
      setSavedFixed(true);
      fixedTimes.reload();
    } else {
      setFailed(true);
    }
  }

  async function endFixed(id: string, line: string) {
    if (!window.confirm(f.fixedEndConfirm(line))) return;
    const result = await backend.command('recurrence.end', { id, endsOn: today });
    setFailed(!result.ok);
    if (result.ok) fixedTimes.reload();
  }

  return (
    <section>
      <h1>{f.title}</h1>
      <form className="stack" onSubmit={submit}>
        <fieldset className="addresses">
          <legend className="field-label">{f.kind}</legend>
          <label className="row tight">
            <input type="radio" name="kind" checked={kind === 'oneOff'} onChange={() => setKind('oneOff')} />
            {f.oneOff}
          </label>
          <label className="row tight">
            <input type="radio" name="kind" checked={kind === 'fixed'} onChange={() => setKind('fixed')} />
            {f.fixed}
          </label>
        </fieldset>

        <SelectField
          label={f.student}
          required
          value={first}
          onChange={(e) => {
            setFirst(e.target.value);
            setAddressId('');
            if (second === e.target.value) setSecond('');
          }}
        >
          <option value="">{f.pick}</option>
          {eligible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label={f.second} value={second} onChange={(e) => setSecond(e.target.value)}>
          <option value="">{f.noSecond}</option>
          {eligible
            .filter((s) => s.id !== first)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </SelectField>

        <div className="row end">
          {kind === 'oneOff' ? (
            <Field className="grow" label={f.date} type="date" required min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          ) : (
            <SelectField className="grow" label={f.weekday} value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {strings.agenda.weekdays[d]}
                </option>
              ))}
            </SelectField>
          )}
          <Field className="grow" label={f.time} type="time" required step={900} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="row end">
          <Field className="grow" label={f.duration} type="number" inputMode="numeric" min={1} max={DURACAO_MAXIMA_MIN} required value={duration} onChange={(e) => setDuration(e.target.value)} />
          {kind === 'fixed' && <Field className="grow" label={f.startsOn} type="date" min={today} value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />}
        </div>

        {student && student.addresses.length > 0 && (
          <SelectField label={f.address} value={addressId} onChange={(e) => setAddressId(e.target.value)}>
            <option value="">{f.defaultAddress}</option>
            {student.addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.label} · {address.address}
              </option>
            ))}
          </SelectField>
        )}

        {savedFixed && <Notice>{f.savedFixed}</Notice>}
        {failed && <Notice tone="error">{f.failed}</Notice>}
        <div className="row">
          <Button type="submit" disabled={busy || !first}>
            {kind === 'oneOff' ? f.save : f.saveFixed}
          </Button>
          <Link className="button secondary" to={`/agenda/${initialDate ?? today}`}>
            {strings.back}
          </Link>
        </div>
      </form>

      <h2 className="spaced">{f.fixedTitle}</h2>
      {fixedTimes.data?.length === 0 && <p className="muted">{f.fixedEmpty}</p>}
      <ul className="list">
        {fixedTimes.data?.map((r) => {
          const line = f.fixedLine(strings.agenda.weekdays[r.weekday] ?? '', r.time, r.studentNames.join(strings.agenda.and));
          return (
            <li key={r.id} className="card row">
              <span className="grow">{line}</span>
              <Button variant="secondary-danger" onClick={() => void endFixed(r.id, line)}>
                {f.fixedEnd}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
