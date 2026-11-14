import { useEffect, useState, type FormEvent } from 'react';
import type { StudentView } from '../../application/api-contract';
import { initials, NOTES_MAX_LENGTH } from '../../domain/alunos/student';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';
import { StudentForm } from './StudentForm';

/** Tabs of the profile. The next sessions add Pacotes e pagamentos (and later Treinos, Histórico) here. */
export type ProfileTab = 'registration' | 'notes';

const TABS: { tab: ProfileTab; label: string; path: (id: string) => string }[] = [
  { tab: 'registration', label: strings.students.tabs.registration, path: (id) => `/alunos/${id}` },
  { tab: 'notes', label: strings.students.tabs.notes, path: (id) => `/alunos/${id}/notas` },
];

export function NewStudent() {
  return (
    <section>
      <h1>{strings.students.newTitle}</h1>
      <StudentForm onSaved={(student) => navigate(`/alunos/${student.id}`)} />
    </section>
  );
}

export function StudentProfile({ id, tab }: { id: string; tab: ProfileTab }) {
  const student = useQuery('student', { id }, ['students']);

  if (student.error === 'not_found') {
    return (
      <section>
        <Notice tone="error">{strings.students.notFound}</Notice>
        <Link to="/">{strings.students.back}</Link>
      </section>
    );
  }
  if (!student.data) return student.error ? <Notice tone="error">{strings.genericError}</Notice> : null;

  const data = student.data;
  return (
    <section>
      <header className="row profile-header">
        <span className="initials large" aria-hidden="true">
          {initials(data.name)}
        </span>
        <div className="grow">
          <h1>{data.name}</h1>
          <span className="muted small">
            {strings.students.billing[data.billing]} · {strings.students.status[data.status]}
          </span>
        </div>
      </header>
      <nav className="row tabs" aria-label={strings.students.tabs.label}>
        {TABS.map((t) => (
          <Link key={t.tab} to={t.path(id)} aria-current={t.tab === tab ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === 'registration' ? <Registration student={data} /> : <Notes student={data} />}
    </section>
  );
}

function Registration({ student }: { student: StudentView }) {
  const { backend } = useServices();
  const [failed, setFailed] = useState(false);

  async function setStatus(status: StudentView['status']) {
    const result = await backend.command('student.setStatus', { id: student.id, status });
    setFailed(!result.ok);
  }

  async function deactivate() {
    if (window.confirm(strings.students.deactivateConfirm(student.name))) await setStatus('inactive');
  }

  return (
    <>
      <StudentForm key={student.id} student={student} onSaved={() => undefined} />
      <h2 className="spaced">{strings.students.status[student.status]}</h2>
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      <div className="row">
        {student.status === 'active' && (
          <Button variant="secondary" onClick={() => void setStatus('paused')}>
            {strings.students.pause}
          </Button>
        )}
        {student.status === 'paused' && (
          <Button variant="secondary" onClick={() => void setStatus('active')}>
            {strings.students.unpause}
          </Button>
        )}
        {student.status === 'inactive' ? (
          <Button variant="secondary" onClick={() => void setStatus('active')}>
            {strings.students.reactivate}
          </Button>
        ) : (
          <Button variant="secondary-danger" onClick={() => void deactivate()}>
            {strings.students.deactivate}
          </Button>
        )}
      </div>
    </>
  );
}

function Notes({ student }: { student: StudentView }) {
  const { backend } = useServices();
  const [text, setText] = useState(student.notes);
  const [state, setState] = useState<'idle' | 'saved' | 'failed'>('idle');

  // Notes changed on another device: take them while this one has nothing unsaved.
  const [base, setBase] = useState(student.notes);
  useEffect(() => {
    if (student.notes !== base) {
      if (text === base) setText(student.notes);
      setBase(student.notes);
    }
  }, [student.notes, base, text]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await backend.command('student.setNotes', { id: student.id, notes: text });
    setState(result.ok ? 'saved' : 'failed');
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span className="field-label">{strings.students.notes.label}</span>
        <textarea
          rows={10}
          maxLength={NOTES_MAX_LENGTH}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setState('idle');
          }}
        />
      </label>
      {state === 'failed' && <Notice tone="error">{strings.genericError}</Notice>}
      {state === 'saved' && <Notice>{strings.students.notes.saved}</Notice>}
      <div className="row">
        <Button type="submit">{strings.students.notes.save}</Button>
      </div>
    </form>
  );
}
