// Payment status (docs/spec/pacotes-e-pagamentos.md, "Pagamentos"). All money is integer cents.

export type FormaDePagamento = 'pix' | 'dinheiro' | 'cartao';
export type SituacaoDePagamento = 'pago' | 'pendente';

export interface ResumoDePagamento {
  readonly situacao: SituacaoDePagamento;
  readonly pagoCentavos: number;
  /** What is still owed; zero when paid. */
  readonly faltaCentavos: number;
}

type ComValor = { readonly valorCentavos: number };

export function somaDosPagamentos(pagamentos: readonly ComValor[]): number {
  return pagamentos.reduce((soma, pagamento) => soma + pagamento.valorCentavos, 0);
}

/** Paid when the payments reach the total; pending while something is missing. */
export function resumirPagamento(
  totalCentavos: number,
  pagamentos: readonly ComValor[],
): ResumoDePagamento {
  const pagoCentavos = somaDosPagamentos(pagamentos);
  const faltaCentavos = Math.max(0, totalCentavos - pagoCentavos);
  return { situacao: faltaCentavos === 0 ? 'pago' : 'pendente', pagoCentavos, faltaCentavos };
}

/** Reais (as in the plan table) to cents. */
export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

export function totalDoPacoteCentavos(totalAulas: number, valorPorAulaCentavos: number): number {
  return totalAulas * valorPorAulaCentavos;
}
