// Cancelling and missing lessons (docs/spec/agenda.md, "Remarcar e cancelar").
import { somarMinutos } from './horario';

/** A student may cancel without losing the lesson with at least this much notice. */
export const ANTECEDENCIA_MINIMA_H = 24;

export type DecisaoDeCobranca = 'cobrar' | 'abonar';

/** Whole hours (fractions included) from `agora` until the lesson starts; negative once it has. */
export function horasDeAntecedencia(inicio: string, agora: Date): number {
  return (new Date(inicio).getTime() - agora.getTime()) / 3_600_000;
}

export type ResultadoDoCancelamento =
  /** The lesson becomes "cancelada", no question asked. */
  | { readonly tipo: 'cancelada' }
  /** Less than 24 h: the trainer decides; "cobrar" comes pre-selected. */
  | { readonly tipo: 'decidir'; readonly sugestao: DecisaoDeCobranca }
  /** The decision was given: a charged or waived absence. */
  | { readonly tipo: 'falta'; readonly cobrada: boolean };

/**
 * What cancelling does. The trainer's own cancellation is always "cancelada". A student's with 24 h
 * or more is too. With less, `decisao` is needed.
 */
export function cancelarAula(
  inicio: string,
  agora: Date,
  opcoes: { readonly peloTreinador?: boolean; readonly decisao?: DecisaoDeCobranca | null } = {},
): ResultadoDoCancelamento {
  if (opcoes.peloTreinador || horasDeAntecedencia(inicio, agora) >= ANTECEDENCIA_MINIMA_H) return { tipo: 'cancelada' };
  if (!opcoes.decisao) return { tipo: 'decidir', sugestao: 'cobrar' };
  return { tipo: 'falta', cobrada: opcoes.decisao === 'cobrar' };
}

/** A no-show (falta sem aviso) suggests a charged absence; the trainer may switch it. */
export const sugestaoParaFaltaSemAviso: DecisaoDeCobranca = 'cobrar';

/** "Aula agora": from the start until the end of the planned duration. */
export function aulaAgora(inicio: string, duracaoMin: number, agora: Date): boolean {
  const t = agora.getTime();
  return new Date(inicio).getTime() <= t && t < new Date(somarMinutos(inicio, duracaoMin)).getTime();
}
