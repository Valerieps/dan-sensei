import { useEffect } from 'react';
import type { MeView } from '../application/api-contract';
import { canManageGroup } from '../domain/group/roles';
import { strings } from '../domain/strings';
import { useLiveStatus, useServices } from './backend-context';
import { Button } from './components/Button';
import { Notice } from './components/Notice';
import { usePath } from './router';
import { Shell } from './Shell';
import { Agenda } from './screens/Agenda';
import { Exercises, NewExercise } from './screens/Exercises';
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

/** Signs in, then puts the screen inside the shell (tab bar, toolbar, large title). */
export function App() {
  const { live } = useServices();
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

  return (
    <Shell>
      <OfflineNotice />
      <Screen me={me.data} />
    </Shell>
  );
}

function OfflineNotice() {
  const status = useLiveStatus();
  if (status !== 'offline') return null;
  return <Notice>{strings.offline}</Notice>;
}

/** What a panel keeps in view: the student's profile when it opened from there, else the Hoje screen. */
function behindStudent(studentId: string | undefined, tab: 'packages' | 'monthly') {
  return studentId ? <StudentProfile key={studentId} id={studentId} tab={tab} /> : <Home />;
}

function Screen({ me }: { me: MeView }) {
  const path = usePath();
  if (path === '/membros') return <Members me={me} />;
  if (path === '/convites' && canManageGroup(me)) return <Invites />;
  if (path === '/configuracoes') return <Settings />;
  if (/^\/exercicios\/novo\/?$/.test(path)) return <NewExercise behind={<Exercises />} />;
  const exercise = /^\/exercicios(?:\/([^/]+))?\/?$/.exec(path);
  if (exercise) return <Exercises selectedId={exercise[1]} />;
  const newClass = /^\/agenda\/nova(?:\/(\d{4}-\d{2}-\d{2})(?:\/(\d{2}:\d{2}))?)?\/?$/.exec(path);
  if (newClass) return <NewClass key={path} date={newClass[1]} time={newClass[2]} behind={<Agenda mode="day" date={newClass[1]} />} />;
  const week = /^\/agenda\/semana(?:\/(\d{4}-\d{2}-\d{2}))?\/?$/.exec(path);
  if (week) return <Agenda mode="week" date={week[1]} />;
  const day = /^\/agenda(?:\/(\d{4}-\d{2}-\d{2}))?\/?$/.exec(path);
  if (day) return <Agenda mode="day" date={day[1]} />;
  const payment = /^\/pagamentos\/registrar(?:\/([^/]+)(?:\/([^/]+))?)?\/?$/.exec(path);
  if (payment) return <RegisterPayment key={path} studentId={payment[1]} packageId={payment[2]} behind={behindStudent(payment[1], 'packages')} />;
  const monthlyPayment = /^\/mensalidades\/registrar(?:\/([^/]+))?\/?$/.exec(path);
  if (monthlyPayment) return <RegisterMonthly key={path} studentId={monthlyPayment[1]} behind={behindStudent(monthlyPayment[1], 'monthly')} />;
  const pause = /^\/pacotes\/([^/]+)\/pausar\/?$/.exec(path);
  if (pause) return <PausePackage key={pause[1]} packageId={pause[1]} />;
  if (path === '/nota-aluno') return <StudentList />;
  if (path === '/alunos/novo') return <NewStudent behind={<Overview />} />;
  const lesson = /^\/aulas\/registrar(?:\/([^/]+))?\/?$/.exec(path);
  if (lesson) return <RegisterLesson key={lesson[1] ?? ''} studentId={lesson[1]} behind={behindStudent(lesson[1], 'packages')} />;
  const packageForm = /^\/alunos\/([^/]+)\/pacotes\/(novo|saldo-inicial)\/?$/.exec(path);
  if (packageForm) return <PackageForm key={path} studentId={packageForm[1]} startingBalance={packageForm[2] === 'saldo-inicial'} />;
  const workouts = /^\/alunos\/([^/]+)\/treinos(?:\/([^/]+))?\/?$/.exec(path);
  if (workouts) return <StudentProfile key={workouts[1]} id={workouts[1]} tab="workouts" workoutId={workouts[2]} />;
  const profile = /^\/alunos\/([^/]+)(\/notas|\/pacotes|\/mensalidades|\/saude)?\/?$/.exec(path);
  if (profile) {
    const tabs = { '/notas': 'notes', '/pacotes': 'packages', '/mensalidades': 'monthly', '/saude': 'health' } as const;
    const tab = tabs[profile[2] as keyof typeof tabs] ?? 'registration';
    return <StudentProfile key={profile[1]} id={profile[1]} tab={tab} />;
  }
  if (path === '/alunos') return <Overview />;
  return <Home />;
}
