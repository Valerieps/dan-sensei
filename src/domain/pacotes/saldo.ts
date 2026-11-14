// Balance (docs/spec/pacotes-e-pagamentos.md, "Saldo" and "Renovação").

export interface ConsumoDoPacote {
  /** Lessons bought with this package (the plan's total, possibly edited). */
  readonly totalAulas: number;
  /** Lessons carried over from the previous package at renewal. */
  readonly aulasTransferidas: number;
  /** Lessons already used before the app existed ("usadas antes do app"). */
  readonly usadasAntesDoApp: number;
  /** Lessons given. */
  readonly aulasDadas: number;
  /** Charged absences. */
  readonly faltasCobradas: number;
}

export interface Saldo {
  /** New plus transferred lessons. */
  readonly total: number;
  readonly usadas: number;
  /** Never negative: lessons past the total are "sem pacote". */
  readonly restantes: number;
}

export function totalDeAulas(
  pacote: Pick<ConsumoDoPacote, 'totalAulas' | 'aulasTransferidas'>,
): number {
  return pacote.totalAulas + pacote.aulasTransferidas;
}

export function aulasUsadas(
  pacote: Pick<ConsumoDoPacote, 'usadasAntesDoApp' | 'aulasDadas' | 'faltasCobradas'>,
): number {
  return pacote.usadasAntesDoApp + pacote.aulasDadas + pacote.faltasCobradas;
}

export function calcularSaldo(pacote: ConsumoDoPacote): Saldo {
  const total = totalDeAulas(pacote);
  const usadas = aulasUsadas(pacote);
  return { total, usadas, restantes: Math.max(0, total - usadas) };
}
