// Urgency order of the "Alunos e pacotes" screen (docs/spec/telas-de-gestao.md).
import { type Data, diasEntre } from './datas';
import { type SituacaoDoPacote } from './situacao';

export const MINIMO_DE_AULAS_RESTANTES = 4;
export const MINIMO_DE_DIAS_PARA_VENCER = 7;

export type NivelDeUrgencia = 1 | 2 | 3 | 4;

export interface ItemDeUrgencia {
  readonly id: string;
  readonly nome: string;
  /** Monthly students have no package: no balance, no validity. */
  readonly mensalista: boolean;
  /** The Avulso plan (one lesson): no balance or validity highlight. */
  readonly avulso: boolean;
  /** A package with pending payment, or a monthly fee pending. */
  readonly pagamentoPendente: boolean;
  /** Status of the student's current package; null for monthly students or no package. */
  readonly situacao: SituacaoDoPacote | null;
  readonly restantes: number;
  /** Due date; null while awaiting start. */
  readonly vencimento: Data | null;
  /** Date of the next scheduled lesson (1b); null when none. */
  readonly proximaAula: Data | null;
}

export function diasParaVencer(vencimento: Data | null, hoje: Data): number | null {
  return vencimento === null ? null : diasEntre(hoje, vencimento);
}

/**
 * 1. pending payment; 2. expired or used up, not renewed (the current package is the one shown);
 * 3. fewer than 4 lessons left or due in under 7 days; 4. the rest.
 * Avulso and monthly students skip levels 2 and 3.
 */
export function nivelDeUrgencia(item: ItemDeUrgencia, hoje: Data): NivelDeUrgencia {
  if (item.pagamentoPendente) return 1;
  if (item.mensalista || item.avulso || item.situacao === null) return 4;
  if (item.situacao === 'vencido' || item.situacao === 'esgotado') return 2;
  if (item.situacao === 'encerrado') return 4;
  const dias = diasParaVencer(item.vencimento, hoje);
  if (
    item.restantes < MINIMO_DE_AULAS_RESTANTES ||
    (dias !== null && dias < MINIMO_DE_DIAS_PARA_VENCER)
  ) {
    return 3;
  }
  return 4;
}

/** Levels 1 to 3 are urgent: the card gets the red highlight. */
export function comDestaqueVermelho(item: ItemDeUrgencia, hoje: Data): boolean {
  return nivelDeUrgencia(item, hoje) <= 3;
}

/** Within a level: next lesson first (none last), then name. */
export function ordenarPorUrgencia<T extends ItemDeUrgencia>(
  itens: readonly T[],
  hoje: Data,
): T[] {
  return itens
    .map((item) => ({ item, nivel: nivelDeUrgencia(item, hoje) }))
    .sort((a, b) => {
      if (a.nivel !== b.nivel) return a.nivel - b.nivel;
      const aulaA = a.item.proximaAula;
      const aulaB = b.item.proximaAula;
      if (aulaA !== aulaB) {
        if (aulaA === null) return 1;
        if (aulaB === null) return -1;
        return aulaA < aulaB ? -1 : 1;
      }
      return a.item.nome.localeCompare(b.item.nome, 'pt-BR');
    })
    .map(({ item }) => item);
}
