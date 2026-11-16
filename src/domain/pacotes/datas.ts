// Calendar dates for packages. A date is a "YYYY-MM-DD" string in America/Sao_Paulo: the trainer
// thinks in days there, so validity never shifts with the server's or the device's time zone.
// A month is "YYYY-MM".

export type Data = string;
export type Mes = string;

export const FUSO = 'America/Sao_Paulo';

const formatador = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The São Paulo calendar day of an instant (a Date, epoch milliseconds or an ISO string). */
export function dataEmSaoPaulo(instante: Date | number | string): Data {
  const partes = formatador.formatToParts(new Date(instante));
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? '';
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

function paraUtc(data: Data): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return Date.UTC(ano ?? 0, (mes ?? 1) - 1, dia ?? 1);
}

const DIA_MS = 86_400_000;

export function somarDias(data: Data, dias: number): Data {
  return new Date(paraUtc(data) + dias * DIA_MS).toISOString().slice(0, 10);
}

/** Whole days from `de` to `ate` (negative when `ate` is earlier). */
export function diasEntre(de: Data, ate: Data): number {
  return Math.round((paraUtc(ate) - paraUtc(de)) / DIA_MS);
}

export function maxData(a: Data, b: Data): Data {
  return a >= b ? a : b;
}

export function mesDe(data: Data): Mes {
  return data.slice(0, 7);
}

export function somarMeses(mes: Mes, meses: number): Mes {
  const [ano, m] = mes.split('-').map(Number);
  const total = (ano ?? 0) * 12 + ((m ?? 1) - 1) + meses;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function ultimoDiaDoMes(mes: Mes): number {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(ano ?? 0, m ?? 1, 0)).getUTCDate();
}

/** "2026-12-12" as "12/12/2026". */
export function formatarData(data: Data): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}
