import { useState, type FormEvent } from 'react';
import type { PlanView } from '../../application/api-contract';
import { CHAVE_PIX_MAX, MODELOS_PADRAO, MODELO_MAX } from '../../domain/mensagens/extrato';
import { formatarData, formatarReais, lerReais, reaisParaTexto } from '../../domain/pacotes';
import { canManageGroup } from '../../domain/group/roles';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Switch } from '../components/Controls';
import { ListContent, ListRow, ListSection } from '../components/GroupedList';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { useQuery } from '../use-query';

const MAX_CLASSES = 200;
const NAME_MAX = 60;

/** Settings: "Pausar todos os pacotes" and the plans. */
export function Settings() {
  return (
    <section className="stack">
      <h1>{strings.settings.title}</h1>
      <Account />
      <PauseAll />
      <Plans />
      <Messages />
      <Export />
      <Devices />
    </section>
  );
}

/** Where the group and the sign-out live now that the tab bar has no room for them. */
function Account() {
  const { backend } = useServices();
  const me = useQuery('me', {}, ['me']);
  async function signOut() {
    await backend.signOut();
    window.location.assign('/');
  }
  return (
    <ListSection header={strings.settings.account}>
      <ListRow title={strings.nav.members} href="/membros" />
      {me.data && canManageGroup(me.data) && <ListRow title={strings.nav.invites} href="/convites" />}
      <ListRow title={strings.nav.signOut} action onClick={() => void signOut()} />
    </ListSection>
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
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(false);
    const ok = startsOn !== '' && endsOn !== '' && endsOn >= startsOn;
    setInvalid(!ok);
    if (!ok) return;
    setBusy(true);
    const result = await backend.command('pause.createGlobal', { startsOn, endsOn });
    setBusy(false);
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
    <>
      <form onSubmit={submit} noValidate>
        <ListSection header={t.title} footer={t.hint}>
          <ListContent>
            <div className="stack">
              <div className="row end">
                <Field className="grow" label={t.startsOn} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} error={invalid ? t.error : null} />
                <Field className="grow" label={t.endsOn} type="date" min={startsOn || undefined} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </div>
              {failed && <Notice tone="error">{strings.genericError}</Notice>}
              <div className="row">
                <Button type="submit" disabled={busy}>
                  {t.submit}
                </Button>
              </div>
            </div>
          </ListContent>
        </ListSection>
      </form>
      <ListSection header={t.active} footer={overview.data && overview.data.globalPauses.length === 0 ? t.none : undefined}>
        {(overview.data?.globalPauses ?? []).map((pause) => (
          <ListRow
            key={pause.id}
            title={`${formatarData(pause.startsOn)} a ${formatarData(pause.endsOn)}`}
            swipeActions={[{ label: t.remove, tone: 'danger', onClick: () => void remove(pause.id) }]}
          />
        ))}
      </ListSection>
    </>
  );
}

function Plans() {
  const t = strings.settings.plans;
  const plans = useQuery('plans', { includeInactive: true }, ['plans']);
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  return (
    <>
      {plans.error && <Notice tone="error">{strings.genericError}</Notice>}
      <ListSection header={t.title} footer={plans.data && plans.data.length === 0 && editing !== 'new' ? t.empty : t.hint}>
        {(plans.data ?? []).map((plan) =>
          editing === plan.id ? (
            <ListContent key={plan.id}>
              <PlanForm plan={plan} onDone={() => setEditing(null)} />
            </ListContent>
          ) : (
            <ListRow
              key={plan.id}
              title={plan.name}
              subtitle={t.summary(plan.classes, formatarReais(plan.priceCents), formatarReais(plan.classes * plan.priceCents), plan.validityDays)}
              trailing={plan.active ? undefined : <Badge>{t.inactive}</Badge>}
              onClick={() => setEditing(plan.id)}
            />
          ),
        )}
        {editing === 'new' ? (
          <ListContent>
            <PlanForm onDone={() => setEditing(null)} />
          </ListContent>
        ) : (
          <ListRow title={t.new} action onClick={() => setEditing('new')} />
        )}
      </ListSection>
    </>
  );
}

