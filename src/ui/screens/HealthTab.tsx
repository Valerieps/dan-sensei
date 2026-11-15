import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { HealthAlertView, StudentHealth, StudentView } from '../../application/api-contract';
import { dataEmSaoPaulo, formatarData } from '../../domain/pacotes';
import { MAX_SECONDARY_GOALS, parqNeedsClearance, PARQ_QUESTION_COUNT, TERM_VERSION } from '../../domain/saude/saude';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/Controls';
import { Field } from '../components/Field';
import { ListContent, ListRow, ListSection } from '../components/GroupedList';
import { HealthAlerts } from '../components/HealthAlerts';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { SelectField } from '../components/SelectField';
import { Sheet } from '../components/Sheet';
import { SignaturePad } from '../components/SignaturePad';
import { useQuery } from '../use-query';

const t = strings.health;
const dateOf = (iso: string) => formatarData(dataEmSaoPaulo(iso));

type Panel = { kind: 'term' } | { kind: 'parq' } | { kind: 'alert'; alert?: HealthAlertView };

/** "Saúde" in the profile: the term, the PAR-Q, the objectives and the health alerts. */
export function HealthTab({ student }: { student: StudentView }) {
  const health = useQuery('studentHealth', { studentId: student.id }, ['students']);
  const [panel, setPanel] = useState<Panel>();
  if (!health.data) return health.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />;
  const data = health.data;
  const signed = data.consent !== null;
  const outdated = signed && data.consent!.version < TERM_VERSION;

  return (
    <>
      <ListSection header={t.consent.title} footer={signed ? undefined : t.needTerm}>
        <ListRow
          title={signed ? t.consent.signedOn(dateOf(data.consent!.signedAt), data.consent!.version) : t.consent.notSigned}
          subtitle={outdated ? t.consent.outdated : undefined}
          action={!signed || outdated}
          onClick={!signed || outdated ? () => setPanel({ kind: 'term' }) : undefined}
          trailing={!signed || outdated ? <span className="strong">{signed ? t.consent.collectAgain : t.consent.collect}</span> : undefined}
        />
      </ListSection>

      {signed && (
        <>
          <ListSection header={t.alerts.title}>
            {data.alerts.length === 0 && <ListContent><p className="muted">{t.alerts.none}</p></ListContent>}
            {data.alerts.map((alert) => (
              <ListRow key={alert.id} title={<HealthAlerts alerts={[{ ...alert, note: '' }]} />} subtitle={alert.note || undefined} onClick={() => setPanel({ kind: 'alert', alert })} />
            ))}
            <ListRow title={t.alerts.add} action onClick={() => setPanel({ kind: 'alert' })} />
          </ListSection>

          <ListSection header={t.parq.title}>
            <ListRow
              title={data.parq ? t.parq.answeredOn(dateOf(data.parq.answeredAt)) : t.parq.notAnswered}
              subtitle={data.parq && parqNeedsClearance(data.parq.answers) ? t.parq.clearance : undefined}
              onClick={() => setPanel({ kind: 'parq' })}
              trailing={<span className="strong">{data.parq ? t.parq.answerAgain : t.parq.answer}</span>}
            />
          </ListSection>

          <Goals studentId={student.id} data={data} />
        </>
      )}

      {panel?.kind === 'term' && <TermSheet studentId={student.id} onClose={() => setPanel(undefined)} />}
      {panel?.kind === 'parq' && <ParqSheet studentId={student.id} onClose={() => setPanel(undefined)} />}
      {panel?.kind === 'alert' && <AlertSheet studentId={student.id} data={data} alert={panel.alert} onClose={() => setPanel(undefined)} />}
    </>
  );
}

