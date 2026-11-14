import { describe, expect, it } from 'vitest';
import {
  aulaAgora,
  avisoDePrevisao,
  cancelarAula,
  datasDaRecorrencia,
  diaDaSemana,
  duracaoValida,
  ehData,
  ehHora,
  horaEmSaoPaulo,
  horasDeAntecedencia,
  instanteEmSaoPaulo,
  preverValidade,
  projetarDatas,
  semanaDe,
} from './index';

describe('horário em São Paulo', () => {
  it('converts a local date and time to UTC and back', () => {
    expect(instanteEmSaoPaulo('2026-11-16', '07:00')).toBe('2026-11-16T10:00:00.000Z');
    expect(horaEmSaoPaulo('2026-11-16T10:00:00.000Z')).toBe('07:00');
    expect(horaEmSaoPaulo('2026-11-17T02:30:00.000Z')).toBe('23:30');
  });

  it('gives ISO weekdays and Monday-to-Sunday weeks', () => {
    expect(diaDaSemana('2026-11-16')).toBe(1);
    expect(diaDaSemana('2026-11-22')).toBe(7);
    expect(semanaDe('2026-11-22')).toEqual({ segunda: '2026-11-16', domingo: '2026-11-22' });
    expect(semanaDe('2026-11-16')).toEqual({ segunda: '2026-11-16', domingo: '2026-11-22' });
  });

  it('validates dates, times and durations', () => {
    expect(ehData('2026-02-29')).toBe(false);
    expect(ehData('2026-02-28')).toBe(true);
    expect(ehHora('24:00')).toBe(false);
    expect(ehHora('07:05')).toBe(true);
    expect(duracaoValida(60)).toBe(true);
    expect(duracaoValida(61)).toBe(false);
    expect(duracaoValida(0)).toBe(false);
    expect(duracaoValida(45.5)).toBe(false);
  });
});

describe('recorrência', () => {
  const terca = { diaDaSemana: 2 as const, inicio: '2026-11-10', fim: null };

  it('lists the weekday dates inside the window, ends included', () => {
    expect(datasDaRecorrencia(terca, '2026-11-10', '2026-11-24')).toEqual(['2026-11-10', '2026-11-17', '2026-11-24']);
    expect(datasDaRecorrencia(terca, '2026-11-11', '2026-11-23')).toEqual(['2026-11-17']);
  });

  it('respects the start and the end of the recurrence', () => {
    expect(datasDaRecorrencia({ ...terca, inicio: '2026-11-17' }, '2026-11-01', '2026-11-30')).toEqual(['2026-11-17', '2026-11-24']);
    expect(datasDaRecorrencia({ ...terca, fim: '2026-11-17' }, '2026-11-01', '2026-11-30')).toEqual(['2026-11-10', '2026-11-17']);
    expect(datasDaRecorrencia({ ...terca, fim: '2026-11-09' }, '2026-11-01', '2026-11-30')).toEqual([]);
  });

  it('merges recurrences when projecting', () => {
    const quinta = { diaDaSemana: 4 as const, inicio: '2026-11-10', fim: null };
    expect(projetarDatas([terca, quinta], '2026-11-17', 3)).toEqual(['2026-11-19', '2026-11-24', '2026-11-26']);
    expect(projetarDatas([], '2026-11-17', 3)).toEqual([]);
    expect(projetarDatas([{ ...terca, fim: '2026-11-24' }], '2026-11-17', 5)).toEqual(['2026-11-24']);
  });
});

