import { useState } from 'react';
import type { ClassWithoutPackage, PackageSummary, StudentView } from '../../application/api-contract';
import { linkDoWhatsApp, montarMensagemDoExtrato, precisaDeRenovacao, type DadosDoExtrato } from '../../domain/mensagens/extrato';
import { dataEmSaoPaulo, formatarData, formatarReais } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Badge } from '../components/Badge';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ListContent, ListRow, ListSection } from '../components/GroupedList';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { PackageProgress } from '../components/PackageProgress';
import { PaymentEdit } from './RegisterPayment';
import { useConfirm } from '../components/use-confirm';
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
        <ButtonLink to={`/alunos/${student.id}/pacotes/novo`}>{holds ? t.renew : t.newPackage}</ButtonLink>
        {packages.data.length === 0 && (
          <ButtonLink variant="secondary" to={`/alunos/${student.id}/pacotes/saldo-inicial`}>
            {t.initialBalance}
          </ButtonLink>
        )}
        <ButtonLink variant="secondary" to={`/aulas/registrar/${student.id}`}>
          {t.registerLesson}
        </ButtonLink>
      </div>

      {packages.data.length === 0 && <EmptyState>{t.empty}</EmptyState>}

      {live.map((pkg) => (
        <div key={pkg.id} className="stack">
          <ListSection header={`${t.current} · ${pkg.planName}`}>
            <ListContent>
              <PackageSummaryRows pkg={pkg} />
            </ListContent>
            <ListRow title={t.registerPayment} action href={`/pagamentos/registrar/${student.id}/${pkg.id}`} />
            <ListRow title={t.pausePackage} action href={`/pacotes/${pkg.id}/pausar`} />
          </ListSection>
          <StatementMessage student={student} pkg={pkg} />
          <Statement id={pkg.id} />
        </div>
      ))}

      {orphans.data && orphans.data.length > 0 && <OrphanLessons lessons={orphans.data} target={linkable} />}

      {closed.length > 0 && <h2>{t.previous}</h2>}
      {closed.map((pkg) => (
        <ClosedPackage key={pkg.id} pkg={pkg} />
      ))}
    </div>
  );
}

/** What a package card shows: the plan's state, who holds it, the belt, lessons, validity and payment. */
function PackageSummaryRows({ pkg }: { pkg: PackageSummary }) {
  const t = strings.packages.tab;
  const urgent = pkg.status === 'vencido' || pkg.status === 'esgotado' || pkg.paymentStatus === 'pending';
  return (
    <div className="stack tight">
      <div className="row spread">
        <span className="strong">{pkg.planName}</span>
        <Badge tone={urgent ? 'danger' : 'brand'}>{strings.packages.status[pkg.status]}</Badge>
      </div>
      <p className="muted small">
        {pkg.participantName ? t.participant(pkg.participantName) : t.holder(pkg.holderName)} · {formatarReais(pkg.totalCents)}
      </p>
      <PackageProgress pkg={pkg} urgent={urgent} />
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
    <div className="stack">
      <ListSection header={pkg.planName} footer={pkg.closedNote ?? undefined}>
        <ListRow
          title={pkg.origin}
          subtitle={pkg.participantName ? t.participant(pkg.participantName) : t.holder(pkg.holderName)}
          value={formatarReais(pkg.totalCents)}
        />
        <ListRow title={open ? t.hideStatement : t.showStatement} action onClick={() => setOpen(!open)} />
      </ListSection>
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
  const { confirm, dialog } = useConfirm();

  if (!statement.data) return statement.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />;
  const { summary, lessons, payments, pauses } = statement.data;

  function remove(classId: string, date: string) {
    confirm({
      title: t.deleteLesson,
      message: t.deleteLessonConfirm(formatarData(date)),
      run: async () => setFailed(!(await backend.command('class.delete', { classId })).ok),
    });
  }

  function removePayment(id: string, date: string, cents: number) {
    confirm({
      title: t.deletePayment,
      message: t.deletePaymentConfirm(formatarData(date), formatarReais(cents)),
      run: async () => setFailed(!(await backend.command('payment.delete', { id })).ok),
    });
  }

  function removePause(id: string) {
    confirm({
      title: t.removePause,
      message: t.removePauseConfirm,
      run: async () => setFailed(!(await backend.command('package.removePause', { id })).ok),
    });
  }

  const open = summary.status !== 'encerrado';
  return (
    <div className="stack">
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      {summary.transferredIn > 0 && <p className="small">{t.transferredFrom(summary.transferredIn)}</p>}
      {summary.usedBeforeApp > 0 && <p className="small">{t.usedBeforeApp(summary.usedBeforeApp)}</p>}

      <ListSection header={t.lessons} footer={lessons.length === 0 ? t.noLessons : open ? t.swipeHint : undefined}>
        {lessons.map((lesson) => (
          <ListRow
            key={lesson.classId}
            title={`${formatarData(lesson.date)} · ${t.outcome[lesson.outcome]}`}
            subtitle={lesson.studentNames.length > 0 ? lesson.studentNames.join(', ') : undefined}
            swipeActions={open ? [{ label: t.deleteLesson, tone: 'danger', onClick: () => void remove(lesson.classId, lesson.date) }] : undefined}
          />
        ))}
      </ListSection>

      <ListSection
        header={t.payments}
        footer={payments.length === 0 ? t.noPayments : undefined}
      >
        {payments.map((payment) =>
          editing === payment.id ? (
            <ListContent key={payment.id}>
              <PaymentEdit payment={payment} missingCents={summary.missingCents} onDone={() => setEditing(null)} />
            </ListContent>
          ) : (
            <ListRow
              key={payment.id}
              title={`${formatarData(payment.paidOn)} · ${formatarReais(payment.amountCents)}`}
              subtitle={t.method[payment.method]}
              swipeActions={[
                { label: t.editPayment, onClick: () => setEditing(payment.id) },
                { label: t.deletePayment, tone: 'danger', onClick: () => void removePayment(payment.id, payment.paidOn, payment.amountCents) },
              ]}
            />
          ),
        )}
        <ListRow
          title={summary.paymentStatus === 'pending' ? t.missing(formatarReais(summary.missingCents)) : t.paidAll}
          trailing={<Badge tone={summary.paymentStatus === 'pending' ? 'danger' : 'brand'}>{summary.paymentStatus === 'pending' ? strings.packages.card.pending : strings.packages.card.paid}</Badge>}
        />
      </ListSection>

      {pauses.length > 0 && (
        <ListSection header={t.pauses} footer={summary.originalDueOn && summary.dueOn && summary.originalDueOn !== summary.dueOn ? t.originalDue(formatarData(summary.originalDueOn)) : undefined}>
          {pauses.map((pause) => (
            <ListRow
              key={pause.id}
              title={`${formatarData(pause.startsOn)} a ${formatarData(pause.endsOn)}`}
              subtitle={[pause.general ? t.general : null, pause.reason].filter(Boolean).join(' · ') || undefined}
              swipeActions={!pause.general && open ? [{ label: t.removePause, tone: 'danger', onClick: () => void removePause(pause.id) }] : undefined}
            />
          ))}
        </ListSection>
      )}
      {dialog}
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
      <ListSection header={t.orphans} footer={t.orphansHint}>
        {lessons.map((lesson) => (
          <ListRow
            key={lesson.classId}
            title={`${formatarData(lesson.date)} · ${t.outcome[lesson.outcome]}`}
            swipeActions={target ? [{ label: t.link, onClick: () => void link(lesson.classId, target.id) }] : undefined}
          />
        ))}
      </ListSection>
    </>
  );
}
