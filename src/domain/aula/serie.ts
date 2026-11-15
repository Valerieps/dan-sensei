// Recording a set and choosing what comes next (docs/spec/aula-ao-vivo.md, "Modo Ao Vivo").
import type { Measure } from '../treinos/exercicios';
import { MAX_LOAD_G, maxRepsFor } from '../treinos/prescricao';

/** What a set records; a field the exercise's measure does not use stays null. */
export interface Medidas {
  readonly reps: number | null;
  readonly loadG: number | null;
  readonly seconds: number | null;
  readonly meters: number | null;
}

export interface Prescrito {
  readonly repsMin: number;
  readonly loadG: number | null;
}

const inteiro = (valor: unknown, min: number, max: number): valor is number =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max;

/**
 * The set the one-tap button records: the prescribed repetitions (the bottom of the range, what the
 * student must reach) and the load suggested for the exercise, which comes from the last time.
 * Time goes to `seconds` and distance to `meters`.
 */
export function serieComoPrescrita(prescrito: Prescrito, measure: Measure): Medidas {
  const loadG = measure === 'load_reps' ? prescrito.loadG : null;
  if (measure === 'time') return { reps: null, loadG: null, seconds: prescrito.repsMin, meters: null };
  if (measure === 'distance') return { reps: null, loadG: null, seconds: null, meters: prescrito.repsMin };
  return { reps: prescrito.repsMin, loadG, seconds: null, meters: null };
}

/** Applies the fields the trainer adjusted (+ and −) over `base`; null when the result is not valid for the measure. */
export function ajustarSerie(base: Medidas, ajuste: Record<string, unknown>, measure: Measure): Medidas | null {
  const proximo: Record<string, unknown> = { ...base };
  for (const campo of ['reps', 'loadG', 'seconds', 'meters'] as const) {
    if (Object.hasOwn(ajuste, campo) && ajuste[campo] !== undefined) proximo[campo] = ajuste[campo];
  }
  const s = proximo as unknown as Medidas;
  const max = maxRepsFor(measure);
  if (s.reps !== null && !inteiro(s.reps, 0, max)) return null;
  if (s.seconds !== null && !inteiro(s.seconds, 0, 3600)) return null;
  if (s.meters !== null && !inteiro(s.meters, 0, 10_000)) return null;
  if (s.loadG !== null && !inteiro(s.loadG, 0, MAX_LOAD_G)) return null;
  // A set must record something: a load alone is not a set.
  return s.reps === null && s.seconds === null && s.meters === null ? null : s;
}

export interface ItemDoPlano {
  readonly id: string;
  /** Items with the same group id are done side by side (bi-set, tri-set, circuit); null stands alone. */
  readonly groupId: string | null;
  readonly sets: number;
  readonly done: number;
}

/**
 * The item to do next. The first item still short of its sets leads; when it belongs to a group, the
 * app alternates through the group: the member with the fewest sets done goes next, ties going to
 * whoever comes after the last one done (`lastId`). Null when everything is done.
 */
export function proximoItem(items: readonly ItemDoPlano[], lastId: string | null): string | null {
  const lider = items.find((item) => item.done < item.sets);
  if (!lider) return null;
  if (lider.groupId === null) return lider.id;
  const grupo = items.filter((item) => item.groupId === lider.groupId && item.done < item.sets);
  const fewest = Math.min(...grupo.map((item) => item.done));
  const empatados = grupo.filter((item) => item.done === fewest);
  const all = items.filter((item) => item.groupId === lider.groupId);
  const last = all.findIndex((item) => item.id === lastId);
  if (last >= 0) {
    for (let step = 1; step <= all.length; step++) {
      const candidato = all[(last + step) % all.length]!;
      if (empatados.includes(candidato)) return candidato.id;
    }
  }
  return empatados[0]!.id;
}
