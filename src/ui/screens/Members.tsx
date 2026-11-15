import { useState, type FormEvent } from 'react';
import type { ApiError, MeView, MemberListItem } from '../../application/api-contract';
import { initials } from '../../domain/alunos/student';
import { NAME_MAX_LENGTH, normalizeName } from '../../domain/group/profile';
import { canManageGroup, isAdmin } from '../../domain/group/roles';
import { strings } from '../../domain/strings';
import { useServices } from '../backend-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { ListContent, ListRow, ListSection } from '../components/GroupedList';
import { Notice } from '../components/Notice';
import { useQuery } from '../use-query';

function errorText(error: ApiError): string {
  if (error === 'last_admin') return strings.members.lastAdmin;
  if (error === 'forbidden') return strings.forbidden;
  return strings.genericError;
}

/** The member's own name: it starts as the Google account's and can be changed. */
function MyName({ me }: { me: MeView }) {
  const { backend } = useServices();
  const [name, setName] = useState(me.name);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'invalid' | 'failed'>('idle');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (normalizeName(name) === null) {
      setStatus('invalid');
      return;
    }
    setStatus('saving');
    const result = await backend.command('member.rename', { name });
    setStatus(result.ok ? 'saved' : 'failed');
  }

  return (
    <form onSubmit={submit} noValidate>
      <ListSection>
        <ListContent>
          <div className="row end">
            <Field
              className="grow"
              label={strings.members.myName}
              value={name}
              maxLength={NAME_MAX_LENGTH}
              error={status === 'invalid' ? strings.members.nameInvalid : null}
              onChange={(e) => {
                setName(e.target.value);
                setStatus('idle');
              }}
            />
            <Button type="submit" variant="secondary" disabled={status === 'saving'}>
              {strings.members.saveName}
            </Button>
          </div>
          {status === 'saved' && <p className="small strong">{strings.members.nameSaved}</p>}
          {status === 'failed' && <Notice tone="error">{strings.genericError}</Notice>}
        </ListContent>
      </ListSection>
    </form>
  );
}

export function Members({ me }: { me: MeView }) {
  const { backend } = useServices();
  const members = useQuery('members', {}, ['members']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const manages = canManageGroup(me);

  async function toggleAdmin(member: MemberListItem) {
    setBusy(member.id);
    const result = await backend.command('member.setRoles', { memberId: member.id, roles: isAdmin(member) ? [] : ['admin'] });
    setBusy(null);
    setError(result.ok ? null : errorText(result.error));
  }

  async function remove(member: MemberListItem) {
    if (!window.confirm(strings.members.removeConfirm(member.name))) return;
    setBusy(member.id);
    const result = await backend.command('member.remove', { memberId: member.id });
    setBusy(null);
    setError(result.ok ? null : errorText(result.error));
  }

  return (
    <section>
      <h1>{strings.members.title}</h1>
      <MyName me={me} />
      {members.error && !members.data && <Notice tone="error">{strings.genericError}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <ListSection header={strings.members.title} footer={members.data?.length === 1 ? strings.members.empty : undefined}>
        {members.data?.map((member) => (
          <ListRow
            key={member.id}
            leading={
              member.photoUrl ? (
                <img className="avatar" src={member.photoUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="initials" aria-hidden="true">
                  {initials(member.name)}
                </span>
              )
            }
            title={member.id === me.id ? `${member.name} ${strings.members.you}` : member.name}
            subtitle={member.email ?? undefined}
            trailing={<Badge tone={isAdmin(member) ? 'brand' : 'neutral'}>{isAdmin(member) ? strings.members.admin : strings.members.member}</Badge>}
            swipeActions={
              manages && busy !== member.id
                ? [
                    { label: isAdmin(member) ? strings.members.revokeAdmin : strings.members.makeAdmin, onClick: () => void toggleAdmin(member) },
                    ...(member.id !== me.id ? [{ label: strings.members.remove, tone: 'danger' as const, onClick: () => void remove(member) }] : []),
                  ]
                : undefined
            }
          />
        ))}
      </ListSection>
    </section>
  );
}
