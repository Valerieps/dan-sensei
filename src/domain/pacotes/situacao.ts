// Package status (docs/spec/pacotes-e-pagamentos.md, "Pacote" and "Saldo").
import { type Data } from './datas';
import { type ConsumoDoPacote, type Saldo, calcularSaldo } from './saldo';
import { type Pausa, calcularVencimento } from './validade';

export type SituacaoDoPacote = 'aguardando-inicio' | 'ativo' | 'vencido' | 'esgotado' | 'encerrado';

export interface DadosDoPacote extends ConsumoDoPacote {
  /** Plan days, copied into the package when it was sold. */
  readonly validadeDias: number;
  /** Day of the first consuming lesson; null while no lesson consumed the package. */
  readonly primeiraAula: Data | null;
  readonly pausas: readonly Pausa[];
  /** Closed by a renewal (its leftover moved on) or by hand. */
  readonly encerrado: boolean;
}

/**
 * - encerrado: closed, whatever else is true.
 * - esgotado: no lessons left, even if it is also past its date.
 * - vencido: past the due date with lessons left (the balance is kept until the renewal). The
 *   due date itself is still valid.
 * - aguardando início: nothing consumed it yet, so there is no due date.
 * - ativo: otherwise.
 */
export function situacaoDoPacote(pacote: DadosDoPacote, hoje: Data): SituacaoDoPacote {
  if (pacote.encerrado) return 'encerrado';
  if (calcularSaldo(pacote).restantes === 0) return 'esgotado';
  const vencimento = calcularVencimento(pacote.primeiraAula, pacote.validadeDias, pacote.pausas);
  if (vencimento === null) return 'aguardando-inicio';
  return hoje > vencimento ? 'vencido' : 'ativo';
}

export interface ResumoDoPacote extends Saldo {
  readonly situacao: SituacaoDoPacote;
  readonly vencimento: Data | null;
}

export function resumirPacote(pacote: DadosDoPacote, hoje: Data): ResumoDoPacote {
  return {
    ...calcularSaldo(pacote),
    situacao: situacaoDoPacote(pacote, hoje),
    vencimento: calcularVencimento(pacote.primeiraAula, pacote.validadeDias, pacote.pausas),
  };
}
