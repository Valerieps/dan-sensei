import { beforeEach, describe, expect, it } from 'vitest';
import type {
  Commands,
  PackageStatement,
  PackageSummary,
  PackagesOverview,
  PlanView,
  RegisterClassResult,
  RenewalPreview,
  StudentView,
  Topic,
} from '../../src/application/api-contract';
import { fixedClock, memorySql, sequentialIds } from '../testing/node-sql';
import { GroupService } from './group-service';

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

function addStudent(name: string): string {
  const result = service.command(ADMIN, 'student.create', {
    name,
    phone: '(11) 91234-5678',
    birthDate: null,
    heightCm: null,
    emergencyContact: '',
    addresses: [],
  });
  if (!result.ok) throw new Error(result.error);
  return (result.value as StudentView).id;
}

const plans = () => query<PlanView[]>('plans');
const planId = (name: string) => plans().find((p) => p.name === name)!.id;
const pkg = (id: string) => query<PackageStatement>('package', { id }).summary;

function sell(holderId: string, plan = '12 aulas', extra: Record<string, unknown> = {}): PackageSummary {
  return command('package.create', { holderId, planId: planId(plan), ...extra } as never);
}

function register(date: string, outcome: 'given' | 'missed_charged' | 'missed_waived', studentIds: string[], packageId?: string | null) {
  return command('class.register', { date, outcome, studentIds, ...(packageId !== undefined ? { packageId } : {}) }) as RegisterClassResult;
}

const given = (date: string, studentIds: string[], packageId?: string | null) => register(date, 'given', studentIds, packageId);

describe('plans', () => {
  it('comes with the four factory plans, price per lesson in cents', () => {
    expect(plans().map((p) => [p.name, p.classes, p.priceCents, p.validityDays])).toEqual([
      ['Avulso', 1, 20000, 7],
      ['12 aulas', 12, 12000, 60],
      ['16 aulas', 16, 11000, 75],
      ['20 aulas', 20, 10000, 90],
    ]);
  });

  it('creates and edits plans, and hides the inactive ones from the list', () => {
    const created = command('plan.create', { name: '30 aulas', classes: 30, priceCents: 9000, validityDays: 120 });
    expect(plans().at(-1)).toEqual(created);
    const edited = command('plan.update', { id: created.id, name: '30 aulas', classes: 30, priceCents: 9500, validityDays: 120, active: false });
    expect(edited).toMatchObject({ priceCents: 9500, active: false });
    expect(plans().some((p) => p.id === created.id)).toBe(false);
    expect(query<PlanView[]>('plans', { includeInactive: true }).some((p) => p.id === created.id)).toBe(true);
  });

  it('refuses bad values and unknown plans', () => {
    expect(fail('plan.create', { name: ' ', classes: 5, priceCents: 100, validityDays: 10 })).toBe('invalid');
    expect(fail('plan.create', { name: 'x', classes: 0, priceCents: 100, validityDays: 10 })).toBe('invalid');
    expect(fail('plan.create', { name: 'x', classes: 5, priceCents: 10.5, validityDays: 10 })).toBe('invalid');
    expect(fail('plan.update', { id: 'nope', name: 'x', classes: 5, priceCents: 100, validityDays: 10 })).toBe('not_found');
  });

  it('does not change packages already sold', () => {
    const bia = addStudent('Bia');
    const sold = sell(bia);
    command('plan.update', { id: planId('12 aulas'), name: '12 aulas', classes: 12, priceCents: 15000, validityDays: 30 });
    expect(pkg(sold.id)).toMatchObject({ priceCents: 12000, validityDays: 60, totalCents: 144000 });
  });

  it('tells the open screens what changed', () => {
    expect(service.command(ADMIN, 'plan.create', { name: '30', classes: 30, priceCents: 1, validityDays: 1 })).toMatchObject({ changed: ['plans'] });
  });
});

