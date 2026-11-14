// Monthly fees (docs/spec/mensalistas.md).
import { type Data, type Mes, mesDe, somarMeses, ultimoDiaDoMes } from './datas';

export interface DadosDaMensalidade {
  /** Day of the month the fee is due, 1 to 31. */
  readonly diaVencimento: number;
  /** Last month registered as paid ("YYYY-MM"); null when none was ever registered. */
  readonly ultimoMesPago: Mes | null;
}

/** The due date of a month; a due day past the month's end (31 in February) falls on its last day. */
export function vencimentoDoMes(mes: Mes, diaVencimento: number): Data {
  const dia = Math.min(Math.max(1, diaVencimento), ultimoDiaDoMes(mes));
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

/**
 * Months whose due day has passed without a registered payment, oldest first. The count starts
 * the month after `ultimoMesPago`; with no payment registered, only the current month is checked.
 * "Depois do dia de vencimento": on the due day itself the fee is not yet pending.
 */
export function mesesPendentes(mensalidade: DadosDaMensalidade, hoje: Data): Mes[] {
  const atual = mesDe(hoje);
  const primeiro = mensalidade.ultimoMesPago ? somarMeses(mensalidade.ultimoMesPago, 1) : atual;
  const pendentes: Mes[] = [];
  for (let mes = primeiro; mes <= atual; mes = somarMeses(mes, 1)) {
    if (hoje > vencimentoDoMes(mes, mensalidade.diaVencimento)) pendentes.push(mes);
  }
  return pendentes;
}

export function mensalidadePendente(mensalidade: DadosDaMensalidade, hoje: Data): boolean {
  return mesesPendentes(mensalidade, hoje).length > 0;
}

/** The day Início asks whether the student paid (1b): the due day of the current month, unpaid. */
export function mensalidadeVenceHoje(mensalidade: DadosDaMensalidade, hoje: Data): boolean {
  const atual = mesDe(hoje);
  if (mensalidade.ultimoMesPago !== null && mensalidade.ultimoMesPago >= atual) return false;
  return hoje === vencimentoDoMes(atual, mensalidade.diaVencimento);
}
