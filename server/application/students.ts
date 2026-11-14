// Student registration, status and notes (docs/spec/alunos.md). Both admins use it; no student signs in.
import type { AddressView, StudentView } from '../../src/application/api-contract';
import { isStudentStatus, normalizeNotes, normalizeStudentInput, type StudentStatus } from '../../src/domain/alunos/student';
import { failure, nowIso, QueryError, type CommandResult, type Context } from './context';
import type { Member } from './members';

interface StudentRow {
  id: string;
  name: string;
  phone: string;
  birth_date: string | null;
  height_cm: number | null;
  emergency_contact: string;
  status: StudentStatus;
  billing: 'package' | 'monthly';
  notes: string;
}

interface AddressRow {
  id: string;
  student_id: string;
  label: string;
  address: string;
  is_default: number;
}

function toView(row: StudentRow, addresses: readonly AddressRow[]): StudentView {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    birthDate: row.birth_date,
    heightCm: row.height_cm,
    emergencyContact: row.emergency_contact,
    status: row.status,
    billing: row.billing,
    notes: row.notes,
    addresses: addresses
      .filter((a) => a.student_id === row.id)
      .map((a): AddressView => ({ id: a.id, label: a.label, address: a.address, isDefault: a.is_default === 1 })),
  };
}

function loadStudent(ctx: Context, id: string): StudentView | null {
  const [row] = ctx.sql.all<StudentRow>('SELECT * FROM students WHERE id = ?', id);
  if (!row) return null;
  return toView(row, ctx.sql.all<AddressRow>('SELECT * FROM student_addresses WHERE student_id = ? ORDER BY is_default DESC, rowid', id));
}

export function listStudents(ctx: Context, _actor: Member, input: { includeInactive?: unknown }): StudentView[] {
  const rows = ctx.sql.all<StudentRow>(
    input.includeInactive === true ? 'SELECT * FROM students ORDER BY name COLLATE NOCASE' : "SELECT * FROM students WHERE status <> 'inactive' ORDER BY name COLLATE NOCASE",
  );
  const addresses = ctx.sql.all<AddressRow>('SELECT * FROM student_addresses ORDER BY is_default DESC, rowid');
  return rows.map((row) => toView(row, addresses));
}

export function getStudent(ctx: Context, _actor: Member, input: { id?: unknown }): StudentView | QueryError {
  if (typeof input.id !== 'string') return new QueryError('invalid');
  return loadStudent(ctx, input.id) ?? new QueryError('not_found');
}

/** Replaces the student's addresses: the ones with a known id are kept (and edited), the rest go. */
function saveAddresses(ctx: Context, studentId: string, addresses: readonly { id?: string; label: string; address: string; isDefault: boolean }[]): void {
  const existing = ctx.sql.all<{ id: string }>('SELECT id FROM student_addresses WHERE student_id = ?', studentId).map((r) => r.id);
  const kept = new Set<string>();
  for (const a of addresses) {
    if (a.id && existing.includes(a.id) && !kept.has(a.id)) {
      kept.add(a.id);
      ctx.sql.run('UPDATE student_addresses SET label = ?, address = ?, is_default = ? WHERE id = ?', a.label, a.address, a.isDefault ? 1 : 0, a.id);
    } else {
      ctx.sql.run(
        'INSERT INTO student_addresses (id, student_id, label, address, is_default) VALUES (?, ?, ?, ?, ?)',
        ctx.ids.next(),
        studentId,
        a.label,
        a.address,
        a.isDefault ? 1 : 0,
      );
    }
  }
  for (const id of existing) if (!kept.has(id)) ctx.sql.run('DELETE FROM student_addresses WHERE id = ?', id);
}

/** Every new student is active and bills by package. */
export function createStudent(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<StudentView> {
  const parsed = normalizeStudentInput(input);
  if (!parsed.ok) return failure('invalid');
  const s = parsed.value;
  const id = ctx.ids.next();
  ctx.sql.run(
    "INSERT INTO students (id, name, phone, birth_date, height_cm, emergency_contact, status, billing, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, 'active', 'package', '', ?)",
    id,
    s.name,
    s.phone,
    s.birthDate,
    s.heightCm,
    s.emergencyContact,
    nowIso(ctx),
  );
  saveAddresses(ctx, id, s.addresses);
  return { ok: true, value: loadStudent(ctx, id)!, changed: ['students'] };
}

export function updateStudent(ctx: Context, _actor: Member, input: Record<string, unknown>): CommandResult<StudentView> {
  if (typeof input.id !== 'string') return failure('invalid');
  if (!loadStudent(ctx, input.id)) return failure('not_found');
  const parsed = normalizeStudentInput(input);
  if (!parsed.ok) return failure('invalid');
  const s = parsed.value;
  ctx.sql.run(
    'UPDATE students SET name = ?, phone = ?, birth_date = ?, height_cm = ?, emergency_contact = ? WHERE id = ?',
    s.name,
    s.phone,
    s.birthDate,
    s.heightCm,
    s.emergencyContact,
    input.id,
  );
  saveAddresses(ctx, input.id, s.addresses);
  return { ok: true, value: loadStudent(ctx, input.id)!, changed: ['students'] };
}

/** Inactive students leave the daily lists; nothing is deleted. */
export function setStudentStatus(ctx: Context, _actor: Member, input: { id?: unknown; status?: unknown }): CommandResult<StudentView> {
  if (typeof input.id !== 'string' || !isStudentStatus(input.status)) return failure('invalid');
  if (!loadStudent(ctx, input.id)) return failure('not_found');
  ctx.sql.run('UPDATE students SET status = ? WHERE id = ?', input.status, input.id);
  return { ok: true, value: loadStudent(ctx, input.id)!, changed: ['students'] };
}

export function setStudentNotes(ctx: Context, _actor: Member, input: { id?: unknown; notes?: unknown }): CommandResult<StudentView> {
  if (typeof input.id !== 'string' || typeof input.notes !== 'string') return failure('invalid');
  const notes = normalizeNotes(input.notes);
  if (notes === null) return failure('invalid');
  if (!loadStudent(ctx, input.id)) return failure('not_found');
  ctx.sql.run('UPDATE students SET notes = ? WHERE id = ?', notes, input.id);
  return { ok: true, value: loadStudent(ctx, input.id)!, changed: ['students'] };
}
