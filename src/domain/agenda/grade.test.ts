import { describe, expect, it } from 'vitest';
import { duracaoPorExtenso, faixaDaGrade, horaAposArrasto, horaDeMinutos, intervalosEntreAulas, posicaoNaGrade } from './grade';

const faixa = { inicioH: 6, fimH: 22 };

describe('the day grid', () => {
  it('opens from 06:00 to 22:00 and widens for lessons outside', () => {
    expect(faixaDaGrade([])).toEqual(faixa);
    expect(faixaDaGrade([{ time: '07:00', durationMin: 60 }])).toEqual(faixa);
    expect(faixaDaGrade([{ time: '05:30', durationMin: 60 }, { time: '21:30', durationMin: 60 }])).toEqual({ inicioH: 5, fimH: 23 });
    expect(faixaDaGrade([{ time: '23:30', durationMin: 60 }]).fimH).toBe(24);
  });

  it('places a lesson as percentages of the grid', () => {
    const { topo, altura } = posicaoNaGrade({ time: '10:00', durationMin: 60 }, faixa);
    expect(topo).toBeCloseTo(25);
    expect(altura).toBeCloseTo(6.25);
  });

  it('snaps a drag to 15 minutes and keeps it inside the grid', () => {
    const aula = { time: '08:00', durationMin: 60 };
    expect(horaAposArrasto(aula, 20, faixa)).toBe('08:15');
    expect(horaAposArrasto(aula, 22, faixa)).toBe('08:15');
    expect(horaAposArrasto(aula, -70, faixa)).toBe('06:45');
    expect(horaAposArrasto(aula, -600, faixa)).toBe('06:00');
    expect(horaAposArrasto(aula, 900, faixa)).toBe('21:00');
  });

  it('finds the free time between lessons', () => {
    const aulas = [
      { time: '09:00', durationMin: 60 },
      { time: '07:00', durationMin: 60 },
      { time: '10:00', durationMin: 30 },
      { time: '11:15', durationMin: 45 },
    ];
    expect(intervalosEntreAulas(aulas)).toEqual([
      { deMin: 8 * 60, ateMin: 9 * 60 },
      { deMin: 10 * 60 + 30, ateMin: 11 * 60 + 15 },
    ]);
    expect(intervalosEntreAulas([])).toEqual([]);
  });

  it('writes times and durations', () => {
    expect(horaDeMinutos(65)).toBe('01:05');
    expect(duracaoPorExtenso(45)).toBe('45 min');
    expect(duracaoPorExtenso(60)).toBe('1 h');
    expect(duracaoPorExtenso(90)).toBe('1 h 30');
  });
});
