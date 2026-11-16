// Lessons recorded by hand, before the agenda exists (docs/spec/pacotes-e-pagamentos.md, "Aula dada
// e falta" and "Saldo"). A lesson draws 1 from one package, however many students it has.
import type { ClassWithoutPackage, LessonOutcome, PackageSummary, RegisterClassResult, WithoutPackageReason } from '../../src/application/api-contract';
import { dataEmSaoPaulo, pacoteDaAula, type PacoteCandidato } from '../../src/domain/pacotes';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import type { Member } from './members';
import { loadPackages, studentNames, summarize, todayIn, type PackageState } from './package-data';
import { isDate } from './plans';

const OUTCOMES: readonly LessonOutcome[] = ['given', 'missed_charged', 'missed_waived'];

function startsAt(date: string): string {
  // Registered without a time: noon in São Paulo, which keeps the day right in any time zone.
  return new Date(`${date}T12:00:00-03:00`).toISOString();
}

const candidate = (state: PackageState): PacoteCandidato => ({
  id: state.row.id,
  titularId: state.row.holder_id,
  participanteId: state.row.participant_id,
  situacao: state.resumo.situacao,
  pagamentoPendente: state.pagamento.situacao === 'pendente',
});

export type Resolution =
  | { readonly choose: PackageSummary[] }
  | { readonly packageId: string | null; readonly withoutPackage: WithoutPackageReason | null; readonly pendingPayment: boolean };

/**
 * Which package a lesson of these students on `date` draws from: the rules of `pacoteDaAula`, unless
 * `explicit` is a package id or null ("sem pacote"). `choose` means the rules need an answer.
 * Returns null when `explicit` is not a package of these students.
 */
export function resolveConsumption(
  ctx: Context,
  studentIds: readonly string[],
  date: string,
  consumes: boolean,
  explicit: string | null | undefined,
): Resolution | null {
  // Situations as of the lesson's day, so a backdated lesson meets the package as it was then.
  const states = loadPackages(ctx, date);
  const related = [...states.values()].filter(
    (s) => s.row.closed_at === null && (studentIds.includes(s.row.holder_id) || (s.row.participant_id !== null && studentIds.includes(s.row.participant_id))),
  );

  let packageId: string | null = null;
  let withoutPackage: WithoutPackageReason | null = null;
  if (explicit === null) {
    withoutPackage = consumes ? 'escolhido' : null;
  } else if (typeof explicit === 'string') {
    const chosen = related.find((s) => s.row.id === explicit);
    if (!chosen) return null;
    const status = chosen.resumo.situacao;
    if (consumes && (status === 'esgotado' || status === 'vencido')) withoutPackage = status;
    else packageId = chosen.row.id;
  } else {
    const resolved = pacoteDaAula(studentIds as string[], related.map(candidate));
    if (resolved.tipo === 'pacote') packageId = resolved.pacoteId;
    else if (resolved.tipo === 'sem-pacote') withoutPackage = consumes ? resolved.motivo : null;
    else if (consumes) {
      const names = studentNames(ctx);
      return { choose: resolved.opcoes.map((id) => summarize(ctx, states.get(id)!, names, todayIn(ctx))) };
    }
  }
  return {
    packageId,
    withoutPackage,
    pendingPayment: packageId !== null && consumes && states.get(packageId)!.pagamento.situacao === 'pendente',
  };
}

/**
 * Records a lesson given or an absence. The package comes from `pacoteDaAula`, unless the trainer
 * chose one (or "sem pacote" with `packageId: null`). When the rules need an answer, nothing is
 * saved and the result lists the packages to choose from.
 */
export function registerClass(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<RegisterClassResult> {
  const today = todayIn(ctx);
  if (!isDate(input.date) || input.date > today) return failure('invalid');
  if (!OUTCOMES.includes(input.outcome as LessonOutcome)) return failure('invalid');
  const outcome = input.outcome as LessonOutcome;
  const ids = input.studentIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 2 || ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    return failure('invalid');
  }
  const studentIds = ids as string[];
  for (const id of studentIds) {
    if (ctx.sql.all('SELECT 1 FROM students WHERE id = ?', id).length === 0) return failure('not_found');
  }
  const explicit = input.packageId;
  if (explicit !== undefined && explicit !== null && typeof explicit !== 'string') return failure('invalid');

  const consumes = outcome !== 'missed_waived';
  const resolved = resolveConsumption(ctx, studentIds, input.date, consumes, explicit);
  if (resolved === null) return failure('invalid');
  if ('choose' in resolved) return { ok: true, value: { registered: false, choose: resolved.choose }, changed: [] };

  const classId = ctx.ids.next();
  ctx.sql.run('INSERT INTO classes (id, starts_at, status, created_at) VALUES (?, ?, ?, ?)', classId, startsAt(input.date), outcome === 'given' ? 'given' : 'missed', nowIso(ctx));
  for (const studentId of studentIds) {
    ctx.sql.run('INSERT INTO class_students (class_id, student_id, package_id, charge) VALUES (?, ?, ?, ?)', classId, studentId, resolved.packageId, consumes ? 'consumes' : 'waived');
  }
  return {
    ok: true,
    value: { registered: true, classId, packageId: resolved.packageId, withoutPackage: resolved.withoutPackage, pendingPayment: resolved.pendingPayment },
    changed: ['classes', 'packages'],
  };
}

