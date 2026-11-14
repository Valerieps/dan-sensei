import { describe, expect, it } from 'vitest';
import {
  type DadosDoPacote,
  type ItemDeUrgencia,
  type PacoteCandidato,
  type Pausa,
  anotacaoDoPacoteEncerrado,
  aulasATransferir,
  avaliarPausa,
  avisoDeTransferencia,
  calcularSaldo,
  calcularVencimento,
  comDestaqueVermelho,
  dataEmSaoPaulo,
  diasEntre,
  diasPausadosNoLimite,
  diasPausadosParaValidade,
  estaPausado,
  mensalidadePendente,
  mensalidadeVenceHoje,
  mesesPendentes,
  nivelDeUrgencia,
  ordenarPorUrgencia,
  origemDasAulas,
  pacoteDaAula,
  resumirPacote,
  resumirPagamento,
  situacaoDoPacote,
  somarDias,
  somarMeses,
  vencimentoDoMes,
  vencimentoOriginal,
} from './index';

const pacote12: DadosDoPacote = {
  totalAulas: 12,
  aulasTransferidas: 0,
  usadasAntesDoApp: 0,
  aulasDadas: 0,
  faltasCobradas: 0,
  validadeDias: 60,
  primeiraAula: null,
  pausas: [],
  encerrado: false,
};

const pausa = (inicio: string, fim: string, geral = false): Pausa => ({ inicio, fim, geral });

describe('datas', () => {
  it('uses the São Paulo day, not the UTC day', () => {
    // 02:30 UTC on the 15th is still the 14th at 23:30 in São Paulo.
    expect(dataEmSaoPaulo('2026-03-15T02:30:00Z')).toBe('2026-03-14');
    expect(dataEmSaoPaulo('2026-03-15T03:00:00Z')).toBe('2026-03-15');
    expect(dataEmSaoPaulo(Date.UTC(2026, 0, 1, 1, 0))).toBe('2025-12-31');
  });

  it('adds days across months and years, and counts days between', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(diasEntre('2026-01-01', '2026-03-02')).toBe(60);
    expect(diasEntre('2026-03-02', '2026-01-01')).toBe(-60);
  });

  it('adds months', () => {
    expect(somarMeses('2026-11', 2)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
  });
});

describe('saldo', () => {
  it('counts given lessons, charged absences and lessons used before the app', () => {
    const saldo = calcularSaldo({
      ...pacote12,
      usadasAntesDoApp: 4,
      aulasDadas: 3,
      faltasCobradas: 1,
    });
    expect(saldo).toEqual({ total: 12, usadas: 8, restantes: 4 });
  });

  it('adds transferred lessons to the total (3 left + 12 bought = 15)', () => {
    expect(calcularSaldo({ ...pacote12, aulasTransferidas: 3 })).toEqual({
      total: 15,
      usadas: 0,
      restantes: 15,
    });
  });

  it('never goes below zero when lessons run past the total', () => {
    expect(calcularSaldo({ ...pacote12, aulasDadas: 13 }).restantes).toBe(0);
  });
});

describe('validade', () => {
  it('starts on the first consuming lesson', () => {
    expect(calcularVencimento(null, 60, [])).toBeNull();
    expect(calcularVencimento('2026-01-10', 60, [])).toBe('2026-03-11');
    expect(vencimentoOriginal('2026-01-10', 60)).toBe('2026-03-11');
  });

  it('adds the paused days, keeping the original date', () => {
    const pausas = [pausa('2026-02-01', '2026-02-10')];
    expect(calcularVencimento('2026-01-10', 60, pausas)).toBe('2026-03-21');
    expect(vencimentoOriginal('2026-01-10', 60)).toBe('2026-03-11');
  });

  it('counts a day once when pauses overlap', () => {
    const pausas = [pausa('2026-02-01', '2026-02-10'), pausa('2026-02-05', '2026-02-12', true)];
    expect(diasPausadosParaValidade(pausas, '2026-01-10')).toBe(12);
  });

  it('ignores paused days before the first lesson', () => {
    expect(diasPausadosParaValidade([pausa('2026-01-01', '2026-01-10')], '2026-01-06')).toBe(5);
    expect(diasPausadosParaValidade([pausa('2026-01-01', '2026-01-10')], '2026-02-01')).toBe(0);
  });

  it('knows when a package is paused today', () => {
    const pausas = [pausa('2026-02-01', '2026-02-10')];
    expect(estaPausado(pausas, '2026-02-10')).toBe(true);
    expect(estaPausado(pausas, '2026-02-11')).toBe(false);
  });
});

