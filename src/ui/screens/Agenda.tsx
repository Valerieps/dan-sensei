import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { AgendaClass } from '../../application/api-contract';
import {
  PASSO_DO_ARRASTO_MIN,
  diaDaSemana,
  duracaoPorExtenso,
  ehData,
  faixaDaGrade,
  horaAposArrasto,
  horaDeMinutos,
  intervalosEntreAulas,
  posicaoNaGrade,
  semanaDe,
} from '../../domain/agenda';
import { dataEmSaoPaulo, formatarData, somarDias } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { classNames, classStatusText, classTone } from '../components/class-text';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { Link } from '../router';
import { useQuery } from '../use-query';
import { ClassSheet } from './ClassSheet';

type Open = { readonly lesson: AgendaClass; readonly initial?: { readonly date: string; readonly time: string } };

/** "terça, 17/11" */
const dayText = (date: string) => strings.agenda.dayLabel(strings.agenda.weekdays[diaDaSemana(date)] ?? '', formatarData(date).slice(0, 5));

/** Lessons that still take the trainer's time: cancelled and rescheduled ones leave the gaps free. */
const takesTime = (c: AgendaClass) => c.status !== 'cancelled' && c.status !== 'rescheduled';

/** The agenda: the day as a grid of hours (the default) or the week. Docs: spec/agenda.md. */
export function Agenda({ mode, date: rawDate }: { mode: 'day' | 'week'; date?: string }) {
  const today = dataEmSaoPaulo(new Date());
  const date = rawDate && ehData(rawDate) ? rawDate : today;
  const [open, setOpen] = useState<Open>();
  const a = strings.agenda;
  const day = useQuery('agendaDay', { date }, ['classes', 'students']);
  const week = useQuery('agendaWeek', { date }, ['classes', 'students']);
  const current = mode === 'day' ? day : week;
  const step = mode === 'day' ? 1 : 7;
  const { segunda, domingo } = semanaDe(date);
  const base = mode === 'day' ? '/agenda' : '/agenda/semana';
  const label = mode === 'day' ? dayText(date) : a.weekLabel(formatarData(segunda).slice(0, 5), formatarData(domingo).slice(0, 5));

  return (
    <section>
      <div className="row">
        <h1 className="grow">{a.title}</h1>
        <Link className="button" to={`/agenda/nova/${date}`}>
          {a.newClass}
        </Link>
      </div>

      <nav className="row tabs" aria-label={a.views}>
        <Link to={`/agenda/${date}`} aria-current={mode === 'day' ? 'page' : undefined}>
          {a.day}
        </Link>
        <Link to={`/agenda/semana/${date}`} aria-current={mode === 'week' ? 'page' : undefined}>
          {a.week}
        </Link>
      </nav>

      <div className="row agenda-nav">
        <Link className="button secondary" to={`${base}/${somarDias(date, -step)}`} aria-label={mode === 'day' ? a.previousDay : a.previousWeek}>
          ‹
        </Link>
        <h2 className="grow agenda-label">{label}</h2>
        <Link className="button secondary" to={`${base}/${today}`}>
          {a.today}
        </Link>
        <Link className="button secondary" to={`${base}/${somarDias(date, step)}`} aria-label={mode === 'day' ? a.nextDay : a.nextWeek}>
          ›
        </Link>
      </div>

      {!current.data && (current.error ? <Notice tone="error">{a.loadFailed}</Notice> : <Loading />)}

      {mode === 'day' && day.data && <DayGrid date={date} lessons={day.data} onOpen={(lesson, initial) => setOpen({ lesson, initial })} />}
      {mode === 'week' && week.data && <WeekList from={week.data.from} lessons={week.data.classes} today={today} onOpen={(lesson) => setOpen({ lesson })} />}

      {open && <ClassSheet key={open.lesson.id + (open.initial?.time ?? '')} lesson={open.lesson} initial={open.initial} onClose={() => setOpen(undefined)} onChanged={current.reload} />}
    </section>
  );
}

interface Drag {
  readonly id: string;
  readonly startY: number;
  readonly minutesPerPixel: number;
  readonly deltaMin: number;
}

