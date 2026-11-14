import { useState } from 'react';
import { formatPhone, initials } from '../../domain/alunos/student';
import { strings } from '../../domain/strings';
import { Notice } from '../components/Notice';
import { Link } from '../router';
import { useQuery } from '../use-query';

/**
 * Provisional list of students: the cards with the package progress replace it (docs/ROADMAP.md).
 * In `pickForNote` mode, a tap opens the student's notes (the + button's "Nota sobre aluno").
 */
export function StudentList({ pickForNote = false }: { pickForNote?: boolean }) {
  const [showInactive, setShowInactive] = useState(false);
  const students = useQuery('students', { includeInactive: showInactive }, ['students']);

  return (
    <section>
      <div className="row">
        <h1 className="grow">{pickForNote ? strings.students.pickForNote : strings.students.title}</h1>
        {!pickForNote && (
          <Link className="button" to="/alunos/novo">
            {strings.students.newTitle}
          </Link>
        )}
      </div>
      {students.error && !students.data && <Notice tone="error">{strings.genericError}</Notice>}
      {students.data?.length === 0 && <p className="muted">{strings.students.empty}</p>}
      <ul className="list">
        {students.data?.map((student) => (
          <li key={student.id}>
            <Link className="card row student-row" to={pickForNote ? `/alunos/${student.id}/notas` : `/alunos/${student.id}`}>
              <span className="initials" aria-hidden="true">
                {initials(student.name)}
              </span>
              <span className="grow">
                <span className="strong">{student.name}</span>
                <br />
                <span className="muted small">{formatPhone(student.phone)}</span>
              </span>
              {student.status !== 'active' && <span className="muted small">{strings.students.status[student.status]}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {!pickForNote && (
        <label className="row">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {strings.students.showInactive}
        </label>
      )}
    </section>
  );
}