describe('limite de pausa', () => {
  it('allows up to 30 days in total without a reason', () => {
    const existentes = [pausa('2026-02-01', '2026-02-20')];
    const resultado = avaliarPausa(existentes, pausa('2026-03-01', '2026-03-10'), null);
    expect(resultado).toEqual({ ok: true, diasNoLimite: 30, passaDoLimite: false });
  });

  it('asks for a reason past 30 days, and accepts it once written', () => {
    const existentes = [pausa('2026-02-01', '2026-02-20')];
    const nova = pausa('2026-03-01', '2026-03-11');
    expect(avaliarPausa(existentes, nova, '  ')).toEqual({ ok: false, motivo: 'precisa-de-motivo' });
    expect(avaliarPausa(existentes, nova, 'Lesão no joelho')).toEqual({
      ok: true,
      diasNoLimite: 31,
      passaDoLimite: true,
    });
  });

  it('rejects an inverted period', () => {
    expect(avaliarPausa([], pausa('2026-03-10', '2026-03-01'), 'x')).toEqual({
      ok: false,
      motivo: 'periodo-invalido',
    });
  });

  it('does not count the general pause in the 30 days', () => {
    const geral = pausa('2026-02-01', '2026-03-15', true);
    expect(diasPausadosNoLimite([geral])).toBe(0);
    expect(avaliarPausa([geral], pausa('2026-04-01', '2026-04-30'), null).ok).toBe(true);
  });

  it('does not count own pause days already covered by a general pause', () => {
    const geral = pausa('2026-02-01', '2026-02-10', true);
    const propria = pausa('2026-02-05', '2026-02-14');
    expect(diasPausadosNoLimite([geral, propria])).toBe(4);
  });

  it('never asks a reason for a general pause', () => {
    const resultado = avaliarPausa([], pausa('2026-02-01', '2026-04-30', true), null);
    expect(resultado.ok).toBe(true);
  });
});

describe('situação do pacote', () => {
  it('awaits start until a lesson consumes it', () => {
    expect(situacaoDoPacote(pacote12, '2026-01-01')).toBe('aguardando-inicio');
  });

  it('is active within the validity, including the due date itself', () => {
    const ativo = { ...pacote12, aulasDadas: 1, primeiraAula: '2026-01-10' };
    expect(situacaoDoPacote(ativo, '2026-03-11')).toBe('ativo');
    expect(situacaoDoPacote(ativo, '2026-03-12')).toBe('vencido');
  });

  it('keeps the balance of an expired package', () => {
    const vencido = { ...pacote12, aulasDadas: 9, primeiraAula: '2026-01-10' };
    const resumo = resumirPacote(vencido, '2026-06-01');
    expect(resumo.situacao).toBe('vencido');
    expect(resumo.restantes).toBe(3);
  });

  it('is used up when no lessons are left, even past the date', () => {
    const esgotado = { ...pacote12, aulasDadas: 12, primeiraAula: '2026-01-10' };
    expect(situacaoDoPacote(esgotado, '2026-02-01')).toBe('esgotado');
    expect(situacaoDoPacote(esgotado, '2026-09-01')).toBe('esgotado');
  });

  it('is closed whatever else is true', () => {
    expect(situacaoDoPacote({ ...pacote12, encerrado: true }, '2026-01-01')).toBe('encerrado');
  });

  it('lets a pause keep the package active past its original date', () => {
    const pausado = {
      ...pacote12,
      aulasDadas: 1,
      primeiraAula: '2026-01-10',
      pausas: [pausa('2026-02-01', '2026-02-10')],
    };
    expect(situacaoDoPacote(pausado, '2026-03-15')).toBe('ativo');
    expect(situacaoDoPacote(pausado, '2026-03-22')).toBe('vencido');
  });

  it('counts the used-before-the-app lessons of an opening balance', () => {
    const inicial = { ...pacote12, usadasAntesDoApp: 5, primeiraAula: '2026-01-05' };
    expect(resumirPacote(inicial, '2026-02-01')).toMatchObject({
      situacao: 'ativo',
      restantes: 7,
      vencimento: '2026-03-06',
    });
  });
});

