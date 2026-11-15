import { useState } from 'react';
import type { UrgencyItem } from '../../application/api-contract';
import { diaDaSemana } from '../../domain/agenda';
import { formatPhone, initials } from '../../domain/alunos/student';
import { formatarData, formatarReais } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { PackageProgress } from '../components/PackageProgress';
import { Link } from '../router';
import { useQuery } from '../use-query';

const HIDE_KEY = 'dan-sensei.hide-values';

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(HIDE_KEY, hidden ? '1' : '0');
  } catch {
    // Private window or blocked storage: the choice just lasts until the page closes.
  }
}

/** The label that says why a card is red; the red is never the only signal. */
export function urgencyLabel(item: UrgencyItem): string | null {
  if (!item.highlighted) return null;
  const labels = strings.packages.card.urgency;
  if (item.urgency === 1) return item.billing === 'monthly' ? strings.packages.card.monthlyPending : labels.payment;
  if (item.package?.status === 'vencido') return labels.expired;
  if (item.package?.status === 'esgotado') return labels.exhausted;
  return labels.ending;
}

/** "Alunos": every student as a card, most urgent first, with the month's numbers on top. */
export function Overview() {
  const overview = useQuery('packagesOverview', {}, ['packages', 'payments', 'students', 'classes', 'monthly']);
  const [hidden, setHidden] = useState(readHidden);
  const [showInactive, setShowInactive] = useState(false);
  const pending = useQuery('pendingStatements', {}, ['messages', 'classes', 'packages', 'students']);
  const agenda = useQuery('agendaHome', {}, ['classes', 'packages', 'students']);
  const inactive = useQuery('students', { includeInactive: true }, ['students']);
  const o = strings.packages.overview;

  function toggleHidden() {
    saveHidden(!hidden);
    setHidden(!hidden);
  }

  const data = overview.data;
  const [year, month] = data ? data.month.split('-') : ['', ''];
  const inactiveStudents = showInactive ? (inactive.data ?? []).filter((s) => s.status === 'inactive') : [];

  return (
    <section>
      <div className="row">
        <Link className="button secondary" to="/aulas/registrar">
          {o.registerLesson}
        </Link>
      </div>

      {!data && (overview.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />)}

      {data && (
        <div className="card">
          <div className="row spread">
            <h2>{o.month(`${month}/${year}`)}</h2>
            <Button variant="secondary" aria-pressed={hidden} onClick={toggleHidden}>
              {hidden ? o.showValues : o.hideValues}
            </Button>
          </div>
          <div className="month-numbers">
            <p>
              <span className="muted small">{o.received}</span>
              <span className="number">{hidden ? o.hidden : formatarReais(data.receivedCents)}</span>
            </p>
            <p>
              <span className="muted small">{o.renewals}</span>
              <span className="number">{data.expectedRenewals}</span>
            </p>
          </div>
        </div>
      )}

      {pending.data && pending.data.length > 0 && (
        <div className="card stack">
          <h2>{o.pendingStatements}</h2>
          <p className="muted small">{o.pendingStatementsHint}</p>
          <ul className="list">
            {pending.data.map((p) => (
              <li key={p.studentId} className="statement-line">
                <span className="grow">
                  <span className="strong">{p.name}</span> <span className="muted small">· {o.lastLesson(formatarData(p.lastLessonOn))}</span>
                </span>
                <Link className="button secondary" to={`/alunos/${p.studentId}/pacotes`}>
                  {strings.packages.tab.sendStatement}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data?.items.length === 0 && (
        <EmptyState
          action={
            <Link className="button" to="/alunos/novo">
              {strings.students.newTitle}
            </Link>
          }
        >
          {o.empty}
        </EmptyState>
      )}

      <ul className="list">
        {data?.items.map((item) => (
          <li key={item.studentId}>
            <StudentCard item={item} forecast={agenda.data?.forecastWarnings.find((w) => w.packageId === item.package?.id)?.message} />
          </li>
        ))}
      </ul>

      <label className="row">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        {strings.students.showInactive}
      </label>
      {inactiveStudents.length > 0 && (
        <>
          <h2>{o.inactiveTitle}</h2>
          <ul className="list">
            {inactiveStudents.map((student) => (
              <li key={student.id}>
                <Link className="card row student-row" to={`/alunos/${student.id}`}>
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
        </>
      )}
    </section>
  );
}

function StudentCard({ item, forecast }: { item: UrgencyItem; forecast?: string }) {
  const c = strings.packages.card;
  const label = urgencyLabel(item);
  const pkg = item.package;
  const destination =
    item.billing === 'monthly'
      ? `/alunos/${item.studentId}/mensalidades`
      : pkg
        ? `/alunos/${item.studentId}/pacotes`
        : `/alunos/${item.studentId}/pacotes/novo`;
  return (
    <Link className={item.highlighted ? 'card package-card urgent' : 'card package-card'} to={destination}>
      <div className="row spread">
        <span className="row tight">
          <span className="initials" aria-hidden="true">
            {initials(item.name)}
          </span>
          <span className="strong">{item.name}</span>
        </span>
        {label && <span className="urgent-label">{label}</span>}
      </div>
      {item.billing === 'monthly' && <p className="muted">{c.monthly}</p>}
      {item.pendingMonths.length > 0 && <p className="small">{c.monthlyPendingMonths(item.pendingMonths)}</p>}
      {item.billing !== 'monthly' && !pkg && <p className="muted">{c.noPackage}</p>}
      {pkg && (
        <>
          {item.asParticipant && <p className="muted small">{c.pair}</p>}
          <PackageProgress pkg={pkg} urgent={item.highlighted} />
        </>
      )}
      {item.nextClass ? (
        <p className="small">{c.nextClass(`${strings.agenda.weekdaysShort[diaDaSemana(item.nextClass.date)]}, ${formatarData(item.nextClass.date).slice(0, 5)} às ${item.nextClass.time}`)}</p>
      ) : (
        <p className="muted small">{c.noNextClass}</p>
      )}
      {forecast && (
        <p className="small strong forecast">
          {strings.agenda.forecastTitle}: {forecast}
        </p>
      )}
      {item.lessonsWithoutPackage > 0 && <p className="small">{c.withoutPackage(item.lessonsWithoutPackage)}</p>}
    </Link>
  );
}