describe('selling a package', () => {
  it('starts awaiting start, copying the plan, with no due date', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    expect(p).toMatchObject({
      holderId: bia,
      participantId: null,
      planName: '12 aulas',
      classes: 12,
      total: 12,
      used: 0,
      remaining: 12,
      status: 'aguardando-inicio',
      dueOn: null,
      totalCents: 144000,
      paymentStatus: 'pending',
      missingCents: 144000,
      createdOn: '2026-10-21',
      origin: '12 aulas',
    });
  });

  it('lets the trainer change the plan values', () => {
    const p = sell(addStudent('Bia'), '12 aulas', { classes: 10, priceCents: 13000, validityDays: 45 });
    expect(p).toMatchObject({ classes: 10, priceCents: 13000, validityDays: 45, totalCents: 130000 });
  });

  it('takes a pair package with a participant', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    expect(sell(bia, '20 aulas', { participantId: caio })).toMatchObject({ participantName: 'Caio', holderName: 'Bia' });
  });

  it('registers the payments sent with it', () => {
    const p = sell(addStudent('Bia'), '12 aulas', {
      payments: [
        { paidOn: '2026-10-21', amountCents: 100000, method: 'pix' },
        { paidOn: '2026-10-21', amountCents: 44000, method: 'cash' },
      ],
    });
    expect(p).toMatchObject({ paymentStatus: 'paid', paidCents: 144000, missingCents: 0 });
  });

  it('refuses unknown or invalid students, plans and values', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    expect(fail('package.create', { holderId: 'nope', planId: planId('Avulso') })).toBe('not_found');
    expect(fail('package.create', { holderId: bia, planId: 'nope' })).toBe('not_found');
    expect(fail('package.create', { holderId: bia, planId: planId('Avulso'), participantId: bia })).toBe('invalid');
    expect(fail('package.create', { holderId: bia, planId: planId('Avulso'), participantId: 'nope' })).toBe('not_found');
    expect(fail('package.create', { holderId: bia, planId: planId('Avulso'), classes: 0 })).toBe('invalid');
    expect(fail('package.create', { holderId: bia, planId: planId('Avulso'), payments: [{ paidOn: 'x', amountCents: 1, method: 'pix' }] })).toBe('invalid');
    command('student.setStatus', { id: caio, status: 'inactive' });
    expect(fail('package.create', { holderId: caio, planId: planId('Avulso') })).toBe('invalid');
    const avulso = planId('Avulso');
    command('plan.update', { id: avulso, name: 'Avulso', classes: 1, priceCents: 20000, validityDays: 7, active: false });
    expect(fail('package.create', { holderId: bia, planId: avulso })).toBe('invalid');
  });

  it('is closed to people who are not signed in', () => {
    expect(service.command('nobody', 'package.create', {})).toEqual({ ok: false, error: 'unauthenticated' });
    expect(service.query('nobody', 'packagesOverview', {})).toEqual({ ok: false, error: 'unauthenticated' });
  });
});

describe('starting balance', () => {
  it('counts lessons used before the app and the due date from the first lesson', () => {
    const bia = addStudent('Bia');
    const p = sell(bia, '12 aulas', { usedBeforeApp: 5, firstClassOn: '2026-10-01' });
    expect(p).toMatchObject({ used: 5, remaining: 7, usedBeforeApp: 5, status: 'ativo', firstClassOn: '2026-10-01', dueOn: '2026-11-30', originalDueOn: '2026-11-30' });
  });

  it('needs the first-lesson date, not in the future, and no more used than bought', () => {
    const bia = addStudent('Bia');
    expect(fail('package.create', { holderId: bia, planId: planId('12 aulas'), usedBeforeApp: 3 })).toBe('invalid');
    expect(fail('package.create', { holderId: bia, planId: planId('12 aulas'), usedBeforeApp: 3, firstClassOn: '2026-12-01' })).toBe('invalid');
    expect(fail('package.create', { holderId: bia, planId: planId('12 aulas'), usedBeforeApp: 13, firstClassOn: '2026-10-01' })).toBe('invalid');
  });

  it('sums with the lessons given later', () => {
    const bia = addStudent('Bia');
    const p = sell(bia, '12 aulas', { usedBeforeApp: 5, firstClassOn: '2026-10-01' });
    given('2026-10-20', [bia]);
    expect(pkg(p.id)).toMatchObject({ used: 6, remaining: 6, firstClassOn: '2026-10-01' });
  });
});