describe('renovação', () => {
  it('transfers what is left (3 left, 12 bought, 15 in the new package)', () => {
    const anterior = { ...pacote12, aulasDadas: 9, primeiraAula: '2026-01-10' };
    const transferidas = aulasATransferir(anterior);
    expect(transferidas).toBe(3);
    expect(calcularSaldo({ ...pacote12, aulasTransferidas: transferidas }).total).toBe(15);
    expect(avisoDeTransferencia(transferidas)).toBe('3 aulas do pacote anterior serão transferidas');
  });

  it('transfers the balance of an expired package, and nothing from a closed one', () => {
    expect(aulasATransferir({ ...pacote12, aulasDadas: 2 })).toBe(10);
    expect(aulasATransferir({ ...pacote12, aulasDadas: 2, encerrado: true })).toBe(0);
    expect(aulasATransferir({ ...pacote12, aulasDadas: 12 })).toBe(0);
  });

  it('writes the note on the closed package', () => {
    expect(anotacaoDoPacoteEncerrado(3, '2026-12-12')).toBe(
      '3 aulas transferidas para o pacote de 12/12/2026',
    );
    expect(anotacaoDoPacoteEncerrado(1, '2026-12-12')).toBe(
      '1 aula transferida para o pacote de 12/12/2026',
    );
    expect(anotacaoDoPacoteEncerrado(0, '2026-12-12')).toBe(
      'Nenhuma aula transferida para o pacote de 12/12/2026',
    );
  });

  it('writes the confirmation and the origin of the lessons', () => {
    expect(avisoDeTransferencia(0)).toBeNull();
    expect(avisoDeTransferencia(1)).toBe('1 aula do pacote anterior será transferida');
    expect(origemDasAulas(12, 3)).toBe('15 aulas (12 novas + 3 transferidas)');
    expect(origemDasAulas(12, 0)).toBe('12 aulas');
  });
});

describe('pagamento', () => {
  it('is pending until the payments reach the total', () => {
    expect(resumirPagamento(144_000, [])).toEqual({
      situacao: 'pendente',
      pagoCentavos: 0,
      faltaCentavos: 144_000,
    });
    expect(resumirPagamento(144_000, [{ valorCentavos: 100_000 }])).toMatchObject({
      situacao: 'pendente',
      faltaCentavos: 44_000,
    });
  });

  it('is paid in one or several payments', () => {
    expect(resumirPagamento(144_000, [{ valorCentavos: 144_000 }]).situacao).toBe('pago');
    const dividido = [{ valorCentavos: 100_000 }, { valorCentavos: 44_000 }];
    expect(resumirPagamento(144_000, dividido)).toEqual({
      situacao: 'pago',
      pagoCentavos: 144_000,
      faltaCentavos: 0,
    });
  });

  it('treats an overpayment as paid', () => {
    expect(resumirPagamento(20_000, [{ valorCentavos: 25_000 }]).faltaCentavos).toBe(0);
  });
});

