import { useState } from 'react';
import type { UrgencyItem } from '../../application/api-contract';
import { diaDaSemana } from '../../domain/agenda';
import { formatPhone, initials } from '../../domain/alunos/student';
import { formatarData, formatarReais } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { Badge, type BadgeTone } from '../components/Badge';
import { ButtonLink } from '../components/Button';
import { SegmentedControl, Switch } from '../components/Controls';
import { EmptyState } from '../components/EmptyState';
import { ListContent, ListRow, ListSection } from '../components/GroupedList';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { Belt, validityText } from '../components/PackageProgress';
import { Sheet } from '../components/Sheet';
import { StudentCard } from '../components/StudentCard';
import { navigate } from '../router';
import { useQuery } from '../use-query';
import { cardDestination, cardMenu, FILTERS, filterItems, type StudentFilter } from './student-cards';

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

/** "Alunos": the month's numbers, then every student as a card, most urgent first. */
export function Overview() {
  const overview = useQuery('packagesOverview', {}, ['packages', 'payments', 'students', 'classes', 'monthly']);
  const [hidden, setHidden] = useState(readHidden);
  const [filter, setFilter] = useState<StudentFilter>('all');
  const [menu, setMenu] = useState<UrgencyItem>();
  const pending = useQuery('pendingStatements', {}, ['messages', 'classes', 'packages', 'students']);
  const agenda = useQuery('agendaHome', {}, ['classes', 'packages', 'students']);
  const inactive = useQuery('students', { includeInactive: true }, ['students']);
  const o = strings.packages.overview;

  function toggleHidden(next: boolean) {
    saveHidden(next);
    setHidden(next);
  }

  const data = overview.data;
  const [year, month] = data ? data.month.split('-') : ['', ''];
  const shown = data ? filterItems(data.items, filter) : [];
  const inactiveStudents = (inactive.data ?? []).filter((s) => s.status === 'inactive');

  return (
    <section>
      <div className="row">
        <ButtonLink variant="secondary" to="/aulas/registrar">
          {o.registerLesson}
        </ButtonLink>
      </div>

      {!data && (overview.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />)}

      {data && (
        <ListSection header={o.month(`${month}/${year}`)}>
          <ListRow title={o.received} value={hidden ? o.hidden : formatarReais(data.receivedCents)} />
          <ListRow title={o.renewals} value={data.expectedRenewals} />
          <ListContent>
            <Switch label={o.hideValues} checked={hidden} onChange={toggleHidden} />
          </ListContent>
        </ListSection>
      )}

      {pending.data && pending.data.length > 0 && (
        <ListSection header={o.pendingStatements} footer={o.pendingStatementsHint}>
          {pending.data.map((p) => (
            <ListRow
              key={p.studentId}
              title={p.name}
              subtitle={o.lastLesson(formatarData(p.lastLessonOn))}
              value={strings.packages.tab.sendStatement}
              onClick={() => navigate(`/alunos/${p.studentId}/pacotes`)}
            />
          ))}
        </ListSection>
      )}

      {data && (
        <SegmentedControl label={o.filterLabel} options={FILTERS.map((value) => ({ value, label: o.filters[value] }))} value={filter} onChange={setFilter} />
      )}

      {data?.items.length === 0 && filter !== 'inactive' && (
        <EmptyState
          action={
            <ButtonLink to="/alunos/novo">
              {strings.students.newTitle}
            </ButtonLink>
          }
        >
          {o.empty}
        </EmptyState>
      )}
      {data && data.items.length > 0 && shown.length === 0 && filter !== 'inactive' && <p className="muted">{o.noMatch}</p>}

      {filter !== 'inactive' && (
        <ul className="student-grid">
          {shown.map((item) => (
            <li key={item.studentId}>
              <StudentCardOf item={item} forecast={agenda.data?.forecastWarnings.find((w) => w.packageId === item.package?.id)?.message} onMenu={() => setMenu(item)} />
            </li>
          ))}
        </ul>
      )}

      {filter === 'inactive' &&
        (inactiveStudents.length === 0 ? (
          <p className="muted">{o.inactiveEmpty}</p>
        ) : (
          <ListSection header={o.inactiveTitle}>
            {inactiveStudents.map((student) => (
              <ListRow
                key={student.id}
                title={student.name}
                subtitle={formatPhone(student.phone)}
                onClick={() => navigate(`/alunos/${student.id}`)}
                trailing={<Badge>{strings.students.status.inactive}</Badge>}
              />
            ))}
          </ListSection>
        ))}

      {menu && <StudentMenu item={menu} onClose={() => setMenu(undefined)} />}
    </section>
  );
}