/** Links a consuming lesson that is "sem pacote" to a package of one of its students. */
export function linkClassToPackage(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<null> {
  if (typeof input.classId !== 'string' || typeof input.packageId !== 'string') return failure('invalid');
  const [lesson] = ctx.sql.all<{ starts_at: string }>('SELECT starts_at FROM classes WHERE id = ?', input.classId);
  if (!lesson) return failure('not_found');
  const students = ctx.sql
    .all<{ student_id: string }>("SELECT student_id FROM class_students WHERE class_id = ? AND package_id IS NULL AND charge = 'consumes'", input.classId)
    .map((r) => r.student_id);
  if (students.length === 0) return failure('conflict');
  const target = loadPackages(ctx, dataEmSaoPaulo(lesson.starts_at)).get(input.packageId);
  if (!target) return failure('not_found');
  const takesPart = students.includes(target.row.holder_id) || (target.row.participant_id !== null && students.includes(target.row.participant_id));
  if (!takesPart) return failure('invalid');
  const status = target.resumo.situacao;
  if (status === 'encerrado' || status === 'esgotado' || status === 'vencido') return failure('conflict');
  ctx.sql.run("UPDATE class_students SET package_id = ? WHERE class_id = ? AND package_id IS NULL AND charge = 'consumes'", input.packageId, input.classId);
  return { ok: true, value: null, changed: ['classes', 'packages'] };
}

/** Removes a lesson recorded by mistake; the balance follows by itself. */
export function deleteClass(ctx: Context, _actor: Member, input: { classId?: unknown }): CommandResult<null> {
  if (typeof input.classId !== 'string') return failure('invalid');
  const [lesson] = ctx.sql.all<{ status: string; slot_on: string | null }>('SELECT status, slot_on FROM classes WHERE id = ?', input.classId);
  if (!lesson) return failure('not_found');
  if (lesson.slot_on !== null && lesson.status === 'scheduled') {
    // A day of a fixed time stays on the books, or the generator would make it again (ADR-010).
    ctx.sql.run("UPDATE classes SET status = 'cancelled', confirmed_at = NULL WHERE id = ?", input.classId);
    return { ok: true, value: null, changed: ['classes'] };
  }
  ctx.sql.run('UPDATE classes SET rescheduled_from = NULL WHERE rescheduled_from = ?', input.classId);
  ctx.sql.run('DELETE FROM class_students WHERE class_id = ?', input.classId);
  ctx.sql.run('DELETE FROM classes WHERE id = ?', input.classId);
  return { ok: true, value: null, changed: ['classes', 'packages'] };
}

export function lessonsWithoutPackage(ctx: Context, _actor: Member, input: { studentId?: unknown }): ClassWithoutPackage[] | QueryError {
  if (typeof input.studentId !== 'string') return new QueryError('invalid');
  const rows = ctx.sql.all<{ class_id: string; starts_at: string; status: string; student_id: string }>(
    `SELECT c.id AS class_id, c.starts_at, c.status, cs2.student_id
       FROM class_students cs JOIN classes c ON c.id = cs.class_id
       JOIN class_students cs2 ON cs2.class_id = c.id
      WHERE cs.student_id = ? AND cs.charge = 'consumes' AND cs.package_id IS NULL
      ORDER BY c.starts_at, c.rowid, cs2.rowid`,
    input.studentId,
  );
  const lessons = new Map<string, { classId: string; date: string; outcome: LessonOutcome; studentIds: string[] }>();
  for (const r of rows) {
    const lesson = lessons.get(r.class_id) ?? { classId: r.class_id, date: dataEmSaoPaulo(r.starts_at), outcome: r.status === 'given' ? ('given' as const) : ('missed_charged' as const), studentIds: [] };
    lesson.studentIds.push(r.student_id);
    lessons.set(r.class_id, lesson);
  }
  return [...lessons.values()];
}