describe('mensalidade', () => {
  const mensalidade = { diaVencimento: 10, ultimoMesPago: '2026-10' };

  it('is not pending until the day after the due day', () => {
    expect(mensalidadePendente(mensalidade, '2026-11-09')).toBe(false);
    expect(mensalidadePendente(mensalidade, '2026-11-10')).toBe(false);
    expect(mensalidadePendente(mensalidade, '2026-11-11')).toBe(true);
  });

  it('is settled once the month is registered', () => {
    expect(mensalidadePendente({ ...mensalidade, ultimoMesPago: '2026-11' }, '2026-11-25')).toBe(
      false,
    );
  });

  it('lists every overdue month', () => {
    expect(mesesPendentes({ diaVencimento: 5, ultimoMesPago: '2026-08' }, '2026-11-20')).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
  });

  it('checks only the current month when none was ever registered', () => {
    expect(mesesPendentes({ diaVencimento: 5, ultimoMesPago: null }, '2026-11-20')).toEqual([
      '2026-11',
    ]);
  });

  it('moves a due day past the month end to its last day', () => {
    expect(vencimentoDoMes('2026-02', 31)).toBe('2026-02-28');
    expect(mensalidadePendente({ diaVencimento: 31, ultimoMesPago: '2026-01' }, '2026-02-28')).toBe(
      false,
    );
    expect(mensalidadePendente({ diaVencimento: 31, ultimoMesPago: '2026-01' }, '2026-03-01')).toBe(
      true,
    );
  });

  it('asks on the due day itself, only while unpaid', () => {
    expect(mensalidadeVenceHoje(mensalidade, '2026-11-10')).toBe(true);
    expect(mensalidadeVenceHoje(mensalidade, '2026-11-11')).toBe(false);
    expect(mensalidadeVenceHoje({ ...mensalidade, ultimoMesPago: '2026-11' }, '2026-11-10')).toBe(
      false,
    );
  });
});

describe('urgência', () => {
  const hoje = '2026-11-14';
  const base: ItemDeUrgencia = {
    id: 'x',
    nome: 'Ana',
    mensalista: false,
    avulso: false,
    pagamentoPendente: false,
    situacao: 'ativo',
    restantes: 10,
    vencimento: '2027-01-14',
    proximaAula: null,
  };
  const item = (parcial: Partial<ItemDeUrgencia>): ItemDeUrgencia => ({ ...base, ...parcial });

  it('puts pending payment first, then expired or used up, then low balance, then the rest', () => {
    expect(nivelDeUrgencia(item({ pagamentoPendente: true }), hoje)).toBe(1);
    expect(nivelDeUrgencia(item({ situacao: 'vencido' }), hoje)).toBe(2);
    expect(nivelDeUrgencia(item({ situacao: 'esgotado', restantes: 0 }), hoje)).toBe(2);
    expect(nivelDeUrgencia(item({ restantes: 3 }), hoje)).toBe(3);
    expect(nivelDeUrgencia(item({ restantes: 4 }), hoje)).toBe(4);
    expect(nivelDeUrgencia(item({ vencimento: '2026-11-20' }), hoje)).toBe(3);
    expect(nivelDeUrgencia(item({ vencimento: '2026-11-21' }), hoje)).toBe(4);
  });

  it('gives no balance or validity highlight to Avulso and monthly students', () => {
    const avulso = item({ avulso: true, situacao: 'esgotado', restantes: 0 });
    expect(nivelDeUrgencia(avulso, hoje)).toBe(4);
    expect(comDestaqueVermelho(avulso, hoje)).toBe(false);
    const mensalista = item({ mensalista: true, situacao: null, restantes: 0, vencimento: null });
    expect(nivelDeUrgencia(mensalista, hoje)).toBe(4);
  });

  it('still ranks a pending payment or monthly fee of those students first', () => {
    expect(nivelDeUrgencia(item({ avulso: true, pagamentoPendente: true }), hoje)).toBe(1);
    expect(
      nivelDeUrgencia(item({ mensalista: true, situacao: null, pagamentoPendente: true }), hoje),
    ).toBe(1);
  });

  it('does not alarm a package that has not started', () => {
    expect(
      nivelDeUrgencia(item({ situacao: 'aguardando-inicio', vencimento: null, restantes: 12 }), hoje),
    ).toBe(4);
  });

  it('highlights levels 1 to 3 in red', () => {
    expect(comDestaqueVermelho(item({ restantes: 2 }), hoje)).toBe(true);
    expect(comDestaqueVermelho(item({}), hoje)).toBe(false);
  });

  it('sorts by level, then next lesson (none last), then name', () => {
    const ordenado = ordenarPorUrgencia(
      [
        item({ id: 'normal-sem-aula', nome: 'Zeca' }),
        item({ id: 'normal-amanha', nome: 'Bia', proximaAula: '2026-11-15' }),
        item({ id: 'normal-hoje', nome: 'Caio', proximaAula: '2026-11-14' }),
        item({ id: 'baixo', nome: 'Dani', restantes: 2, proximaAula: '2026-11-20' }),
        item({ id: 'vencido', nome: 'Edu', situacao: 'vencido' }),
        item({ id: 'pendente', nome: 'Fabi', pagamentoPendente: true }),
        item({ id: 'normal-sem-aula-a', nome: 'Alê' }),
      ],
      hoje,
    );
    expect(ordenado.map((i) => i.id)).toEqual([
      'pendente',
      'vencido',
      'baixo',
      'normal-hoje',
      'normal-amanha',
      'normal-sem-aula-a',
      'normal-sem-aula',
    ]);
  });
});

