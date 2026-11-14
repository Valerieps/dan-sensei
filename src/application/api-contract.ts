// The contract between the app and the server: query and command names, inputs and outputs.
// Types only. The server imports it with `import type`, so nothing here runs on either side.
import type { Billing, StudentStatus } from '../domain/alunos/student';
import type { Role } from '../domain/group/roles';
import type { NivelDeUrgencia, SituacaoDoPacote } from '../domain/pacotes';

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

/** Dates are "YYYY-MM-DD" in America/Sao_Paulo, months "YYYY-MM"; money is integer cents. */
export type PaymentMethod = 'pix' | 'cash' | 'card';

export interface PlanView {
  readonly id: string;
  readonly name: string;
  readonly classes: number;
  /** Price of one lesson, in cents; the plan's total is `classes` times this. */
  readonly priceCents: number;
  readonly validityDays: number;
  readonly active: boolean;
}

export interface PlanInput {
  readonly name: string;
  readonly classes: number;
  readonly priceCents: number;
  readonly validityDays: number;
}

export interface PaymentView {
  readonly id: string;
  readonly packageId: string;
  readonly paidOn: string;
  readonly amountCents: number;
  readonly method: PaymentMethod;
}

export interface PaymentInput {
  readonly paidOn: string;
  readonly amountCents: number;
  readonly method: PaymentMethod;
}

/** Everything about a package that is calculated (balance, due date, status), never stored. */
export interface PackageSummary {
  readonly id: string;
  readonly holderId: string;
  readonly holderName: string;
  readonly participantId: string | null;
  readonly participantName: string | null;
  readonly planId: string;
  readonly planName: string;
  /** New lessons bought (the plan's, possibly edited); transferred ones come on top. */
  readonly classes: number;
  readonly priceCents: number;
  readonly validityDays: number;
  /** What the package costs: `classes` times `priceCents`. */
  readonly totalCents: number;
  readonly transferredIn: number;
  readonly usedBeforeApp: number;
  /** New plus transferred lessons. */
  readonly total: number;
  readonly used: number;
  readonly remaining: number;
  readonly status: SituacaoDoPacote;
  /** Day of the first consuming lesson; null while awaiting start. */
  readonly firstClassOn: string | null;
  readonly dueOn: string | null;
  /** The due date before any pause. */
  readonly originalDueOn: string | null;
  readonly pausedToday: boolean;
  /** Paused days that count against the 30-day limit. */
  readonly pausedDaysInLimit: number;
  readonly paymentStatus: 'paid' | 'pending';
  readonly paidCents: number;
  readonly missingCents: number;
  readonly createdOn: string;
  /** "15 aulas (12 novas + 3 transferidas)". */
  readonly origin: string;
  readonly closedNote: string | null;
}

export interface PackageFormInput {
  readonly holderId: string;
  readonly participantId?: string | null;
  readonly planId: string;
  /** Overrides of the plan's values; omitted means the plan's. */
  readonly classes?: number;
  readonly priceCents?: number;
  readonly validityDays?: number;
  /** Starting balance: lessons used before the app, and the day of the first one. */
  readonly usedBeforeApp?: number;
  readonly firstClassOn?: string | null;
  readonly payments?: readonly PaymentInput[];
}

export interface RenewalPreview {
  /** The package that a new one for this holder would close; null when there is none. */
  readonly previousPackageId: string | null;
  readonly transferred: number;
  /** "3 aulas do pacote anterior serão transferidas"; null when nothing moves. */
  readonly notice: string | null;
}

export interface MonthlyPaymentView {
  readonly id: string;
  /** The month the fee refers to, "YYYY-MM". */
  readonly month: string;
  readonly paidOn: string;
  readonly amountCents: number;
  readonly method: PaymentMethod;
}

