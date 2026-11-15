import { formatPhone, initials } from '../../domain/alunos/student';
import { strings } from '../../domain/strings';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ListRow, ListSection } from '../components/GroupedList';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { useQuery } from '../use-query';

/** Picks a student for the + button's "Nota sobre aluno"; a tap opens that student's notes. */
export function StudentList() {
  const students = useQuery('students', {}, ['students']);
  return (
    <section>
      <h1>{strings.students.pickForNote}</h1>
      {!students.data && (students.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />)}
      {students.data?.length === 0 && (
        <EmptyState
          action={
            <ButtonLink to="/alunos/novo">{strings.students.newTitle}</ButtonLink>
          }
        >
          {strings.students.empty}
        </EmptyState>
      )}
      <ListSection>
        {students.data?.map((student) => (
          <ListRow
            key={student.id}
            leading={
              <span className="initials" aria-hidden="true">
                {initials(student.name)}
              </span>
            }
            title={student.name}
            subtitle={formatPhone(student.phone)}
            href={`/alunos/${student.id}/notas`}
          />
        ))}
      </ListSection>
    </section>
  );
}