describe('pacote da aula', () => {
  const sozinho: PacoteCandidato = {
    id: 'p-ana',
    titularId: 'ana',
    participanteId: null,
    situacao: 'ativo',
  };
  const dupla: PacoteCandidato = {
    id: 'p-dupla',
    titularId: 'bia',
    participanteId: 'caio',
    situacao: 'ativo',
  };

  it('draws a lone student from their own package', () => {
    expect(pacoteDaAula(['ana'], [sozinho, dupla])).toEqual({
      tipo: 'pacote',
      pacoteId: 'p-ana',
      avisoDePagamentoPendente: false,
    });
  });

  it('draws a pair lesson from the pair package, whoever is the titular', () => {
    const esperado = { tipo: 'pacote', pacoteId: 'p-dupla', avisoDePagamentoPendente: false };
    expect(pacoteDaAula(['bia', 'caio'], [sozinho, dupla])).toEqual(esperado);
    expect(pacoteDaAula(['caio', 'bia'], [sozinho, dupla])).toEqual(esperado);
  });

  it('draws a pair student with an own package: alone from his own, in pair from the pair', () => {
    const proprioDoCaio: PacoteCandidato = {
      id: 'p-caio',
      titularId: 'caio',
      participanteId: null,
      situacao: 'ativo',
    };
    const pacotes = [dupla, proprioDoCaio];
    expect(pacoteDaAula(['caio'], pacotes)).toMatchObject({ tipo: 'pacote', pacoteId: 'p-caio' });
    expect(pacoteDaAula(['bia', 'caio'], pacotes)).toMatchObject({ pacoteId: 'p-dupla' });
  });

  it('asks where to draw when the pair student has no package of his own', () => {
    expect(pacoteDaAula(['caio'], [dupla])).toEqual({ tipo: 'perguntar', opcoes: ['p-dupla'] });
  });

  it('asks where to draw a pair lesson when the two share no package', () => {
    const outro: PacoteCandidato = { ...sozinho, id: 'p-dani', titularId: 'dani' };
    expect(pacoteDaAula(['ana', 'dani'], [sozinho, outro])).toEqual({
      tipo: 'perguntar',
      opcoes: ['p-ana', 'p-dani'],
    });
  });

  it('leaves the lesson "sem pacote" when the package is used up or expired', () => {
    expect(pacoteDaAula(['ana'], [{ ...sozinho, situacao: 'esgotado' }])).toEqual({
      tipo: 'sem-pacote',
      motivo: 'esgotado',
    });
    expect(pacoteDaAula(['ana'], [{ ...sozinho, situacao: 'vencido' }])).toEqual({
      tipo: 'sem-pacote',
      motivo: 'vencido',
    });
  });

  it('ignores closed packages and reports a student with none', () => {
    expect(pacoteDaAula(['ana'], [{ ...sozinho, situacao: 'encerrado' }])).toEqual({
      tipo: 'sem-pacote',
      motivo: 'sem-pacote-cadastrado',
    });
  });

  it('uses a package awaiting start, and warns about pending payment without blocking', () => {
    expect(
      pacoteDaAula(['ana'], [{ ...sozinho, situacao: 'aguardando-inicio', pagamentoPendente: true }]),
    ).toEqual({ tipo: 'pacote', pacoteId: 'p-ana', avisoDePagamentoPendente: true });
  });

  it('accepts one or two students only', () => {
    expect(() => pacoteDaAula([], [])).toThrow();
    expect(() => pacoteDaAula(['a', 'b', 'c'], [])).toThrow();
  });
});
