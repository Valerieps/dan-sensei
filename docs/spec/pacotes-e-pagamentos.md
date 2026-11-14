# Pacotes e pagamentos

O saldo e a validade de cada pacote sempre corretos, sem depender da minha memória.

- **Entra aqui:** planos, pacotes, o que consome uma aula, saldo, renovação, pausas, pagamentos, o
  pacote da dupla e o saldo inicial.
- **Não entra aqui:** mensalistas (`mensalistas.md`), a agenda e o cancelamento de aulas marcadas
  (`agenda.md`), a mensagem de extrato (`whatsapp.md`) e a tela Alunos e pacotes
  (`telas-de-gestao.md`).

## Em aberto

- [ ] Quando a aula passa de 1h10, o app pergunta, ao encerrar, se eu cobro uma aula extra, com
  "não cobrar" pré-selecionado. Se eu cobro, a aula consome 2 do pacote. Está certo? *(1c)*

## Planos

- O app vem com estes planos, e eu edito os valores e crio outros. *(1a)*

  | Plano | Aulas | Valor por aula (R$) | Total (R$) | Validade (dias) |
  | --- | --- | --- | --- | --- |
  | Avulso | 1 | 200 | 200 | 7 |
  | 12 aulas | 12 | 120 | 1.440 | 60 |
  | 16 aulas | 16 | 110 | 1.760 | 75 |
  | 20 aulas | 20 | 100 | 2.000 | 90 |

- Pacotes maiores que 20 são cadastrados como planos novos. *(1a)*

## Pacote

- Quando escolho um plano para o aluno, o app preenche o total de aulas, o valor e a validade. Eu
  posso mudar qualquer um deles. *(1a)*
- O pacote guarda uma cópia dos valores do plano. Mudar o preço de um plano não muda pacotes já
  vendidos. *(1a)*
- A validade conta a partir da primeira aula, não do pagamento. O pacote nasce como **aguardando
  início**, e o vencimento é fixado quando a primeira aula consome o pacote (aula dada ou falta
  cobrada). *(1a)*
- Enquanto o pacote aguarda início, o app mostra o vencimento previsto a partir da primeira aula
  marcada na agenda. *(1b)*
- Um pacote tem um titular e pode ter um participante (ver Aula em dupla). Um aluno é titular de no
  máximo um pacote ativo por vez. *(1a)*

## Aula dada e falta

O aluno pode cancelar sem perder a aula com pelo menos 24 h de antecedência.

| Situação da aula | Consome o pacote? | Quando |
| --- | --- | --- |
| Agendada | Não | Marcada na agenda |
| Dada | Sim | A aula aconteceu |
| Falta cobrada | Sim | Falta sem aviso, ou cancelamento com menos de 24 h que eu decidi cobrar |
| Falta abonada | Não | Falta justificada, ou cancelamento com menos de 24 h que eu decidi abonar |
| Cancelada | Não | Cancelada pelo aluno com 24 h ou mais, ou por mim |
| Remarcada | Não | Trocada por outra aula agendada, com o vínculo guardado |

- Antes da agenda existir, eu registro no pacote uma aula dada ou uma falta, com a data. *(1a)*
  Por quê: a fase 1a precisa controlar o saldo sozinha; a partir da 1b, a agenda faz isso.
- As regras de cancelamento com e sem 24 h estão em `agenda.md`. *(1b)*

## Saldo

- Usadas = aulas do pacote dadas ou com falta cobrada. Restantes = total − usadas. O saldo é sempre
  calculado, nunca digitado. *(1a)*
- Pacote esgotado: o app deixa registrar a aula, avisa, e a aula fica "sem pacote" até eu ligá-la ao
  próximo pacote. *(1a)*
- Pacote vencido com aulas sobrando: fica como **vencido**, com o saldo visível e guardado até a
  renovação. *(1a)*

## Renovação