describe('recording lessons by hand', () => {
  it('a lesson given consumes 1 and the first one starts the validity', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    const result = given('2026-10-10', [bia]);
    expect(result).toMatchObject({ registered: true, packageId: p.id, withoutPackage: null, pendingPayment: true });
    expect(pkg(p.id)).toMatchObject({ used: 1, remaining: 11, status: 'ativo', firstClassOn: '2026-10-10', dueOn: '2026-12-09' });
  });

  it('a charged absence consumes and a waived one does not', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    register('2026-10-10', 'missed_charged', [bia]);
    register('2026-10-12', 'missed_waived', [bia]);
    expect(pkg(p.id)).toMatchObject({ used: 1, remaining: 11, firstClassOn: '2026-10-10' });
    const statement = query<PackageStatement>('package', { id: p.id });
    expect(statement.lessons.map((l) => [l.date, l.outcome])).toEqual([
      ['2026-10-12', 'missed_waived'],
      ['2026-10-10', 'missed_charged'],
    ]);
  });

  it('a waived absence alone does not start the validity', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    register('2026-10-10', 'missed_waived', [bia]);
    expect(pkg(p.id)).toMatchObject({ status: 'aguardando-inicio', dueOn: null });
  });

  it('a pair lesson draws 1 lesson from the pair package, not 2', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    const p = sell(bia, '20 aulas', { participantId: caio });
    expect(given('2026-10-10', [caio, bia])).toMatchObject({ registered: true, packageId: p.id });
    expect(pkg(p.id)).toMatchObject({ used: 1, remaining: 19 });
    expect(query<PackageStatement>('package', { id: p.id }).lessons[0]?.studentNames).toEqual(['Caio', 'Bia']);
  });

  it('a student alone draws from the own package, not the pair one', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    const pair = sell(bia, '20 aulas', { participantId: caio });
    const own = sell(caio, '12 aulas');
    expect(given('2026-10-10', [caio])).toMatchObject({ registered: true, packageId: own.id });
    expect(given('2026-10-11', [bia, caio])).toMatchObject({ registered: true, packageId: pair.id });
    expect(pkg(own.id).used).toBe(1);
    expect(pkg(pair.id).used).toBe(1);
  });

  it('asks which package when a participant without one trains alone', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    const pair = sell(bia, '20 aulas', { participantId: caio });
    const asked = given('2026-10-10', [caio]);
    expect(asked).toMatchObject({ registered: false });
    expect((asked as unknown as { choose: PackageSummary[] }).choose.map((c) => c.id)).toEqual([pair.id]);
    expect(pkg(pair.id).used).toBe(0);
    expect(given('2026-10-10', [caio], pair.id)).toMatchObject({ registered: true, packageId: pair.id });
    expect(pkg(pair.id).used).toBe(1);
  });

  it('asks which package when two students share none', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    const [pb, pc] = [sell(bia), sell(caio)];
    const asked = given('2026-10-10', [bia, caio]) as unknown as { registered: false; choose: PackageSummary[] };
    expect(asked.choose.map((c) => c.id).sort()).toEqual([pb.id, pc.id].sort());
    expect(given('2026-10-10', [bia, caio], pc.id)).toMatchObject({ packageId: pc.id });
    expect(pkg(pb.id).used).toBe(0);
    expect(pkg(pc.id).used).toBe(1);
  });

  it('keeps the lesson "sem pacote" when the student has none, or the package is used up', () => {
    const bia = addStudent('Bia');
    expect(given('2026-10-09', [bia])).toMatchObject({ registered: true, packageId: null, withoutPackage: 'sem-pacote-cadastrado' });
    const p = sell(bia, 'Avulso');
    expect(given('2026-10-10', [bia])).toMatchObject({ packageId: p.id });
    expect(pkg(p.id).status).toBe('esgotado');
    expect(given('2026-10-11', [bia])).toMatchObject({ packageId: null, withoutPackage: 'esgotado' });
    expect(pkg(p.id)).toMatchObject({ used: 1, remaining: 0 });
  });

  it('keeps the lesson "sem pacote" when the package is past its due date', () => {
    const bia = addStudent('Bia');
    const p = sell(bia, 'Avulso', { classes: 3 });
    given('2026-09-01', [bia]);
    expect(pkg(p.id).status).toBe('vencido');
    expect(given('2026-10-20', [bia])).toMatchObject({ packageId: null, withoutPackage: 'vencido' });
  });

  it('the due day itself still counts', () => {
    const bia = addStudent('Bia');
    sell(bia, 'Avulso', { classes: 3 });
    given('2026-10-14', [bia]);
    expect(given('2026-10-21', [bia])).toMatchObject({ registered: true, withoutPackage: null });
  });

  it('lets the trainer force "sem pacote", and an explicit package that is used up ends sem pacote', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    expect(given('2026-10-10', [bia], null)).toMatchObject({ packageId: null, withoutPackage: 'escolhido' });
    expect(pkg(p.id).used).toBe(0);
    const only = sell(addStudent('Caio'), 'Avulso');
    given('2026-10-10', [only.holderId]);
    expect(given('2026-10-11', [only.holderId], only.id)).toMatchObject({ packageId: null, withoutPackage: 'esgotado' });
  });

  it('warns about a pending payment but still records', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    expect(given('2026-10-10', [bia])).toMatchObject({ pendingPayment: true });
    command('payment.create', { packageId: p.id, paidOn: '2026-10-10', amountCents: 144000, method: 'pix' });
    expect(given('2026-10-11', [bia])).toMatchObject({ pendingPayment: false });
  });

  it('refuses the wrong input', () => {
    const [bia, caio, dani] = [addStudent('Bia'), addStudent('Caio'), addStudent('Dani')];
    const ok = { date: '2026-10-10', outcome: 'given', studentIds: [bia] };
    expect(fail('class.register', { ...ok, date: '2026-10-22' })).toBe('invalid');
    expect(fail('class.register', { ...ok, date: '10/10/2026' })).toBe('invalid');
    expect(fail('class.register', { ...ok, outcome: 'maybe' })).toBe('invalid');
    expect(fail('class.register', { ...ok, studentIds: [] })).toBe('invalid');
    expect(fail('class.register', { ...ok, studentIds: [bia, caio, dani] })).toBe('invalid');
    expect(fail('class.register', { ...ok, studentIds: [bia, bia] })).toBe('invalid');
    expect(fail('class.register', { ...ok, studentIds: ['nope'] })).toBe('not_found');
    expect(fail('class.register', { ...ok, packageId: 'nope' })).toBe('invalid');
    const caioPackage = sell(caio);
    expect(fail('class.register', { ...ok, packageId: caioPackage.id })).toBe('invalid');
  });

  it('tells the open screens what changed, and nothing when it only asks', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    sell(bia, '12 aulas', { participantId: caio });
    expect(service.command(ADMIN, 'class.register', { date: '2026-10-10', outcome: 'given', studentIds: [bia] })).toMatchObject({ changed: ['classes', 'packages'] });
    expect(service.command(ADMIN, 'class.register', { date: '2026-10-10', outcome: 'given', studentIds: [caio] })).toMatchObject({ changed: [] satisfies Topic[] });
  });

  it('deletes a lesson recorded by mistake and the balance follows', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    const lesson = given('2026-10-10', [bia]) as { classId: string };
    command('class.delete', { classId: lesson.classId });
    expect(pkg(p.id)).toMatchObject({ used: 0, status: 'aguardando-inicio' });
    expect(fail('class.delete', { classId: lesson.classId })).toBe('not_found');
  });
});

