import { useState } from 'react';
import type { AgendaClass, MonthlyDue, StudentView } from '../../application/api-contract';
import { diaDaSemana, duracaoPorExtenso, horaDeMinutos, intervalosEntreAulas, minutosDoDia } from '../../domain/agenda';
import { linkDoWhatsApp } from '../../domain/mensagens/extrato';
import { montarConfirmacaoDaAula, montarLembreteDeMensalidade } from '../../domain/mensagens/lembretes';
import { dataEmSaoPaulo, formatarData, formatarReais } from '../../domain/pacotes';
import { formatMonth, strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Badge } from '../components/Badge';
import { Button, ButtonLink } from '../components/Button';
import { classNames, classStatusText, lessonSwipeActions } from '../components/class-text';
import { SegmentedControl } from '../components/Controls';
import { ListRow, ListSection } from '../components/GroupedList';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { SwipeActions } from '../components/SwipeActions';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';
import { ClassSheet } from './ClassSheet';
import { urgencyLabel } from './Overview';

const t = strings.home;

/** The ways to start a lesson. Until phase 1c (the Modo Ao Vivo) there is only one. */
const START_WAYS = [{ value: 'given', label: t.markGiven }] as const;

type Open = { readonly lesson: AgendaClass; readonly missed: boolean };

/** The first screen: today as a timeline of cards, who needs attention, and who has not confirmed (docs/spec/telas-de-gestao.md). */
export function Home() {
  const home = useQuery('agendaHome', {}, ['classes', 'packages', 'students']);
  const overview = useQuery('packagesOverview', {}, ['packages', 'payments', 'students', 'classes', 'monthly']);
  const due = useQuery('monthlyDue', {}, ['monthly', 'students']);
  const students = useQuery('students', {}, ['students']);
  const settings = useQuery('messageSettings', {}, ['messages']);
  const [sheet, setSheet] = useState<Open>();
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
  const today = dataEmSaoPaulo(new Date());

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
        <ul className="timeline">
          <li className="tl-card">
            <p className="tl-tag">{t.nextTomorrowTag}</p>
            <LessonSummary lesson={tomorrowFirst} />
          </li>
        </ul>
      )}

      {dueToday.length > 0 && (
        <ListSection header={t.monthlyTitle}>
          {dueToday.map((d) => (
            <ListRow
              key={d.studentId}
              title={t.monthlyAsk(d.name, formatarReais(d.amountCents), formatMonth(d.month), d.dueToday)}
              trailing={<MonthlyActions item={d} student={studentById.get(d.studentId)} pix={pix} />}
            />
          ))}
        </ListSection>
      )}

      <h2>{t.timeline}</h2>
      {data.classes.length === 0 && <p className="muted">{t.empty}</p>}
      <ol className="timeline">
        {withGaps(data.classes).map((entry) =>
          entry.kind === 'gap' ? (
            <li key={entry.key} className="timeline-entry">
              <span className="timeline-time" aria-hidden="true">
                {entry.from}
              </span>
              <div className="free-slot">{t.freeBetween(duracaoPorExtenso(entry.minutes))}</div>
            </li>
          ) : (
            <li key={entry.lesson.id} className="timeline-entry">
              <span className="timeline-time">{entry.lesson.time}</span>
              <LessonCard
                lesson={entry.lesson}
                today={today}
                featured={entry.lesson.id === featuredId}
                current={entry.lesson.id === data.currentClassId}
                due={entry.lesson.students.flatMap((s) => dueByStudent.get(s.id) ?? [])}
                students={studentById}
                pix={pix}
                forecast={data.forecastWarnings.filter((w) => entry.lesson.students.some((s) => s.id === w.holderId)).map((w) => w.message)}
                onOpen={(missed = false) => setSheet({ lesson: entry.lesson, missed })}
                onChanged={home.reload}
              />
            </li>
          ),
        )}
      </ol>

      {attention.length > 0 && (
        <ListSection header={t.attention} footer={t.attentionHint}>
          {attention.map((item) => (
            <ListRow
              key={item.studentId}
              title={item.name}
              subtitle={<span className="urgent-label">{urgencyLabel(item)}</span>}
              onClick={() => navigate(item.billing === 'monthly' ? `/alunos/${item.studentId}/mensalidades` : `/alunos/${item.studentId}/pacotes`)}
            />
          ))}
        </ListSection>
      )}

      {sheet && <ClassSheet lesson={sheet.lesson} startMissed={sheet.missed} onClose={() => setSheet(undefined)} onChanged={home.reload} />}
    </section>
  );
}

type Entry = { kind: 'lesson'; lesson: AgendaClass } | { kind: 'gap'; key: string; from: string; minutes: number };

/** The lessons in time order with the free time between them. */
function withGaps(lessons: readonly AgendaClass[]): Entry[] {
  const gaps = intervalosEntreAulas(lessons);
  const entries: Entry[] = [];
  lessons.forEach((lesson, index) => {
    const gap = index > 0 ? gaps.find((g) => g.ateMin === minutosDoDia(lesson.time)) : undefined;
    if (gap) entries.push({ kind: 'gap', key: `gap-${gap.deMin}`, from: horaDeMinutos(gap.deMin), minutes: gap.ateMin - gap.deMin });
    entries.push({ kind: 'lesson', lesson });
  });
  return entries;
}

