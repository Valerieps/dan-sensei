// Validity and pauses (docs/spec/pacotes-e-pagamentos.md, "Pacote" and "Pausas").
import { type Data, diasEntre, maxData, somarDias } from './datas';

/** Most days one package may stay paused, adding up all of its own pauses. */
export const LIMITE_DIAS_PAUSA = 30;

export interface Pausa {
  readonly inicio: Data;
  /** Last paused day, inclusive. */
  readonly fim: Data;
  /** "Pausar todos": the trainer's break, which never counts against the 30 days. */
  readonly geral: boolean;
  readonly motivo?: string | null;
}

function dias(inicio: Data, fim: Data): Set<Data> {
  const resultado = new Set<Data>();
  for (let dia = inicio; dia <= fim; dia = somarDias(dia, 1)) resultado.add(dia);
  return resultado;
}

export function diasDaPausa(pausa: Pausa): number {
  return Math.max(0, diasEntre(pausa.inicio, pausa.fim) + 1);
}

function uniao(pausas: readonly Pausa[], desde: Data | null): Set<Data> {
  const resultado = new Set<Data>();
  for (const pausa of pausas) {
    const inicio = desde ? maxData(pausa.inicio, desde) : pausa.inicio;
    for (const dia of dias(inicio, pausa.fim)) resultado.add(dia);
  }
  return resultado;
}

/**
 * Days that push the due date: every paused day (own or general) from the first consuming lesson
 * on, each day counted once even if two pauses overlap. Days before the first lesson cost nothing,
 * because validity had not started.
 */
export function diasPausadosParaValidade(pausas: readonly Pausa[], primeiraAula: Data): number {
  return uniao(pausas, primeiraAula).size;
}

/**
 * Days that count against the 30-day limit: the package's own pauses, minus any day already
 * covered by a general pause.
 */
export function diasPausadosNoLimite(pausas: readonly Pausa[]): number {
  const proprios = uniao(
    pausas.filter((pausa) => !pausa.geral),
    null,
  );
  const gerais = uniao(
    pausas.filter((pausa) => pausa.geral),
    null,
  );
  let total = 0;
  for (const dia of proprios) if (!gerais.has(dia)) total += 1;
  return total;
}

/** The due date: first lesson + plan days + paused days. Null while the package awaits start. */
export function calcularVencimento(
  primeiraAula: Data | null,
  validadeDias: number,
  pausas: readonly Pausa[],
): Data | null {
  if (!primeiraAula) return null;
  return somarDias(primeiraAula, validadeDias + diasPausadosParaValidade(pausas, primeiraAula));
}

/** The due date before any pause, kept so the history explains the extension. */
export function vencimentoOriginal(primeiraAula: Data | null, validadeDias: number): Data | null {
  return primeiraAula ? somarDias(primeiraAula, validadeDias) : null;
}

export function estaPausado(pausas: readonly Pausa[], hoje: Data): boolean {
  return pausas.some((pausa) => pausa.inicio <= hoje && hoje <= pausa.fim);
}

export type ResultadoPausa =
  | { readonly ok: true; readonly diasNoLimite: number; readonly passaDoLimite: boolean }
  | { readonly ok: false; readonly motivo: 'periodo-invalido' | 'precisa-de-motivo' };

/**
 * Whether a new pause may be added. Going over 30 days is allowed, but only with a written reason
 * (`motivo`). A general pause never needs one.
 */
export function avaliarPausa(
  existentes: readonly Pausa[],
  nova: Pausa,
  motivo: string | null | undefined,
): ResultadoPausa {
  if (nova.fim < nova.inicio) return { ok: false, motivo: 'periodo-invalido' };
  const diasNoLimite = diasPausadosNoLimite([...existentes, nova]);
  const passaDoLimite = diasNoLimite > LIMITE_DIAS_PAUSA;
  if (passaDoLimite && !nova.geral && !(motivo ?? '').trim()) {
    return { ok: false, motivo: 'precisa-de-motivo' };
  }
  return { ok: true, diasNoLimite, passaDoLimite };
}
