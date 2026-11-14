// The day grid of the agenda (docs/spec/agenda.md, "Visões"): where a lesson sits and what a drag does.
import { DURACAO_MAXIMA_MIN, type Hora } from './horario';

/** The grid opens from 06:00 to 22:00 and grows when a lesson falls outside that. */
export const INICIO_PADRAO_DA_GRADE_H = 6;
export const FIM_PADRAO_DA_GRADE_H = 22;

/** A drag snaps to quarters of an hour. */
export const PASSO_DO_ARRASTO_MIN = 15;

export interface FaixaDaGrade {
  readonly inicioH: number;
  readonly fimH: number;
}

export interface AulaNaGrade {
  readonly time: Hora;
  readonly durationMin: number;
}

export const minutosDoDia = (hora: Hora): number => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

export function horaDeMinutos(minutos: number): Hora {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutos)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The hours the grid shows: the default range, widened to hold every lesson. */
export function faixaDaGrade(aulas: readonly AulaNaGrade[]): FaixaDaGrade {
  let inicioH = INICIO_PADRAO_DA_GRADE_H;
  let fimH = FIM_PADRAO_DA_GRADE_H;
  for (const aula of aulas) {
    const inicio = minutosDoDia(aula.time);
    inicioH = Math.min(inicioH, Math.floor(inicio / 60));
    fimH = Math.max(fimH, Math.min(24, Math.ceil((inicio + aula.durationMin) / 60)));
  }
  return { inicioH, fimH };
}

/** Top and height of a lesson as percentages of the grid. */
export function posicaoNaGrade(aula: AulaNaGrade, faixa: FaixaDaGrade): { readonly topo: number; readonly altura: number } {
  const total = (faixa.fimH - faixa.inicioH) * 60;
  return {
    topo: ((minutosDoDia(aula.time) - faixa.inicioH * 60) / total) * 100,
    altura: (aula.durationMin / total) * 100,
  };
}

/** The new start after dragging `deslocamentoMin` minutes: snapped to the step and kept inside the grid. */
export function horaAposArrasto(aula: AulaNaGrade, deslocamentoMin: number, faixa: FaixaDaGrade): Hora {
  const passo = PASSO_DO_ARRASTO_MIN;
  const bruto = minutosDoDia(aula.time) + deslocamentoMin;
  const encaixado = Math.round(bruto / passo) * passo;
  const minimo = faixa.inicioH * 60;
  const maximo = Math.max(minimo, faixa.fimH * 60 - Math.min(aula.durationMin, DURACAO_MAXIMA_MIN));
  return horaDeMinutos(Math.min(maximo, Math.max(minimo, encaixado)));
}

export interface Intervalo {
  readonly deMin: number;
  readonly ateMin: number;
}

/** The free time between one lesson's end and the next lesson's start, for lessons that happen. */
export function intervalosEntreAulas(aulas: readonly AulaNaGrade[]): Intervalo[] {
  const ordenadas = aulas
    .map((a) => ({ inicio: minutosDoDia(a.time), fim: minutosDoDia(a.time) + a.durationMin }))
    .sort((a, b) => a.inicio - b.inicio);
  const intervalos: Intervalo[] = [];
  let fimAtual = ordenadas[0]?.fim ?? 0;
  for (const aula of ordenadas.slice(1)) {
    if (aula.inicio > fimAtual) intervalos.push({ deMin: fimAtual, ateMin: aula.inicio });
    fimAtual = Math.max(fimAtual, aula.fim);
  }
  return intervalos;
}

/** "45 min", "1 h", "1 h 30". */
export function duracaoPorExtenso(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}
