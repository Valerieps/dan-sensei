import { useState, type FormEvent } from 'react';
import { avaliarPausa, formatarData, type Pausa } from '../../domain/pacotes';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Notice } from '../components/Notice';
import { Link, navigate } from '../router';
import { useQuery } from '../use-query';

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

  if (statement.error === 'not_found') return <Notice tone="error">{strings.genericError}</Notice>;
  if (!statement.data) return statement.error ? <Notice tone="error">{strings.genericError}</Notice> : null;

  const { summary, pauses } = statement.data;
  const back = `/alunos/${summary.holderId}/pacotes`;
  if (summary.status === 'encerrado') {
    return (
      <section>
        <h1>{t.title}</h1>
        <Notice>{t.closed}</Notice>
        <Link className="button secondary" to={back}>
          {strings.back}
        </Link>
      </section>
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
    <section>
      <h1>{t.title}</h1>
      <p className="muted">
        {summary.planName} · {summary.holderName}
      </p>
      <form className="stack" onSubmit={submit} noValidate>
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
        <div className="row">
          <Button type="submit" disabled={busy}>
            {t.submit}
          </Button>
          <Link className="button secondary" to={back}>
            {strings.cancel}
          </Link>
        </div>
      </form>
    </section>
  );
}
