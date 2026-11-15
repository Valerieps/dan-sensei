import { beforeEach, describe, expect, it } from 'vitest';
import type { StudentHealth, StudentView } from '../../src/application/api-contract';
import { TERM_VERSION } from '../../src/domain/saude/saude';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';

let service: GroupService;
const ADMIN = 'h-ana';
const SIGNATURE = `data:image/png;base64,${'A'.repeat(200)}`;

beforeEach(() => {
  service = new GroupService(memorySql(), fixedClock('2026-11-15T12:00:00Z'), sequentialIds());
  service.migrate();
  service.signIn({ sub: 's1', email: 'ana@example.com', name: 'Ana', picture: null }, ADMIN, ['ana@example.com']);
});

function student(): string {
  const r = service.command(ADMIN, 'student.create', { name: 'Bia Lima', phone: '11912345678', birthDate: null, heightCm: null, emergencyContact: '', addresses: [] });
  if (!r.ok) throw new Error(r.error);
  return (r.value as StudentView).id;
}

const sign = (studentId: string) => service.command(ADMIN, 'consent.sign', { studentId, version: TERM_VERSION, signature: SIGNATURE });
const health = (studentId: string) => {
  const r = service.query(ADMIN, 'studentHealth', { studentId });
  if (!r.ok) throw new Error(r.error);
  return r.value as StudentHealth;
};
const alert = (studentId: string, conditionId = 'cond-5', note = 'evitar flexão profunda') => service.command(ADMIN, 'alert.set', { studentId, conditionId, note });

describe('without a signed term', () => {
  it('stores no anamnesis, PAR-Q or alert', () => {
    const id = student();
    expect(service.command(ADMIN, 'anamnesis.save', { studentId: id, main: 'Emagrecer', secondary: [] })).toEqual({ ok: false, error: 'consent_required' });
    expect(service.command(ADMIN, 'parq.save', { studentId: id, answers: Array(7).fill(false) })).toEqual({ ok: false, error: 'consent_required' });
    expect(alert(id)).toEqual({ ok: false, error: 'consent_required' });
    expect(health(id)).toMatchObject({ consent: null, parq: null, mainGoal: '', alerts: [] });
  });
});

describe('the term', () => {
  it('keeps the version and the date of the signature, never the image in the views', () => {
    const id = student();
    const result = sign(id);
    expect(result).toMatchObject({ ok: true, value: { version: TERM_VERSION, signedAt: '2026-11-15T12:00:00.000Z' }, changed: ['students'] });
    expect(health(id).consent).toEqual({ version: TERM_VERSION, signedAt: '2026-11-15T12:00:00.000Z' });
    expect(JSON.stringify(health(id))).not.toContain('base64');
  });

  it('refuses a wrong version, a bad signature and an unknown student', () => {
    const id = student();
    expect(service.command(ADMIN, 'consent.sign', { studentId: id, version: TERM_VERSION + 1, signature: SIGNATURE })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command(ADMIN, 'consent.sign', { studentId: id, version: TERM_VERSION, signature: 'data:image/png;base64,AAAA' })).toEqual({ ok: false, error: 'invalid' });
    expect(sign('nobody')).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('with a signed term', () => {
  it('saves the PAR-Q and the objectives', () => {
    const id = student();
    sign(id);
    const answers = [false, true, false, false, false, false, false];
    expect(service.command(ADMIN, 'parq.save', { studentId: id, answers }).ok).toBe(true);
    expect(service.command(ADMIN, 'parq.save', { studentId: id, answers: [true] })).toEqual({ ok: false, error: 'invalid' });
    expect(service.command(ADMIN, 'anamnesis.save', { studentId: id, main: 'Emagrecer', secondary: ['Dormir melhor'] }).ok).toBe(true);
    expect(service.command(ADMIN, 'anamnesis.save', { studentId: id, main: 'x', secondary: ['a', 'b', 'c', 'd'] })).toEqual({ ok: false, error: 'invalid' });
    expect(health(id)).toMatchObject({ parq: { answers, answeredAt: '2026-11-15T12:00:00.000Z' }, mainGoal: 'Emagrecer', secondaryGoals: ['Dormir melhor'] });
  });

  it('marks an alert with a note, shows it on the student and edits it in place', () => {
    const id = student();
    sign(id);
    expect(alert(id)).toMatchObject({ ok: true, value: { label: 'Dor no joelho', note: 'evitar flexão profunda' } });
    alert(id, 'cond-5', 'só leve');
    const view = service.query(ADMIN, 'student', { id });
    expect(view.ok && (view.value as StudentView).healthAlerts).toMatchObject([{ label: 'Dor no joelho', note: 'só leve' }]);
    const list = service.query(ADMIN, 'students', {});
    expect(list.ok && (list.value as StudentView[])[0].healthAlerts).toHaveLength(1);
    expect(service.command(ADMIN, 'alert.remove', { studentId: id, conditionId: 'cond-5' }).ok).toBe(true);
    expect(health(id).alerts).toEqual([]);
  });

  it('refuses an unknown condition', () => {
    const id = student();
    sign(id);
    expect(alert(id, 'nope')).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('the condition list', () => {
  it('starts with the usual ones, takes a new one and refuses a repeat', () => {
    const id = student();
    expect(health(id).conditions.map((c) => c.name)).toContain('Diabetes');
    expect(service.command(ADMIN, 'condition.create', { name: 'Escoliose' })).toMatchObject({ ok: true, value: { name: 'Escoliose' } });
    expect(service.command(ADMIN, 'condition.create', { name: 'escoliose ' })).toEqual({ ok: false, error: 'conflict' });
    expect(service.command(ADMIN, 'condition.create', { name: ' ' })).toEqual({ ok: false, error: 'invalid' });
  });
});
