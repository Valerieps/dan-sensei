import { useState, type FormEvent } from 'react';
import type { ApiError, InviteState } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { ListContent, ListRow, ListSection } from '../components/GroupedList';
import { Loading } from '../components/Loading';
import { Notice } from '../components/Notice';
import { useQuery } from '../use-query';

const STATE_LABEL: Record<InviteState, string> = {
  pending: strings.invites.pending,
  accepted: strings.invites.accepted,
  revoked: strings.invites.revoked,
};

function errorText(error: ApiError): string {
  if (error === 'invalid') return strings.invites.invalidEmail;
  if (error === 'conflict') return strings.invites.alreadyMember;
  if (error === 'forbidden') return strings.forbidden;
  return strings.genericError;
}

export function Invites() {
  const { backend } = useServices();
  const invites = useQuery('invites', {}, ['invites']);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await backend.command('invite.create', { email });
    setBusy(false);
    if (result.ok) {
      setEmail('');
      setError(null);
    } else {
      setError(errorText(result.error));
    }
  }

  async function revoke(target: string) {
    const result = await backend.command('invite.revoke', { email: target });
    if (!result.ok) setError(errorText(result.error));
  }

  return (
    <section>
      <h1>{strings.invites.title}</h1>
      <form onSubmit={submit}>
        <ListSection>
          <ListContent>
            <div className="row end">
              <Field
                className="grow"
                label={strings.invites.emailLabel}
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={busy}>
                {strings.invites.send}
              </Button>
            </div>
          </ListContent>
        </ListSection>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {!invites.data && (invites.error ? <Notice tone="error">{strings.genericError}</Notice> : <Loading />)}
      <ListSection header={strings.invites.title} footer={invites.data?.length === 0 ? strings.invites.empty : undefined}>
        {invites.data?.map((invite) => (
          <ListRow
            key={invite.email}
            title={invite.email}
            trailing={<Badge tone={invite.state === 'pending' ? 'neutral' : invite.state === 'accepted' ? 'brand' : 'danger'}>{STATE_LABEL[invite.state]}</Badge>}
            swipeActions={invite.state === 'pending' ? [{ label: strings.invites.revoke, tone: 'danger', onClick: () => void revoke(invite.email) }] : undefined}
          />
        ))}
      </ListSection>
    </section>
  );
}
