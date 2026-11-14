// Times of the agenda (docs/spec/agenda.md). Dates and times are read in America/Sao_Paulo; an
// instant is an ISO string in UTC. Brazil has had no daylight saving time since 2019, so São
// Paulo is a fixed UTC-03:00 (the same assumption the hand-registered lessons make).
import { type Data, FUSO, somarDias } from '../pacotes/datas';

/** "HH:MM", 24 h, in São Paulo. */
export type Hora = string;

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export type DiaDaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** A lesson lasts up to 60 minutes, for everybody. */
export const DURACAO_MAXIMA_MIN = 60;

const formatadorDeHora = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const ehData = (valor: unknown): valor is Data =>
  typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(`${valor}T00:00:00Z`)) && new Date(`${valor}T00:00:00Z`).toISOString().startsWith(valor);

export const ehHora = (valor: unknown): valor is Hora => typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);

export function diaDaSemana(data: Data): DiaDaSemana {
  const dia = new Date(`${data}T00:00:00Z`).getUTCDay();
  return (dia === 0 ? 7 : dia) as DiaDaSemana;
}

/** The instant (ISO, UTC) of a São Paulo date and time. */
export function instanteEmSaoPaulo(data: Data, hora: Hora): string {
  return new Date(`${data}T${hora}:00-03:00`).toISOString();
}

/** The São Paulo clock time of an instant. */
export function horaEmSaoPaulo(instante: Date | number | string): Hora {
  return formatadorDeHora.format(new Date(instante));
}

export function somarMinutos(instante: string, minutos: number): string {
  return new Date(new Date(instante).getTime() + minutos * 60_000).toISOString();
}

/** A duration is a whole number of minutes from 1 to 60. */
export const duracaoValida = (minutos: unknown): minutos is number =>
  typeof minutos === 'number' && Number.isInteger(minutos) && minutos >= 1 && minutos <= DURACAO_MAXIMA_MIN;

/** Monday and Sunday of the week (Monday to Sunday) that holds `data`. */
export function semanaDe(data: Data): { readonly segunda: Data; readonly domingo: Data } {
  const segunda = somarDias(data, 1 - diaDaSemana(data));
  return { segunda, domingo: somarDias(segunda, 6) };
}
