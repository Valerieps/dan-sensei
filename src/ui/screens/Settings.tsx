import { useState, type FormEvent } from 'react';
import type { PlanView } from '../../application/api-contract';
import { formatarData, formatarReais, lerReais, reaisParaTexto } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { useQuery } from '../use-query';

const MAX_CLASSES = 200;
const NAME_MAX = 60;

/** Settings: "Pausar todos os pacotes" and the plans. */
export function Settings() {
  return (
    <section className="stack">
      <h1>{strings.settings.title}</h1>
      <PauseAll />
      <Plans />
    </section>
  );
}

function PauseAll() {
  const { backend } = useServices();
  const t = strings.settings.pauseAll;
  const overview = useQuery('packagesOverview', {}, ['packages', 'payments', 'classes', 'students']);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(false);
    const ok = startsOn !== '' && endsOn !== '' && endsOn >= startsOn;
    setInvalid(!ok);
    if (!ok) return;
    const result = await backend.command('pause.createGlobal', { startsOn, endsOn });
    setFailed(!result.ok);
    if (result.ok) {
      setStartsOn('');
      setEndsOn('');
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t.removeConfirm)) return;
    const result = await backend.command('pause.removeGlobal', { id });
    setFailed(!result.ok);
  }

  return (
    <div className="card stack">
      <h2>{t.title}</h2>
      <p className="muted">{t.hint}</p>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="row end">
          <Field className="grow" label={t.startsOn} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} error={invalid ? t.error : null} />
          <Field className="grow" label={t.endsOn} type="date" min={startsOn || undefined} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>
        {failed && <Notice tone="error">{strings.genericError}</Notice>}
        <div className="row">
          <Button type="submit">{t.submit}</Button>
        </div>
      </form>
      <h3>{t.active}</h3>
      {overview.data && overview.data.globalPauses.length === 0 && <p className="muted small">{t.none}</p>}
      <ul className="list">
        {(overview.data?.globalPauses ?? []).map((pause) => (
          <li key={pause.id} className="statement-line">
            <span className="grow">
              {formatarData(pause.startsOn)} a {formatarData(pause.endsOn)}
            </span>
            <Button variant="secondary-danger" onClick={() => void remove(pause.id)}>
              {t.remove}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Plans() {
  const t = strings.settings.plans;
  const plans = useQuery('plans', { includeInactive: true }, ['plans']);
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <div className="card stack">
      <div className="row spread">
        <h2>{t.title}</h2>
        {editing !== 'new' && <Button onClick={() => setEditing('new')}>{t.new}</Button>}
      </div>
      <p className="muted">{t.hint}</p>
      {editing === 'new' && <PlanForm onDone={() => setEditing(null)} />}
      {plans.data && plans.data.length === 0 && editing !== 'new' && <EmptyState>{t.empty}</EmptyState>}
      {plans.error && <Notice tone="error">{strings.genericError}</Notice>}
      <ul className="list">
        {(plans.data ?? []).map((plan) => (
          <li key={plan.id} className="stack">
            {editing === plan.id ? (
              <PlanForm plan={plan} onDone={() => setEditing(null)} />
            ) : (
              <div className="statement-line">
                <span className="grow">
                  <span className="strong">{plan.name}</span>
                  {!plan.active && <span className="muted small"> · {t.inactive}</span>}
                  <br />
                  <span className="muted small">{t.summary(plan.classes, formatarReais(plan.priceCents), formatarReais(plan.classes * plan.priceCents), plan.validityDays)}</span>
                </span>
                <Button variant="secondary" onClick={() => setEditing(plan.id)}>
                  {t.edit}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

type PlanField = keyof typeof strings.settings.plans.errors;

function PlanForm({ plan, onDone }: { plan?: PlanView; onDone: () => void }) {
  const { backend } = useServices();
  const t = strings.settings.plans;
  const [name, setName] = useState(plan?.name ?? '');
  const [classes, setClasses] = useState(plan ? String(plan.classes) : '');
  const [price, setPrice] = useState(plan ? reaisParaTexto(plan.priceCents) : '');
  const [validity, setValidity] = useState(plan ? String(plan.validityDays) : '');
  const [active, setActive] = useState(plan?.active ?? true);
  const [errors, setErrors] = useState<ReadonlySet<PlanField>>(new Set());
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(false);
    const found = new Set<PlanField>();
    const classesValue = Number(classes);
    const validityValue = Number(validity);
    const priceCents = lerReais(price);
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > NAME_MAX) found.add('name');
    if (!Number.isInteger(classesValue) || classesValue < 1 || classesValue > MAX_CLASSES) found.add('classes');
    if (priceCents === null) found.add('price');
    if (!Number.isInteger(validityValue) || validityValue < 1) found.add('validity');
    setErrors(found);
    if (found.size > 0 || priceCents === null) return;
    setBusy(true);
    const input = { name: trimmed, classes: classesValue, priceCents, validityDays: validityValue };
    const result = plan ? await backend.command('plan.update', { ...input, id: plan.id, active }) : await backend.command('plan.create', input);
    setBusy(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    onDone();
  }

  const error = (field: PlanField) => (errors.has(field) ? t.errors[field] : null);

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <Field label={t.name} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} error={error('name')} />
      <div className="row end">
        <Field className="grow" label={t.classes} type="number" inputMode="numeric" value={classes} onChange={(e) => setClasses(e.target.value)} error={error('classes')} />
        <Field className="grow" label={t.price} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} error={error('price')} />
        <Field className="grow" label={t.validity} type="number" inputMode="numeric" value={validity} onChange={(e) => setValidity(e.target.value)} error={error('validity')} />
      </div>
      {plan && (
        <label className="row">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t.active}
        </label>
      )}
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      <div className="row">
        <Button type="submit" disabled={busy}>
          {plan ? t.save : t.create}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          {strings.cancel}
        </Button>
      </div>
    </form>
  );
}
