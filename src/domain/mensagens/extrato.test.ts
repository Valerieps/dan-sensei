import { describe, expect, it } from 'vitest';
import { linhaDoExtrato, linkDoWhatsApp, montarMensagemDoExtrato, MODELOS_PADRAO, precisaDeRenovacao, type DadosDoExtrato } from './extrato';

const HOJE = '2026-11-14';
const modelos = { ...MODELOS_PADRAO, chavePix: 'dan@pix.com' };
const dados: DadosDoExtrato = {
  nome: 'Ana',
  usadas: 8,
  novas: 12,
  transferidas: 0,
  restantes: 4,
  validoAte: '2026-12-15',
  valorDoProximoCentavos: 144000,
  avulso: false,
  encerradoPorUso: false,
};

describe('statement line', () => {
  it('says the lesson, the total and the due date', () => {
    expect(linhaDoExtrato(dados)).toBe('Aula 8 de 12, válido até 15/12');
  });

  it('breaks down transferred lessons', () => {
    expect(linhaDoExtrato({ ...dados, transferidas: 3 })).toBe('Aula 8 de 15 (12 novas + 3 do pacote anterior), válido até 15/12');
  });

  it('leaves the due date out while the package awaits its first lesson', () => {
    expect(linhaDoExtrato({ ...dados, usadas: 0, validoAte: null })).toBe('Aula 0 de 12');
  });
});

describe('renewal', () => {
  it('is due with fewer than 4 lessons left, not with 4', () => {
    expect(precisaDeRenovacao({ ...dados, restantes: 3 }, HOJE)).toBe(true);
    expect(precisaDeRenovacao({ ...dados, restantes: 4 }, HOJE)).toBe(false);
  });

  it('is due with fewer than 7 days left, not with 7', () => {
    expect(precisaDeRenovacao({ ...dados, validoAte: '2026-11-20' }, HOJE)).toBe(true);
    expect(precisaDeRenovacao({ ...dados, validoAte: '2026-11-21' }, HOJE)).toBe(false);
  });

  it('is due for an expired or used-up package, never for Avulso', () => {
    expect(precisaDeRenovacao({ ...dados, encerradoPorUso: true }, HOJE)).toBe(true);
    expect(precisaDeRenovacao({ ...dados, restantes: 0, avulso: true }, HOJE)).toBe(false);
  });
});

describe('statement message', () => {
  it('is the statement alone while the package is far from the end', () => {
    expect(montarMensagemDoExtrato(dados, modelos, HOJE)).toBe('Oi, Ana! Aula 8 de 12, válido até 15/12');
  });

  it('adds the renewal paragraph with the value and the PIX key', () => {
    expect(montarMensagemDoExtrato({ ...dados, restantes: 2 }, modelos, HOJE)).toBe(
      'Oi, Ana! Aula 8 de 12, válido até 15/12\n\nPara renovar: R$ 1.440,00. Chave PIX: dan@pix.com',
    );
  });

  it('uses the trainer\'s own templates', () => {
    const texto = montarMensagemDoExtrato({ ...dados, restantes: 1, transferidas: 3 }, { chavePix: '123', extrato: '{nome}: {extrato}.{renovacao}', renovacao: 'PIX {pix}, {valor}' }, HOJE);
    expect(texto).toBe('Ana: Aula 8 de 15 (12 novas + 3 do pacote anterior), válido até 15/12.\n\nPIX 123, R$ 1.440,00');
  });

  it('never expands a placeholder typed inside a value', () => {
    const texto = montarMensagemDoExtrato({ ...dados, nome: '{pix}', restantes: 1 }, modelos, HOJE);
    expect(texto.startsWith('Oi, {pix}!')).toBe(true);
  });

  it('carries only what the data holds: no health data can enter', () => {
    // The builder takes numbers and the first name only; there is no field for a note or an alert.
    expect(Object.keys(dados).sort()).toEqual(
      ['avulso', 'encerradoPorUso', 'nome', 'novas', 'restantes', 'transferidas', 'usadas', 'validoAte', 'valorDoProximoCentavos'].sort(),
    );
    const texto = montarMensagemDoExtrato({ ...dados, restantes: 1 }, modelos, HOJE);
    expect(texto).not.toMatch(/anamnese|par-q|lesão|alerta|laudo|saúde/i);
  });
});

describe('WhatsApp link', () => {
  it('adds the country code and encodes the text', () => {
    expect(linkDoWhatsApp('(11) 91234-5678', 'Oi, Ana! 8/12')).toBe('https://wa.me/5511912345678?text=Oi%2C%20Ana!%208%2F12');
  });

  it('keeps a number that already has 55', () => {
    expect(linkDoWhatsApp('5511912345678', 'x')).toBe('https://wa.me/5511912345678?text=x');
  });

  it('refuses a number that cannot be a Brazilian phone', () => {
    expect(linkDoWhatsApp('1234', 'x')).toBeNull();
    expect(linkDoWhatsApp('', 'x')).toBeNull();
  });
});