/** A monthly student's fee; what is pending is calculated, never stored. */
export interface MonthlyView {
  readonly studentId: string;
  readonly amountCents: number;
  /** Day of the month the fee is due, 1 to 31. */
  readonly dueDay: number;
  /** Last month paid ("YYYY-MM"): the starting balance or the latest registered payment; null when none. */
  readonly lastPaidMonth: string | null;
  /** Months past their due day without payment, oldest first. */
  readonly pendingMonths: readonly string[];
  /** Newest first. */
  readonly payments: readonly MonthlyPaymentView[];
}

export interface MonthlyFeeInput {
  readonly amountCents: number;
  readonly dueDay: number;
}

export interface MonthlyPaymentInput {
  readonly month: string;
  readonly paidOn: string;
  readonly amountCents: number;
  readonly method: PaymentMethod;
}

/** The trainer's message settings; an empty template means "use the default" and is never stored. */
export interface MessageSettings {
  readonly pixKey: string;
  readonly statementTemplate: string;
  readonly renewalTemplate: string;
}

export type MessageKind = 'statement';

/** A student whose package statement has not been opened in WhatsApp since the last lesson. */
export interface PendingStatement {
  readonly studentId: string;
  readonly name: string;
  readonly lastLessonOn: string;
}

/** A student's next scheduled lesson, as the cards show it. */
export interface NextClass {
  readonly id: string;
  readonly date: string;
  readonly time: string;
}

/** A monthly student the Início asks about: the fee is due today or is past due and unpaid. */
export interface MonthlyDue {
  readonly studentId: string;
  readonly name: string;
  readonly amountCents: number;
  readonly dueDay: number;
  readonly dueToday: boolean;
  /** The month to register: the oldest pending one, or the current month on the due day. */
  readonly month: string;
  readonly pendingMonths: readonly string[];
}

export interface UrgencyItem {
  readonly studentId: string;
  readonly name: string;
  readonly billing: Billing;
  /** Months of a monthly student's fee past due and unpaid; empty for everyone else. */
  readonly pendingMonths: readonly string[];
  /** The package shown is one the student only takes part in (pair package). */
  readonly asParticipant: boolean;
  readonly package: PackageSummary | null;
  readonly urgency: NivelDeUrgencia;
  readonly highlighted: boolean;
  /** Lessons recorded "sem pacote" waiting to be linked. */
  readonly lessonsWithoutPackage: number;
  /** The student's next scheduled lesson; null when none is scheduled. */
  readonly nextClass: NextClass | null;
}

