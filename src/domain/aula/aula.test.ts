import { describe, expect, it } from 'vitest';
import { ajustarSerie, cargaDaAula, cargaPorSemana, duracaoEmMinutos, isPse, proximoItem, serieComoPrescrita, tonelagem, volumePorGrupo, type ItemDoPlano } from './index';

describe('effort', () => {
  it('accepts PSE 0 to 10, whole numbers only', () => {
    expect([0, 5, 10].every(isPse)).toBe(true);
    expect([-1, 11, 5.5, '5', null].some(isPse)).toBe(false);
  });

  it('makes the class load as PSE times minutes (Foster)', () => {
    expect(cargaDaAula(7, 60)).toBe(420);
    expect(cargaDaAula(0, 60)).toBe(0);
  });

  it('measures the duration in whole minutes, at least 1', () => {
    expect(duracaoEmMinutos('2026-11-15T12:00:00Z', '2026-11-15T12:59:40Z')).toBe(60);
    expect(duracaoEmMinutos('2026-11-15T12:00:00Z', '2026-11-15T12:00:05Z')).toBe(1);
    expect(duracaoEmMinutos('2026-11-15T12:00:00Z', '2026-11-16T12:00:00Z')).toBe(600);
  });

  it('totals the load per week from Monday to Sunday', () => {
    const weeks = cargaPorSemana(
      [
        { data: '2026-11-16', carga: 300 },
        { data: '2026-11-22', carga: 100 },
        { data: '2026-11-23', carga: 50 },
        { data: '2026-11-10', carga: 70 },
      ],
      '2026-11-24',
      3,
    );
    expect(weeks.map((w) => [w.segunda, w.total, w.aulas])).toEqual([
      ['2026-11-09', 70, 1],
      ['2026-11-16', 400, 2],
      ['2026-11-23', 50, 1],
    ]);
  });
});

describe('volume', () => {
  it('counts 1 per primary group and 0.5 per secondary one', () => {
    const volume = volumePorGrupo([
      { primaryGroups: ['peitoral'], secondaryGroups: ['triceps', 'ombro'] },
      { primaryGroups: ['peitoral'], secondaryGroups: ['triceps'] },
      { primaryGroups: ['triceps'], secondaryGroups: ['triceps'] },
    ]);
    expect(volume).toEqual({ peitoral: 2, triceps: 2, ombro: 0.5 });
  });

  it('adds up tonnage only for sets with load and repetitions', () => {
    expect(tonelagem([{ loadG: 20_000, reps: 10 }, { loadG: null, reps: 15 }, { loadG: 5000, reps: null }])).toBe(200_000);
  });
});

describe('a set', () => {
  it('is recorded as prescribed: the bottom of the range and the suggested load', () => {
    expect(serieComoPrescrita({ repsMin: 8, loadG: 20_000 }, 'load_reps')).toEqual({ reps: 8, loadG: 20_000, seconds: null, meters: null });
    expect(serieComoPrescrita({ repsMin: 8, loadG: 20_000 }, 'bodyweight_reps')).toEqual({ reps: 8, loadG: null, seconds: null, meters: null });
    expect(serieComoPrescrita({ repsMin: 30, loadG: null }, 'time')).toEqual({ reps: null, loadG: null, seconds: 30, meters: null });
    expect(serieComoPrescrita({ repsMin: 20, loadG: null }, 'distance').meters).toBe(20);
  });

  it('takes the + and − adjustments and refuses invalid ones', () => {
    const base = { reps: 8, loadG: 20_000, seconds: null, meters: null };
    expect(ajustarSerie(base, { loadG: 22_500, reps: 10 }, 'load_reps')).toEqual({ reps: 10, loadG: 22_500, seconds: null, meters: null });
    expect(ajustarSerie(base, { reps: -1 }, 'load_reps')).toBeNull();
    expect(ajustarSerie(base, { reps: 1.5 }, 'load_reps')).toBeNull();
    expect(ajustarSerie(base, { reps: 101 }, 'load_reps')).toBeNull();
    expect(ajustarSerie(base, { reps: null }, 'load_reps')).toBeNull();
  });
});

const item = (id: string, groupId: string | null, sets: number, done: number): ItemDoPlano => ({ id, groupId, sets, done });

describe('what comes next', () => {
  it('finishes every set of a single exercise before moving on', () => {
    expect(proximoItem([item('a', null, 3, 1), item('b', null, 3, 0)], 'a')).toBe('a');
    expect(proximoItem([item('a', null, 3, 3), item('b', null, 3, 0)], 'a')).toBe('b');
    expect(proximoItem([item('a', null, 3, 3)], 'a')).toBeNull();
  });

  it('alternates in a bi-set', () => {
    const plan = (a: number, b: number) => [item('a', 'g', 3, a), item('b', 'g', 3, b), item('c', null, 3, 0)];
    expect(proximoItem(plan(0, 0), null)).toBe('a');
    expect(proximoItem(plan(1, 0), 'a')).toBe('b');
    expect(proximoItem(plan(1, 1), 'b')).toBe('a');
    expect(proximoItem(plan(3, 2), 'a')).toBe('b');
    expect(proximoItem(plan(3, 3), 'b')).toBe('c');
  });

  it('goes round a circuit and skips what has no sets left', () => {
    const circuit = (a: number, b: number, c: number) => [item('a', 'g', 2, a), item('b', 'g', 1, b), item('c', 'g', 2, c)];
    expect(proximoItem(circuit(1, 0, 0), 'a')).toBe('b');
    expect(proximoItem(circuit(1, 1, 0), 'b')).toBe('c');
    expect(proximoItem(circuit(1, 1, 1), 'c')).toBe('a');
    expect(proximoItem(circuit(2, 1, 1), 'a')).toBe('c');
  });
});
