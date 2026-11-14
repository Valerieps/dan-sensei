import { useEffect, useState } from 'react';
import type { MeView } from '../application/api-contract';
import { canManageGroup } from '../domain/group/roles';
import { strings } from '../domain/strings';
import { useLiveStatus, useServices } from './backend-context';
import { Button } from './components/Button';
import { Notice } from './components/Notice';
import { Link, navigate, usePath } from './router';
import { Agenda } from './screens/Agenda';
import { Home } from './screens/Home';
import { NewClass } from './screens/NewClass';
import { Invites } from './screens/Invites';
import { Members } from './screens/Members';
import { SignIn } from './screens/SignIn';
import { Overview } from './screens/Overview';
import { PackageForm } from './screens/PackageForm';
import { PausePackage } from './screens/PausePackage';
import { RegisterMonthly } from './screens/RegisterMonthly';
import { RegisterPayment } from './screens/RegisterPayment';
import { Settings } from './screens/Settings';
import { RegisterLesson } from './screens/RegisterLesson';
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
    { path: '/', label: strings.nav.home, current: path === '/' },
    { path: '/alunos', label: strings.nav.students, current: path.startsWith('/alunos') || path.startsWith('/aulas') || path.startsWith('/pagamentos') || path.startsWith('/mensalidades') || path.startsWith('/pacotes') || path === '/nota-aluno' },
    { path: '/agenda', label: strings.nav.agenda, current: path.startsWith('/agenda') },
    { path: '/configuracoes', label: strings.nav.settings, current: path === '/configuracoes' },
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
            <Link className="button secondary" to="/pagamentos/registrar">
              {strings.nav.addPayment}
            </Link>
          </li>
          <li>
            <Link className="button secondary" to="/agenda/nova">
              {strings.nav.addClass}
            </Link>
          </li>
          <li>
            <Link className="button secondary" to="/aulas/registrar">
              {strings.nav.addLesson}
            </Link>
          </li>
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
          <li>
            <Link className="button secondary" to="/mensalidades/registrar">
              {strings.nav.addMonthlyPayment}
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
  if (path === '/configuracoes') return <Settings />;
  const newClass = /^\/agenda\/nova(?:\/(\d{4}-\d{2}-\d{2})(?:\/(\d{2}:\d{2}))?)?\/?$/.exec(path);
  if (newClass) return <NewClass key={path} date={newClass[1]} time={newClass[2]} />;
  const week = /^\/agenda\/semana(?:\/(\d{4}-\d{2}-\d{2}))?\/?$/.exec(path);
  if (week) return <Agenda mode="week" date={week[1]} />;
  const day = /^\/agenda(?:\/(\d{4}-\d{2}-\d{2}))?\/?$/.exec(path);
  if (day) return <Agenda mode="day" date={day[1]} />;
  const payment = /^\/pagamentos\/registrar(?:\/([^/]+)(?:\/([^/]+))?)?\/?$/.exec(path);
  if (payment) return <RegisterPayment key={path} studentId={payment[1]} packageId={payment[2]} />;
  const monthlyPayment = /^\/mensalidades\/registrar(?:\/([^/]+))?\/?$/.exec(path);
  if (monthlyPayment) return <RegisterMonthly key={path} studentId={monthlyPayment[1]} />;
  const pause = /^\/pacotes\/([^/]+)\/pausar\/?$/.exec(path);
  if (pause) return <PausePackage key={pause[1]} packageId={pause[1]} />;
  if (path === '/nota-aluno') return <StudentList />;
  if (path === '/alunos/novo') return <NewStudent />;
  const lesson = /^\/aulas\/registrar(?:\/([^/]+))?\/?$/.exec(path);
  if (lesson) return <RegisterLesson key={lesson[1] ?? ''} studentId={lesson[1]} />;
  const packageForm = /^\/alunos\/([^/]+)\/pacotes\/(novo|saldo-inicial)\/?$/.exec(path);
  if (packageForm) return <PackageForm key={path} studentId={packageForm[1]} startingBalance={packageForm[2] === 'saldo-inicial'} />;
  const profile = /^\/alunos\/([^/]+)(\/notas|\/pacotes|\/mensalidades)?\/?$/.exec(path);
  if (profile) {
    const tabs = { '/notas': 'notes', '/pacotes': 'packages', '/mensalidades': 'monthly' } as const;
    const tab = tabs[profile[2] as keyof typeof tabs] ?? 'registration';
    return <StudentProfile key={profile[1]} id={profile[1]} tab={tab} />;
  }
  if (path === '/alunos') return <Overview />;
  return <Home />;
}
