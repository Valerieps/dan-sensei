// Fixed weekly times (docs/spec/agenda.md, "Aulas"): "Maria, tuesday and thursday at 7 am" is two
// recurrences. The dates a recurrence produces are pure arithmetic, so the server can generate the
// lessons ahead and the forecast can look past what was generated.
import { type Data, somarDias } from '../pacotes/datas';
import { type DiaDaSemana, diaDaSemana } from './horario';

/** How far ahead scheduled lessons are generated (ADR-010). */
export const HORIZONTE_DIAS = 56;

export interface Recorrencia {
  readonly diaDaSemana: DiaDaSemana;
  /** First day it may produce a lesson (inclusive). */
  readonly inicio: Data;
  /** Last day it may produce a lesson (inclusive); null while it goes on. */
  readonly fim: Data | null;
}

/** Dates of the recurrence from `de` to `ate`, both inclusive, oldest first. */
export function datasDaRecorrencia(recorrencia: Recorrencia, de: Data, ate: Data): Data[] {
  const inicio = de > recorrencia.inicio ? de : recorrencia.inicio;
  const fim = recorrencia.fim !== null && recorrencia.fim < ate ? recorrencia.fim : ate;
  if (inicio > fim) return [];
  const primeira = somarDias(inicio, (recorrencia.diaDaSemana - diaDaSemana(inicio) + 7) % 7);
  const datas: Data[] = [];
  for (let data = primeira; data <= fim; data = somarDias(data, 7)) datas.push(data);
  return datas;
}

/** The last day lessons are generated through, counting from `hoje`. */
export const limiteDeGeracao = (hoje: Data): Data => somarDias(hoje, HORIZONTE_DIAS);

/**
 * The next `quantidade` dates after `depoisDe` that any of the recurrences produces, merged and
 * oldest first. Looks at most two years ahead so a recurrence that never ends cannot loop.
 */
export function projetarDatas(recorrencias: readonly Recorrencia[], depoisDe: Data, quantidade: number): Data[] {
  if (quantidade <= 0 || recorrencias.length === 0) return [];
  const de = somarDias(depoisDe, 1);
  const limite = somarDias(depoisDe, 730);
  return recorrencias
    .flatMap((r) => datasDaRecorrencia(r, de, limite))
    .sort()
    .slice(0, quantidade);
}