/** The context menu of a card: each action is there only when it makes sense for the student. */
function StudentMenu({ item, onClose }: { item: UrgencyItem; onClose: () => void }) {
  const m = strings.packages.overview.menu;
  const destinations = cardMenu(item);
  const go = (path: string) => {
    onClose();
    navigate(path);
  };
  return (
    <Sheet title={item.name} onClose={onClose}>
      <ListSection>
        {destinations.reschedule && <ListRow title={m.reschedule} action onClick={() => go(destinations.reschedule!)} />}
        {destinations.registerPayment && <ListRow title={m.registerPayment} action onClick={() => go(destinations.registerPayment!)} />}
        {destinations.sendStatement && <ListRow title={m.sendStatement} action onClick={() => go(destinations.sendStatement!)} />}
        <ListRow title={m.profile} onClick={() => go(`/alunos/${item.studentId}`)} />
      </ListSection>
    </Sheet>
  );
}

/** The state on the right of the card: why it is red, or whether the money is in. */
function stateBadge(item: UrgencyItem): { tone: BadgeTone; text: string } | null {
  const c = strings.packages.card;
  const label = urgencyLabel(item);
  if (label) return { tone: 'danger', text: label };
  if (item.billing === 'monthly') return { tone: 'brand', text: c.paid };
  if (!item.package) return null;
  return item.package.paymentStatus === 'paid' ? { tone: 'brand', text: c.paid } : { tone: 'danger', text: c.pending };
}

function StudentCardOf({ item, forecast, onMenu }: { item: UrgencyItem; forecast?: string; onMenu: () => void }) {
  const c = strings.packages.card;
  const pkg = item.package;
  const badge = stateBadge(item);
  const next = item.nextClass
    ? c.nextClass(`${strings.agenda.weekdaysShort[diaDaSemana(item.nextClass.date)]}, ${formatarData(item.nextClass.date).slice(0, 5)} às ${item.nextClass.time}`)
    : c.noNextClass;
  return (
    <StudentCard
      href={cardDestination(item)}
      initials={initials(item.name)}
      name={item.name}
      subtitle={next}
      badge={badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
      onMenu={onMenu}
    >
      {item.billing === 'monthly' && <span className="muted">{c.monthly}</span>}
      {item.pendingMonths.length > 0 && <span className="small">{c.monthlyPendingMonths(item.pendingMonths)}</span>}
      {item.billing !== 'monthly' && !pkg && <span className="muted">{c.noPackage}</span>}
      {pkg && (
        <>
          {item.asParticipant && <span className="muted small">{c.pair}</span>}
          <Belt used={pkg.used} total={pkg.total} urgent={item.highlighted} label={c.progressLabel(pkg.used, pkg.total)} />
          <span className="student-card-line">
            <span className="strong">{pkg.used > 0 ? c.lessonOf(pkg.used, pkg.total) : c.noLessonYet(pkg.total)}</span>
            <span className="muted small">{validityText(pkg)}</span>
          </span>
        </>
      )}
      {forecast && (
        <span className="small strong">
          {strings.agenda.forecastTitle}: {forecast}
        </span>
      )}
      {item.lessonsWithoutPackage > 0 && <span className="small">{c.withoutPackage(item.lessonsWithoutPackage)}</span>}
    </StudentCard>
  );
}
