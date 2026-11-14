import { useState, type FormEvent } from 'react';
import type { PackageSummary, PaymentMethod, PaymentView } from '../../application/api-contract';
import { dataEmSaoPaulo, formatarReais, lerReais, reaisParaTexto } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { SelectField } from '../components/SelectField';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';

const TOPICS = ['packages', 'payments'] as const;
type PaymentField = keyof typeof strings.packages.payment.errors;

/** The amount, date and method fields, shared by the new payment screen and the correction. */
export function PaymentFields({
  initial,
  submitLabel,
  maxCents,
  busy,
  failed,
  onSubmit,
  onCancel,
}: {
  initial: { amountCents: number | null; paidOn: string; method: PaymentMethod };
  submitLabel: string;
  /** What is still missing: a larger amount only gets a warning. Null skips the warning. */
  maxCents: number | null;
  busy: boolean;
  failed: boolean;
  onSubmit: (payment: { paidOn: string; amountCents: number; method: PaymentMethod }) => void;
  onCancel?: () => void;
}) {
  const t = strings.packages.payment;
  const today = dataEmSaoPaulo(new Date());
  const [amount, setAmount] = useState(initial.amountCents ? reaisParaTexto(initial.amountCents) : '');
  const [paidOn, setPaidOn] = useState(initial.paidOn);
  const [method, setMethod] = useState<PaymentMethod>(initial.method);
  const [errors, setErrors] = useState<ReadonlySet<PaymentField>>(new Set());

  const amountCents = lerReais(amount);
  const over = maxCents !== null && amountCents !== null && amountCents > maxCents;

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = new Set<PaymentField>();
    if (amountCents === null || amountCents <= 0) found.add('amount');
    if (paidOn === '' || paidOn > today) found.add('paidOn');
    setErrors(found);
    if (found.size > 0 || amountCents === null) return;
    onSubmit({ paidOn, amountCents, method });
  }

  const error = (field: PaymentField) => (errors.has(field) ? t.errors[field] : null);

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="row end">
        <Field className="grow" label={t.amount} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={error('amount')} />
        <Field className="grow" label={t.paidOn} type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} error={error('paidOn')} />
        <SelectField className="grow" label={t.method} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {(Object.keys(strings.packages.tab.method) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {strings.packages.tab.method[m]}
            </option>
          ))}
        </SelectField>
      </div>
      {over && <Notice>{t.overpay}</Notice>}
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      <div className="row">
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {strings.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

/** Inline correction of one payment, inside the package statement. */
export function PaymentEdit({ payment, missingCents, onDone }: { payment: PaymentView; missingCents: number; onDone: () => void }) {
  const { backend } = useServices();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save(value: { paidOn: string; amountCents: number; method: PaymentMethod }) {
    setBusy(true);
    setFailed(false);
    const result = await backend.command('payment.update', { id: payment.id, ...value });
    setBusy(false);
    if (!result.ok) setFailed(true);
    else onDone();
  }

  return (
    <PaymentFields
      initial={{ amountCents: payment.amountCents, paidOn: payment.paidOn, method: payment.method }}
      submitLabel={strings.packages.payment.save}
      maxCents={missingCents + payment.amountCents}
      busy={busy}
      failed={failed}
      onSubmit={(value) => void save(value)}
      onCancel={onDone}
    />
  );
}

/** Registers a payment for a package: from the + button (no student yet) or from a profile. */
export function RegisterPayment({ studentId = '', packageId = '' }: { studentId?: string; packageId?: string }) {
  const { backend } = useServices();
  const t = strings.packages.payment;
  const students = useQuery('students', {}, ['students']);
  const [student, setStudent] = useState(studentId);
  const [chosen, setChosen] = useState(packageId);
  const packages = useQuery('studentPackages', { studentId: student }, TOPICS);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!students.data) return students.error ? <Notice tone="error">{strings.genericError}</Notice> : null;
  const eligible = students.data.filter((s) => s.billing === 'package');
  if (eligible.length === 0) {
    return (
      <section>
        <h1>{t.title}</h1>
        <EmptyState action={<Link className="button" to="/alunos/novo">{strings.students.newTitle}</Link>}>{t.noStudents}</EmptyState>
      </section>
    );
  }

  const live: PackageSummary[] = student && packages.data ? packages.data.filter((p) => p.status !== 'encerrado') : [];
  // The first package that still owes something, else the first one.
  const selected = live.find((p) => p.id === chosen) ?? live.find((p) => p.paymentStatus === 'pending') ?? live[0];

  async function save(value: { paidOn: string; amountCents: number; method: PaymentMethod }) {
    if (!selected) return;
    setBusy(true);
    setFailed(false);
    const result = await backend.command('payment.create', { packageId: selected.id, ...value });
    setBusy(false);
    if (!result.ok) setFailed(true);
    else navigate(`/alunos/${student}/pacotes`);
  }

  return (
    <section>
      <h1>{t.title}</h1>
      <div className="stack">
        <SelectField
          label={t.student}
          value={student}
          onChange={(e) => {
            setStudent(e.target.value);
            setChosen('');
          }}
        >
          <option value="">{t.pickStudent}</option>
          {eligible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>

        {student && packages.data && live.length === 0 && (
          <EmptyState action={<Link className="button" to={`/alunos/${student}/pacotes/novo`}>{strings.packages.tab.newPackage}</Link>}>{t.noPackage}</EmptyState>
        )}

        {selected && (
          <>
            {live.length > 1 && (
              <SelectField label={t.package} value={selected.id} onChange={(e) => setChosen(e.target.value)}>
                {live.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.paymentStatus === 'pending' ? t.packageOption(p.planName, formatarReais(p.missingCents)) : t.packagePaid(p.planName)}
                  </option>
                ))}
              </SelectField>
            )}
            <p className="strong">
              {selected.paymentStatus === 'pending' ? strings.packages.tab.missing(formatarReais(selected.missingCents)) : strings.packages.tab.paidAll}
            </p>
            <PaymentFields
              key={selected.id}
              initial={{ amountCents: selected.missingCents > 0 ? selected.missingCents : null, paidOn: dataEmSaoPaulo(new Date()), method: 'pix' }}
              submitLabel={t.submit}
              maxCents={selected.missingCents}
              busy={busy}
              failed={failed}
              onSubmit={(value) => void save(value)}
            />
          </>
        )}
      </div>
    </section>
  );
}
