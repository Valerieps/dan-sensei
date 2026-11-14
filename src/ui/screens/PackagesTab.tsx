import { useState } from 'react';
import type { ClassWithoutPackage, PackageSummary, StudentView } from '../../application/api-contract';
import { linkDoWhatsApp, montarMensagemDoExtrato, precisaDeRenovacao, type DadosDoExtrato } from '../../domain/mensagens/extrato';
import { dataEmSaoPaulo, formatarData, formatarReais } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button, ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { PackageProgress } from '../components/PackageProgress';
import { Link } from '../router';
import { PaymentEdit } from './RegisterPayment';
import { useQuery } from '../use-query';

const TOPICS = ['packages', 'payments', 'classes'] as const;

/** The profile's Pacotes tab: the current package with its statement, then the earlier ones. */
export function PackagesTab({ student }: { student: StudentView }) {
  const t = strings.packages.tab;
  const packages = useQuery('studentPackages', { studentId: student.id }, TOPICS);
  const orphans = useQuery('lessonsWithoutPackage', { studentId: student.id }, TOPICS);

  if (student.billing === 'monthly') return <EmptyState>{t.monthly}</EmptyState>;
  if (!packages.data) return packages.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />;

  const live = packages.data.filter((p) => p.status !== 'encerrado');
  const closed = packages.data.filter((p) => p.status === 'encerrado');
  const holds = live.some((p) => p.holderId === student.id);
  const linkable = live.find((p) => p.status === 'ativo' || p.status === 'aguardando-inicio');

  return (
    <div className="stack">
      <div className="row">
        <Link className="button" to={`/alunos/${student.id}/pacotes/novo`}>
          {holds ? t.renew : t.newPackage}
        </Link>
        {packages.data.length === 0 && (
          <Link className="button secondary" to={`/alunos/${student.id}/pacotes/saldo-inicial`}>
            {t.initialBalance}
          </Link>
        )}
        <Link className="button secondary" to={`/aulas/registrar/${student.id}`}>
          {t.registerLesson}
        </Link>
      </div>

      {packages.data.length === 0 && <EmptyState>{t.empty}</EmptyState>}

      {live.length > 0 && <h2>{t.current}</h2>}
      {live.map((pkg) => (
        <div key={pkg.id} className="card stack">
          <PackageHeader pkg={pkg} />
          <PackageProgress pkg={pkg} urgent={pkg.status === 'vencido' || pkg.status === 'esgotado' || pkg.paymentStatus === 'pending'} />
          <div className="row">
            <Link className="button secondary" to={`/pagamentos/registrar/${student.id}/${pkg.id}`}>
              {t.registerPayment}
            </Link>
            <Link className="button secondary" to={`/pacotes/${pkg.id}/pausar`}>
              {t.pausePackage}
            </Link>
          </div>
          <StatementMessage student={student} pkg={pkg} />
          <Statement id={pkg.id} />
        </div>
      ))}

      {orphans.data && orphans.data.length > 0 && (
        <>
          <h2>{t.orphans}</h2>
          <p className="muted">{t.orphansHint}</p>
          <OrphanLessons lessons={orphans.data} target={linkable} />
        </>
      )}

      {closed.length > 0 && <h2>{t.previous}</h2>}
      {closed.map((pkg) => (
        <ClosedPackage key={pkg.id} pkg={pkg} />
      ))}
    </div>
  );
}

function PackageHeader({ pkg }: { pkg: PackageSummary }) {
  const t = strings.packages.tab;
  return (
    <div>
      <div className="row spread">
        <h3>{pkg.planName}</h3>
        <span className="strong">{strings.packages.status[pkg.status]}</span>
      </div>
      <p className="muted small">
        {pkg.participantName ? t.participant(pkg.participantName) : t.holder(pkg.holderName)} · {formatarReais(pkg.totalCents)}
      </p>
    </div>
  );
}

