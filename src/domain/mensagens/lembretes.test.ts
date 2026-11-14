import { describe, expect, it } from 'vitest';
import { montarConfirmacaoDaAula, montarLembreteDeMensalidade } from './lembretes';

describe('confirmation of tomorrow\'s lesson', () => {
  it('says the day, the time and the address', () => {
    expect(montarConfirmacaoDaAula({ nome: 'Maria', data: '2026-10-27', diaDaSemana: 2, hora: '07:00', endereco: 'Rua A, 10' })).toBe(
      'Oi, Maria! Confirmando sua aula amanhã, terça (27/10), às 07:00, em Rua A, 10. Pode confirmar?',
    );
  });

  it('leaves the address out when the lesson has none', () => {
    expect(montarConfirmacaoDaAula({ nome: 'João', data: '2026-11-01', diaDaSemana: 7, hora: '18:30', endereco: null })).toBe(
      'Oi, João! Confirmando sua aula amanhã, domingo (01/11), às 18:30. Pode confirmar?',
    );
  });
});

describe('monthly fee reminder', () => {
  it('carries the month, the value and the PIX key', () => {
    expect(montarLembreteDeMensalidade({ nome: 'Ana', mes: '2026-10', valorCentavos: 40000, chavePix: 'ana@pix.com' })).toBe(
      'Oi, Ana! Lembrete da mensalidade de 10/2026: R$ 400,00. Chave PIX: ana@pix.com',
    );
  });

  it('skips the PIX sentence when no key is set', () => {
    expect(montarLembreteDeMensalidade({ nome: 'Ana', mes: '2026-10', valorCentavos: 40000, chavePix: '' })).toBe('Oi, Ana! Lembrete da mensalidade de 10/2026: R$ 400,00.');
  });
});
