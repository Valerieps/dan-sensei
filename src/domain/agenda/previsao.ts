// Validity forecast (docs/spec/agenda.md, "Previsão de validade"; docs/spec/pacotes-e-pagamentos.md,
// "Pacote"): when the package's last lesson should happen, against its due date.
import { type Data, formatarData } from '../pacotes/datas';
import { type Pausa, calcularVencimento } from '../pacotes/validade';

export interface DadosDaPrevisao {
  /** Lessons left in the package. */
  readonly restantes: number;
  /** The package's total, which numbers the last lesson ("12ª aula"). */
  readonly total: number;
  readonly validadeDias: number;
  /** Day of the first consuming lesson; null while the package awaits start. */
  readonly primeiraAula: Data | null;
  readonly pausas: readonly Pausa[];
  /** Dates of the lessons ahead that would draw from the package, oldest first. */
  readonly aulasPrevistas: readonly Data[];
}

export interface Previsao {
  /** Date of the lesson that uses the last one left; null when the agenda lacks enough lessons. */
  readonly ultimaAula: Data | null;
  /** The due date; for a package awaiting start, the one the first scheduled lesson would set. */
  readonly vencimento: Data | null;
  /** The due date comes from the first scheduled lesson, not from a lesson already given. */
  readonly vencimentoPrevisto: boolean;
  /** The last lesson falls after the due date. */
  readonly passaDaValidade: boolean;
  /** There are not enough scheduled or recurring lessons to use up the balance. */
  readonly faltamAulas: boolean;
  readonly aviso: string | null;
}

/** "12ª aula prevista para 20/01/2027; validade 15/01/2027". */
export function avisoDePrevisao(numero: number, ultimaAula: Data, vencimento: Data): string {
  return `${numero}ª aula prevista para ${formatarData(ultimaAula)}; validade ${formatarData(vencimento)}`;
}

export function preverValidade(dados: DadosDaPrevisao): Previsao {
  const primeira = dados.primeiraAula ?? dados.aulasPrevistas[0] ?? null;
  const vencimento = primeira === null ? null : calcularVencimento(primeira, dados.validadeDias, dados.pausas);
  const ultimaAula = dados.restantes > 0 ? (dados.aulasPrevistas[dados.restantes - 1] ?? null) : null;
  const passaDaValidade = ultimaAula !== null && vencimento !== null && ultimaAula > vencimento;
  return {
    ultimaAula,
    vencimento,
    vencimentoPrevisto: dados.primeiraAula === null && vencimento !== null,
    passaDaValidade,
    faltamAulas: dados.restantes > 0 && ultimaAula === null,
    aviso: passaDaValidade ? avisoDePrevisao(dados.total, ultimaAula!, vencimento!) : null,
  };
}
