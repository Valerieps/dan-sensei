import { useState, type FormEvent } from 'react';
import type { PaymentMethod } from '../../application/api-contract';
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

const MAX_CLASSES = 200;
type FormField = keyof typeof strings.packages.form.errors;

/**
 * Sells a package. With a live package already held, it is a renewal and the notice says how many
 * lessons move over. `startingBalance` adds the lessons already used and the first lesson's day.
 */
export function PackageForm({ studentId, startingBalance }: { studentId: string; startingBalance: boolean }) {
  const { backend } = useServices();
  const f = strings.packages.form;
  const student = useQuery('student', { id: studentId }, ['students']);
  const plans = useQuery('plans', {}, ['plans']);
  const preview = useQuery('renewalPreview', { holderId: studentId }, ['packages', 'classes']);
  const students = useQuery('students', {}, ['students']);

  const [planId, setPlanId] = useState('');
  // Edits over the plan's values; a plan change throws them away.
  const [classes, setClasses] = useState<string>();
  const [price, setPrice] = useState<string>();
  const [validity, setValidity] = useState<string>();
  const [participantId, setParticipantId] = useState('');
  const [inProgress, setInProgress] = useState(startingBalance);
  const [used, setUsed] = useState('0');
  const [firstClassOn, setFirstClassOn] = useState('');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(dataEmSaoPaulo(new Date()));
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [errors, setErrors] = useState<ReadonlySet<FormField>>(new Set());
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const back = `/alunos/${studentId}/pacotes`;
  if (student.error === 'not_found') return <Notice tone="error">{strings.students.notFound}</Notice>;
  if (!student.data || !plans.data) return plans.error || student.error ? <Notice tone="error">{strings.genericError}</Notice> : null;
  if (student.data.billing === 'monthly') {
    return (
      <EmptyState action={<Link className="button secondary" to={back}>{strings.back}</Link>}>
        {strings.packages.tab.monthly}
      </EmptyState>
    );
  }

  const activePlans = plans.data.filter((p) => p.active);
  const plan = activePlans.find((p) => p.id === planId) ?? activePlans[0];
  if (!plan) {
    return (
      <section>
        <h1>{f.newTitle}</h1>
        <EmptyState>{f.noPlans}</EmptyState>
      </section>
    );
  }

  const classesText = classes ?? String(plan.classes);
  const priceText = price ?? reaisParaTexto(plan.priceCents);
  const validityText = validity ?? String(plan.validityDays);
  const classesValue = Number(classesText);
  const priceCents = lerReais(priceText);
  const renewing = preview.data?.previousPackageId != null;
  const title = startingBalance ? f.initialTitle : renewing ? f.renewTitle : f.newTitle;
  const today = dataEmSaoPaulo(new Date());
  const others = (students.data ?? []).filter((s) => s.id !== studentId && s.billing === 'package');

  function pickPlan(id: string) {
    setPlanId(id);
    setClasses(undefined);
    setPrice(undefined);
    setValidity(undefined);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(false);
    const found = new Set<FormField>();
    const validityValue = Number(validityText);
    if (!Number.isInteger(classesValue) || classesValue < 1 || classesValue > MAX_CLASSES) found.add('classes');
    if (priceCents === null) found.add('price');
    if (!Number.isInteger(validityValue) || validityValue < 1) found.add('validity');
    const usedValue = Number(used);
    if (inProgress) {
      if (!Number.isInteger(usedValue) || usedValue < 0 || usedValue > classesValue) found.add('used');
      if (usedValue > 0 && (firstClassOn === '' || firstClassOn > today)) found.add('firstClass');
    }
    const amountCents = amount.trim() === '' ? null : lerReais(amount);
    if (amount.trim() !== '' && (amountCents === null || amountCents <= 0)) found.add('amount');
    if (amountCents !== null && paidOn === '') found.add('paidOn');
    setErrors(found);
    if (found.size > 0 || priceCents === null) return;

    setBusy(true);
    const result = await backend.command('package.create', {
      holderId: studentId,
      participantId: participantId || null,
      planId: plan!.id,
      classes: classesValue,
      priceCents,
      validityDays: validityValue,
      ...(inProgress && usedValue > 0 ? { usedBeforeApp: usedValue, firstClassOn } : {}),
      ...(amountCents !== null ? { payments: [{ paidOn, amountCents, method }] } : {}),
    });
    setBusy(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    navigate(back);
  }

  const error = (field: FormField) => (errors.has(field) ? f.errors[field] : null);

  return (
    <section>
      <h1>{title}</h1>
      <p className="muted">{student.data.name}</p>
      {startingBalance && <p>{f.initialHint}</p>}
      {preview.data?.notice && <Notice>{preview.data.notice}</Notice>}
      <form className="stack" onSubmit={submit} noValidate>
        <SelectField label={f.plan} value={plan.id} onChange={(e) => pickPlan(e.target.value)}>
          {activePlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <div className="row end">
          <Field className="grow" label={f.classes} type="number" inputMode="numeric" value={classesText} onChange={(e) => setClasses(e.target.value)} error={error('classes')} />
          <Field className="grow" label={f.price} inputMode="decimal" value={priceText} onChange={(e) => setPrice(e.target.value)} error={error('price')} />
          <Field className="grow" label={f.validity} type="number" inputMode="numeric" value={validityText} onChange={(e) => setValidity(e.target.value)} error={error('validity')} />
        </div>
        {priceCents !== null && Number.isInteger(classesValue) && classesValue > 0 && (
          <p className="strong">{f.total(formatarReais(classesValue * priceCents))}</p>
        )}

        <SelectField label={f.participant} value={participantId} onChange={(e) => setParticipantId(e.target.value)}>
          <option value="">{f.noParticipant}</option>
          {others.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>

        {!startingBalance && (
          <label className="row">
            <input type="checkbox" checked={inProgress} onChange={(e) => setInProgress(e.target.checked)} />
            {f.inProgress}
          </label>
        )}
        {inProgress && (
          <div className="row end">
            <Field className="grow" label={f.used} type="number" inputMode="numeric" value={used} onChange={(e) => setUsed(e.target.value)} error={error('used')} />
            <Field className="grow" label={f.firstClass} type="date" max={today} value={firstClassOn} onChange={(e) => setFirstClassOn(e.target.value)} error={error('firstClass')} />
          </div>
        )}

        <fieldset className="addresses">
          <legend className="field-label">{f.paidSection}</legend>
          <div className="row end">
            <Field className="grow" label={f.amount} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={error('amount')} />
            <Field className="grow" label={f.paidOn} type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} error={error('paidOn')} />
            <SelectField className="grow" label={f.method} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(Object.keys(strings.packages.tab.method) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {strings.packages.tab.method[m]}
                </option>
              ))}
            </SelectField>
          </div>
        </fieldset>

        {failed && <Notice tone="error">{strings.genericError}</Notice>}
        <div className="row">
          <Button type="submit" disabled={busy}>
            {startingBalance ? f.save : renewing ? f.renew : f.create}
          </Button>
          <Link className="button secondary" to={back}>
            {strings.cancel}
          </Link>
        </div>
      </form>
    </section>
  );
}
