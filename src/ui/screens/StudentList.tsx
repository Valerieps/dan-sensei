import { formatPhone, initials } from '../../domain/alunos/student';
import { strings } from '../../domain/strings';
import { EmptyState } from '../components/EmptyState';
import { Notice } from '../components/Notice';
import { Link } from '../router';
import { useQuery } from '../use-query';

/** Picks a student for the + button's "Nota sobre aluno"; a tap opens that student's notes. */
export function StudentList() {
  const students = useQuery('students', {}, ['students']);
  return (
    <section>
      <h1>{strings.students.pickForNote}</h1>
      {students.error && !students.data && <Notice tone="error">{strings.genericError}</Notice>}
      {students.data?.length === 0 && (
        <EmptyState
          action={
            <Link className="button" to="/alunos/novo">
              {strings.students.newTitle}
            </Link>
          }
        >
          {strings.students.empty}
        </EmptyState>
      )}
      <ul className="list">
        {students.data?.map((student) => (
          <li key={student.id}>
            <Link className="card row student-row" to={`/alunos/${student.id}/notas`}>
              <span className="initials" aria-hidden="true">
                {initials(student.name)}
              </span>
              <span className="grow">
                <span className="strong">{student.name}</span>
                <br />
                <span className="muted small">{formatPhone(student.phone)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
