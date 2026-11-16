// Money as the trainer reads and types it: "R$ 1.440,00" on screen, "1440", "1.440,50" in a field.

const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 144000 as "R$ 1.440,00". */
export function formatarReais(centavos: number): string {
  // Intl puts a no-break space after the symbol; a plain one keeps copy and tests simple.
  return formatador.format(centavos / 100).replace(/\s/g, ' ');
}

/** 12050 as "120,50", for a field the trainer edits. */
export function reaisParaTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

/**
 * Reads what was typed into a money field: "120", "120,5", "1.440,00", "R$ 1440". Returns cents,
 * or null when the text is not an amount (empty, negative, letters, more than two decimals).
 */
export function lerReais(texto: string): number | null {
  const limpo = texto.replace(/R\$/g, '').replace(/\s/g, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null;
  const [inteiro = '', decimais = ''] = limpo.replace(/\./g, '').split(',');
  return Number(inteiro) * 100 + Number(decimais.padEnd(2, '0'));
}