function LessonSummary({ lesson, featured = false }: { lesson: AgendaClass; featured?: boolean }) {
  return (
    <div>
      <p className="tl-name">{featured ? classNames(lesson) : strings.agenda.classLine(lesson.time, classNames(lesson))}</p>
      <p className="tl-sub">{lesson.address ?? strings.agenda.sheet.noAddress}</p>
    </div>
  );
}

interface LessonCardProps {
  readonly lesson: AgendaClass;
  readonly today: string;
  readonly featured: boolean;
  readonly current: boolean;
  readonly due: readonly MonthlyDue[];
  readonly students: ReadonlyMap<string, StudentView>;
  readonly pix: string;
  readonly forecast: readonly string[];
  readonly onOpen: (missed?: boolean) => void;
  readonly onChanged: () => void;
}

function LessonCard({ lesson, today, featured, current, due, students, pix, forecast, onOpen, onChanged }: LessonCardProps) {
  const { backend } = useServices();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [way, setWay] = useState<(typeof START_WAYS)[number]['value']>(START_WAYS[0].value);
  const scheduled = lesson.status === 'scheduled';
  const unconfirmed = scheduled && lesson.confirmationAsked && !lesson.confirmed;
  const past = lesson.status === 'given';

  async function markGiven() {
    setBusy(true);
    setFailed(false);
    const result = await backend.command('class.complete', { classId: lesson.id });
    setBusy(false);
    if (!result.ok) setFailed(true);
    else if (!result.value.registered) onOpen(); // the sheet asks which package the lesson draws from
    else onChanged();
  }

  const card = (
    <div className={featured ? 'tl-card featured' : past ? 'tl-card past' : 'tl-card'}>
      {featured && <p className="tl-tag">{current ? t.nowTag : t.nextTag}</p>}
      <div className="row spread">
        <button type="button" className="tl-main" onClick={() => onOpen()}>
          <LessonSummary lesson={lesson} featured={featured} />
        </button>
        {!featured && <Badge tone={past ? 'brand' : 'neutral'}>{classStatusText(lesson)}</Badge>}
        {featured && lesson.confirmed && <Badge tone="brand">{strings.agenda.confirmed}</Badge>}
        {unconfirmed && <Badge>{t.notConfirmed}</Badge>}
      </div>
      {forecast.map((message) => (
        <p key={message} className="tl-sub forecast">
          {t.forecast}: {message}
        </p>
      ))}
      {due.map((d) => (
        <div key={d.studentId} className="tl-question">
          <p className="strong">{t.monthlyAsk(d.name, formatarReais(d.amountCents), formatMonth(d.month), d.dueToday)}</p>
          <MonthlyActions item={d} student={students.get(d.studentId)} pix={pix} />
        </div>
      ))}
      {failed && <Notice tone="error">{strings.agenda.sheet.failed}</Notice>}
      {scheduled && featured && (
        <div className="tl-start">
          <Button size="large" disabled={busy} onClick={() => void markGiven()}>
            {START_WAYS.find((w) => w.value === way)?.label}
          </Button>
          <SegmentedControl label={t.startWays} options={START_WAYS} value={way} onChange={setWay} />
        </div>
      )}
      {scheduled && !featured && (
        <div className="row">
          <Button variant="secondary" disabled={busy} onClick={() => void markGiven()}>
            {t.markGiven}
          </Button>
        </div>
      )}
    </div>
  );

  const actions = lessonSwipeActions(lesson, today, { reschedule: () => onOpen(), missed: () => onOpen(true) });
  return actions.length > 0 ? <SwipeActions actions={actions}>{card}</SwipeActions> : card;
}

/** "Maria pagou a mensalidade?": register the payment or send the reminder (docs/spec/mensalistas.md). */
function MonthlyActions({ item, student, pix }: { item: MonthlyDue; student?: StudentView; pix: string }) {
  const text = montarLembreteDeMensalidade({ nome: item.name, mes: item.month, valorCentavos: item.amountCents, chavePix: pix });
  const link = student ? linkDoWhatsApp(student.phone, text) : null;
  return (
    <div className="list-row-trailing">
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
    <>
      <ListSection header={t.confirmTitle} footer={t.confirmHint}>
        {lessons.length === 0 && <ListRow title={t.confirmNone} />}
        {lessons.map((lesson) => (
          <ListRow
            key={lesson.id}
            title={t.confirmLine(lesson.time, classNames(lesson))}
            subtitle={lesson.confirmed ? t.confirmDone : lesson.confirmationAsked ? t.confirmAsked : undefined}
            trailing={
              <div className="list-row-trailing">
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
              </div>
            }
          />
        ))}
      </ListSection>
      {failed && <Notice tone="error">{t.confirmFailed}</Notice>}
    </>
  );
}