describe('linking a "sem pacote" lesson to the next package', () => {
  it('links it, and the balance and validity count it', () => {
    const bia = addStudent('Bia');
    given('2026-10-05', [bia]);
    expect(query<{ classId: string; date: string }[]>('lessonsWithoutPackage', { studentId: bia })).toMatchObject([{ date: '2026-10-05' }]);
    const p = sell(bia);
    const [lesson] = query<{ classId: string }[]>('lessonsWithoutPackage', { studentId: bia });
    command('class.linkToPackage', { classId: lesson!.classId, packageId: p.id });
    expect(pkg(p.id)).toMatchObject({ used: 1, remaining: 11, firstClassOn: '2026-10-05', status: 'ativo' });
    expect(query('lessonsWithoutPackage', { studentId: bia })).toEqual([]);
  });

  it('refuses a lesson that already has a package, a stranger package or an used-up one', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    const own = sell(bia);
    const done = given('2026-10-05', [bia]) as { classId: string };
    expect(fail('class.linkToPackage', { classId: done.classId, packageId: own.id })).toBe('conflict');

    const lone = given('2026-10-06', [bia], null) as { classId: string };
    const stranger = sell(caio);
    expect(fail('class.linkToPackage', { classId: lone.classId, packageId: stranger.id })).toBe('invalid');
    expect(fail('class.linkToPackage', { classId: 'nope', packageId: own.id })).toBe('not_found');
    expect(fail('class.linkToPackage', { classId: lone.classId, packageId: 'nope' })).toBe('not_found');

    const small = sell(addStudent('Dani'), 'Avulso');
    given('2026-10-07', [small.holderId]);
    const loose = given('2026-10-08', [small.holderId]) as { classId: string };
    expect(fail('class.linkToPackage', { classId: loose.classId, packageId: small.id })).toBe('conflict');
  });
});

