import { useState, type FormEvent } from 'react';
import { avaliarPausa, formatarData, type Pausa } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Field } from '../components/Field';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { RouteSheet } from '../components/RouteSheet';
import { navigate } from '../router';
import { useQuery } from '../use-query';
import { StudentProfile } from './StudentProfile';

const FORM_ID = 'pause-form';

/** Pauses one package for a period; past 30 own days the reason is required (the general pause never counts). */
export function PausePackage({ packageId }: { packageId: string }) {
  const { backend } = useServices();
  const t = strings.packages.pause;
  const statement = useQuery('package', { id: packageId }, ['packages']);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<ReadonlySet<'period' | 'reason'>>(new Set());
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!statement.data) {
    return (
      <RouteSheet title={t.title} back="/alunos">
        {statement.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />}
      </RouteSheet>
    );
  }

  const { summary, pauses } = statement.data;
  const back = `/alunos/${summary.holderId}/pacotes`;
  const behind = <StudentProfile id={summary.holderId} tab="packages" />;
  if (summary.status === 'encerrado') {
    return (
      <RouteSheet title={t.title} back={back} behind={behind}>
        <Notice>{t.closed}</Notice>
      </RouteSheet>
    );
  }

  const existing: Pausa[] = pauses.map((p) => ({ inicio: p.startsOn, fim: p.endsOn, geral: p.general }));
  const valid = startsOn !== '' && endsOn !== '' && endsOn >= startsOn;
  const outcome = valid ? avaliarPausa(existing, { inicio: startsOn, fim: endsOn, geral: false }, reason) : null;
  // Asking with an empty reason tells whether this pause goes past the limit.
  const needsReason = valid && (avaliarPausa(existing, { inicio: startsOn, fim: endsOn, geral: false }, '') as { ok: boolean }).ok === false;
  const days = outcome && outcome.ok ? outcome.diasNoLimite : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailed(false);
    const found = new Set<'period' | 'reason'>();
    if (!valid) found.add('period');
    else if (needsReason && reason.trim() === '') found.add('reason');
    setErrors(found);
    if (found.size > 0) return;
    setBusy(true);
    const result = await backend.command('package.pause', { packageId, startsOn, endsOn, ...(reason.trim() ? { reason: reason.trim() } : {}) });
    setBusy(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    navigate(back);
  }

  return (
    <RouteSheet title={t.title} back={back} behind={behind} formId={FORM_ID} busy={busy}>
      <p className="muted">
        {summary.planName} · {summary.holderName}
      </p>
      <form id={FORM_ID} className="stack" onSubmit={submit} noValidate>
        <div className="row end">
          <Field className="grow" label={t.startsOn} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} error={errors.has('period') ? t.errors.period : null} />
          <Field className="grow" label={t.endsOn} type="date" min={startsOn || undefined} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>
        {valid && days !== null && <p className="small">{t.days(Math.round((Date.parse(endsOn) - Date.parse(startsOn)) / 86_400_000) + 1, days)}</p>}
        {valid && <p className="muted small">{t.extends}</p>}
        {needsReason && (
          <>
            <Notice>{t.reasonHint}</Notice>
            <Field label={t.reason} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} error={errors.has('reason') ? t.errors.reason : null} />
          </>
        )}
        {summary.originalDueOn && <p className="muted small">{strings.packages.tab.originalDue(formatarData(summary.originalDueOn))}</p>}
        {failed && <Notice tone="error">{strings.genericError}</Notice>}
      </form>
    </RouteSheet>
  );
}
