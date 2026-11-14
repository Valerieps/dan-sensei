// Message settings and the log of messages opened in WhatsApp (docs/spec/whatsapp.md, ADR-008).
import type { MessageSettings, PendingStatement } from '../../src/application/api-contract';
import { dataEmSaoPaulo } from '../../src/domain/pacotes';
import {
  CHAVE_PIX_MAX,
  MODELO_DA_RENOVACAO_PADRAO,
  MODELO_DO_EXTRATO_PADRAO,
  MODELO_MAX,
} from '../../src/domain/mensagens/extrato';
import { failure, nowIso, type CommandResult, type Context } from './context';
import type { Member } from './members';

const KEYS = { pixKey: 'pix_key', statementTemplate: 'template_statement', renewalTemplate: 'template_renewal' } as const;

function stored(ctx: Context, key: string): string | null {
  const [row] = ctx.sql.all<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : null;
}

export function loadMessageSettings(ctx: Context): MessageSettings {
  return {
    pixKey: stored(ctx, KEYS.pixKey) ?? '',
    statementTemplate: stored(ctx, KEYS.statementTemplate) ?? MODELO_DO_EXTRATO_PADRAO,
    renewalTemplate: stored(ctx, KEYS.renewalTemplate) ?? MODELO_DA_RENOVACAO_PADRAO,
  };
}

export function messageSettings(ctx: Context): MessageSettings {
  return loadMessageSettings(ctx);
}

function save(ctx: Context, key: string, value: string, fallback: string): void {
  if (value === '' || value === fallback) ctx.sql.run('DELETE FROM settings WHERE key = ?', key);
  else ctx.sql.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

export function setMessageSettings(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<MessageSettings> {
  const { pixKey, statementTemplate, renewalTemplate } = input;
  if (typeof pixKey !== 'string' || typeof statementTemplate !== 'string' || typeof renewalTemplate !== 'string') return failure('invalid');
  const pix = pixKey.trim();
  const statement = statementTemplate.trim();
  const renewal = renewalTemplate.trim();
  if (pix.length > CHAVE_PIX_MAX || statement.length > MODELO_MAX || renewal.length > MODELO_MAX) return failure('invalid');
  save(ctx, KEYS.pixKey, pix, '');
  save(ctx, KEYS.statementTemplate, statement, MODELO_DO_EXTRATO_PADRAO);
  save(ctx, KEYS.renewalTemplate, renewal, MODELO_DA_RENOVACAO_PADRAO);
  return { ok: true, value: loadMessageSettings(ctx), changed: ['messages'] };
}

/** Records that the trainer opened the message in WhatsApp; whether it was sent is unknowable. */
export function markMessageOpened(ctx: Context, actor: Member, input: Record<string, unknown>): CommandResult<null> {
  if (typeof input.studentId !== 'string' || input.kind !== 'statement') return failure('invalid');
  if (ctx.sql.all('SELECT 1 FROM students WHERE id = ?', input.studentId).length === 0) return failure('not_found');
  ctx.sql.run('INSERT INTO message_log (id, student_id, kind, opened_at, opened_by) VALUES (?, ?, ?, ?, ?)', ctx.ids.next(), input.studentId, input.kind, nowIso(ctx), actor.id);
  return { ok: true, value: null, changed: ['messages'] };
}

/**
 * Holders of a package (not closed, not inactive) whose latest lesson given has no statement
 * opened on or after its day. A pair lesson counts for the holder only: the participant gets none.
 */
export function pendingStatements(ctx: Context): PendingStatement[] {
  const lessons = ctx.sql.all<{ holder_id: string; name: string; starts_at: string }>(
    `SELECT p.holder_id, s.name, c.starts_at
       FROM class_students cs
       JOIN classes c ON c.id = cs.class_id
       JOIN packages p ON p.id = cs.package_id
       JOIN students s ON s.id = p.holder_id
      WHERE p.closed_at IS NULL AND s.status != 'inactive' AND c.status = 'given'`,
  );
  const lastLesson = new Map<string, { name: string; on: string }>();
  for (const lesson of lessons) {
    const on = dataEmSaoPaulo(lesson.starts_at);
    const known = lastLesson.get(lesson.holder_id);
    if (!known || on > known.on) lastLesson.set(lesson.holder_id, { name: lesson.name, on });
  }
  const opened = new Map<string, string>();
  for (const row of ctx.sql.all<{ student_id: string; opened_at: string }>("SELECT student_id, opened_at FROM message_log WHERE kind = 'statement'")) {
    const on = dataEmSaoPaulo(row.opened_at);
    if (on > (opened.get(row.student_id) ?? '')) opened.set(row.student_id, on);
  }
  return [...lastLesson]
    .filter(([id, lesson]) => (opened.get(id) ?? '') < lesson.on)
    .map(([studentId, lesson]) => ({ studentId, name: lesson.name, lastLessonOn: lesson.on }))
    .sort((a, b) => a.lastLessonOn.localeCompare(b.lastLessonOn) || a.name.localeCompare(b.name, 'pt-BR'));
}