describe('renewal', () => {
  it('previews, then transfers the leftover and closes the previous in one go', () => {
    const bia = addStudent('Bia');
    const old = sell(bia);
    for (let day = 1; day <= 9; day++) given(`2026-10-0${day}`, [bia]);
    expect(pkg(old.id).remaining).toBe(3);
    expect(query<RenewalPreview>('renewalPreview', { holderId: bia })).toEqual({
      previousPackageId: old.id,
      transferred: 3,
      notice: '3 aulas do pacote anterior serão transferidas',
    });

    const fresh = sell(bia);
    expect(fresh).toMatchObject({ classes: 12, transferredIn: 3, total: 15, remaining: 15, origin: '15 aulas (12 novas + 3 transferidas)', totalCents: 144000 });
    // Validity of the new plan, counted from the first lesson of the new package.
    expect(fresh).toMatchObject({ status: 'aguardando-inicio', dueOn: null });
    expect(pkg(old.id)).toMatchObject({ status: 'encerrado', closedNote: '3 aulas transferidas para o pacote de 21/10/2026' });

    const statement = query<PackageStatement>('package', { id: old.id });
    expect(statement.transferredTo).toEqual({ packageId: fresh.id, count: 3, note: '3 aulas transferidas para o pacote de 21/10/2026' });
    expect(query<PackageStatement>('package', { id: fresh.id }).transferredFrom).toEqual({ packageId: old.id, count: 3 });
    expect(query<RenewalPreview>('renewalPreview', { holderId: bia })).toMatchObject({ previousPackageId: fresh.id, transferred: 15 });
    expect(query<RenewalPreview>('renewalPreview', { holderId: addStudent('Novo') })).toEqual({ previousPackageId: null, transferred: 0, notice: null });
  });

  it('renews an expired package keeping its leftover', () => {
    const bia = addStudent('Bia');
    const old = sell(bia, 'Avulso', { classes: 3 });
    given('2026-09-01', [bia]);
    expect(pkg(old.id).status).toBe('vencido');
    expect(sell(bia, '16 aulas')).toMatchObject({ transferredIn: 2, total: 18 });
  });

  it('renewing a used-up package transfers nothing', () => {
    const bia = addStudent('Bia');
    const old = sell(bia, 'Avulso');
    given('2026-10-10', [bia]);
    expect(sell(bia, 'Avulso')).toMatchObject({ transferredIn: 0 });
    expect(pkg(old.id).closedNote).toBe('Nenhuma aula transferida para o pacote de 21/10/2026');
  });

  it('a student is the holder of one open package at a time', () => {
    const bia = addStudent('Bia');
    const first = sell(bia);
    const second = sell(bia);
    const open = query<PackageSummary[]>('studentPackages', { studentId: bia }).filter((p) => p.status !== 'encerrado');
    expect(open.map((p) => p.id)).toEqual([second.id]);
    expect(pkg(first.id).status).toBe('encerrado');
  });

  it('keeps unlinked lessons waiting until they are linked', () => {
    const bia = addStudent('Bia');
    given('2026-10-05', [bia]);
    sell(bia);
    expect(query('lessonsWithoutPackage', { studentId: bia })).toHaveLength(1);
  });
});