describe('cancelamento', () => {
  const inicio = instanteEmSaoPaulo('2026-11-17', '07:00');

  it('measures the notice in hours', () => {
    expect(horasDeAntecedencia(inicio, new Date('2026-11-16T10:00:00Z'))).toBe(24);
    expect(horasDeAntecedencia(inicio, new Date('2026-11-17T11:00:00Z'))).toBe(-1);
  });

  it('cancels at once with 24 h or more', () => {
    expect(cancelarAula(inicio, new Date('2026-11-16T10:00:00Z'))).toEqual({ tipo: 'cancelada' });
  });

  it('asks charge or waive with less than 24 h, charge pre-selected', () => {
    expect(cancelarAula(inicio, new Date('2026-11-16T10:00:01Z'))).toEqual({ tipo: 'decidir', sugestao: 'cobrar' });
  });

  it('turns the decision into a charged or waived absence', () => {
    const tarde = new Date('2026-11-17T06:00:00Z');
    expect(cancelarAula(inicio, tarde, { decisao: 'cobrar' })).toEqual({ tipo: 'falta', cobrada: true });
    expect(cancelarAula(inicio, tarde, { decisao: 'abonar' })).toEqual({ tipo: 'falta', cobrada: false });
  });

  it('never charges when the trainer cancels', () => {
    expect(cancelarAula(inicio, new Date('2026-11-17T06:00:00Z'), { peloTreinador: true })).toEqual({ tipo: 'cancelada' });
  });

  it('knows when a lesson is happening now', () => {
    expect(aulaAgora(inicio, 60, new Date('2026-11-17T10:30:00Z'))).toBe(true);
    expect(aulaAgora(inicio, 60, new Date('2026-11-17T11:00:00Z'))).toBe(false);
    expect(aulaAgora(inicio, 60, new Date('2026-11-17T09:59:00Z'))).toBe(false);
    expect(aulaAgora(inicio, 30, new Date('2026-11-17T10:30:00Z'))).toBe(false);
  });
});

describe('previsão de validade', () => {
  const semanais = ['2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22'];

  it('warns when the last lesson falls after the due date', () => {
    const previsao = preverValidade({ restantes: 4, total: 12, validadeDias: 60, primeiraAula: '2026-10-20', pausas: [], aulasPrevistas: semanais });
    expect(previsao.vencimento).toBe('2026-12-19');
    expect(previsao.ultimaAula).toBe('2026-12-22');
    expect(previsao.passaDaValidade).toBe(true);
    expect(previsao.aviso).toBe('12ª aula prevista para 22/12/2026; validade 19/12/2026');
    expect(avisoDePrevisao(12, '2027-01-20', '2027-01-15')).toBe('12ª aula prevista para 20/01/2027; validade 15/01/2027');
  });

  it('does not warn when the last lesson is on the due date', () => {
    const previsao = preverValidade({ restantes: 3, total: 12, validadeDias: 60, primeiraAula: '2026-10-22', pausas: [], aulasPrevistas: semanais });
    expect(previsao.vencimento).toBe('2026-12-21');
    expect(previsao.ultimaAula).toBe('2026-12-15');
    expect(previsao.passaDaValidade).toBe(false);
    expect(previsao.aviso).toBeNull();
  });

  it('counts the paused days in the due date', () => {
    const pausa = [{ inicio: '2026-11-01', fim: '2026-11-05', geral: false }];
    const previsao = preverValidade({ restantes: 4, total: 12, validadeDias: 60, primeiraAula: '2026-10-20', pausas: pausa, aulasPrevistas: semanais });
    expect(previsao.vencimento).toBe('2026-12-24');
    expect(previsao.passaDaValidade).toBe(false);
  });

  it('forecasts the due date of a package awaiting start from its first scheduled lesson', () => {
    const previsao = preverValidade({ restantes: 12, total: 12, validadeDias: 60, primeiraAula: null, pausas: [], aulasPrevistas: semanais });
    expect(previsao.vencimento).toBe('2027-01-30');
    expect(previsao.vencimentoPrevisto).toBe(true);
    expect(previsao.faltamAulas).toBe(true);
    expect(previsao.ultimaAula).toBeNull();
    expect(previsao.aviso).toBeNull();
  });

  it('has nothing to say without lessons ahead or a balance', () => {
    expect(preverValidade({ restantes: 5, total: 12, validadeDias: 60, primeiraAula: null, pausas: [], aulasPrevistas: [] })).toMatchObject({ vencimento: null, faltamAulas: true });
    expect(preverValidade({ restantes: 0, total: 12, validadeDias: 60, primeiraAula: '2026-10-01', pausas: [], aulasPrevistas: semanais })).toMatchObject({ ultimaAula: null, faltamAulas: false });
  });
});
