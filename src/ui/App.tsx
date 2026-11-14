import { useEffect, useState } from 'react';
import type { MeView } from '../application/api-contract';
import { canManageGroup } from '../domain/group/roles';
import { strings } from '../domain/strings';
import { useLiveStatus, useServices } from './backend-context';
import { Button } from './components/Button';
import { Notice } from './components/Notice';
import { Link, navigate, usePath } from './router';
import { Invites } from './screens/Invites';
import { Members } from './screens/Members';
import { SignIn } from './screens/SignIn';
import { StudentList } from './screens/StudentList';
import { NewStudent, StudentProfile } from './screens/StudentProfile';
import { useQuery } from './use-query';

/** The app's shell: side menu on the wide screen, bottom bar and + button on the phone (docs/spec/telas-de-gestao.md). */
export function App() {
  const { backend, live } = useServices();
  const me = useQuery('me', {}, ['me']);
  const signedIn = me.data !== undefined && me.error !== 'unauthenticated';

  useEffect(() => {
    if (!signedIn) return;
    live.start();
    return () => live.stop();
  }, [live, signedIn]);

  if (me.loading && !me.data) return null;
  if (!me.data && me.error && me.error !== 'unauthenticated') {
    return (
      <main className="app">
        <Notice tone="error">{strings.genericError}</Notice>
        <Button onClick={me.reload}>{strings.retry}</Button>
      </main>
    );
  }
  if (!signedIn) return <SignIn />;

  async function signOut() {
    await backend.signOut();
    navigate('/', { replace: true });
    me.reload();
  }

  return (
    <div className="shell">
      <Navigation me={me.data} onSignOut={() => void signOut()} />
      <main className="content">
        <OfflineNotice />
        <Screen me={me.data} />
      </main>
      <AddMenu />
    </div>
  );
}

function Navigation({ me, onSignOut }: { me: MeView; onSignOut: () => void }) {
  const path = usePath();
  const entries = [
    { path: '/', label: strings.nav.students, current: path === '/' || path.startsWith('/alunos') || path === '/nota-aluno' },
    { path: '/membros', label: strings.nav.members, current: path === '/membros' },
    ...(canManageGroup(me) ? [{ path: '/convites', label: strings.nav.invites, current: path === '/convites' }] : []),
  ];
  return (
    <nav className="nav" aria-label={strings.nav.main}>
      <span className="nav-brand">{strings.appName}</span>
      {entries.map((entry) => (
        <Link key={entry.path} to={entry.path} aria-current={entry.current ? 'page' : undefined}>
          {entry.label}
        </Link>
      ))}
      <Button variant="secondary" className="nav-sign-out" onClick={onSignOut}>
        {strings.nav.signOut}
      </Button>
    </nav>
  );
}

/** The phone's + button. Only the actions that exist so far; the others join as their screens do. */
function AddMenu() {
  const [open, setOpen] = useState(false);
  const path = usePath();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="add-menu">
      {open && (
        <ul className="list add-menu-items">
          <li>
            <Link className="button secondary" to="/nota-aluno">
              {strings.nav.addNote}
            </Link>
          </li>
          <li>
            <Link className="button secondary" to="/alunos/novo">
              {strings.nav.addStudent}
            </Link>
          </li>
        </ul>
      )}
      <Button className="add-button" aria-expanded={open} aria-label={open ? strings.nav.close : strings.nav.add} onClick={() => setOpen(!open)}>
        {open ? '×' : '+'}
      </Button>
    </div>
  );
}

function OfflineNotice() {
  const status = useLiveStatus();
  if (status !== 'offline') return null;
  return <Notice>{strings.offline}</Notice>;
}

function Screen({ me }: { me: MeView }) {
  const path = usePath();
  if (path === '/membros') return <Members me={me} />;
  if (path === '/convites' && canManageGroup(me)) return <Invites />;
  if (path === '/nota-aluno') return <StudentList pickForNote />;
  if (path === '/alunos/novo') return <NewStudent />;
  const profile = /^\/alunos\/([^/]+)(\/notas)?\/?$/.exec(path);
  if (profile) return <StudentProfile key={profile[1]} id={profile[1]} tab={profile[2] ? 'notes' : 'registration'} />;
  return <StudentList />;
}
