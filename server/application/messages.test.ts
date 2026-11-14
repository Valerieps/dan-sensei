import { beforeEach, describe, expect, it } from 'vitest';
import type { Commands, MessageSettings, PendingStatement, StudentView } from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { csvCell, exportedTables, NOT_EXPORTED } from './export';
import { GroupService } from './group-service';
import { crc32 } from './zip';

let service: GroupService;
let sql: ReturnType<typeof memorySql>;
let clock: ReturnType<typeof fixedClock>;
const ADMIN = 'h-ana';
const OTHER = 'h-dan';

beforeEach(() => {
  clock = fixedClock('2026-10-21T12:00:00Z');
  sql = memorySql();
  service = new GroupService(sql, clock, sequentialIds());
  service.migrate();
  service.signIn({ sub: 's1', email: 'ana@example.com', name: 'Ana', picture: null }, ADMIN, ['ana@example.com']);
});

function command<N extends keyof Commands>(name: N, input: Commands[N]['input'], hash = ADMIN): Commands[N]['output'] {
  const result = service.command(hash, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as Commands[N]['output'];
}

function query<T>(name: string, input: unknown = {}): T {
  const result = service.query(ADMIN, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as T;
}

function addStudent(name: string): string {
  return (command('student.create', { name, phone: '11912345678', birthDate: null, heightCm: null, emergencyContact: '', addresses: [] }) as StudentView).id;
}

function giveLesson(studentId: string, date: string): void {
  command('class.register', { date, outcome: 'given', studentIds: [studentId] });
}

describe('message settings', () => {
  it('start with the default templates and no PIX key', () => {
    const settings = query<MessageSettings>('messageSettings');
    expect(settings.pixKey).toBe('');
    expect(settings.statementTemplate).toContain('{extrato}');
    expect(settings.renewalTemplate).toContain('{pix}');
  });

  it('keep what the trainer saves, and an empty template goes back to the default', () => {
    const defaults = query<MessageSettings>('messageSettings');
    const saved = command('settings.setMessages', { pixKey: ' dan@pix.com ', statementTemplate: 'Oi {nome}! {extrato}{renovacao}', renewalTemplate: 'PIX {pix}' });
    expect(saved).toEqual({ pixKey: 'dan@pix.com', statementTemplate: 'Oi {nome}! {extrato}{renovacao}', renewalTemplate: 'PIX {pix}' });
    expect(command('settings.setMessages', { pixKey: '', statementTemplate: '', renewalTemplate: '  ' })).toEqual(defaults);
  });

  it('refuse a template that is too long', () => {
    const result = service.command(ADMIN, 'settings.setMessages', { pixKey: '', statementTemplate: 'x'.repeat(1001), renewalTemplate: '' });
    expect(result.ok).toBe(false);
  });
});

describe('statements to send', () => {
  it('lists a holder after a lesson, and stops once the statement was opened', () => {
    const id = addStudent('Bia');
    command('package.create', { holderId: id, planId: 'plan-12' });
    expect(query<PendingStatement[]>('pendingStatements')).toEqual([]);

    giveLesson(id, '2026-10-20');
    expect(query<PendingStatement[]>('pendingStatements')).toEqual([{ studentId: id, name: 'Bia', lastLessonOn: '2026-10-20' }]);

    command('message.markOpened', { studentId: id, kind: 'statement' });
    expect(query<PendingStatement[]>('pendingStatements')).toEqual([]);
  });

  it('lists the student again after a lesson given later', () => {
    const id = addStudent('Bia');
    command('package.create', { holderId: id, planId: 'plan-12' });
    giveLesson(id, '2026-10-20');
    command('message.markOpened', { studentId: id, kind: 'statement' });
    clock.set('2026-10-23T12:00:00Z');
    giveLesson(id, '2026-10-22');
    expect(query<PendingStatement[]>('pendingStatements').map((p) => p.lastLessonOn)).toEqual(['2026-10-22']);
  });

  it('never lists the participant of a pair package', () => {
    const holder = addStudent('Bia');
    const partner = addStudent('Caio');
    command('package.create', { holderId: holder, participantId: partner, planId: 'plan-12' });
    command('class.register', { date: '2026-10-20', outcome: 'given', studentIds: [holder, partner] });
    expect(query<PendingStatement[]>('pendingStatements').map((p) => p.name)).toEqual(['Bia']);
  });

  it('refuses to log a message for a student that does not exist', () => {
    expect(service.command(ADMIN, 'message.markOpened', { studentId: 'nope', kind: 'statement' }).ok).toBe(false);
  });
});

describe('sign out of all devices', () => {
  it('ends every session of the member, and the rest of the group keeps theirs', () => {
    service.signIn({ sub: 's1', email: 'ana@example.com', name: 'Ana', picture: null }, 'h-ipad', []);
    command('invite.create', { email: 'dan@example.com' });
    service.signIn({ sub: 's2', email: 'dan@example.com', name: 'Dan', picture: null }, OTHER, []);

    command('session.signOutAll', {}, 'h-ipad');
    expect(service.memberForSession(ADMIN)).toBeNull();
    expect(service.memberForSession('h-ipad')).toBeNull();
    expect(service.memberForSession(OTHER)).not.toBeNull();
  });

  it('lets an admin end the sessions of another member', () => {
    command('invite.create', { email: 'dan@example.com' });
    service.signIn({ sub: 's2', email: 'dan@example.com', name: 'Dan', picture: null }, OTHER, []);
    const dan = service.memberForSession(OTHER)!;
    const result = service.command(ADMIN, 'session.signOutAll', { memberId: dan.id });
    expect(result).toMatchObject({ ok: true, disconnect: [dan.id] });
    expect(service.memberForSession(OTHER)).toBeNull();
    expect(service.memberForSession(ADMIN)).not.toBeNull();
  });
});

describe('export', () => {
  it('is a zip with one CSV per table, and none of the secrets', () => {
    const id = addStudent('Bia, "a Ana"');
    command('package.create', { holderId: id, planId: 'plan-12' });
    const bytes = service.exportData(ADMIN)!;
    const text = new TextDecoder().decode(bytes);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    for (const table of exportedTables({ sql, clock, ids: sequentialIds() })) expect(text).toContain(`${table}.csv`);
    expect(text).toContain('"Bia, ""a Ana"""');
    expect(text).not.toContain('sessions.csv');
    expect(text).not.toContain('google_sub');
    expect(text).not.toContain('h-ana');
  });

  it('covers every table the database has, except the ones deliberately left out', () => {
    const tables = sql.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((t) => t.name);
    expect(exportedTables({ sql, clock, ids: sequentialIds() }).sort()).toEqual(tables.filter((t) => !(NOT_EXPORTED as readonly string[]).includes(t)).sort());
    expect(tables).toContain('message_log');
  });

  it('is refused without a valid session', () => {
    expect(service.exportData('nobody')).toBeNull();
  });

  it('makes text that a spreadsheet would run as a formula plain text', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+5511912345678')).toBe("'+5511912345678");
    expect(csvCell(-300)).toBe('-300');
    expect(csvCell(null)).toBe('');
  });

  it('checksums like the zip format wants', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});
