// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.
import type { Billing, StudentStatus } from '../domain/alunos/student';
import type { Role } from '../domain/group/roles';

export interface MemberView {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
  readonly roles: readonly Role[];
}

/** A row of the members screen: the e-mail only reaches admins. */
export interface MemberListItem extends MemberView {
  readonly email?: string;
}

export interface MeView extends MemberView {
  readonly email: string;
}

export type InviteState = 'pending' | 'accepted' | 'revoked';

export interface InviteView {
  readonly email: string;
  readonly state: InviteState;
  readonly invitedByName: string;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
}

export interface AddressView {
  readonly id: string;
  readonly label: string;
  readonly address: string;
  readonly isDefault: boolean;
}

export interface StudentView {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly birthDate: string | null;
  readonly heightCm: number | null;
  readonly emergencyContact: string;
  readonly status: StudentStatus;
  readonly billing: Billing;
  readonly notes: string;
  readonly addresses: readonly AddressView[];
}

/** The fields of the registration form; `addresses` with an `id` keep that address. */
export interface StudentFormInput {
  readonly name: string;
  readonly phone: string;
  readonly birthDate: string | null;
  readonly heightCm: number | null;
  readonly emergencyContact: string;
  readonly addresses: readonly { id?: string; label: string; address: string; isDefault: boolean }[];
}

/** Reads: `POST /api/query/<name>`. They never change anything. */
export interface Queries {
  me: { input: Record<string, never>; output: MeView };
  /** Every student that is not inactive, by name; `includeInactive` adds the inactive ones. */
  students: { input: { includeInactive?: boolean }; output: StudentView[] };
  student: { input: { id: string }; output: StudentView };
  members: { input: Record<string, never>; output: MemberListItem[] };
  /** Admins only. */
  invites: { input: Record<string, never>; output: InviteView[] };
}

/** Writes: `POST /api/command/<name>`. Each runs alone, in one transaction. */
export interface Commands {
  'invite.create': { input: { email: string }; output: InviteView };
  'invite.revoke': { input: { email: string }; output: null };
  'member.setRoles': { input: { memberId: string; roles: Role[] }; output: MemberView };
  /** Admins; never oneself, so the last admin stays. */
  'member.remove': { input: { memberId: string }; output: null };
  'member.rename': { input: { name: string }; output: MeView };
  /** Every new student bills by package (docs/spec/alunos.md). Failure `invalid` carries no detail: the form validates first. */
  'student.create': { input: StudentFormInput; output: StudentView };
  'student.update': { input: StudentFormInput & { id: string }; output: StudentView };
  'student.setStatus': { input: { id: string; status: StudentStatus }; output: StudentView };
  'student.setNotes': { input: { id: string; notes: string }; output: StudentView };
}

export type QueryName = keyof Queries;
export type CommandName = keyof Commands;

/** What a live message says changed; the screens that show it refetch. */
export type Topic = 'me' | 'members' | 'invites' | 'students';

export interface LiveMessage {
  readonly type: 'changed';
  readonly topics: readonly Topic[];
}

export type ApiError = 'unauthenticated' | 'forbidden' | 'not_found' | 'invalid' | 'conflict' | 'last_admin' | 'unavailable';

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };
