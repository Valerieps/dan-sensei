// What the workout cards compute without the DOM: blocks, moves, ranges, summaries.
import type { PrescribedExerciseView } from '../../application/api-contract';
import { strings } from '../../domain/strings';
import type { Measure, Prescription } from '../../domain/treinos';

interface Placed {
  readonly id: string;
  readonly groupId: string | null;
}

export interface Block<T extends Placed> {
  /** The group the items share (bi-set, tri-set or circuit); null for a lone exercise. */
  readonly groupId: string | null;
  readonly items: readonly T[];
}

/** The exercises in order, with the ones of a group (side by side) as one block. */
export function blocksOf<T extends Placed>(items: readonly T[]): Block<T>[] {
  const blocks: { groupId: string | null; items: T[] }[] = [];
  for (const item of items) {
    const last = blocks[blocks.length - 1];
    if (item.groupId !== null && last && last.groupId === item.groupId) last.items.push(item);
    else blocks.push({ groupId: item.groupId, items: [item] });
  }
  return blocks;
}

/**
 * Every id in the new order after the block of `id` moved one place up (-1) or down (1); a group
 * moves as one, so it stays together. Null when it is already at that end.
 */
export function moveBlock<T extends Placed>(items: readonly T[], id: string, direction: -1 | 1): string[] | null {
  const blocks = blocksOf(items);
  const index = blocks.findIndex((block) => block.items.some((item) => item.id === id));
  const target = index + direction;
  if (index < 0 || target < 0 || target >= blocks.length) return null;
  const order = [...blocks];
  [order[index], order[target]] = [order[target], order[index]];
  return order.flatMap((block) => block.items.map((item) => item.id));
}

/** The exercise right after `id`, unless it is in the same group (so "Unir ao próximo" makes sense). */
export function nextToJoin<T extends Placed>(items: readonly T[], id: string): T | null {
  const index = items.findIndex((item) => item.id === id);
  const next = index >= 0 ? items[index + 1] : undefined;
  if (!next) return null;
  return next.groupId !== null && next.groupId === items[index].groupId ? null : next;
}

/** Changes one end of the repetition range and drags the other along, so the minimum never passes the maximum. */
export function adjustReps(range: { repsMin: number; repsMax: number }, field: 'repsMin' | 'repsMax', value: number): { repsMin: number; repsMax: number } {
  if (field === 'repsMin') return { repsMin: value, repsMax: Math.max(range.repsMax, value) };
  return { repsMin: Math.min(range.repsMin, value), repsMax: value };
}

export const gramsToKg = (grams: number | null): number => (grams === null ? 0 : grams / 1000);

/** A load of zero means no load. */
export const kgToGrams = (kg: number): number | null => (kg > 0 ? Math.round(kg * 1000) : null);

export const formatKg = (kg: number): string => (kg > 0 ? `${kg.toLocaleString('pt-BR')} kg` : strings.training.workouts.noLoad);

export const repsKind = (measure: Measure): 'reps' | 'time' | 'distance' => (measure === 'time' ? 'time' : measure === 'distance' ? 'distance' : 'reps');

/** The step of the range buttons: 1 repetition, 5 seconds or 5 meters. */
export const repsStep = (measure: Measure): number => (measure === 'time' || measure === 'distance' ? 5 : 1);

export const REST_STEP_S = 15;

/** "3 × 8–12 · 20 kg · 60 s": what a compact card says. */
export function summaryOf(p: Prescription, measure: Measure): string {
  const kind = repsKind(measure);
  const unit = kind === 'reps' ? '' : ` ${strings.training.workouts.units[kind]}`;
  const reps = p.repsMin === p.repsMax ? `${p.repsMin}` : `${p.repsMin}–${p.repsMax}`;
  const parts = [`${p.sets} × ${reps}${unit}`];
  if ((measure === 'load_reps' || measure === 'bodyweight_reps') && p.loadG !== null) parts.push(formatKg(gramsToKg(p.loadG)));
  parts.push(`${p.restS} s`);
  if (p.method !== 'normal') parts.push(strings.training.methods[p.method]);
  return parts.join(' · ');
}

export const prescriptionOf = (item: PrescribedExerciseView): Prescription => ({
  sets: item.sets,
  repsMin: item.repsMin,
  repsMax: item.repsMax,
  loadG: item.loadG,
  restS: item.restS,
  method: item.method,
  targetKind: item.targetKind,
  targetValue: item.targetValue,
  notes: item.notes,
});
