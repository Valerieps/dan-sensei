import { useState, type FormEvent } from 'react';
import type { MonthlyView, StudentView } from '../../application/api-contract';
import { dataEmSaoPaulo, formatarData, formatarReais, lerReais, mesDe, reaisParaTexto } from '../../domain/pacotes';
import { formatMonth, strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { ListContent, ListRow, ListSection } from '../components/GroupedList';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { useQuery } from '../use-query';

const TOPICS = ['monthly', 'students', 'packages'] as const;

/** The profile's Mensalidades tab: the fee, what is pending and the months paid. */
export function MonthlyTab({ student }: { student: StudentView }) {
  const monthly = useQuery('monthly', { studentId: student.id }, TOPICS);
  if (monthly.data) return <Fees student={student} monthly={monthly.data} />;
  if (monthly.error === 'not_found') return <Setup student={student} />;
  return monthly.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />;
}

type FeeField = keyof typeof strings.packages.monthly.errors;

/** The fee and due day fields, shared by the starting balance and the fee change. */
function FeeFields({
  initial,
  withLastPaid,
  submitLabel,
  failed,
  onSubmit,
  onCancel,
}: {
  initial: { amountCents: number | null; dueDay: number | null };
  withLastPaid: boolean;
  submitLabel: string;
  failed: boolean;
  onSubmit: (value: { amountCents: number; dueDay: number; lastPaidMonth: string | null }) => Promise<void>;
  onCancel?: () => void;
}) {
  const t = strings.packages.monthly;
  const [amount, setAmount] = useState(initial.amountCents ? reaisParaTexto(initial.amountCents) : '');
  const [dueDay, setDueDay] = useState(initial.dueDay ? String(initial.dueDay) : '');
  const [lastPaid, setLastPaid] = useState('');
  const [errors, setErrors] = useState<ReadonlySet<FeeField>>(new Set());
  const [busy, setBusy] = useState(false);
  const thisMonth = mesDe(dataEmSaoPaulo(new Date()));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amountCents = lerReais(amount);
    const day = Number(dueDay);
    const found = new Set<FeeField>();
    if (amountCents === null || amountCents <= 0) found.add('amount');
    if (!Number.isInteger(day) || day < 1 || day > 31) found.add('dueDay');
    if (lastPaid > thisMonth) found.add('lastPaidMonth');
    setErrors(found);
    if (found.size > 0 || amountCents === null) return;
    setBusy(true);
    await onSubmit({ amountCents, dueDay: day, lastPaidMonth: lastPaid === '' ? null : lastPaid });
    setBusy(false);
  }

  const error = (field: FeeField) => (errors.has(field) ? t.errors[field] : null);

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="row end">
        <Field className="grow" label={t.amount} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={error('amount')} />
        <Field className="grow" label={t.dueDay} inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value)} error={error('dueDay')} />
        {withLastPaid && (
          <Field className="grow" label={t.lastPaidMonth} type="month" max={thisMonth} value={lastPaid} onChange={(e) => setLastPaid(e.target.value)} error={error('lastPaidMonth')} />
        )}
      </div>
      {withLastPaid && <p className="muted small">{t.lastPaidHint}</p>}
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      <div className="row">
        <Button type="submit" disabled={busy}>{submitLabel}</Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {strings.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

/** A student who is not monthly yet: the starting balance of an old monthly student. */
function Setup({ student }: { student: StudentView }) {
  const { backend } = useServices();
  const t = strings.packages.monthly;
  const packages = useQuery('studentPackages', { studentId: student.id }, TOPICS);
  const [failed, setFailed] = useState(false);

  if (!packages.data) return packages.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />;
  if (packages.data.length > 0) return <p className="muted">{t.hasPackages}</p>;

  async function save(value: { amountCents: number; dueDay: number; lastPaidMonth: string | null }) {
    const result = await backend.command('monthly.setup', { studentId: student.id, ...value });
    setFailed(!result.ok);
  }

  return (
    <ListSection header={t.setupTitle} footer={t.setupHint}>
      <ListContent>
        <FeeFields initial={{ amountCents: null, dueDay: null }} withLastPaid submitLabel={t.setupSubmit} failed={failed} onSubmit={save} />
      </ListContent>
    </ListSection>
  );
}

function Fees({ student, monthly }: { student: StudentView; monthly: MonthlyView }) {
  const { backend } = useServices();
  const t = strings.packages.monthly;
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);

  async function saveFee(value: { amountCents: number; dueDay: number }) {
    const result = await backend.command('monthly.setFee', { studentId: student.id, amountCents: value.amountCents, dueDay: value.dueDay });
    setFailed(!result.ok);
    if (result.ok) setEditing(false);
  }

  async function remove(id: string, month: string, cents: number) {
    if (!window.confirm(t.deleteConfirm(formatMonth(month), formatarReais(cents)))) return;
    const result = await backend.command('monthly.deletePayment', { id });
    setFailed(!result.ok);
  }

  return (
    <div className="stack">
      <ListSection>
        <ListRow title={t.feeOf(formatarReais(monthly.amountCents), monthly.dueDay)} subtitle={monthly.lastPaidMonth ? t.lastPaid(formatMonth(monthly.lastPaidMonth)) : t.noneYet} />
        <ListRow
          title={monthly.pendingMonths.length > 0 ? t.pending(monthly.pendingMonths) : t.upToDate}
          trailing={monthly.pendingMonths.length > 0 ? <Badge tone="danger">{strings.packages.card.pending}</Badge> : <Badge tone="brand">{strings.packages.card.paid}</Badge>}
        />
        {editing ? (
          <ListContent>
            <FeeFields
              initial={{ amountCents: monthly.amountCents, dueDay: monthly.dueDay }}
              withLastPaid={false}
              submitLabel={t.saveFee}
              failed={failed}
              onSubmit={saveFee}
              onCancel={() => setEditing(false)}
            />
          </ListContent>
        ) : (
          <>
            <ListRow title={t.submit} action href={`/mensalidades/registrar/${student.id}`} />
            <ListRow title={t.changeFee} action onClick={() => setEditing(true)} />
          </>
        )}
      </ListSection>

      {failed && !editing && <Notice tone="error">{strings.genericError}</Notice>}
      <ListSection header={t.payments} footer={monthly.payments.length === 0 ? t.noPayments : undefined}>
        {monthly.payments.map((p) => (
          <ListRow
            key={p.id}
            title={t.line(formatMonth(p.month), formatarData(p.paidOn), formatarReais(p.amountCents), strings.packages.tab.method[p.method])}
            swipeActions={[{ label: t.delete, tone: 'danger', onClick: () => void remove(p.id, p.month, p.amountCents) }]}
          />
        ))}
      </ListSection>
    </div>
  );
}
