import { useState } from 'react';
import type { AgendaClass, MonthlyDue, StudentView } from '../../application/api-contract';
import { diaDaSemana, duracaoPorExtenso, intervalosEntreAulas, minutosDoDia } from '../../domain/agenda';
import { linkDoWhatsApp } from '../../domain/mensagens/extrato';
import { montarConfirmacaoDaAula, montarLembreteDeMensalidade } from '../../domain/mensagens/lembretes';
import { formatarData, formatarReais } from '../../domain/pacotes';
import { formatMonth, strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button, ButtonLink } from '../components/Button';
import { classNames, classStatusText } from '../components/class-text';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { Link } from '../router';
import { useQuery } from '../use-query';
import { ClassSheet } from './ClassSheet';
import { urgencyLabel } from './Overview';

const t = strings.home;

/** The first screen: today as a timeline, who needs attention, and who has not confirmed (docs/spec/telas-de-gestao.md). */
export function Home() {
  const home = useQuery('agendaHome', {}, ['classes', 'packages', 'students']);
  const overview = useQuery('packagesOverview', {}, ['packages', 'payments', 'students', 'classes', 'monthly']);
  const due = useQuery('monthlyDue', {}, ['monthly', 'students']);
  const students = useQuery('students', {}, ['students']);
  const settings = useQuery('messageSettings', {}, ['messages']);
  const [sheet, setSheet] = useState<AgendaClass>();
  const [confirming, setConfirming] = useState(false);

  const data = home.data;
  if (!data) return home.error ? <Notice tone="error">{t.loadFailed}</Notice> : <Loading />;

  const dueByStudent = new Map((due.data ?? []).map((d) => [d.studentId, d]));
  const studentById = new Map((students.data ?? []).map((s) => [s.id, s]));
  const pix = settings.data?.pixKey ?? '';
  const featuredId = data.currentClassId ?? data.nextClassId;
  const tomorrowFirst = featuredId === null ? (data.tomorrow[0] ?? null) : null;
  const dueToday = (due.data ?? []).filter((d) => d.dueToday);
  const attention = (overview.data?.items ?? []).filter((i) => i.highlighted);

  return (
    <section>
      <div className="row spread">
        <p className="muted grow">{t.today(formatarData(data.today))}</p>
        {data.tomorrow.length > 0 && (
          <Button variant="secondary" aria-expanded={confirming} onClick={() => setConfirming(!confirming)}>
            {t.confirmButton}
          </Button>
        )}
      </div>

      {confirming && <ConfirmTomorrow lessons={data.tomorrow} students={studentById} onChanged={home.reload} />}

      {tomorrowFirst && (
        <div className="card timeline-item featured">
          <p className="strong">{t.nextTomorrowTag}</p>
          <LessonSummary lesson={tomorrowFirst} />
        </div>
      )}

      {dueToday.length > 0 && (
        <div className="card stack">
          <h2>{t.monthlyTitle}</h2>
          {dueToday.map((d) => (
            <MonthlyQuestion key={d.studentId} item={d} student={studentById.get(d.studentId)} pix={pix} />
          ))}
        </div>
      )}

      <h2>{t.timeline}</h2>
      {data.classes.length === 0 && <p className="muted">{t.empty}</p>}
      <ol className="list timeline">
        {withGaps(data.classes).map((entry) =>
          entry.kind === 'gap' ? (
            <li key={entry.key} className="timeline-gap muted small">
              {t.freeBetween(duracaoPorExtenso(entry.minutes))}
            </li>
          ) : (
            <li key={entry.lesson.id}>
              <LessonCard
                lesson={entry.lesson}
                featured={entry.lesson.id === featuredId}
                current={entry.lesson.id === data.currentClassId}
                due={entry.lesson.students.flatMap((s) => dueByStudent.get(s.id) ?? [])}
                students={studentById}
                pix={pix}
                forecast={data.forecastWarnings.filter((w) => entry.lesson.students.some((s) => s.id === w.holderId)).map((w) => w.message)}
                onOpen={() => setSheet(entry.lesson)}
                onChanged={home.reload}
              />
            </li>
          ),
        )}
      </ol>

      {attention.length > 0 && (
        <div className="stack">
          <h2>{t.attention}</h2>
          <p className="muted small">{t.attentionHint}</p>
          <ul className="list">
            {attention.map((item) => (
              <li key={item.studentId} className="statement-line">
                <span className="grow">
                  <span className="strong">{item.name}</span> <span className="urgent-label">{urgencyLabel(item)}</span>
                </span>
                <Link className="button secondary" to={item.billing === 'monthly' ? `/alunos/${item.studentId}/mensalidades` : `/alunos/${item.studentId}/pacotes`}>
                  {t.openStudent}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet && <ClassSheet lesson={sheet} onClose={() => setSheet(undefined)} onChanged={home.reload} />}
    </section>
  );
}

type Entry = { kind: 'lesson'; lesson: AgendaClass } | { kind: 'gap'; key: string; minutes: number };

/** The lessons in time order with the free time between them. */
function withGaps(lessons: readonly AgendaClass[]): Entry[] {
  const gaps = intervalosEntreAulas(lessons);
  const entries: Entry[] = [];
  lessons.forEach((lesson, index) => {
    const gap = index > 0 ? gaps.find((g) => g.ateMin === minutosDoDia(lesson.time)) : undefined;
    if (gap) entries.push({ kind: 'gap', key: `gap-${gap.deMin}`, minutes: gap.ateMin - gap.deMin });
    entries.push({ kind: 'lesson', lesson });
  });
  return entries;
}

function LessonSummary({ lesson }: { lesson: AgendaClass }) {
  return (
    <div>
      <p className="strong">{strings.agenda.classLine(lesson.time, classNames(lesson))}</p>
      <p className="muted small">{lesson.address ?? strings.agenda.sheet.noAddress}</p>
    </div>
  );
}

interface LessonCardProps {
  readonly lesson: AgendaClass;
  readonly featured: boolean;
  readonly current: boolean;
  readonly due: readonly MonthlyDue[];
  readonly students: ReadonlyMap<string, StudentView>;
  readonly pix: string;
  readonly forecast: readonly string[];
  readonly onOpen: () => void;
  readonly onChanged: () => void;
}

function LessonCard({ lesson, featured, current, due, students, pix, forecast, onOpen, onChanged }: LessonCardProps) {
  const { backend } = useServices();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const scheduled = lesson.status === 'scheduled';
  const unconfirmed = scheduled && lesson.confirmationAsked && !lesson.confirmed;

  async function markGiven() {
    setBusy(true);
    setFailed(false);
    const result = await backend.command('class.complete', { classId: lesson.id });
    setBusy(false);
    if (!result.ok) setFailed(true);
    else if (!result.value.registered) onOpen(); // the sheet asks which package the lesson draws from
    else onChanged();
  }

  return (
    <div className={featured ? 'card timeline-item featured' : unconfirmed ? 'card timeline-item unconfirmed' : 'card timeline-item'}>
      {featured && <p className="strong">{current ? t.nowTag : t.nextTag}</p>}
      <div className="row spread">
        <LessonSummary lesson={lesson} />
        <span className="muted small">{classStatusText(lesson)}</span>
      </div>
      {unconfirmed && <p className="strong">{t.notConfirmed}</p>}
      {scheduled && lesson.confirmed && <p className="muted small">{strings.agenda.confirmed}</p>}
      {forecast.map((message) => (
        <p key={message} className="small strong forecast">
          {t.forecast}: {message}
        </p>
      ))}
      {due.map((d) => (
        <MonthlyQuestion key={d.studentId} item={d} student={students.get(d.studentId)} pix={pix} />
      ))}
      {failed && <Notice tone="error">{strings.agenda.sheet.failed}</Notice>}
      {scheduled && (
        <div className="row">
          <Button variant={featured ? 'primary' : 'secondary'} disabled={busy} onClick={() => void markGiven()}>
            {t.markGiven}
          </Button>
          <Button variant="secondary" onClick={onOpen}>
            {t.moreOptions}
          </Button>
        </div>
      )}
    </div>
  );
}

/** "Maria pagou a mensalidade?": register the payment or send the reminder (docs/spec/mensalistas.md). */
function MonthlyQuestion({ item, student, pix }: { item: MonthlyDue; student?: StudentView; pix: string }) {
  const month = formatMonth(item.month);
  const text = montarLembreteDeMensalidade({ nome: item.name, mes: item.month, valorCentavos: item.amountCents, chavePix: pix });
  const link = student ? linkDoWhatsApp(student.phone, text) : null;
  return (
    <div className="stack monthly-question">
      <p className="strong">{t.monthlyAsk(item.name, formatarReais(item.amountCents), month, item.dueToday)}</p>
      <div className="row">
        <Link className="button" to={`/mensalidades/registrar/${item.studentId}`}>
          {t.registerMonthly}
        </Link>
        {link ? (
          <ButtonLink variant="secondary" href={link} target="_blank" rel="noopener noreferrer">
            {t.sendReminder}
          </ButtonLink>
        ) : (
          <span className="muted small">{t.noPhone}</span>
        )}
      </div>
    </div>
  );
}

/** Tomorrow's lessons: open the WhatsApp message of each chosen student, and mark who answered. */
function ConfirmTomorrow({ lessons, students, onChanged }: { lessons: readonly AgendaClass[]; students: ReadonlyMap<string, StudentView>; onChanged: () => void }) {
  const { backend } = useServices();
  const [failed, setFailed] = useState(false);

  async function run(call: () => Promise<{ ok: boolean }>) {
    setFailed(false);
    const result = await call();
    if (!result.ok) setFailed(true);
    onChanged();
  }

  return (
    <div className="card stack">
      <h2>{t.confirmTitle}</h2>
      <p className="muted small">{t.confirmHint}</p>
      {lessons.length === 0 && <p className="muted">{t.confirmNone}</p>}
      <ul className="list">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="statement-line">
            <span className="grow">
              <span className="strong">{t.confirmLine(lesson.time, classNames(lesson))}</span>
              <br />
              <span className="muted small">{lesson.confirmed ? t.confirmDone : lesson.confirmationAsked ? t.confirmAsked : ''}</span>
            </span>
            {lesson.students.map((s) => {
              const phone = students.get(s.id)?.phone ?? '';
              const link = linkDoWhatsApp(
                phone,
                montarConfirmacaoDaAula({ nome: s.name, data: lesson.date, diaDaSemana: diaDaSemana(lesson.date), hora: lesson.time, endereco: lesson.address }),
              );
              return link ? (
                <ButtonLink
                  key={s.id}
                  variant="secondary"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void run(() => backend.command('class.markConfirmationAsked', { classId: lesson.id }))}
                >
                  {t.confirmSend(s.name)}
                </ButtonLink>
              ) : (
                <span key={s.id} className="muted small">
                  {s.name}: {t.noPhone}
                </span>
              );
            })}
            <Button variant="secondary" onClick={() => void run(() => backend.command('class.confirm', { classId: lesson.id, confirmed: !lesson.confirmed }))}>
              {lesson.confirmed ? t.confirmUndo : t.confirmMark}
            </Button>
          </li>
        ))}
      </ul>
      {failed && <Notice tone="error">{t.confirmFailed}</Notice>}
    </div>
  );
}