/** The term, read by scrolling to the end, then signed on the iPad. */
function TermSheet({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { backend } = useServices();
  const [read, setRead] = useState(false);
  const [signed, setSigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const text = useRef<HTMLDivElement>(null);
  const pad = useRef<{ toDataUrl: () => string; clear: () => void } | null>(null);

  function check() {
    const el = text.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) setRead(true);
  }
  useEffect(check, []);

  async function save() {
    if (!pad.current) return;
    setBusy(true);
    setFailed(false);
    const result = await backend.command('consent.sign', { studentId, version: TERM_VERSION, signature: pad.current.toDataUrl() });
    setBusy(false);
    if (result.ok) onClose();
    else setFailed(true);
  }

  return (
    <Sheet title={t.consent.title} detent="large" onClose={onClose} onSave={() => void save()} saveLabel={t.consent.sign} saveDisabled={!read || !signed || busy}>
      <div className="stack">
        <div ref={text} className="term-text" tabIndex={0} onScroll={check}>
          {t.consent.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {!read && <p className="muted small">{t.consent.readAll}</p>}
        {read && (
          <>
            <p className="strong">{t.consent.signHere}</p>
            <SignaturePad onChange={setSigned} controls={pad} />
            <div className="row">
              <Button variant="secondary" disabled={!signed} onClick={() => pad.current?.clear()}>
                {t.consent.clear}
              </Button>
            </div>
          </>
        )}
        {failed && <Notice tone="error">{t.consent.failed}</Notice>}
      </div>
    </Sheet>
  );
}

/** The seven PAR-Q questions as a list of yes/no. */
function ParqSheet({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { backend } = useServices();
  const [answers, setAnswers] = useState<(boolean | null)[]>(Array(PARQ_QUESTION_COUNT).fill(null));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save() {
    if (answers.some((a) => a === null)) return setError(t.parq.allAnswered);
    setBusy(true);
    const result = await backend.command('parq.save', { studentId, answers: answers as boolean[] });
    setBusy(false);
    if (result.ok) onClose();
    else setError(t.failed);
  }

  return (
    <Sheet title={t.parq.title} detent="large" onClose={onClose} onSave={() => void save()} saveDisabled={busy}>
      <div className="stack">
        <p className="muted">{t.parq.intro}</p>
        {t.parq.questions.map((question, i) => (
          <div key={question} className="parq-question">
            <p>{question}</p>
            <SegmentedControl
              label={question}
              options={[
                { value: 'yes', label: t.parq.yes },
                { value: 'no', label: t.parq.no },
              ]}
              value={answers[i] === null ? '' : answers[i] ? 'yes' : 'no'}
              onChange={(value) => setAnswers(answers.map((a, j) => (j === i ? value === 'yes' : a)))}
            />
          </div>
        ))}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Sheet>
  );
}

const NEW_CONDITION = '__new__';

/** Marks an alert from the list of conditions, with a note; edits or removes an existing one. */
function AlertSheet({ studentId, data, alert, onClose }: { studentId: string; data: StudentHealth; alert?: HealthAlertView; onClose: () => void }) {
  const { backend } = useServices();
  const [conditionId, setConditionId] = useState(alert?.conditionId ?? '');
  const [newName, setNewName] = useState('');
  const [note, setNote] = useState(alert?.note ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const free = data.conditions.filter((c) => c.id === alert?.conditionId || !data.alerts.some((a) => a.conditionId === c.id));

  async function save() {
    setError(undefined);
    let id = conditionId;
    if (!id) return setError(t.alerts.pick);
    setBusy(true);
    if (id === NEW_CONDITION) {
      const created = await backend.command('condition.create', { name: newName });
      if (!created.ok) {
        setBusy(false);
        return setError(created.error === 'conflict' ? t.alerts.conditionTaken : t.alerts.invalid);
      }
      id = created.value.id;
    }
    const result = await backend.command('alert.set', { studentId, conditionId: id, note });
    setBusy(false);
    if (result.ok) onClose();
    else setError(result.error === 'invalid' ? t.alerts.invalid : t.failed);
  }

  async function remove() {
    if (!alert) return;
    setBusy(true);
    const result = await backend.command('alert.remove', { studentId, conditionId: alert.conditionId });
    setBusy(false);
    if (result.ok) onClose();
    else setError(t.failed);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void save();
  }

  return (
    <Sheet title={alert ? t.alerts.edit(alert.label) : t.alerts.add} onClose={onClose} onSave={() => void save()} saveDisabled={busy}>
      <form className="stack" onSubmit={submit} noValidate>
        {!alert && (
          <SelectField label={t.alerts.condition} value={conditionId} onChange={(e) => setConditionId(e.target.value)}>
            <option value="" />
            {free.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CONDITION}>{t.alerts.newCondition}</option>
          </SelectField>
        )}
        {conditionId === NEW_CONDITION && <Field label={t.alerts.newConditionName} value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} />}
        <Field label={t.alerts.note} placeholder={t.alerts.notePlaceholder} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        {error && <Notice tone="error">{error}</Notice>}
        {alert && (
          <div className="row">
            <Button variant="secondary" disabled={busy} onClick={() => void remove()}>
              {t.alerts.remove}
            </Button>
          </div>
        )}
      </form>
    </Sheet>
  );
}

/** One main objective and up to three secondary ones. */
function Goals({ studentId, data }: { studentId: string; data: StudentHealth }) {
  const { backend } = useServices();
  const [main, setMain] = useState(data.mainGoal);
  const [others, setOthers] = useState<string[]>(() => Array.from({ length: MAX_SECONDARY_GOALS }, (_, i) => data.secondaryGoals[i] ?? ''));
  const [state, setState] = useState<'idle' | 'saved' | 'invalid' | 'failed'>('idle');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await backend.command('anamnesis.save', { studentId, main, secondary: others });
    setState(result.ok ? 'saved' : result.error === 'invalid' ? 'invalid' : 'failed');
  }

  return (
    <form className="stack" onSubmit={submit}>
      <ListSection header={t.goals.title}>
        <ListContent>
          <div className="stack">
            <Field label={t.goals.main} value={main} maxLength={120} onChange={(e) => { setMain(e.target.value); setState('idle'); }} />
            {others.map((goal, i) => (
              <Field key={i} label={t.goals.secondary(i + 1)} value={goal} maxLength={120} onChange={(e) => { setOthers(others.map((g, j) => (j === i ? e.target.value : g))); setState('idle'); }} />
            ))}
          </div>
        </ListContent>
      </ListSection>
      {state === 'invalid' && <Notice tone="error">{t.goals.invalid}</Notice>}
      {state === 'failed' && <Notice tone="error">{t.failed}</Notice>}
      {state === 'saved' && <Notice>{t.goals.saved}</Notice>}
      <div className="row">
        <Button type="submit">{t.goals.save}</Button>
      </div>
    </form>
  );
}