function DayGrid({ date, lessons, onOpen }: { date: string; lessons: readonly AgendaClass[]; onOpen: (lesson: AgendaClass, initial?: { date: string; time: string }) => void }) {
  const a = strings.agenda;
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag>();
  const faixa = faixaDaGrade(lessons);
  const hours = Array.from({ length: faixa.fimH - faixa.inicioH }, (_, i) => faixa.inicioH + i);
  const gaps = intervalosEntreAulas(lessons.filter(takesTime));

  function startDrag(event: PointerEvent<HTMLButtonElement>, lesson: AgendaClass) {
    const grid = gridRef.current;
    if (!grid) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const height = grid.getBoundingClientRect().height;
    setDrag({ id: lesson.id, startY: event.clientY, minutesPerPixel: ((faixa.fimH - faixa.inicioH) * 60) / height, deltaMin: 0 });
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    setDrag({ ...drag, deltaMin: (event.clientY - drag.startY) * drag.minutesPerPixel });
  }

  function endDrag(lesson: AgendaClass) {
    if (!drag) return;
    const time = horaAposArrasto(lesson, drag.deltaMin, faixa);
    setDrag(undefined);
    if (time !== lesson.time) onOpen(lesson, { date: lesson.date, time });
  }

  /** The keyboard's way to drag: a quarter of an hour up or down. */
  function nudge(event: KeyboardEvent<HTMLButtonElement>, lesson: AgendaClass) {
    const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    onOpen(lesson, { date: lesson.date, time: horaAposArrasto(lesson, direction * PASSO_DO_ARRASTO_MIN, faixa) });
  }

  return (
    <>
      {lessons.length === 0 && <p className="muted">{a.emptyDay}</p>}
      {lessons.some((l) => l.status === 'scheduled') && <p className="muted small">{a.dragHint}</p>}
      <div className="day-grid" role="group" aria-label={a.gridLabel}>
        <div ref={gridRef} className="day-hours">
          {hours.map((h) => {
            const time = horaDeMinutos(h * 60);
            return (
              <Link key={h} className="hour-row" to={`/agenda/nova/${date}/${time}`} aria-label={a.freeSlot(time)}>
                <span className="hour-label">{time}</span>
              </Link>
            );
          })}
        </div>
        <div className="day-overlay">
          {gaps.map((gap) => {
            const { topo, altura } = posicaoNaGrade({ time: horaDeMinutos(gap.deMin), durationMin: gap.ateMin - gap.deMin }, faixa);
            return (
              <span key={gap.deMin} className="gap-label" style={{ top: `${topo}%`, height: `${altura}%` }}>
                {a.gap(duracaoPorExtenso(gap.ateMin - gap.deMin))}
              </span>
            );
          })}
          {lessons.map((lesson) => {
            const dragging = drag?.id === lesson.id ? drag : undefined;
            const time = dragging ? horaAposArrasto(lesson, dragging.deltaMin, faixa) : lesson.time;
            const { topo, altura } = posicaoNaGrade({ time, durationMin: lesson.durationMin }, faixa);
            const names = classNames(lesson);
            return (
              <div key={lesson.id} className={`class-block ${classTone(lesson)}${dragging ? ' dragging' : ''}`} style={{ top: `${topo}%`, height: `${altura}%` }}>
                <button type="button" className="class-main" onClick={() => onOpen(lesson)}>
                  <span className="strong">{names}</span>
                  <span className="small">
                    {dragging ? a.dragging(time) : a.classLine(lesson.time, classStatusText(lesson))}
                    {lesson.status === 'scheduled' && !lesson.confirmed ? ` · ${a.notConfirmed}` : ''}
                  </span>
                </button>
                {lesson.status === 'scheduled' && (
                  <button
                    type="button"
                    className="class-handle"
                    aria-label={a.dragHandle(names, lesson.time)}
                    onPointerDown={(e) => startDrag(e, lesson)}
                    onPointerMove={moveDrag}
                    onPointerUp={() => endDrag(lesson)}
                    onPointerCancel={() => setDrag(undefined)}
                    onKeyDown={(e) => nudge(e, lesson)}
                  >
                    ⠿
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function WeekList({ from, lessons, today, onOpen }: { from: string; lessons: readonly AgendaClass[]; today: string; onOpen: (lesson: AgendaClass) => void }) {
  const a = strings.agenda;
  const days = Array.from({ length: 7 }, (_, i) => somarDias(from, i));
  const visible = lessons.filter((l) => l.status !== 'rescheduled');
  return (
    <>
      {visible.length === 0 && <EmptyState>{a.emptyWeek}</EmptyState>}
      <ul className="list">
        {days.map((day) => {
          const ofDay = visible.filter((l) => l.date === day).sort((x, y) => x.time.localeCompare(y.time));
          return (
            <li key={day} className={day === today ? 'card week-day today' : 'card week-day'}>
              <h3>
                <Link to={`/agenda/${day}`}>{dayText(day)}</Link>
              </h3>
              <ul className="list stack tight">
                {ofDay.map((lesson) => (
                  <li key={lesson.id}>
                    <button type="button" className={`week-class ${classTone(lesson)}`} onClick={() => onOpen(lesson)}>
                      <span className="strong">{a.classLine(lesson.time, classNames(lesson))}</span>
                      <span className="small">{classStatusText(lesson)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </>
  );
}
