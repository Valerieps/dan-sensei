// The confirmation of tomorrow's lesson and the monthly fee reminder (docs/spec/whatsapp.md).
//
// Pure, like the statement: the builders receive only what they print, so no health data can reach
// the text. The wording is fixed; the trainer may edit it in WhatsApp before sending.
import { formatarReais, type Data } from '../pacotes';

const DIAS = { 1: 'segunda', 2: 'terça', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sábado', 7: 'domingo' } as const;

function diaEMes(data: Data): string {
  const [, mes, dia] = data.split('-');
  return `${dia}/${mes}`;
}

export interface DadosDaConfirmacao {
  readonly nome: string;
  readonly data: Data;
  /** ISO weekday of `data`, 1 = Monday. */
  readonly diaDaSemana: keyof typeof DIAS;
  readonly hora: string;
  readonly endereco: string | null;
}

/** "Oi, Maria! Confirmando sua aula amanhã, terça (27/10), às 07:00, em Rua A, 10. Pode confirmar?" */
export function montarConfirmacaoDaAula(dados: DadosDaConfirmacao): string {
  const onde = dados.endereco ? `, em ${dados.endereco}` : '';
  return `Oi, ${dados.nome}! Confirmando sua aula amanhã, ${DIAS[dados.diaDaSemana]} (${diaEMes(dados.data)}), às ${dados.hora}${onde}. Pode confirmar?`;
}

export interface DadosDoLembrete {
  readonly nome: string;
  /** The month the fee refers to, "YYYY-MM". */
  readonly mes: string;
  readonly valorCentavos: number;
  readonly chavePix: string;
}

/** "Oi, Maria! Lembrete da mensalidade de 10/2026: R$ 400,00. Chave PIX: ..." */
export function montarLembreteDeMensalidade(dados: DadosDoLembrete): string {
  const [ano, mes] = dados.mes.split('-');
  const pix = dados.chavePix ? ` Chave PIX: ${dados.chavePix}` : '';
  return `Oi, ${dados.nome}! Lembrete da mensalidade de ${mes}/${ano}: ${formatarReais(dados.valorCentavos)}.${pix}`;
}