describe('pauses', () => {
  it('pushes the due date by the paused days, both ends counted', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    given('2026-10-01', [bia]);
    expect(pkg(p.id)).toMatchObject({ dueOn: '2026-11-30' });
    command('package.pause', { packageId: p.id, startsOn: '2026-10-10', endsOn: '2026-10-14' });
    expect(pkg(p.id)).toMatchObject({ dueOn: '2026-12-05', originalDueOn: '2026-11-30', pausedDaysInLimit: 5, pausedToday: false });
    expect(query<PackageStatement>('package', { id: p.id }).pauses).toMatchObject([{ startsOn: '2026-10-10', endsOn: '2026-10-14', general: false }]);
  });

  it('a pause before the first lesson costs nothing', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    command('package.pause', { packageId: p.id, startsOn: '2026-10-01', endsOn: '2026-10-05' });
    given('2026-10-10', [bia]);
    expect(pkg(p.id).dueOn).toBe('2026-12-09');
  });

  it('allows more than 30 days only with a reason', () => {
    const p = sell(addStudent('Bia'));
    expect(fail('package.pause', { packageId: p.id, startsOn: '2026-10-01', endsOn: '2026-11-15' })).toBe('invalid');
    expect(fail('package.pause', { packageId: p.id, startsOn: '2026-10-01', endsOn: '2026-11-15', reason: '  ' })).toBe('invalid');
    const done = command('package.pause', { packageId: p.id, startsOn: '2026-10-01', endsOn: '2026-11-15', reason: 'Lesão no joelho' });
    expect(done).toMatchObject({ reason: 'Lesão no joelho', general: false });
    expect(pkg(p.id).pausedDaysInLimit).toBe(46);
  });

  it('adds up all pauses of the package toward the 30 days', () => {
    const p = sell(addStudent('Bia'));
    command('package.pause', { packageId: p.id, startsOn: '2026-10-01', endsOn: '2026-10-20' });
    expect(fail('package.pause', { packageId: p.id, startsOn: '2026-11-01', endsOn: '2026-11-15' })).toBe('invalid');
    command('package.pause', { packageId: p.id, startsOn: '2026-11-01', endsOn: '2026-11-10' });
  });

  it('removing a pause gives the days back', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    given('2026-10-01', [bia]);
    const pause = command('package.pause', { packageId: p.id, startsOn: '2026-10-10', endsOn: '2026-10-14' });
    command('package.removePause', { id: pause.id });
    expect(pkg(p.id).dueOn).toBe('2026-11-30');
    expect(fail('package.removePause', { id: pause.id })).toBe('not_found');
  });

  it('refuses an invalid period, an unknown package and a closed one', () => {
    const bia = addStudent('Bia');
    const old = sell(bia);
    expect(fail('package.pause', { packageId: old.id, startsOn: '2026-10-10', endsOn: '2026-10-05' })).toBe('invalid');
    expect(fail('package.pause', { packageId: 'nope', startsOn: '2026-10-10', endsOn: '2026-10-12' })).toBe('not_found');
    sell(bia);
    expect(fail('package.pause', { packageId: old.id, startsOn: '2026-10-10', endsOn: '2026-10-12' })).toBe('conflict');
  });

  it('"pausar todos" extends every package without using up the 30 days', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    const [pb, pc] = [sell(bia), sell(caio)];
    given('2026-10-01', [bia]);
    given('2026-10-02', [caio]);
    const all = command('pause.createGlobal', { startsOn: '2026-10-10', endsOn: '2026-10-24' });
    expect(all).toMatchObject({ startsOn: '2026-10-10', endsOn: '2026-10-24' });
    expect(pkg(pb.id)).toMatchObject({ dueOn: '2026-12-15', originalDueOn: '2026-11-30', pausedDaysInLimit: 0, pausedToday: true });
    expect(pkg(pc.id).dueOn).toBe('2026-12-16');
    // 30 own days are still available on top of the general pause.
    command('package.pause', { packageId: pb.id, startsOn: '2026-11-01', endsOn: '2026-11-30' });
    expect(pkg(pb.id).pausedDaysInLimit).toBe(30);
    expect(query<PackageStatement>('package', { id: pb.id }).pauses.map((p) => p.general)).toEqual([true, false]);
    expect(query<PackagesOverview>('packagesOverview').globalPauses).toEqual([{ id: all.id, startsOn: '2026-10-10', endsOn: '2026-10-24' }]);
  });

  it('a day in both an own and a general pause counts once and not against the limit', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    given('2026-10-01', [bia]);
    command('pause.createGlobal', { startsOn: '2026-10-10', endsOn: '2026-10-14' });
    command('package.pause', { packageId: p.id, startsOn: '2026-10-12', endsOn: '2026-10-16' });
    expect(pkg(p.id)).toMatchObject({ pausedDaysInLimit: 2, dueOn: '2026-12-07' });
  });

  it('removes a general pause and refuses a bad period', () => {
    const bia = addStudent('Bia');
    const p = sell(bia);
    given('2026-10-01', [bia]);
    const all = command('pause.createGlobal', { startsOn: '2026-10-10', endsOn: '2026-10-14' });
    command('pause.removeGlobal', { id: all.id });
    expect(pkg(p.id).dueOn).toBe('2026-11-30');
    expect(fail('pause.createGlobal', { startsOn: '2026-10-14', endsOn: '2026-10-10' })).toBe('invalid');
    expect(fail('pause.removeGlobal', { id: all.id })).toBe('not_found');
  });
});

