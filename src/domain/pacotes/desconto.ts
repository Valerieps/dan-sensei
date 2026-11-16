// Which package a lesson draws from (docs/spec/pacotes-e-pagamentos.md, "Aula em dupla" and
// "Saldo").
import { type SituacaoDoPacote } from './situacao';

export interface PacoteCandidato {
  readonly id: string;
  readonly titularId: string;
  /** The other student of a pair package; null for a single-student package. */
  readonly participanteId: string | null;
  readonly situacao: SituacaoDoPacote;
  readonly pagamentoPendente?: boolean;
}

export type MotivoSemPacote = 'sem-pacote-cadastrado' | 'esgotado' | 'vencido';

export type PacoteDaAula =
  /** Draw 1 lesson from this package. `avisoDePagamentoPendente`: warn, never block. */
  | { readonly tipo: 'pacote'; readonly pacoteId: string; readonly avisoDePagamentoPendente: boolean }
  /** The app asks the trainer which of these packages to draw from. */
  | { readonly tipo: 'perguntar'; readonly opcoes: readonly string[] }
  /** The lesson is recorded "sem pacote" and linked to the next package later. */
  | { readonly tipo: 'sem-pacote'; readonly motivo: MotivoSemPacote };

function resolver(pacote: PacoteCandidato): PacoteDaAula {
  if (pacote.situacao === 'esgotado') return { tipo: 'sem-pacote', motivo: 'esgotado' };
  if (pacote.situacao === 'vencido') return { tipo: 'sem-pacote', motivo: 'vencido' };
  return {
    tipo: 'pacote',
    pacoteId: pacote.id,
    avisoDePagamentoPendente: pacote.pagamentoPendente === true,
  };
}

/**
 * - One student: the package the student owns (a student is titular of one active package at most).
 *   Without one, the app asks among the pair packages the student takes part in.
 * - Two students: their shared package, whichever of them is the titular. Without one, the app
 *   asks among the packages either of them owns.
 * - A package that is used up or expired leaves the lesson "sem pacote".
 * Closed packages never take part.
 */
export function pacoteDaAula(
  alunoIds: readonly string[],
  pacotes: readonly PacoteCandidato[],
): PacoteDaAula {
  const [a, b] = alunoIds;
  if (a === undefined || alunoIds.length > 2) {
    throw new Error('A lesson has one or two students');
  }
  const vivos = pacotes.filter((pacote) => pacote.situacao !== 'encerrado');
  if (b === undefined) {
    const proprio = vivos.find((pacote) => pacote.titularId === a);
    if (proprio) return resolver(proprio);
    const comoParticipante = vivos.filter((pacote) => pacote.participanteId === a);
    if (comoParticipante.length > 0) {
      return { tipo: 'perguntar', opcoes: comoParticipante.map((pacote) => pacote.id) };
    }
    return { tipo: 'sem-pacote', motivo: 'sem-pacote-cadastrado' };
  }
  const daDupla = vivos.find(
    (pacote) =>
      (pacote.titularId === a && pacote.participanteId === b) ||
      (pacote.titularId === b && pacote.participanteId === a),
  );
  if (daDupla) return resolver(daDupla);
  const proprios = vivos.filter((pacote) => pacote.titularId === a || pacote.titularId === b);
  if (proprios.length > 0) return { tipo: 'perguntar', opcoes: proprios.map((pacote) => pacote.id) };
  return { tipo: 'sem-pacote', motivo: 'sem-pacote-cadastrado' };
}
