import { describe, expect, it } from 'vitest';
import { formatarReais, lerReais, reaisParaTexto } from './formatacao';

describe('formatação de dinheiro', () => {
  it('shows cents as reais', () => {
    expect(formatarReais(144000)).toBe('R$ 1.440,00');
    expect(formatarReais(12050)).toBe('R$ 120,50');
    expect(reaisParaTexto(12000)).toBe('120,00');
  });

  it('reads what the trainer types', () => {
    expect(lerReais('120')).toBe(12000);
    expect(lerReais('120,5')).toBe(12050);
    expect(lerReais('1.440,00')).toBe(144000);
    expect(lerReais('R$ 1440')).toBe(144000);
    expect(lerReais('0')).toBe(0);
  });

  it('refuses text that is not an amount', () => {
    for (const texto of ['', 'abc', '-5', '1,234', '12,3,4', '1.44']) expect(lerReais(texto)).toBeNull();
  });
});