export interface GlobalPauseView {
  readonly id: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface PackagesOverview {
  readonly month: string;
  /** Payments dated in the month. */
  readonly receivedCents: number;
  /** Students whose package is expired, used up or about to be (urgency 2 or 3), Avulso aside. */
  readonly expectedRenewals: number;
  /** Already in urgency order. */
  readonly items: UrgencyItem[];
  /** "Pausar todos" periods that have not ended yet. */
  readonly globalPauses: GlobalPauseView[];
}

export type LessonOutcome = 'given' | 'missed_charged' | 'missed_waived';

export interface StatementLesson {
  readonly classId: string;
  readonly date: string;
  readonly outcome: LessonOutcome;
  readonly studentIds: readonly string[];
  readonly studentNames: readonly string[];
}

export interface StatementPause {
  /** The package pause's id, or the global pause's id when `general`. */
  readonly id: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly reason: string | null;
  /** "Pausar todos": never counts against the 30 days. */
  readonly general: boolean;
}

export interface PackageStatement {
  readonly summary: PackageSummary;
  /** Lessons that drew from this package, newest first. */
  readonly lessons: StatementLesson[];
  readonly pauses: StatementPause[];
  readonly payments: PaymentView[];
  readonly transferredFrom: { readonly packageId: string; readonly count: number } | null;
  readonly transferredTo: { readonly packageId: string; readonly count: number; readonly note: string } | null;
}

export interface ClassWithoutPackage {
  readonly classId: string;
  readonly date: string;
  readonly outcome: LessonOutcome;
  readonly studentIds: readonly string[];
}

export type WithoutPackageReason = 'sem-pacote-cadastrado' | 'esgotado' | 'vencido' | 'escolhido';

export interface RegisterClassInput {
  readonly date: string;
  readonly outcome: LessonOutcome;
  /** One or two students. */
  readonly studentIds: readonly string[];
  /** Which package it draws from; omitted lets the rules decide, null forces "sem pacote". */
  readonly packageId?: string | null;
}

export type RegisterClassResult =
  | {
      readonly registered: true;
      readonly classId: string;
      readonly packageId: string | null;
      /** Why the lesson is "sem pacote"; null when it drew from a package or consumes nothing. */
      readonly withoutPackage: WithoutPackageReason | null;
      readonly pendingPayment: boolean;
    }
  /** Nothing was saved: the trainer must pick one of these packages and send it again. */
  | { readonly registered: false; readonly choose: readonly PackageSummary[] };

/** The agenda (docs/spec/agenda.md). Times are "HH:MM" in America/Sao_Paulo; weekdays are ISO (1 = Monday ... 7 = Sunday). */
export type ClassStatus = 'scheduled' | 'given' | 'missed' | 'cancelled' | 'rescheduled';

export interface AgendaClass {
  readonly id: string;
  /** The instant, ISO in UTC. */
  readonly startsAt: string;
  readonly date: string;
  readonly time: string;
  readonly durationMin: number;
  readonly status: ClassStatus;
  /** For `missed`: whether the absence draws from the package. Null for the other statuses. */
  readonly absenceCharged: boolean | null;
  readonly confirmed: boolean;
  /** The confirmation message was opened in WhatsApp; asked and not confirmed is highlighted on the day. */
  readonly confirmationAsked: boolean;
  /** The address of the lesson: the chosen one, or the first student's default; null when there is none. */
  readonly address: string | null;
  readonly students: readonly { readonly id: string; readonly name: string }[];
  readonly recurrenceId: string | null;
  /** The lesson this one replaced, when it came from a reschedule. */
  readonly rescheduledFrom: string | null;
  /** The package a given or charged lesson drew from; null with `withoutPackage` for "sem pacote". */
  readonly packageId: string | null;
  readonly withoutPackage: boolean;
}

export interface RecurrenceView {
  readonly id: string;
  readonly studentIds: readonly string[];
  readonly studentNames: readonly string[];
  readonly weekday: number;
  readonly time: string;
  readonly durationMin: number;
  readonly address: string | null;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

export interface ScheduleClassInput {
  /** One or two students. */
  readonly studentIds: readonly string[];
  readonly date: string;
  readonly time: string;
  /** 1 to 60; default 60. */
  readonly durationMin?: number;
  /** An address of one of the students; omitted or null means the first student's default. */
  readonly addressId?: string | null;
}

export interface RecurrenceInput {
  readonly studentIds: readonly string[];
  readonly weekday: number;
  readonly time: string;
  readonly durationMin?: number;
  readonly addressId?: string | null;
  /** First day; default today. */
  readonly startsOn?: string;
}

export type AbsenceDecision = 'charge' | 'waive';

export type CancelClassResult =
  | { readonly done: true; readonly status: 'cancelled' | 'missed'; readonly charged: boolean }
  /** Less than 24 h: nothing changed; ask "cobrar ou abonar?" with `suggested` selected, then send again with `decision`. */
  | { readonly done: false; readonly needsDecision: true; readonly suggested: AbsenceDecision }
  /** A charged absence needs a package choice: nothing changed; pick one and send it again as `packageId`. */
  | { readonly done: false; readonly needsPackage: true; readonly choose: readonly PackageSummary[] };

/** One live package whose forecast goes past its validity. */
export interface ForecastWarning {
  readonly packageId: string;
  readonly holderId: string;
  readonly holderName: string;
  readonly message: string;
}

export interface PackageForecast {
  readonly packageId: string;
  /** Date of the lesson that uses the last one left; null when the agenda has too few lessons. */
  readonly lastClassOn: string | null;
  readonly dueOn: string | null;
  /** True while the package awaits start: the due date comes from the first scheduled lesson. */
  readonly dueOnForecast: boolean;
  readonly exceedsValidity: boolean;
  readonly missingClasses: boolean;
  /** "12ª aula prevista para 20/01/2027; validade 15/01/2027", only when it exceeds. */
  readonly warning: string | null;
}

export interface AgendaWeek {
  readonly from: string;
  readonly to: string;
  readonly classes: readonly AgendaClass[];
}

/** What the Início needs from the agenda. */
export interface AgendaHome {
  readonly today: string;
  /** Today's lessons in time order, without the rescheduled and cancelled ones. */
  readonly classes: readonly AgendaClass[];
  /** The scheduled lesson happening now (start until the planned end), if any. */
  readonly currentClassId: string | null;
  /** The next scheduled lesson today that has not started. */
  readonly nextClassId: string | null;
  /** Tomorrow's scheduled lessons, with `confirmed` telling who still has not confirmed. */
  readonly tomorrow: readonly AgendaClass[];
  readonly forecastWarnings: readonly ForecastWarning[];
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
  plans: { input: { includeInactive?: boolean }; output: PlanView[] };
  /** The Alunos e pacotes screen: every non-inactive student, in urgency order, with the month's numbers. */
  packagesOverview: { input: Record<string, never>; output: PackagesOverview };
  /** The statement of one package: lessons, pauses, payments and transfers. */
  package: { input: { id: string }; output: PackageStatement };
  /** Every package the student holds or takes part in, newest first. */
  studentPackages: { input: { studentId: string }; output: PackageSummary[] };
  /** What a new package for this holder would transfer from the current one. */
  renewalPreview: { input: { holderId: string }; output: RenewalPreview };
  /** Lessons of the student recorded "sem pacote", oldest first. */
  lessonsWithoutPackage: { input: { studentId: string }; output: ClassWithoutPackage[] };
  /** A monthly student's fee and payments; `not_found` for a student without a monthly fee. */
  monthly: { input: { studentId: string }; output: MonthlyView };
  /** The PIX key and the message templates, defaults filled in. */
  messageSettings: { input: Record<string, never>; output: MessageSettings };
  /** Holders whose last lesson's statement was not opened in WhatsApp yet, oldest lesson first. */
  pendingStatements: { input: Record<string, never>; output: PendingStatement[] };
  /** The day's grid: every lesson of the date but the rescheduled ones, in time order. */
  agendaDay: { input: { date: string }; output: AgendaClass[] };
  /** The Monday-to-Sunday week that holds `date`. */
  agendaWeek: { input: { date: string }; output: AgendaWeek };
  agendaHome: { input: Record<string, never>; output: AgendaHome };
  /** Monthly students whose fee is due today or past due and unpaid, by name. */
  monthlyDue: { input: Record<string, never>; output: MonthlyDue[] };
  /** Fixed times still running, optionally those of one student. */
  recurrences: { input: { studentId?: string }; output: RecurrenceView[] };
  /** Last lesson forecast against the due date; `not_found` for an unknown or closed package. */
  packageForecast: { input: { packageId: string }; output: PackageForecast };
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
  'plan.create': { input: PlanInput; output: PlanView };
  'plan.update': { input: PlanInput & { id: string; active?: boolean }; output: PlanView };
  /**
   * Sells a package. When the holder still has a live package, it is closed in the same
   * transaction and its leftover lessons move to the new one (see `renewalPreview`).
   */
  'package.create': { input: PackageFormInput; output: PackageSummary };
  /** Going over 30 days of own pause needs a `reason`; failure `invalid` otherwise. */
  'package.pause': { input: { packageId: string; startsOn: string; endsOn: string; reason?: string }; output: StatementPause };
  'package.removePause': { input: { id: string }; output: null };
  /** "Pausar todos os pacotes". */
  'pause.createGlobal': { input: { startsOn: string; endsOn: string }; output: GlobalPauseView };
  'pause.removeGlobal': { input: { id: string }; output: null };
  'payment.create': { input: PaymentInput & { packageId: string }; output: PaymentView };
  'payment.update': { input: PaymentInput & { id: string }; output: PaymentView };
  'payment.delete': { input: { id: string }; output: null };
  /** Records a lesson given or an absence by hand (1a). */
  'class.register': { input: RegisterClassInput; output: RegisterClassResult };
  /** Links a "sem pacote" lesson to a package of one of its students. */
  'class.linkToPackage': { input: { classId: string; packageId: string }; output: null };
  'class.delete': { input: { classId: string }; output: null };
  /** A one-off lesson (1b). Failure `invalid` for a past date, more than 2 students or 60+ minutes. */
  'class.schedule': { input: ScheduleClassInput; output: AgendaClass };
  /** A fixed weekly time; the lessons are generated ahead (ADR-010). */
  'recurrence.create': { input: RecurrenceInput; output: RecurrenceView };
  /** The last day of the fixed time; scheduled lessons after it are removed. */
  'recurrence.end': { input: { id: string; endsOn: string }; output: null };
  /**
   * Moves a scheduled lesson to another date and time, keeping the link to the original.
   * `following` moves this and the next lessons of its fixed time by the same shift.
   */
  'class.reschedule': { input: { classId: string; date: string; time: string; scope: 'this' | 'following' }; output: AgendaClass };
  /** Less than 24 h before the start the answer asks for `decision` (see `CancelClassResult`). */
  'class.cancel': { input: { classId: string; byTrainer?: boolean; decision?: AbsenceDecision; packageId?: string | null }; output: CancelClassResult };
  /** A no-show: charged by default, `decision: 'waive'` to waive. Like `class.register`, it may answer with packages to choose from. */
  'class.markMissed': { input: { classId: string; decision?: AbsenceDecision; packageId?: string | null }; output: RegisterClassResult };
  /** The scheduled lesson happened; draws from the package by the rules of `class.register`. */
  'class.complete': { input: { classId: string; packageId?: string | null }; output: RegisterClassResult };
  /** The student answered the confirmation; `confirmed: false` takes it back. */
  'class.confirm': { input: { classId: string; confirmed?: boolean }; output: null };
  /** The confirmation was opened in WhatsApp (ADR-008); a scheduled lesson only, `conflict` otherwise. */
  'class.markConfirmationAsked': { input: { classId: string }; output: null };
  /**
   * Starting balance of an old monthly student (1a): makes the student monthly with the fee, the
   * due day and the last month paid. Failure `conflict` when the student already has packages.
   */
  'monthly.setup': { input: MonthlyFeeInput & { studentId: string; lastPaidMonth: string | null }; output: MonthlyView };
  /** Changes the fee or the due day of a monthly student. */
  'monthly.setFee': { input: MonthlyFeeInput & { studentId: string }; output: MonthlyView };
  /** Failure `conflict` when that month already has a payment. */
  'monthly.registerPayment': { input: MonthlyPaymentInput & { studentId: string }; output: MonthlyPaymentView };
  'monthly.deletePayment': { input: { id: string }; output: null };
  /** An empty template or key goes back to the default (the key to none). */
  'settings.setMessages': { input: MessageSettings; output: MessageSettings };
  /** The app opened the message in WhatsApp; it cannot know it was sent (ADR-008). */
  'message.markOpened': { input: { studentId: string; kind: MessageKind }; output: null };
  /** Ends every session of a member (default: the actor's own), for a lost iPad or phone. */
  'session.signOutAll': { input: { memberId?: string }; output: null };
}

export type QueryName = keyof Queries;
export type CommandName = keyof Commands;

/** What a live message says changed; the screens that show it refetch. */
export type Topic = 'me' | 'members' | 'invites' | 'students' | 'plans' | 'packages' | 'payments' | 'classes' | 'monthly' | 'messages';

export interface LiveMessage {
  readonly type: 'changed';
  readonly topics: readonly Topic[];
}

export type ApiError = 'unauthenticated' | 'forbidden' | 'not_found' | 'invalid' | 'conflict' | 'last_admin' | 'unavailable';

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };
