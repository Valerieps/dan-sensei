// The single entry to the group's data. The Durable Object calls it; every method is synchronous,
// so a command runs alone and inside one transaction (ADR-004).
import type { ApiResult, CommandName, Commands, QueryName, Queries, Topic } from '../../src/application/api-contract';
import { agendaDay, agendaHome, agendaWeek, cancelClass, completeClass, confirmClass, createRecurrence, endRecurrence, generateAhead, markConfirmationAsked, markMissed, packageForecast, recurrencesOf, rescheduleClass, scheduleClass } from './agenda';
import { deleteClass, lessonsWithoutPackage, linkClassToPackage, registerClass } from './classes';
import { failure, QueryError, type CommandResult, type Context } from './context';
import { exportAll } from './export';
import { createExercise, exerciseChoicesQuery, exerciseTags, exerciseWarnings, getExercise, listExercises, setExerciseArchived, updateExercise } from './exercises';
import { createCondition, removeAlert, saveAnamnesis, saveParq, setAlert, signConsent, studentHealth } from './health';
import { addExercise, correctClass, deleteSet, editSet, finishClass, lastClassPlan, liveClass, liveOpen, previousLoads, recordSet, setPse, startClass, studentEffort } from './live';
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
import { deleteMonthlyPayment, monthlyDue, monthlyOf, registerMonthlyPayment, setMonthlyFee, setupMonthly } from './monthly';
import { createPayment, deletePayment, updatePayment } from './payments';
import { createPlan, listPlans, updatePlan } from './plans';
import { isAdmin } from '../../src/domain/group/roles';
import type { Clock, IdGenerator, Sql } from './ports';
import { migrate } from './schema';
import {
  addPrescribed,
  createProgram,
  createWorkout,
  deleteProgram,
  deleteWorkout,
  getWorkout,
  groupPrescribed,
  removePrescribed,
  renameWorkout,
  reorderWorkout,
  studentTraining,
  ungroupPrescribed,
  updatePrescribed,
  updateProgram,
} from './training';
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
  studentHealth,
  plans: listPlans,
  packagesOverview,
  package: getPackage,
  studentPackages,
  renewalPreview,
  lessonsWithoutPackage,
  monthly: monthlyOf,
  messageSettings: (ctx) => messageSettings(ctx),
  pendingStatements: (ctx) => pendingStatements(ctx),
  agendaDay,
  agendaWeek,
  agendaHome: (ctx) => agendaHome(ctx),
  monthlyDue: (ctx) => monthlyDue(ctx),
  recurrences: recurrencesOf,
  packageForecast,
  exercises: listExercises,
  exercise: getExercise,
  exerciseChoices: exerciseChoicesQuery,
  exerciseTags: (ctx) => exerciseTags(ctx),
  exerciseWarnings: (ctx) => exerciseWarnings(ctx),
  studentTraining,
  workout: getWorkout,
  liveClass,
  liveOpen: (ctx) => liveOpen(ctx),
  previousLoads,
  lastClassPlan,
  studentEffort,
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
  'consent.sign': signConsent,
  'parq.save': saveParq,
  'anamnesis.save': saveAnamnesis,
  'alert.set': setAlert,
  'alert.remove': removeAlert,
  'condition.create': createCondition,
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
  'class.schedule': scheduleClass,
  'recurrence.create': createRecurrence,
  'recurrence.end': endRecurrence,
  'class.reschedule': rescheduleClass,
  'class.cancel': cancelClass,
  'class.markMissed': markMissed,
  'class.complete': completeClass,
  'class.confirm': confirmClass,
  'class.markConfirmationAsked': markConfirmationAsked,
  'monthly.setup': setupMonthly,
  'monthly.setFee': setMonthlyFee,
  'monthly.registerPayment': registerMonthlyPayment,
  'monthly.deletePayment': deleteMonthlyPayment,
  'settings.setMessages': setMessageSettings,
  'message.markOpened': markMessageOpened,
  'exercise.create': createExercise,
  'exercise.update': updateExercise,
  'exercise.setArchived': setExerciseArchived,
  'program.create': createProgram,
  'program.update': updateProgram,
  'program.delete': deleteProgram,
  'workout.create': createWorkout,
  'workout.rename': renameWorkout,
  'workout.delete': deleteWorkout,
  'workout.reorder': reorderWorkout,
  'prescribed.add': addPrescribed,
  'prescribed.update': updatePrescribed,
  'prescribed.remove': removePrescribed,
  'prescribed.group': groupPrescribed,
  'prescribed.ungroup': ungroupPrescribed,
  'live.start': startClass,
  'live.addExercise': addExercise,
  'live.recordSet': recordSet,
  'live.editSet': editSet,
  'live.deleteSet': deleteSet,
  'live.setPse': setPse,
  'live.finish': finishClass,
  'live.correct': correctClass,
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
    return this.ctx.sql.transaction(() => (name.startsWith('live.') ? this.runOnce(name, handler, actor, asInput(input)) : handler(this.ctx, actor, asInput(input))));
  }

  /**
   * A command of the offline queue (ADR-009) applies once: the client's id is stored with the answer,
   * and a resend gets that answer back with nothing changed. Failures are not stored: a refused
   * command may be sent again after the cause is fixed.
   */
  private runOnce(name: string, handler: Handler<CommandResult<unknown>>, actor: Member, input: Input): CommandResult<unknown> {
    const id = input.clientCommandId;
    if (typeof id !== 'string' || id.length < 1 || id.length > 100) return failure('invalid');
    const [done] = this.ctx.sql.all<{ name: string; result: string }>('SELECT name, result FROM client_commands WHERE id = ?', id);
    if (done) return done.name === name ? { ok: true, value: JSON.parse(done.result), changed: [] } : failure('conflict');
    const result = handler(this.ctx, actor, input);
    if (result.ok) {
      this.ctx.sql.run('INSERT INTO client_commands (id, name, result, applied_at) VALUES (?, ?, ?, ?)', id, name, JSON.stringify(result.value), this.ctx.clock.now().toISOString());
    }
    return result;
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
    // Keeps the agenda generated ahead (ADR-010); a no-op until a new day brings a new week into range.
    const generated = this.ctx.sql.transaction(() => generateAhead(this.ctx));
    return generated > 0 ? ['classes', 'packages'] : [];
  }
}

function asInput(input: unknown): Input {
  return typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Input) : {};
}
