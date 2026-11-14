import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AgendaClass,
  AgendaHome,
  AgendaWeek,
  CancelClassResult,
  Commands,
  PackageForecast,
  PackageSummary,
  PlanView,
  RecurrenceView,
  RegisterClassResult,
  StudentView,
} from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';

// "Today" is Wednesday 2026-10-21, 09:00 in São Paulo.
let service: GroupService;
let clock: ReturnType<typeof fixedClock>;
const ADMIN = 'h-ana';

beforeEach(() => {
  clock = fixedClock('2026-10-21T12:00:00Z');
  service = new GroupService(memorySql(), clock, sequentialIds());
  service.migrate();
  service.signIn({ sub: 's1', email: 'ana@example.com', name: 'Ana', picture: null }, ADMIN, ['ana@example.com']);
});

function command<N extends keyof Commands>(name: N, input: Commands[N]['input']): Commands[N]['output'] {
  const result = service.command(ADMIN, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as Commands[N]['output'];
}

const fail = (name: string, input: unknown) => {
  const result = service.command(ADMIN, name, input);
  if (result.ok) throw new Error(`${name} should have failed`);
  return result.error;
};

function query<T>(name: string, input: unknown = {}): T {
  const result = service.query(ADMIN, name, input);
  if (!result.ok) throw new Error(`${name}: ${result.error}`);
  return result.value as T;
}

function addStudent(name: string, address = ''): StudentView {
  const result = service.command(ADMIN, 'student.create', {
    name,
    phone: '(11) 91234-5678',
    birthDate: null,
    heightCm: null,
    emergencyContact: '',
    addresses: address ? [{ label: 'Casa', address, isDefault: true }] : [],
  });
  if (!result.ok) throw new Error(result.error);
  return result.value as StudentView;
}

const planId = (name: string) => query<PlanView[]>('plans').find((p) => p.name === name)!.id;
const sell = (holderId: string, plan = '12 aulas', extra: Record<string, unknown> = {}) =>
  command('package.create', { holderId, planId: planId(plan), ...extra } as never) as PackageSummary;
const pkg = (id: string) => query<{ summary: PackageSummary }>('package', { id }).summary;
const day = (date: string) => query<AgendaClass[]>('agendaDay', { date });

describe('recurrences and generation', () => {
  it('generates the scheduled lessons ahead, in São Paulo time, and consumes nothing', () => {
    const maria = addStudent('Maria', 'Rua A, 10');
    const plan = sell(maria.id);
    const recurrence = command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    expect(recurrence).toMatchObject({ weekday: 2, time: '07:00', durationMin: 60, startsOn: '2026-10-21', endsOn: null, studentNames: ['Maria'] });

    const week = query<AgendaWeek>('agendaWeek', { date: '2026-10-27' });
    expect(week).toMatchObject({ from: '2026-10-26', to: '2026-11-01' });
    expect(week.classes).toHaveLength(1);
    expect(week.classes[0]).toMatchObject({
      date: '2026-10-27',
      time: '07:00',
      startsAt: '2026-10-27T10:00:00.000Z',
      status: 'scheduled',
      address: 'Rua A, 10',
      recurrenceId: recurrence.id,
      students: [{ id: maria.id, name: 'Maria' }],
    });
    // 8 weeks ahead: Tuesdays from 27/10 through 15/12.
    expect(query<AgendaWeek>('agendaWeek', { date: '2026-12-15' }).classes).toHaveLength(1);
    expect(query<AgendaWeek>('agendaWeek', { date: '2026-12-22' }).classes).toHaveLength(0);
    // Scheduled lessons do not touch the package.
    expect(pkg(plan.id)).toMatchObject({ used: 0, remaining: 12, status: 'aguardando-inicio' });
  });

  it('tops the horizon up when the cron ticks, without repeating lessons', () => {
    const maria = addStudent('Maria');
    command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    expect(service.tick()).toEqual([]);
    clock.set('2026-10-28T12:00:00Z');
    expect(service.tick()).toEqual(['classes', 'packages']);
    expect(query<AgendaWeek>('agendaWeek', { date: '2026-12-22' }).classes).toHaveLength(1);
    expect(service.tick()).toEqual([]);
    expect(query<AgendaWeek>('agendaWeek', { date: '2026-12-15' }).classes).toHaveLength(1);
  });

  it('ends a fixed time and drops the scheduled lessons after it', () => {
    const maria = addStudent('Maria');
    const recurrence = command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    command('recurrence.end', { id: recurrence.id, endsOn: '2026-11-03' });
    expect(query<RecurrenceView[]>('recurrences', { studentId: maria.id })).toHaveLength(1);
    expect(day('2026-11-03')).toHaveLength(1);
    expect(day('2026-11-10')).toHaveLength(0);
    clock.set('2026-11-05T12:00:00Z');
    expect(query<RecurrenceView[]>('recurrences', { studentId: maria.id })).toHaveLength(0);
  });

  it('validates the input', () => {
    const maria = addStudent('Maria');
    expect(fail('recurrence.create', { studentIds: [maria.id], weekday: 8, time: '07:00' })).toBe('invalid');
    expect(fail('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '7h' })).toBe('invalid');
    expect(fail('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00', durationMin: 90 })).toBe('invalid');
    expect(fail('recurrence.create', { studentIds: [], weekday: 2, time: '07:00' })).toBe('invalid');
    expect(fail('recurrence.create', { studentIds: ['nope'], weekday: 2, time: '07:00' })).toBe('not_found');
    expect(fail('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00', startsOn: '2026-10-01' })).toBe('invalid');
    expect(fail('recurrence.end', { id: 'nope', endsOn: '2026-11-03' })).toBe('not_found');
  });

  it('does not generate for an inactive student', () => {
    const maria = addStudent('Maria');
    command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    command('student.setStatus', { id: maria.id, status: 'inactive' });
    clock.set('2026-10-28T12:00:00Z');
    service.tick();
    expect(query<AgendaWeek>('agendaWeek', { date: '2026-12-22' }).classes).toHaveLength(0);
  });
});

describe('one-off lessons', () => {
  it('schedules one or two students with a chosen address and a shorter duration', () => {
    const maria = addStudent('Maria', 'Rua A, 10');
    const joao = addStudent('João');
    const other = command('student.update', {
      id: maria.id,
      name: 'Maria',
      phone: '(11) 91234-5678',
      birthDate: null,
      heightCm: null,
      emergencyContact: '',
      addresses: [
        { id: maria.addresses[0]!.id, label: 'Casa', address: 'Rua A, 10', isDefault: true },
        { label: 'Trabalho', address: 'Av. B, 20', isDefault: false },
      ],
    }).addresses.find((a) => a.label === 'Trabalho')!;

    const lesson = command('class.schedule', { studentIds: [maria.id, joao.id], date: '2026-10-22', time: '18:30', durationMin: 45, addressId: other.id });
    expect(lesson).toMatchObject({ date: '2026-10-22', time: '18:30', durationMin: 45, address: 'Av. B, 20', status: 'scheduled', recurrenceId: null });
    expect(lesson.students.map((s) => s.name)).toEqual(['Maria', 'João']);
    const plain = command('class.schedule', { studentIds: [maria.id], date: '2026-10-22', time: '08:00' });
    expect(plain).toMatchObject({ durationMin: 60, address: 'Rua A, 10' });
    expect(day('2026-10-22').map((c) => c.time)).toEqual(['08:00', '18:30']);
  });

  it('rejects three students, a past date, more than 60 minutes and another student\'s address', () => {
    const [a, b, c] = [addStudent('A', 'x'), addStudent('B', 'y'), addStudent('C')];
    const base = { studentIds: [a.id], date: '2026-10-22', time: '08:00' };
    expect(fail('class.schedule', { ...base, studentIds: [a.id, b.id, c.id] })).toBe('invalid');
    expect(fail('class.schedule', { ...base, studentIds: [a.id, a.id] })).toBe('invalid');
    expect(fail('class.schedule', { ...base, date: '2026-10-20' })).toBe('invalid');
    expect(fail('class.schedule', { ...base, durationMin: 61 })).toBe('invalid');
    expect(fail('class.schedule', { ...base, addressId: b.addresses[0]!.id })).toBe('invalid');
    expect(fail('class.schedule', { ...base, studentIds: ['nope'] })).toBe('not_found');
  });
});

describe('rescheduling', () => {
  it('moves only one lesson and links the new one to the original', () => {
    const maria = addStudent('Maria');
    const recurrence = command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    const original = day('2026-10-27')[0]!;
    const moved = command('class.reschedule', { classId: original.id, date: '2026-10-28', time: '09:30', scope: 'this' });
    expect(moved).toMatchObject({ date: '2026-10-28', time: '09:30', status: 'scheduled', rescheduledFrom: original.id, recurrenceId: recurrence.id });
    expect(day('2026-10-27')).toHaveLength(0);
    // The old row is kept as "remarcada" and the day is not generated again.
    clock.set('2026-10-22T12:00:00Z');
    service.tick();
    expect(day('2026-10-27')).toHaveLength(0);
    expect(day('2026-11-03')).toHaveLength(1);
  });

  it('moves this and the following lessons by the same shift, keeping cancelled days cancelled', () => {
    const maria = addStudent('Maria');
    command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    const second = day('2026-11-03')[0]!;
    command('class.cancel', { classId: second.id, byTrainer: true });
    const third = day('2026-11-10')[0]!;
    const result = command('class.reschedule', { classId: third.id, date: '2026-11-12', time: '08:00', scope: 'following' });
    expect(result).toMatchObject({ date: '2026-11-12', time: '08:00', rescheduledFrom: third.id });
    // Before the change: untouched. After: Thursdays at 08:00.
    expect(day('2026-10-27')[0]).toMatchObject({ time: '07:00' });
    expect(day('2026-11-03')[0]).toMatchObject({ status: 'cancelled' });
    expect(day('2026-11-10')).toHaveLength(0);
    expect(day('2026-11-12')).toHaveLength(1);
    expect(day('2026-11-19')[0]).toMatchObject({ time: '08:00', status: 'scheduled' });
    expect(query<RecurrenceView[]>('recurrences')).toMatchObject([
      { weekday: 2, time: '07:00', endsOn: '2026-11-09' },
      { weekday: 4, time: '08:00', startsOn: '2026-11-12', endsOn: null },
    ]);
    // The cron keeps going on the new day and does not bring the old ones back.
    clock.set('2026-11-04T12:00:00Z');
    service.tick();
    expect(day('2026-11-10')).toHaveLength(0);
    expect(day('2026-11-17')).toHaveLength(0);
    expect(day('2026-11-03')).toHaveLength(1);
    expect(day('2026-12-24')).toHaveLength(1);
  });

  it('refuses "following" for a one-off lesson and a finished lesson', () => {
    const maria = addStudent('Maria');
    const lesson = command('class.schedule', { studentIds: [maria.id], date: '2026-10-22', time: '08:00' });
    expect(fail('class.reschedule', { classId: lesson.id, date: '2026-10-23', time: '08:00', scope: 'following' })).toBe('invalid');
    expect(fail('class.reschedule', { classId: lesson.id, date: '2026-10-20', time: '08:00', scope: 'this' })).toBe('invalid');
    command('class.reschedule', { classId: lesson.id, date: '2026-10-23', time: '08:00', scope: 'this' });
    expect(fail('class.reschedule', { classId: lesson.id, date: '2026-10-24', time: '08:00', scope: 'this' })).toBe('conflict');
  });
});

describe('cancelling and missing', () => {
  it('cancels with 24 h or more without a question', () => {
    const maria = addStudent('Maria');
    const lesson = command('class.schedule', { studentIds: [maria.id], date: '2026-10-22', time: '09:00' }); // exactly 24 h away
    expect(command('class.cancel', { classId: lesson.id })).toEqual({ done: true, status: 'cancelled', charged: false });
    expect(day('2026-10-22')[0]).toMatchObject({ status: 'cancelled', absenceCharged: null });
  });

  it('asks charge or waive with less than 24 h, suggesting charge, and changes nothing meanwhile', () => {
    const maria = addStudent('Maria');
    const plan = sell(maria.id);
    const lesson = command('class.schedule', { studentIds: [maria.id], date: '2026-10-22', time: '08:59' });
    expect(command('class.cancel', { classId: lesson.id })).toEqual({ done: false, needsDecision: true, suggested: 'charge' });
    expect(day('2026-10-22')[0]!.status).toBe('scheduled');
    expect(command('class.cancel', { classId: lesson.id, decision: 'charge' })).toEqual({ done: true, status: 'missed', charged: true });
    expect(day('2026-10-22')[0]).toMatchObject({ status: 'missed', absenceCharged: true, packageId: plan.id });
    expect(pkg(plan.id)).toMatchObject({ used: 1, remaining: 11, status: 'ativo', firstClassOn: '2026-10-22' });
  });

  it('waives: the absence consumes nothing and does not start the package', () => {
    const maria = addStudent('Maria');
    const plan = sell(maria.id);
    const lesson = command('class.schedule', { studentIds: [maria.id], date: '2026-10-21', time: '18:00' });
    expect(command('class.cancel', { classId: lesson.id, decision: 'waive' })).toEqual({ done: true, status: 'missed', charged: false });
    expect(day('2026-10-21')[0]).toMatchObject({ status: 'missed', absenceCharged: false });
    expect(pkg(plan.id)).toMatchObject({ used: 0, remaining: 12, status: 'aguardando-inicio' });
  });

  it('never charges when the trainer cancels, even close to the start', () => {
    const maria = addStudent('Maria');
    const lesson = command('class.schedule', { studentIds: [maria.id], date: '2026-10-21', time: '10:00' });
    expect(command('class.cancel', { classId: lesson.id, byTrainer: true })).toMatchObject({ done: true, status: 'cancelled' });
  });

  it('charges a no-show by default and waives on request', () => {
    const maria = addStudent('Maria');
    const plan = sell(maria.id);
    const a = command('class.schedule', { studentIds: [maria.id], date: '2026-10-21', time: '07:00' });
    const b = command('class.schedule', { studentIds: [maria.id], date: '2026-10-21', time: '08:00' });
    expect(command('class.markMissed', { classId: a.id })).toMatchObject({ registered: true, packageId: plan.id });
    expect(command('class.markMissed', { classId: b.id, decision: 'waive' })).toMatchObject({ registered: true, packageId: plan.id });
    expect(pkg(plan.id)).toMatchObject({ used: 1, remaining: 11 });
    expect(fail('class.markMissed', { classId: a.id })).toBe('conflict');
    expect(fail('class.markMissed', { classId: b.id, decision: 'maybe' })).toBe('invalid');
  });

  it('asks which package to charge when a pair lesson has two', () => {
    const maria = addStudent('Maria');
    const joao = addStudent('João');
    const pm = sell(maria.id);
    const pj = sell(joao.id);
    const lesson = command('class.schedule', { studentIds: [maria.id, joao.id], date: '2026-10-21', time: '07:00' });
    const asked = command('class.cancel', { classId: lesson.id, decision: 'charge' }) as CancelClassResult;
    expect(asked).toMatchObject({ done: false, needsPackage: true });
    expect('choose' in asked && asked.choose.map((p) => p.id).sort()).toEqual([pm.id, pj.id].sort());
    expect(day('2026-10-21')[0]!.status).toBe('scheduled');
    expect(command('class.cancel', { classId: lesson.id, decision: 'charge', packageId: pj.id })).toMatchObject({ done: true, status: 'missed' });
    expect(pkg(pj.id).used).toBe(1);
    expect(pkg(pm.id).used).toBe(0);
  });
});

describe('giving a lesson from the agenda', () => {
  it('consumes the package by the rules of 1a and starts its validity', () => {
    const maria = addStudent('Maria');
    const plan = sell(maria.id);
    const lesson = command('class.schedule', { studentIds: [maria.id], date: '2026-10-21', time: '07:00' });
    const result = command('class.complete', { classId: lesson.id }) as Extract<RegisterClassResult, { registered: true }>;
    expect(result).toMatchObject({ registered: true, classId: lesson.id, packageId: plan.id, withoutPackage: null, pendingPayment: true });
    expect(day('2026-10-21')[0]).toMatchObject({ status: 'given', packageId: plan.id });
    expect(pkg(plan.id)).toMatchObject({ used: 1, remaining: 11, status: 'ativo', firstClassOn: '2026-10-21', dueOn: '2026-12-20' });
    expect(fail('class.complete', { classId: lesson.id })).toBe('conflict');
  });

  it('records "sem pacote" when the student has none, and refuses a future lesson', () => {
    const maria = addStudent('Maria');
    const today = command('class.schedule', { studentIds: [maria.id], date: '2026-10-21', time: '07:00' });
    const future = command('class.schedule', { studentIds: [maria.id], date: '2026-10-22', time: '07:00' });
    expect(command('class.complete', { classId: today.id })).toMatchObject({ registered: true, packageId: null, withoutPackage: 'sem-pacote-cadastrado' });
    expect(day('2026-10-21')[0]).toMatchObject({ status: 'given', withoutPackage: true });
    expect(query<{ classId: string }[]>('lessonsWithoutPackage', { studentId: maria.id }).map((l) => l.classId)).toEqual([today.id]);
    expect(fail('class.complete', { classId: future.id })).toBe('invalid');
  });

  it('answers with the packages to choose from, saving nothing, for a pair of separate packages', () => {
    const maria = addStudent('Maria');
    const joao = addStudent('João');
    sell(maria.id);
    sell(joao.id);
    const lesson = command('class.schedule', { studentIds: [maria.id, joao.id], date: '2026-10-21', time: '07:00' });
    const asked = command('class.complete', { classId: lesson.id }) as RegisterClassResult;
    expect(asked.registered).toBe(false);
    expect(day('2026-10-21')[0]!.status).toBe('scheduled');
  });

  it('does not count scheduled lessons as the package\'s first lesson', () => {
    const maria = addStudent('Maria');
    const plan = sell(maria.id);
    command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    expect(pkg(plan.id)).toMatchObject({ firstClassOn: null, dueOn: null, status: 'aguardando-inicio' });
  });
});

describe('confirmation', () => {
  it('marks and unmarks a scheduled lesson as confirmed', () => {
    const maria = addStudent('Maria');
    const lesson = command('class.schedule', { studentIds: [maria.id], date: '2026-10-22', time: '07:00' });
    expect(lesson.confirmed).toBe(false);
    command('class.confirm', { classId: lesson.id });
    expect(day('2026-10-22')[0]!.confirmed).toBe(true);
    command('class.confirm', { classId: lesson.id, confirmed: false });
    expect(day('2026-10-22')[0]!.confirmed).toBe(false);
    command('class.cancel', { classId: lesson.id, byTrainer: true });
    expect(fail('class.confirm', { classId: lesson.id })).toBe('conflict');
    expect(fail('class.confirm', { classId: 'nope' })).toBe('not_found');
  });
});

describe('validity forecast', () => {
  it('forecasts the due date of a package awaiting start from the first scheduled lesson', () => {
    const maria = addStudent('Maria');
    const plan = sell(maria.id);
    command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    const forecast = query<PackageForecast>('packageForecast', { packageId: plan.id });
    // First lesson Tue 27/10; 60 days later is 26/12. Twelve Tuesdays end on 12/01, past that.
    expect(forecast).toMatchObject({ dueOn: '2026-12-26', dueOnForecast: true, lastClassOn: '2027-01-12', exceedsValidity: true, missingClasses: false });
    expect(forecast.warning).toBe('12ª aula prevista para 12/01/2027; validade 26/12/2026');
  });

  it('forecasts beyond the generated horizon and stays quiet when it fits', () => {
    const maria = addStudent('Maria');
    const plan = sell(maria.id, '12 aulas', { validityDays: 100 });
    command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    command('recurrence.create', { studentIds: [maria.id], weekday: 4, time: '07:00' });
    const forecast = query<PackageForecast>('packageForecast', { packageId: plan.id });
    expect(forecast).toMatchObject({ lastClassOn: '2026-12-01', exceedsValidity: false, warning: null });
  });

  it('counts the lessons already given and the pauses', () => {
    const maria = addStudent('Maria');
    const plan = sell(maria.id, '12 aulas', { usedBeforeApp: 8, firstClassOn: '2026-09-01' });
    command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    // 4 left; Tuesdays 27/10, 03/11, 10/11, 17/11. Due: 01/09 + 60 = 31/10, so it overshoots.
    expect(query<PackageForecast>('packageForecast', { packageId: plan.id })).toMatchObject({ dueOn: '2026-10-31', lastClassOn: '2026-11-17', exceedsValidity: true, dueOnForecast: false });
    command('package.pause', { packageId: plan.id, startsOn: '2026-10-22', endsOn: '2026-11-20' });
    expect(query<PackageForecast>('packageForecast', { packageId: plan.id })).toMatchObject({ dueOn: '2026-11-30', exceedsValidity: false });
  });

  it('says when the agenda has too few lessons, and lists the warnings in the Início', () => {
    const maria = addStudent('Maria');
    const plan = sell(maria.id);
    expect(query<PackageForecast>('packageForecast', { packageId: plan.id })).toMatchObject({ lastClassOn: null, dueOn: null, missingClasses: true, warning: null });
    command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    expect(query<AgendaHome>('agendaHome').forecastWarnings).toEqual([
      { packageId: plan.id, holderId: maria.id, holderName: 'Maria', message: '12ª aula prevista para 12/01/2027; validade 26/12/2026' },
    ]);
    expect(service.query(ADMIN, 'packageForecast', { packageId: 'nope' })).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('reads for the grid and the Início', () => {
  it('shows the day in time order, with the lesson happening now and the next one', () => {
    const maria = addStudent('Maria', 'Rua A');
    const joao = addStudent('João');
    command('class.schedule', { studentIds: [maria.id], date: '2026-10-21', time: '08:00' });
    const now = command('class.schedule', { studentIds: [joao.id], date: '2026-10-21', time: '09:00', durationMin: 30 });
    const next = command('class.schedule', { studentIds: [maria.id], date: '2026-10-21', time: '17:00' });
    const gone = command('class.schedule', { studentIds: [maria.id], date: '2026-10-21', time: '18:00' });
    command('class.cancel', { classId: gone.id, byTrainer: true });
    const tomorrow = command('class.schedule', { studentIds: [maria.id], date: '2026-10-22', time: '07:00' });
    command('class.schedule', { studentIds: [joao.id], date: '2026-10-22', time: '08:00' });
    command('class.confirm', { classId: tomorrow.id });

    const home = query<AgendaHome>('agendaHome');
    expect(home.today).toBe('2026-10-21');
    expect(home.classes.map((c) => c.time)).toEqual(['08:00', '09:00', '17:00']);
    expect(home.currentClassId).toBe(now.id);
    expect(home.nextClassId).toBe(next.id);
    expect(home.tomorrow.map((c) => [c.time, c.confirmed])).toEqual([
      ['07:00', true],
      ['08:00', false],
    ]);
    // The grid keeps the cancelled lesson, so it can be shown struck out.
    expect(day('2026-10-21').map((c) => c.status)).toEqual(['scheduled', 'scheduled', 'scheduled', 'cancelled']);
    // After the planned end the lesson is no longer "agora".
    clock.set('2026-10-21T12:31:00Z');
    expect(query<AgendaHome>('agendaHome').currentClassId).toBeNull();
  });

  it('puts a late-evening lesson on its São Paulo day, not the UTC one', () => {
    const maria = addStudent('Maria');
    command('class.schedule', { studentIds: [maria.id], date: '2026-10-22', time: '22:30' });
    expect(day('2026-10-22')).toHaveLength(1);
    expect(day('2026-10-23')).toHaveLength(0);
    expect(day('2026-10-22')[0]!.startsAt).toBe('2026-10-23T01:30:00.000Z');
  });

  it('rejects a bad date', () => {
    expect(service.query(ADMIN, 'agendaDay', { date: 'hoje' })).toEqual({ ok: false, error: 'invalid' });
    expect(service.query(ADMIN, 'agendaWeek', {})).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('deleting a lesson of a fixed time', () => {
  it('keeps the day as cancelled so the cron does not bring it back', () => {
    const maria = addStudent('Maria');
    command('recurrence.create', { studentIds: [maria.id], weekday: 2, time: '07:00' });
    const lesson = day('2026-10-27')[0]!;
    command('class.delete', { classId: lesson.id });
    clock.set('2026-10-22T12:00:00Z');
    service.tick();
    expect(day('2026-10-27')).toMatchObject([{ status: 'cancelled' }]);
  });
});

describe('the Início: confirmation, next class and monthly questions', () => {
  it('remembers that the confirmation was opened, and the lesson stays unconfirmed until the student answers', () => {
    const maria = addStudent('Maria', 'Rua A, 10');
    const lesson = command('class.schedule', { studentIds: [maria.id], date: '2026-10-22', time: '07:00' });
    expect(lesson).toMatchObject({ confirmed: false, confirmationAsked: false });

    command('class.markConfirmationAsked', { classId: lesson.id });
    expect(query<AgendaHome>('agendaHome').tomorrow[0]).toMatchObject({ id: lesson.id, confirmed: false, confirmationAsked: true });

    command('class.confirm', { classId: lesson.id });
    expect(query<AgendaHome>('agendaHome').tomorrow[0]).toMatchObject({ confirmed: true, confirmationAsked: true });
  });

  it('refuses to mark a lesson that is not scheduled, or unknown', () => {
    const maria = addStudent('Maria');
    const lesson = command('class.schedule', { studentIds: [maria.id], date: '2026-10-22', time: '07:00' });
    command('class.cancel', { classId: lesson.id, byTrainer: true });
    expect(fail('class.markConfirmationAsked', { classId: lesson.id })).toBe('conflict');
    expect(fail('class.markConfirmationAsked', { classId: 'nope' })).toBe('not_found');
    expect(fail('class.markConfirmationAsked', {})).toBe('invalid');
  });

  it('shows each student\'s next scheduled lesson on the Alunos e pacotes card', () => {
    const maria = addStudent('Maria');
    const joao = addStudent('João');
    command('class.schedule', { studentIds: [maria.id], date: '2026-10-25', time: '08:00' });
    command('class.schedule', { studentIds: [maria.id], date: '2026-10-23', time: '07:30' });
    const items = query<{ items: { studentId: string; nextClass: { date: string; time: string } | null }[] }>('packagesOverview').items;
    expect(items.find((i) => i.studentId === maria.id)!.nextClass).toMatchObject({ date: '2026-10-23', time: '07:30' });
    expect(items.find((i) => i.studentId === joao.id)!.nextClass).toBeNull();
  });

  it('asks about a monthly fee on its due day, and keeps asking while it is pending', () => {
    const ana = addStudent('Ana');
    command('monthly.setup', { studentId: ana.id, amountCents: 40000, dueDay: 21, lastPaidMonth: '2026-09' });
    expect(query<{ studentId: string; dueToday: boolean; month: string }[]>('monthlyDue')).toMatchObject([{ studentId: ana.id, dueToday: true, month: '2026-10' }]);

    command('monthly.registerPayment', { studentId: ana.id, month: '2026-10', paidOn: '2026-10-21', amountCents: 40000, method: 'pix' });
    expect(query<unknown[]>('monthlyDue')).toEqual([]);

    clock.set('2026-10-23T12:00:00Z');
    const bia = addStudent('Bia');
    command('monthly.setup', { studentId: bia.id, amountCents: 30000, dueDay: 22, lastPaidMonth: '2026-09' });
    expect(query<{ studentId: string; dueToday: boolean; pendingMonths: string[] }[]>('monthlyDue')).toMatchObject([{ studentId: bia.id, dueToday: false, pendingMonths: ['2026-10'] }]);
  });
});