describe('payments', () => {
  it('is pending until the payments reach the total, in any mix of methods', () => {
    const p = sell(addStudent('Bia'));
    const first = command('payment.create', { packageId: p.id, paidOn: '2026-10-21', amountCents: 100000, method: 'pix' });
    expect(pkg(p.id)).toMatchObject({ paymentStatus: 'pending', paidCents: 100000, missingCents: 44000 });
    command('payment.create', { packageId: p.id, paidOn: '2026-10-21', amountCents: 44000, method: 'cash' });
    expect(pkg(p.id)).toMatchObject({ paymentStatus: 'paid', missingCents: 0 });
    expect(query<PackageStatement>('package', { id: p.id }).payments.map((x) => x.method)).toEqual(['pix', 'cash']);
    expect(first).toMatchObject({ packageId: p.id, amountCents: 100000 });
  });

  it('corrects and deletes a payment', () => {
    const p = sell(addStudent('Bia'));
    const pay = command('payment.create', { packageId: p.id, paidOn: '2026-10-21', amountCents: 144000, method: 'card' });
    expect(pkg(p.id).paymentStatus).toBe('paid');
    const fixed = command('payment.update', { id: pay.id, paidOn: '2026-10-20', amountCents: 140000, method: 'pix' });
    expect(fixed).toMatchObject({ paidOn: '2026-10-20', amountCents: 140000, method: 'pix' });
    expect(pkg(p.id)).toMatchObject({ paymentStatus: 'pending', missingCents: 4000 });
    command('payment.delete', { id: pay.id });
    expect(pkg(p.id).paidCents).toBe(0);
  });

  it('refuses bad payments', () => {
    const p = sell(addStudent('Bia'));
    const ok = { packageId: p.id, paidOn: '2026-10-21', amountCents: 100, method: 'pix' };
    expect(fail('payment.create', { ...ok, amountCents: 0 })).toBe('invalid');
    expect(fail('payment.create', { ...ok, amountCents: 1.5 })).toBe('invalid');
    expect(fail('payment.create', { ...ok, method: 'boleto' })).toBe('invalid');
    expect(fail('payment.create', { ...ok, paidOn: '2026-02-30' })).toBe('invalid');
    expect(fail('payment.create', { ...ok, packageId: 'nope' })).toBe('not_found');
    expect(fail('payment.update', { ...ok, id: 'nope' })).toBe('not_found');
    expect(fail('payment.delete', { id: 'nope' })).toBe('not_found');
  });

  it('tells the open screens what changed', () => {
    const p = sell(addStudent('Bia'));
    expect(service.command(ADMIN, 'payment.create', { packageId: p.id, paidOn: '2026-10-21', amountCents: 100, method: 'pix' })).toMatchObject({ changed: ['payments', 'packages'] });
  });
});

