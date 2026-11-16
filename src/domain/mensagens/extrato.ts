// The package statement message and its renewal paragraph (docs/spec/whatsapp.md, ADR-008).
//
// Pure: the builder receives only the numbers and names it prints, so no health data (anamnese,
// PAR-Q, alerts, notes) can reach the text. Templates are the trainer's, edited in Configurações;
// they may only use the placeholders below.
import { MINIMO_DE_AULAS_RESTANTES, MINIMO_DE_DIAS_PARA_VENCER, diasEntre, formatarReais, type Data } from '../pacotes';

export const MODELO_DO_EXTRATO_PADRAO = 'Oi, {nome}! {extrato}{renovacao}';
export const MODELO_DA_RENOVACAO_PADRAO = 'Para renovar: {valor}. Chave PIX: {pix}';
export const MODELO_MAX = 1000;
export const CHAVE_PIX_MAX = 140;

/** What each template may use. Anything else between braces is printed as typed. */
export const MARCADORES_DO_EXTRATO = ['{nome}', '{extrato}', '{renovacao}'] as const;
export const MARCADORES_DA_RENOVACAO = ['{valor}', '{pix}'] as const;

export interface ModelosDeMensagem {
  readonly chavePix: string;
  readonly extrato: string;
  readonly renovacao: string;
}

export const MODELOS_PADRAO: ModelosDeMensagem = {
  chavePix: '',
  extrato: MODELO_DO_EXTRATO_PADRAO,
  renovacao: MODELO_DA_RENOVACAO_PADRAO,
};

/** The only facts the statement prints. */
export interface DadosDoExtrato {
  readonly nome: string;
  /** Lessons used so far, counting the transferred ones. */
  readonly usadas: number;
  /** New lessons bought. */
  readonly novas: number;
  readonly transferidas: number;
  readonly restantes: number;
  /** Due date; null while the package awaits its first lesson. */
  readonly validoAte: Data | null;
  /** Value of the next package, in cents. */
  readonly valorDoProximoCentavos: number;
  /** The Avulso plan (one lesson) never gets the renewal paragraph. */
  readonly avulso: boolean;
  /** An expired or used-up package always needs renewing. */
  readonly encerradoPorUso: boolean;
}

/** Fewer than 4 lessons left or fewer than 7 days of validity. */
export function precisaDeRenovacao(dados: Pick<DadosDoExtrato, 'restantes' | 'validoAte' | 'avulso' | 'encerradoPorUso'>, hoje: Data): boolean {
  if (dados.avulso) return false;
  if (dados.encerradoPorUso) return true;
  if (dados.restantes < MINIMO_DE_AULAS_RESTANTES) return true;
  return dados.validoAte !== null && diasEntre(hoje, dados.validoAte) < MINIMO_DE_DIAS_PARA_VENCER;
}

/** "Aula 8 de 12, válido até 15/12" or "Aula 8 de 15 (12 novas + 3 do pacote anterior)". */
export function linhaDoExtrato(dados: Pick<DadosDoExtrato, 'usadas' | 'novas' | 'transferidas' | 'validoAte'>): string {
  const total = dados.novas + dados.transferidas;
  const origem = dados.transferidas > 0 ? ` (${dados.novas} novas + ${dados.transferidas} do pacote anterior)` : '';
  const validade = dados.validoAte ? `, válido até ${diaEMes(dados.validoAte)}` : '';
  return `Aula ${dados.usadas} de ${total}${origem}${validade}`;
}

function preencher(modelo: string, valores: Record<string, string>): string {
  // One pass over the template: a value that contains "{pix}" is never expanded again.
  return modelo.replace(/\{[a-z]+\}/g, (marcador) => valores[marcador] ?? marcador);
}

/** The text of the statement, with the renewal paragraph when the package is about to end. */
export function montarMensagemDoExtrato(dados: DadosDoExtrato, modelos: ModelosDeMensagem, hoje: Data): string {
  const renovar = precisaDeRenovacao(dados, hoje);
  const paragrafo = renovar
    ? preencher(modelos.renovacao, { '{valor}': formatarReais(dados.valorDoProximoCentavos), '{pix}': modelos.chavePix })
    : '';
  return preencher(modelos.extrato, {
    '{nome}': dados.nome,
    '{extrato}': linhaDoExtrato(dados),
    '{renovacao}': paragrafo === '' ? '' : `\n\n${paragrafo}`,
  });
}

/** `https://wa.me/<phone>?text=<message>`; null when the number cannot be a Brazilian phone. */
export function linkDoWhatsApp(telefone: string, texto: string): string | null {
  const digitos = telefone.replace(/\D/g, '');
  const completo = digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
  if (!/^55\d{10,11}$/.test(completo)) return null;
  return `https://wa.me/${completo}?text=${encodeURIComponent(texto)}`;
}

/** "2026-12-15" as "15/12", as the spec writes it. */
function diaEMes(data: Data): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}