- O aluno pode renovar a qualquer momento, antes ou depois de vencer, sem prazo máximo. *(1a)*
- As aulas que sobraram passam para o pacote novo e valem pela validade dele. Exemplo: sobraram 3
  aulas e o aluno comprou o pacote de 12; ficam 15 aulas, com 60 dias a partir da primeira aula do
  pacote novo. *(1a)*
- Ao criar o pacote novo, o app mostra "3 aulas do pacote anterior serão transferidas" e eu
  confirmo. *(1a)*
- O pacote anterior é encerrado com a anotação "3 aulas transferidas para o pacote de 12/12/2026". O
  novo fica com 12 + 3 = 15 aulas, o valor pago pelas 12 e a validade do plano de 12. *(1a)*
- O extrato mostra a origem: "15 aulas (12 novas + 3 transferidas)". *(1a)*

## Pausas

- Eu pauso um pacote informando o início e o fim, para viagem ou lesão. A validade passa a ser a
  original mais os dias pausados. A data original nunca é apagada, então o histórico sempre explica
  o vencimento. *(1a)*
- Um pacote pode ficar pausado no máximo 30 dias, somando todas as pausas. *(1a)*
  Por quê: sem limite, o aluno pausa e volta dois anos depois.
- Posso passar dos 30 dias, por exemplo numa lesão longa, mas aí o app pede que eu escreva o motivo.
  *(1a)*
- "Pausar todos os pacotes" pausa os pacotes de todos os alunos pelo período que eu informar, para
  minhas férias, doença ou dias sem aula. Essa pausa não conta nos 30 dias de nenhum aluno. *(1a)*
  Por quê: o aluno não pode perder validade por uma falta minha.

## Pagamentos

O pagamento é sempre antecipado: PIX e dinheiro na maioria das vezes, cartão quando o aluno pede.

- Cada pacote tem um ou mais pagamentos, com data, valor e forma (PIX, dinheiro ou cartão). Mais de
  um só no caso raro de pagar parte em uma forma e parte em outra. *(1a)*
- O pacote está **pago** quando a soma dos pagamentos chega ao total, e **pendente** enquanto falta
  algo. *(1a)*
- Se registro uma aula num pacote pendente, o app avisa, mas não impede. *(1a)*
- Um relatório mensal de recebimentos (total por mês e por forma de pagamento), exportável em
  planilha, fica para a fase 2. *(2)*
  Por quê: hoje eu não declaro pelo carnê-leão, então não é urgente.

## Aula em dupla

O preço por aula vale para até 2 alunos na mesma aula; o app aceita no máximo 2.

- Um pacote de 20 aulas são 20 aulas, independente de quem as usa. A dupla pode dividir um pacote no
  nome de um dos dois (o titular), com o outro como participante. *(1a)*
- Cada aula da dupla desconta 1 aula do pacote da dupla. *(1a)*
- Se um aluno da dupla falta e o outro treina, desconta 1 aula normalmente. Se os dois faltam sem
  avisar, desconta 1 aula, com a mesma regra das 24 h. *(1a)*
- Um aluno da dupla pode ter também o seu próprio pacote. Aula em dupla desconta do pacote da dupla;
  aula sozinho desconta do pacote próprio. Se ele não tem pacote próprio, o app pergunta de onde
  descontar. *(1a)*
- O titular recebe o extrato do pacote e o aviso de renovação; o participante recebe só o resumo do
  próprio treino. *(1a)*

## Saldo inicial

Não há histórico a importar: eu cadastro direto no app o que cada aluno tem no dia em que começo a
usar.

- Para cada pacote em andamento, eu informo o plano, o total, quantas aulas já foram usadas, a data
  da primeira aula e o que já foi pago. O app trata as aulas usadas como "usadas antes do app" e
  calcula saldo e validade a partir daí. *(1a)*
- Nas duas primeiras semanas, eu confiro o saldo do app com o que sei pelo WhatsApp. *(1a)*
  Por quê: um saldo inicial errado faz todos os avisos de renovação saírem errados.
