// Consent, PAR-Q, anamnesis and health alerts (docs/spec/termo-e-lgpd.md, docs/spec/alunos.md).
// The rule: without a signed term the app stores no anamnesis, PAR-Q or alert for the student.
import type { ConsentView, HealthAlertView, HealthConditionView, StudentHealth } from '../../src/application/api-contract';
import {
  conditionKey,
  isSignature,
  normalizeAlertNote,
  normalizeConditionName,
  normalizeGoals,
  normalizeParqAnswers,
  TERM_VERSION,
} from '../../src/domain/saude/saude';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import type { Member } from './members';

type Input = Record<string, unknown>;

const studentExists = (ctx: Context, id: string) => ctx.sql.all('SELECT 1 FROM students WHERE id = ?', id).length > 0;

/** The term the student signed last (the signature stays in the database). */
export function consentOf(ctx: Context, studentId: string): ConsentView | null {
  const [row] = ctx.sql.all<{ version: number; signed_at: string }>(
    'SELECT version, signed_at FROM consents WHERE student_id = ? ORDER BY signed_at DESC, rowid DESC LIMIT 1',
    studentId,
  );
  return row ? { version: row.version, signedAt: row.signed_at } : null;
}

interface AlertRow {
  id: string;
  student_id: string;
  condition_id: string;
  label: string;
  note: string;
}

const toAlert = (row: AlertRow): HealthAlertView => ({ id: row.id, conditionId: row.condition_id, label: row.label, note: row.note });

const ALERT_SQL = `SELECT a.id, a.student_id, a.condition_id, c.name AS label, a.note
  FROM student_alerts a JOIN health_conditions c ON c.id = a.condition_id`;

/** Alerts of one student, or of every student keyed by id, in the order they were marked. */
export function alertsOf(ctx: Context, studentId: string): HealthAlertView[] {
  return ctx.sql.all<AlertRow>(`${ALERT_SQL} WHERE a.student_id = ? ORDER BY a.rowid`, studentId).map(toAlert);
}

export function alertsByStudent(ctx: Context): Map<string, HealthAlertView[]> {
  const byStudent = new Map<string, HealthAlertView[]>();
  for (const row of ctx.sql.all<AlertRow>(`${ALERT_SQL} ORDER BY a.rowid`)) {
    byStudent.set(row.student_id, [...(byStudent.get(row.student_id) ?? []), toAlert(row)]);
  }
  return byStudent;
}

export function consentsByStudent(ctx: Context): Map<string, ConsentView> {
  const map = new Map<string, ConsentView>();
  for (const row of ctx.sql.all<{ student_id: string; version: number; signed_at: string }>('SELECT student_id, version, signed_at FROM consents ORDER BY signed_at, rowid')) {
    map.set(row.student_id, { version: row.version, signedAt: row.signed_at });
  }
  return map;
}

function conditions(ctx: Context): HealthConditionView[] {
  return ctx.sql.all<HealthConditionView>('SELECT id, name FROM health_conditions WHERE archived = 0 ORDER BY name COLLATE NOCASE');
}

export function studentHealth(ctx: Context, _actor: Member, input: Input): StudentHealth | QueryError {
  if (typeof input.studentId !== 'string') return new QueryError('invalid');
  if (!studentExists(ctx, input.studentId)) return new QueryError('not_found');
  const [parq] = ctx.sql.all<{ answers: string; answered_at: string }>(
    'SELECT answers, answered_at FROM parq_responses WHERE student_id = ? ORDER BY answered_at DESC, rowid DESC LIMIT 1',
    input.studentId,
  );
  const [goals] = ctx.sql.all<{ main_goal: string; secondary_goals: string }>('SELECT main_goal, secondary_goals FROM anamneses WHERE student_id = ?', input.studentId);
  return {
    consent: consentOf(ctx, input.studentId),
    parq: parq ? { answers: JSON.parse(parq.answers) as boolean[], answeredAt: parq.answered_at } : null,
    mainGoal: goals?.main_goal ?? '',
    secondaryGoals: goals ? (JSON.parse(goals.secondary_goals) as string[]) : [],
    alerts: alertsOf(ctx, input.studentId),
    conditions: conditions(ctx),
  };
}

