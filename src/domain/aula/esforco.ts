// Effort of a class: the PSE the student gives and the load it makes (Foster's session-RPE method).
import { somarDias, type Data } from '../pacotes/datas';
import { semanaDe } from '../agenda';

/** PSE is the CR10 scale: a whole number from 0 to 10. */
export const PSE_MAX = 10;
export const isPse = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= PSE_MAX;

/** Carga da aula = PSE × duration in minutes (Foster). */
export const cargaDaAula = (pse: number, minutos: number): number => pse * minutos;

export const MAX_DURATION_MIN = 600;
export const isDuration = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_DURATION_MIN;

/** Whole minutes from start to end, rounded, never below 1 or above the maximum. */
export function duracaoEmMinutos(inicio: string | Date, fim: string | Date): number {
  const minutos = Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60_000);
  return Math.min(MAX_DURATION_MIN, Math.max(1, minutos));
}

export interface EsforcoDaAula {
  readonly data: Data;
  readonly carga: number;
}

export interface SemanaDeCarga {
  /** The Monday of the week. */
  readonly segunda: Data;
  readonly total: number;
  readonly aulas: number;
}

/** Weekly totals (Monday to Sunday), oldest first, for the `semanas` weeks ending with the one of `hoje`. */
export function cargaPorSemana(aulas: readonly EsforcoDaAula[], hoje: Data, semanas: number): SemanaDeCarga[] {
  const atual = semanaDe(hoje).segunda;
  const resultado: SemanaDeCarga[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const segunda = somarDias(atual, -7 * i);
    const domingo = somarDias(segunda, 6);
    const daSemana = aulas.filter((a) => a.data >= segunda && a.data <= domingo);
    resultado.push({ segunda, total: daSemana.reduce((soma, a) => soma + a.carga, 0), aulas: daSemana.length });
  }
  return resultado;
}