/** The statement as a wa.me link, for the holder only (docs/spec/whatsapp.md, ADR-008). */
function StatementMessage({ student, pkg }: { student: StudentView; pkg: PackageSummary }) {
  const { backend } = useServices();
  const t = strings.packages.tab;
  const settings = useQuery('messageSettings', {}, ['messages']);
  if (pkg.status === 'aguardando-inicio') return null;
  if (pkg.holderId !== student.id) return <p className="muted small">{t.statementOnlyHolder(pkg.holderName)}</p>;
  if (!settings.data) return null;

  const hoje = dataEmSaoPaulo(new Date());
  const dados: DadosDoExtrato = {
    nome: student.name.split(' ')[0] ?? student.name,
    usadas: pkg.used,
    novas: pkg.classes,
    transferidas: pkg.transferredIn,
    restantes: pkg.remaining,
    validoAte: pkg.dueOn,
    valorDoProximoCentavos: pkg.totalCents,
    avulso: pkg.classes === 1,
    encerradoPorUso: pkg.status === 'vencido' || pkg.status === 'esgotado',
  };
  const modelos = { chavePix: settings.data.pixKey, extrato: settings.data.statementTemplate, renovacao: settings.data.renewalTemplate };
  const link = linkDoWhatsApp(student.phone, montarMensagemDoExtrato(dados, modelos, hoje));
  const renewal = precisaDeRenovacao(dados, hoje);

  return (
    <div className="stack">
      {renewal && settings.data.pixKey === '' && <Notice tone="error">{t.statementNoPix}</Notice>}
      {link === null ? (
        <Notice tone="error">{t.statementNoPhone}</Notice>
      ) : (
        <div className="row">
          <ButtonLink
            variant="secondary"
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void backend.command('message.markOpened', { studentId: student.id, kind: 'statement' })}
          >
            {t.sendStatement}
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

function ClosedPackage({ pkg }: { pkg: PackageSummary }) {
  const [open, setOpen] = useState(false);
  const t = strings.packages.tab;
  return (
    <div className="card stack">
      <PackageHeader pkg={pkg} />
      <p className="small">{pkg.origin}</p>
      {pkg.closedNote && <p className="muted small">{pkg.closedNote}</p>}
      <div className="row">
        <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t.hideStatement : t.showStatement}
        </Button>
      </div>
      {open && <Statement id={pkg.id} />}
    </div>
  );
}

/** Lessons, payments and pauses of one package. */
function Statement({ id }: { id: string }) {
  const { backend } = useServices();
  const t = strings.packages.tab;
  const statement = useQuery('package', { id }, TOPICS);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  if (!statement.data) return statement.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />;
  const { summary, lessons, payments, pauses } = statement.data;

  async function remove(classId: string, date: string) {
    if (!window.confirm(t.deleteLessonConfirm(formatarData(date)))) return;
    const result = await backend.command('class.delete', { classId });
    setFailed(!result.ok);
  }

  async function removePayment(id: string, date: string, cents: number) {
    if (!window.confirm(t.deletePaymentConfirm(formatarData(date), formatarReais(cents)))) return;
    const result = await backend.command('payment.delete', { id });
    setFailed(!result.ok);
  }

  async function removePause(id: string) {
    if (!window.confirm(t.removePauseConfirm)) return;
    const result = await backend.command('package.removePause', { id });
    setFailed(!result.ok);
  }

  return (
    <div className="stack">
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      {summary.transferredIn > 0 && <p className="small">{t.transferredFrom(summary.transferredIn)}</p>}
      {summary.usedBeforeApp > 0 && <p className="small">{t.usedBeforeApp(summary.usedBeforeApp)}</p>}

      <h4>{t.lessons}</h4>
      {lessons.length === 0 && <p className="muted small">{t.noLessons}</p>}
      <ul className="list">
        {lessons.map((lesson) => (
          <li key={lesson.classId} className="statement-line">
            <span className="grow">
              {formatarData(lesson.date)} · {t.outcome[lesson.outcome]}
              {lesson.studentNames.length > 0 && <span className="muted small"> · {lesson.studentNames.join(', ')}</span>}
            </span>
            {summary.status !== 'encerrado' && (
              <Button variant="secondary-danger" aria-label={t.deleteLessonOf(formatarData(lesson.date))} onClick={() => void remove(lesson.classId, lesson.date)}>
                {t.deleteLesson}
              </Button>
            )}
          </li>
        ))}
      </ul>

      <h4>{t.payments}</h4>
      {payments.length === 0 && <p className="muted small">{t.noPayments}</p>}
      <ul className="list">
        {payments.map((payment) => (
          <li key={payment.id} className="statement-line">
            {editing === payment.id ? (
              <div className="grow">
                <PaymentEdit payment={payment} missingCents={summary.missingCents} onDone={() => setEditing(null)} />
              </div>
            ) : (
              <>
                <span className="grow">
                  {formatarData(payment.paidOn)} · {formatarReais(payment.amountCents)} · {t.method[payment.method]}
                </span>
                <Button variant="secondary" aria-label={t.editPaymentOf(formatarData(payment.paidOn))} onClick={() => setEditing(payment.id)}>
                  {t.editPayment}
                </Button>
                <Button variant="secondary-danger" aria-label={t.deletePaymentOf(formatarData(payment.paidOn))} onClick={() => void removePayment(payment.id, payment.paidOn, payment.amountCents)}>
                  {t.deletePayment}
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="small strong">{summary.paymentStatus === 'pending' ? t.missing(formatarReais(summary.missingCents)) : t.paidAll}</p>

      {pauses.length > 0 && <h4>{t.pauses}</h4>}
      <ul className="list">
        {pauses.map((pause) => (
          <li key={pause.id} className="statement-line">
            {formatarData(pause.startsOn)} a {formatarData(pause.endsOn)}
            {pause.general && <span className="muted small"> · {t.general}</span>}
            {pause.reason && <span className="muted small"> · {pause.reason}</span>}
            {!pause.general && summary.status !== 'encerrado' && (
              <Button variant="secondary-danger" aria-label={t.removePauseOf(formatarData(pause.startsOn))} onClick={() => void removePause(pause.id)}>
                {t.removePause}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {summary.originalDueOn && summary.dueOn && summary.originalDueOn !== summary.dueOn && (
        <p className="muted small">{t.originalDue(formatarData(summary.originalDueOn))}</p>
      )}
    </div>
  );
}

function OrphanLessons({ lessons, target }: { lessons: ClassWithoutPackage[]; target: PackageSummary | undefined }) {
  const { backend } = useServices();
  const [failed, setFailed] = useState(false);
  const t = strings.packages.tab;

  async function link(classId: string, packageId: string) {
    const result = await backend.command('class.linkToPackage', { classId, packageId });
    setFailed(!result.ok);
  }

  return (
    <>
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      <ul className="list">
        {lessons.map((lesson) => (
          <li key={lesson.classId} className="statement-line">
            <span className="grow">
              {formatarData(lesson.date)} · {t.outcome[lesson.outcome]}
            </span>
            {target && (
              <Button variant="secondary" onClick={() => void link(lesson.classId, target.id)}>
                {t.link}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