/** The student reads the term on the iPad and signs; each signature keeps the version it was for. */
export function signConsent(ctx: Context, actor: Member, input: Input): CommandResult<ConsentView> {
  if (typeof input.studentId !== 'string' || input.version !== TERM_VERSION || !isSignature(input.signature)) return failure('invalid');
  if (!studentExists(ctx, input.studentId)) return failure('not_found');
  const signedAt = nowIso(ctx);
  ctx.sql.run('INSERT INTO consents (id, student_id, version, signature, signed_at, collected_by) VALUES (?, ?, ?, ?, ?, ?)', ctx.ids.next(), input.studentId, TERM_VERSION, input.signature, signedAt, actor.id);
  return { ok: true, value: { version: TERM_VERSION, signedAt }, changed: ['students'] };
}

/** Common checks of the commands that store health data: the student exists and signed the term. */
function guard(ctx: Context, input: Input): { studentId: string } | ReturnType<typeof failure> {
  if (typeof input.studentId !== 'string') return failure('invalid');
  if (!studentExists(ctx, input.studentId)) return failure('not_found');
  if (!consentOf(ctx, input.studentId)) return failure('consent_required');
  return { studentId: input.studentId };
}

const failed = (g: ReturnType<typeof guard>): g is ReturnType<typeof failure> => 'ok' in g;

export function saveParq(ctx: Context, _actor: Member, input: Input): CommandResult<null> {
  const g = guard(ctx, input);
  if (failed(g)) return g;
  const answers = normalizeParqAnswers(input.answers);
  if (!answers) return failure('invalid');
  ctx.sql.run('INSERT INTO parq_responses (id, student_id, answers, answered_at) VALUES (?, ?, ?, ?)', ctx.ids.next(), g.studentId, JSON.stringify(answers), nowIso(ctx));
  return { ok: true, value: null, changed: ['students'] };
}

export function saveAnamnesis(ctx: Context, _actor: Member, input: Input): CommandResult<null> {
  const g = guard(ctx, input);
  if (failed(g)) return g;
  const goals = normalizeGoals({ main: input.main, secondary: input.secondary });
  if (!goals) return failure('invalid');
  ctx.sql.run(
    `INSERT INTO anamneses (student_id, main_goal, secondary_goals, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (student_id) DO UPDATE SET main_goal = excluded.main_goal, secondary_goals = excluded.secondary_goals, updated_at = excluded.updated_at`,
    g.studentId,
    goals.main,
    JSON.stringify(goals.secondary),
    nowIso(ctx),
  );
  return { ok: true, value: null, changed: ['students'] };
}

export function setAlert(ctx: Context, _actor: Member, input: Input): CommandResult<HealthAlertView> {
  const g = guard(ctx, input);
  if (failed(g)) return g;
  const note = normalizeAlertNote(input.note);
  if (note === null || typeof input.conditionId !== 'string') return failure('invalid');
  if (ctx.sql.all('SELECT 1 FROM health_conditions WHERE id = ? AND archived = 0', input.conditionId).length === 0) return failure('not_found');
  ctx.sql.run(
    `INSERT INTO student_alerts (id, student_id, condition_id, note, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (student_id, condition_id) DO UPDATE SET note = excluded.note`,
    ctx.ids.next(),
    g.studentId,
    input.conditionId,
    note,
    nowIso(ctx),
  );
  const alert = alertsOf(ctx, g.studentId).find((a) => a.conditionId === input.conditionId)!;
  return { ok: true, value: alert, changed: ['students'] };
}

/** Removing an alert needs no term: it only ever takes data away. */
export function removeAlert(ctx: Context, _actor: Member, input: Input): CommandResult<null> {
  if (typeof input.studentId !== 'string' || typeof input.conditionId !== 'string') return failure('invalid');
  ctx.sql.run('DELETE FROM student_alerts WHERE student_id = ? AND condition_id = ?', input.studentId, input.conditionId);
  return { ok: true, value: null, changed: ['students'] };
}

export function createCondition(ctx: Context, _actor: Member, input: Input): CommandResult<HealthConditionView> {
  const name = normalizeConditionName(input.name);
  if (!name) return failure('invalid');
  const key = conditionKey(name);
  const [existing] = ctx.sql.all<{ id: string; archived: number }>('SELECT id, archived FROM health_conditions WHERE name_key = ?', key);
  if (existing) {
    if (existing.archived === 0) return failure('conflict');
    ctx.sql.run('UPDATE health_conditions SET archived = 0, name = ? WHERE id = ?', name, existing.id);
    return { ok: true, value: { id: existing.id, name }, changed: ['students'] };
  }
  const id = ctx.ids.next();
  ctx.sql.run('INSERT INTO health_conditions (id, name, name_key) VALUES (?, ?, ?)', id, name, key);
  return { ok: true, value: { id, name }, changed: ['students'] };
}
