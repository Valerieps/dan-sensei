// The single entry to the group's data. The Durable Object calls it; every method is synchronous,
// so a command runs alone and inside one transaction (ADR-004).
import type { ApiResult, CommandName, Commands, QueryName, Queries, Topic } from '../../src/application/api-contract';
import { deleteClass, lessonsWithoutPackage, linkClassToPackage, registerClass } from './classes';
import { failure, QueryError, type CommandResult, type Context } from './context';
import { exportAll } from './export';
import { markMessageOpened, messageSettings, pendingStatements, setMessageSettings } from './messages';
import { createInvite, listInvites, revokeInvite } from './invites';
import {
  listMembers,
  me,
  memberForSession,
  removeMember,
  rename,
  setRoles,
  signIn,
  signOut,
  signOutEverywhere,
  type GoogleProfile,
  type Member,
  type SignInResult,
} from './members';
import { createGlobalPause, createPackage, getPackage, packagesOverview, pausePackage, removeGlobalPause, removePackagePause, renewalPreview, studentPackages } from './packages';
import { deleteMonthlyPayment, monthlyOf, registerMonthlyPayment, setMonthlyFee, setupMonthly } from './monthly';
import { createPayment, deletePayment, updatePayment } from './payments';
import { createPlan, listPlans, updatePlan } from './plans';
import { isAdmin } from '../../src/domain/group/roles';
import type { Clock, IdGenerator, Sql } from './ports';
import { migrate } from './schema';
import { createStudent, getStudent, listStudents, setStudentNotes, setStudentStatus, updateStudent } from './students';

type Input = Record<string, unknown>;

type Handler<T> = (ctx: Context, actor: Member, input: Input) => T;

/** Every query the API answers. A handler returns null when the actor may not see it. */
const QUERIES: { [N in QueryName]: Handler<Queries[N]['output'] | QueryError | null> } = {
  me: (_ctx, actor) => me(actor),
  members: (ctx, actor) => listMembers(ctx, actor),
  invites: (ctx, actor) => listInvites(ctx, actor),
  students: listStudents,
  student: getStudent,
  plans: listPlans,
  packagesOverview,
  package: getPackage,
  studentPackages,
  renewalPreview,
  lessonsWithoutPackage,
  monthly: monthlyOf,
  messageSettings: (ctx) => messageSettings(ctx),
  pendingStatements: (ctx) => pendingStatements(ctx),
};

/** Every command the API runs; each checks the actor's role itself. */
const COMMANDS: { [N in CommandName]: Handler<CommandResult<Commands[N]['output']>> } = {
  'invite.create': createInvite,
  'invite.revoke': revokeInvite,
  'member.setRoles': setRoles,
  'member.remove': removeMember,
  'member.rename': rename,
  'student.create': createStudent,
  'student.update': updateStudent,
  'student.setStatus': setStudentStatus,
  'student.setNotes': setStudentNotes,
  'plan.create': createPlan,
  'plan.update': updatePlan,
  'package.create': createPackage,
  'package.pause': pausePackage,
  'package.removePause': removePackagePause,
  'pause.createGlobal': createGlobalPause,
  'pause.removeGlobal': removeGlobalPause,
  'payment.create': createPayment,
  'payment.update': updatePayment,
  'payment.delete': deletePayment,
  'class.register': registerClass,
  'class.linkToPackage': linkClassToPackage,
  'class.delete': deleteClass,
  'monthly.setup': setupMonthly,
  'monthly.setFee': setMonthlyFee,
  'monthly.registerPayment': registerMonthlyPayment,
  'monthly.deletePayment': deleteMonthlyPayment,
  'settings.setMessages': setMessageSettings,
  'message.markOpened': markMessageOpened,
  'session.signOutAll': signOutEverywhere,
};

export class GroupService {
  private readonly ctx: Context;

  constructor(sql: Sql, clock: Clock, ids: IdGenerator) {
    this.ctx = { sql, clock, ids };
  }

  migrate(): void {
    migrate(this.ctx.sql);
  }

  signIn(profile: GoogleProfile, sessionHash: string, bootstrapAdminEmails: readonly string[]): SignInResult {
    return signIn(this.ctx, profile, sessionHash, bootstrapAdminEmails);
  }

  signOut(sessionHash: string): void {
    signOut(this.ctx, sessionHash);
  }

  memberForSession(sessionHash: string): Member | null {
    return memberForSession(this.ctx, sessionHash);
  }

  query(sessionHash: string, name: string, input: unknown): ApiResult<unknown> {
    const actor = this.memberForSession(sessionHash);
    if (!actor) return failure('unauthenticated');
    const handler = Object.hasOwn(QUERIES, name) ? QUERIES[name as QueryName] : undefined;
    if (!handler) return failure('not_found');
    const value = handler(this.ctx, actor, asInput(input));
    if (value instanceof QueryError) return failure(value.error);
    return value === null ? failure('forbidden') : { ok: true, value };
  }

  command(sessionHash: string, name: string, input: unknown): CommandResult<unknown> {
    const actor = this.memberForSession(sessionHash);
    if (!actor) return failure('unauthenticated');
    const handler = Object.hasOwn(COMMANDS, name) ? COMMANDS[name as CommandName] : undefined;
    if (!handler) return failure('not_found');
    return this.ctx.sql.transaction(() => handler(this.ctx, actor, asInput(input)));
  }

  /** Every table as CSV in one zip; null unless the session belongs to an admin. */
  exportData(sessionHash: string): Uint8Array | null {
    const actor = this.memberForSession(sessionHash);
    return actor && isAdmin(actor) ? exportAll(this.ctx) : null;
  }

  /**
   * Runs the time-based jobs that are due (ADR-004: one cron, every few minutes; each job decides
   * whether it is due). Returns the topics that changed, for the open apps.
   */
  tick(): Topic[] {
    this.ctx.sql.run('DELETE FROM sessions WHERE expires_at <= ?', this.ctx.clock.now().toISOString());
    return [];
  }
}

function asInput(input: unknown): Input {
  return typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Input) : {};
}