function Messages() {
  const { backend } = useServices();
  const t = strings.settings.messages;
  const settings = useQuery('messageSettings', {}, ['messages']);
  const [form, setForm] = useState<{ pixKey: string; statementTemplate: string; renewalTemplate: string } | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const current = form ?? settings.data;
  if (!current) return settings.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />;

  const change = (patch: Partial<typeof current>) => {
    setStatus('idle');
    setForm({ ...current, ...patch });
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    const result = await backend.command('settings.setMessages', current!);
    setStatus(result.ok ? 'saved' : 'failed');
    if (result.ok) setForm(null);
  }

  return (
    <form onSubmit={submit} noValidate>
      <ListSection header={t.title} footer={t.hint}>
        <ListContent>
          <div className="stack">
            <Field label={t.pixKey} value={current.pixKey} maxLength={CHAVE_PIX_MAX} onChange={(e) => change({ pixKey: e.target.value })} />
            <label className="field">
              <span className="field-label">{t.statementTemplate}</span>
              <textarea rows={3} value={current.statementTemplate} maxLength={MODELO_MAX} onChange={(e) => change({ statementTemplate: e.target.value })} />
              <span className="muted small">{t.statementHelp}</span>
            </label>
            <label className="field">
              <span className="field-label">{t.renewalTemplate}</span>
              <textarea rows={3} value={current.renewalTemplate} maxLength={MODELO_MAX} onChange={(e) => change({ renewalTemplate: e.target.value })} />
              <span className="muted small">{t.renewalHelp}</span>
            </label>
            {status === 'failed' && <Notice tone="error">{strings.genericError}</Notice>}
            {status === 'saved' && <p className="small strong">{t.saved}</p>}
            <div className="row">
              <Button type="submit" disabled={status === 'saving'}>
                {t.save}
              </Button>
              <Button variant="secondary" onClick={() => change({ statementTemplate: MODELOS_PADRAO.extrato, renewalTemplate: MODELOS_PADRAO.renovacao })}>
                {t.restore}
              </Button>
            </div>
          </div>
        </ListContent>
      </ListSection>
    </form>
  );
}

function Export() {
  const { backend } = useServices();
  const t = strings.settings.export;
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  async function download() {
    setStatus('busy');
    const result = await backend.exportData();
    if (!result.ok) {
      setStatus('failed');
      return;
    }
    // A blob link in a throwaway anchor: the browser saves the file; nothing leaves the device.
    const url = URL.createObjectURL(result.value);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dan-sensei-dados-${new Date().toISOString().slice(0, 10)}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('done');
  }

  return (
    <>
      {status === 'failed' && <Notice tone="error">{strings.genericError}</Notice>}
      <ListSection header={t.title} footer={status === 'done' ? t.done : t.hint}>
        <ListRow title={t.button} action onClick={() => void download()} />
      </ListSection>
    </>
  );
}

function Devices() {
  const { backend } = useServices();
  const t = strings.settings.devices;
  const me = useQuery('me', {}, ['me']);
  const members = useQuery('members', {}, ['members']);
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function signOutAll(id: string, name: string) {
    const self = id === me.data?.id;
    if (!window.confirm(self ? t.confirmSelf : t.confirmOther(name))) return;
    const result = await backend.command('session.signOutAll', self ? {} : { memberId: id });
    setFailed(!result.ok);
    if (!result.ok) return;
    if (self) {
      await backend.signOut();
      window.location.assign('/');
    } else {
      setDone(t.doneOther(name));
    }
  }

  return (
    <>
      {failed && <Notice tone="error">{strings.genericError}</Notice>}
      <ListSection header={t.title} footer={done ?? t.hint}>
        {(members.data ?? []).map((member) => (
          <ListRow key={member.id} title={member.name} value={t.signOutAll} onClick={() => void signOutAll(member.id, member.name)} />
        ))}
      </ListSection>
    </>
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
        <Switch label={t.active} checked={active} onChange={setActive} />
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
