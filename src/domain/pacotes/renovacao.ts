// Renewal (docs/spec/pacotes-e-pagamentos.md, "Renovação").
//
// The texts below are stored with the closed package and shown in the statement, so they are
// built here, in Brazilian Portuguese, and are not part of `strings.ts`.
import { type Data, formatarData } from './datas';
import { type ConsumoDoPacote, calcularSaldo } from './saldo';

/** Lessons left over that move to the new package. A closed package has nothing to move. */
export function aulasATransferir(
  anterior: ConsumoDoPacote & { readonly encerrado?: boolean },
): number {
  return anterior.encerrado ? 0 : calcularSaldo(anterior).restantes;
}

function aulas(quantidade: number): string {
  return quantidade === 1 ? '1 aula' : `${quantidade} aulas`;
}

/** The confirmation shown before the new package is created; null when nothing moves. */
export function avisoDeTransferencia(transferidas: number): string | null {
  if (transferidas <= 0) return null;
  return transferidas === 1
    ? '1 aula do pacote anterior será transferida'
    : `${transferidas} aulas do pacote anterior serão transferidas`;
}

/** The note on the closed package: "3 aulas transferidas para o pacote de 12/12/2026". */
export function anotacaoDoPacoteEncerrado(transferidas: number, dataDoPacoteNovo: Data): string {
  const data = formatarData(dataDoPacoteNovo);
  if (transferidas <= 0) return `Nenhuma aula transferida para o pacote de ${data}`;
  const palavra = transferidas === 1 ? 'transferida' : 'transferidas';
  return `${aulas(transferidas)} ${palavra} para o pacote de ${data}`;
}

/** The origin line of the statement: "15 aulas (12 novas + 3 transferidas)". */
export function origemDasAulas(totalAulas: number, aulasTransferidas: number): string {
  const total = totalAulas + aulasTransferidas;
  if (aulasTransferidas <= 0) return aulas(total);
  const novas = totalAulas === 1 ? '1 nova' : `${totalAulas} novas`;
  const transferidas =
    aulasTransferidas === 1 ? '1 transferida' : `${aulasTransferidas} transferidas`;
  return `${aulas(total)} (${novas} + ${transferidas})`;
}
