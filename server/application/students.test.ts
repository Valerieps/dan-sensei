import { beforeEach, describe, expect, it } from 'vitest';
import type { StudentView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';

let service: GroupService;
const ADMIN = 'h-ana';

beforeEach(() => {
  service = new GroupService(memorySql(), fixedClock('2026-10-21T12:00:00Z'), sequentialIds());
  service.migrate();
  service.signIn({ sub: 's1', email: 'ana@example.com', name: 'Ana', picture: null }, ADMIN, ['ana@example.com']);
});

const form = (over: Record<string, unknown> = {}) => ({
  name: 'Bia Lima',
  phone: '(11) 91234-5678',
  birthDate: null,
  heightCm: null,
  emergencyContact: '',
  addresses: [],
  ...over,
});

function create(over: Record<string, unknown> = {}): StudentView {
  const result = service.command(ADMIN, 'student.create', form(over));
  if (!result.ok) throw new Error(result.error);
  return result.value as StudentView;
}

describe('student registration', () => {
  it('needs the name and the phone only, and starts active by package', () => {
    const student = create();
    expect(student).toMatchObject({ name: 'Bia Lima', phone: '11912345678', status: 'active', billing: 'package', notes: '', addresses: [] });
  });

  it('refuses a missing name or phone', () => {
    expect(service.command(ADMIN, 'student.create', form({ name: ' ' }))).toEqual({ ok: false, error: 'invalid' });
    expect(service.command(ADMIN, 'student.create', form({ phone: '12' }))).toEqual({ ok: false, error: 'invalid' });
  });

  it('is closed to people who are not signed in', () => {
    expect(service.command('nobody', 'student.create', form())).toEqual({ ok: false, error: 'unauthenticated' });
    expect(service.query('nobody', 'students', {})).toEqual({ ok: false, error: 'unauthenticated' });
  });

  it('tells the open screens that students changed', () => {
    expect(service.command(ADMIN, 'student.create', form())).toMatchObject({ ok: true, changed: ['students'] });
  });

  it('keeps one default address and edits, adds and removes addresses by id', () => {
    const student = create({
      addresses: [
        { label: 'Casa', address: 'Rua A, 1', isDefault: true },
        { label: 'Trabalho', address: 'Rua B, 2', isDefault: false },
      ],
    });
    const [home, work] = student.addresses;
    expect(home).toMatchObject({ label: 'Casa', isDefault: true });

    const updated = service.command(ADMIN, 'student.update', {
      ...form({ name: 'Beatriz Lima' }),
      id: student.id,
      addresses: [
        { id: work.id, label: 'Escritório', address: 'Rua B, 2', isDefault: true },
        { label: 'Praia', address: 'Av. C, 3', isDefault: false },
      ],
    });
    expect(updated.ok && (updated.value as StudentView)).toMatchObject({ name: 'Beatriz Lima' });
    const after = (updated as { value: StudentView }).value.addresses;
    expect(after.map((a) => [a.label, a.isDefault])).toEqual([
      ['Escritório', true],
      ['Praia', false],
    ]);
    expect(after[0].id).toBe(work.id);
    expect(after.some((a) => a.id === home.id)).toBe(false);
  });

  it('does not touch the status or notes when editing', () => {
    const student = create();
    service.command(ADMIN, 'student.setNotes', { id: student.id, notes: 'Joelho' });
    service.command(ADMIN, 'student.update', { ...form({ name: 'Bia' }), id: student.id });
    expect(service.query(ADMIN, 'student', { id: student.id })).toMatchObject({ ok: true, value: { name: 'Bia', notes: 'Joelho' } });
  });

  it('answers not_found for an unknown student', () => {
    expect(service.query(ADMIN, 'student', { id: 'nope' })).toEqual({ ok: false, error: 'not_found' });
    expect(service.command(ADMIN, 'student.update', { ...form(), id: 'nope' })).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('student status and notes', () => {
  it('hides inactive students from the list, but keeps them', () => {
    const a = create({ name: 'Ana' });
    create({ name: 'Caio' });
    service.command(ADMIN, 'student.setStatus', { id: a.id, status: 'inactive' });

    const names = (input: object) => (service.query(ADMIN, 'students', input) as { value: StudentView[] }).value.map((s) => s.name);
    expect(names({})).toEqual(['Caio']);
    expect(names({ includeInactive: true })).toEqual(['Ana', 'Caio']);

    service.command(ADMIN, 'student.setStatus', { id: a.id, status: 'active' });
    expect(names({})).toEqual(['Ana', 'Caio']);
  });

  it('accepts paused and refuses an unknown status', () => {
    const a = create();
    expect(service.command(ADMIN, 'student.setStatus', { id: a.id, status: 'paused' })).toMatchObject({ ok: true, value: { status: 'paused' } });
    expect(service.command(ADMIN, 'student.setStatus', { id: a.id, status: 'gone' })).toEqual({ ok: false, error: 'invalid' });
  });

  it('saves the notes and refuses huge ones', () => {
    const a = create();
    expect(service.command(ADMIN, 'student.setNotes', { id: a.id, notes: 'Prefere manhã' })).toMatchObject({ ok: true, value: { notes: 'Prefere manhã' } });
    expect(service.command(ADMIN, 'student.setNotes', { id: a.id, notes: 'x'.repeat(5001) })).toEqual({ ok: false, error: 'invalid' });
  });
});