describe('Alunos e pacotes', () => {
  const overview = () => query<PackagesOverview>('packagesOverview');
  const names = () => overview().items.map((i) => i.name);

  it('lists every student that is not inactive, even without a package', () => {
    const [bia] = [addStudent('Bia'), addStudent('Caio')];
    command('student.setStatus', { id: addStudent('Dani'), status: 'inactive' });
    expect(names().sort()).toEqual(['Bia', 'Caio']);
    expect(overview().items.find((i) => i.studentId === bia)).toMatchObject({ package: null, urgency: 4, highlighted: false });
  });

  it('orders by urgency: pending payment, expired or used up, running low, the rest', () => {
    const [ana, bia, caio, dani, edu] = ['Ana', 'Bia', 'Caio', 'Dani', 'Edu'].map(addStudent) as [string, string, string, string, string];
    const pay = (id: string, cents = 144000) => command('payment.create', { packageId: id, paidOn: '2026-10-21', amountCents: cents, method: 'pix' });
    // Ana: paid, plenty left (level 4).
    pay(sell(ana).id);
    // Bia: paid, 3 left (level 3).
    const b = sell(bia);
    pay(b.id);
    for (let day = 1; day <= 9; day++) given(`2026-10-0${day}`, [bia]);
    // Caio: paid, expired (level 2).
    const c = sell(caio, 'Avulso', { classes: 3 });
    pay(c.id, 60000);
    given('2026-09-01', [caio]);
    // Dani: not paid (level 1).
    sell(dani);
    // Edu: paid, plenty left (level 4).
    pay(sell(edu).id);

    expect(overview().items.map((i) => [i.name, i.urgency, i.highlighted])).toEqual([
      ['Dani', 1, true],
      ['Caio', 2, true],
      ['Bia', 3, true],
      ['Ana', 4, false],
      ['Edu', 4, false],
    ]);
    expect(overview().expectedRenewals).toBe(2);
  });

  it('does not highlight the Avulso plan for balance or validity', () => {
    const bia = addStudent('Bia');
    const p = sell(bia, 'Avulso');
    command('payment.create', { packageId: p.id, paidOn: '2026-10-21', amountCents: 20000, method: 'pix' });
    given('2026-10-10', [bia]);
    expect(overview().items[0]).toMatchObject({ urgency: 4, highlighted: false });
    expect(overview().expectedRenewals).toBe(0);
  });

  it('shows monthly students without a package', () => {
    const bia = addStudent('Bia');
    // The monthly billing arrives with its own screen; the column already exists.
    const sql = (service as unknown as { ctx: { sql: { run(q: string, ...b: string[]): void } } }).ctx.sql;
    sql.run("UPDATE students SET billing = 'monthly' WHERE id = ?", bia);
    expect(overview().items[0]).toMatchObject({ billing: 'monthly', package: null, urgency: 4 });
    expect(fail('package.create', { holderId: bia, planId: planId('Avulso') })).toBe('invalid');
  });

  it('shows the shared package to the participant, without charging them the payment', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    const pair = sell(bia, '20 aulas', { participantId: caio });
    const items = overview().items;
    expect(items.find((i) => i.studentId === caio)).toMatchObject({ asParticipant: true, urgency: 4, package: { id: pair.id } });
    expect(items.find((i) => i.studentId === bia)).toMatchObject({ asParticipant: false, urgency: 1 });
  });

  it('counts lessons without package on the student card', () => {
    const bia = addStudent('Bia');
    given('2026-10-05', [bia]);
    expect(overview().items[0]).toMatchObject({ lessonsWithoutPackage: 1 });
  });

  it('adds up the month: what was received, by payment date', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    const [pb, pc] = [sell(bia), sell(caio)];
    command('payment.create', { packageId: pb.id, paidOn: '2026-10-02', amountCents: 100000, method: 'pix' });
    command('payment.create', { packageId: pc.id, paidOn: '2026-10-20', amountCents: 44000, method: 'cash' });
    command('payment.create', { packageId: pc.id, paidOn: '2026-09-30', amountCents: 5000, method: 'cash' });
    expect(overview()).toMatchObject({ month: '2026-10', receivedCents: 144000 });
  });

  it('uses the São Paulo day, not the UTC one', () => {
    clock.set('2026-11-01T01:30:00Z');
    expect(overview().month).toBe('2026-10');
  });
});

describe('statement of a package', () => {
  it('gathers lessons, pauses, payments and the origin of the lessons', () => {
    const bia = addStudent('Bia');
    const old = sell(bia);
    for (let day = 1; day <= 9; day++) given(`2026-10-0${day}`, [bia]);
    const fresh = sell(bia, '12 aulas', {
      payments: [{ paidOn: '2026-10-21', amountCents: 144000, method: 'pix' }],
    });
    given('2026-10-21', [bia]);
    command('package.pause', { packageId: fresh.id, startsOn: '2026-10-25', endsOn: '2026-10-26' });
    const statement = query<PackageStatement>('package', { id: fresh.id });
    expect(statement.summary).toMatchObject({ origin: '15 aulas (12 novas + 3 transferidas)', used: 1, remaining: 14, paymentStatus: 'paid' });
    expect(statement.lessons).toHaveLength(1);
    expect(statement.pauses).toHaveLength(1);
    expect(statement.payments).toHaveLength(1);
    expect(statement.transferredFrom).toEqual({ packageId: old.id, count: 3 });
    expect(query<PackageStatement>('package', { id: old.id }).lessons).toHaveLength(9);
  });

  it('answers not_found for an unknown package', () => {
    expect(service.query(ADMIN, 'package', { id: 'nope' })).toEqual({ ok: false, error: 'not_found' });
    expect(service.query(ADMIN, 'package', {})).toEqual({ ok: false, error: 'invalid' });
  });

  it('lists the packages of a student, newest first, including pair ones', () => {
    const [bia, caio] = [addStudent('Bia'), addStudent('Caio')];
    const [first, second] = [sell(bia), sell(bia)];
    const pair = sell(caio, '20 aulas', { participantId: bia });
    expect(query<PackageSummary[]>('studentPackages', { studentId: bia }).map((p) => p.id)).toEqual([pair.id, second.id, first.id]);
  });
});
