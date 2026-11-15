# Roadmap

O que ainda não está pronto.

- **Entra aqui:** o que falta construir, onde o código ainda não segue o spec, o que foi adiado de
  propósito e as lacunas do spec que o agente decidiu sozinho.
- **Não entra aqui:** o que já está pronto (quando uma linha fica pronta, ela sai daqui; o git e as
  issues fechadas guardam o histórico), bugs e débito técnico (issues do GitHub) e as regras (`spec/`).

## Falta construir

| Feature | Fase | Spec | Observação |
| --- | --- | --- | --- |
| Biblioteca de exercícios e árvore de grupos musculares | 1c | `spec/treinos-e-exercicios.md` | A fase 1c segue as sessões C1 a C9 do mesmo plano |
| Programas, treinos e montagem em cartões | 1c | `spec/treinos-e-exercicios.md` | |
| Modo Ao Vivo individual, cronômetro e registro das séries | 1c | `spec/aula-ao-vivo.md` | Depois do teste no iPad do Dan (issue #7) |
| Aula em dupla com dois cronômetros e sons por aluno | 1c | `spec/aula-ao-vivo.md` | |
| PSE, carga da aula e volume | 1c | `spec/aula-ao-vivo.md` | |
| Resumo da aula pelo WhatsApp | 1c | `spec/whatsapp.md` | |
| Anamnese e alertas de saúde | 1c | `spec/alunos.md` | |
| Termo e PAR-Q | 1c | `spec/termo-e-lgpd.md` | Parte do rascunho de contrato do Dan |
| Aula sem internet | 1c | `spec/aula-ao-vivo.md` | ADR-009 |
| Aula simples no celular | 1c | `spec/aula-ao-vivo.md` | |

## Adiado

- Avaliação física, fotos comparativas, mapa de calor e gráficos de volume — fase 2; não bloqueiam a
  aula e os gráficos precisam de semanas de dados.
- Código de acesso ou Touch ID para abrir o app — fase 2; na fase 1 bastam o Google e o bloqueio do
  iPad.
- Notificações com o app fechado — fase 2; a fase 1b avisa em Hoje.
- Treino para o aluno treinar sozinho — fase 2.
- Relatório mensal de recebimentos — fase 2; o Dan não declara pelo carnê-leão hoje.
- Tempo de deslocamento, recibos e vídeos próprios — fase 3.

## Revisar as lacunas que o agente decidiu

- [ ] Alunos: os filtros são Todos, Atenção, Mensalistas e Inativos; o menu de contexto do cartão
  tem Remarcar (leva à Agenda no dia da próxima aula), Registrar pagamento e Mandar extrato (leva
  à aba Pacotes), e some a ação que não se aplica (`spec/telas-de-gestao.md`).

- [ ] Fases 1a, 1b e 1c: a ordem e o que entra em cada uma (`SPEC.md`).
- [ ] Na fase 1a, antes da agenda, aula dada e falta são registradas à mão no pacote
  (`spec/pacotes-e-pagamentos.md`).
- [ ] Um aluno é titular de no máximo um pacote ativo por vez, mas pode participar de outro
  (`spec/pacotes-e-pagamentos.md`).
- [ ] Pausa: os dois dias das pontas contam; esgotado vale mais que vencido; aula em pacote vencido
  fica "sem pacote"; dupla sem pacote em comum pergunta de qual descontar
  (`spec/pacotes-e-pagamentos.md`).
- [ ] Pacotes: o total a pagar é aulas × valor por aula (as transferidas não entram); registro à mão só
  com data, nunca futura; "pausar todos" vale também para pacotes vendidos depois; "renovações
  previstas" são os alunos nos níveis 2 e 3 de urgência, e "quanto recebi" é a soma dos pagamentos do
  mês (`spec/pacotes-e-pagamentos.md`, `spec/telas-de-gestao.md`).
- [ ] Mensalidade pendente conta os meses depois do último mês pago; sem nenhum mês pago, só o mês
  atual (`spec/mensalistas.md`).
- [ ] Mensalistas: um mês tem no máximo uma mensalidade registrada; o aluno só vira mensalista se
  não tem pacote; a mensalidade paga entra no "quanto recebi" do mês em que foi paga
  (`spec/mensalistas.md`).
- [ ] O aluno não tem foto, só iniciais (`spec/alunos.md`).
- [ ] Sem termo assinado, o app não guarda anamnese nem alertas de saúde (`spec/termo-e-lgpd.md`).
- [ ] A cor da aula na agenda mostra a situação, não o aluno (`spec/agenda.md`).
- [ ] Agenda (telas): a grade do dia vai das 6h às 22h e cresce se há aula fora disso; arrasto pela
  alça da aula (a aula em si rola a página), em passos de 15 min, e soltar abre a confirmação de
  "remarcar" com "só esta" ou "esta e as seguintes"; a alternativa sem arrastar é tocar na aula,
  escolher dia e hora e remarcar (3 toques) ou as setas do teclado na alça; aula cancelada ou
  remarcada não conta como ocupada nos intervalos; a previsão aparece no cartão do aluno em
  "Alunos" (`spec/agenda.md`).
- [ ] WhatsApp: o extrato e a renovação saem numa só mensagem (a renovação é um parágrafo no fim);
  o valor do parágrafo é o total do pacote atual; o plano Avulso nunca recebe o parágrafo; a data
  aparece como dia/mês; o extrato fica "para enviar" até eu abrir a mensagem depois da última aula
  dada; o app guarda só que abri, não que enviei (`spec/whatsapp.md`).
- [ ] Exportação: um `.zip` com uma planilha CSV por tabela, sem sessões nem o código da conta Google;
  só admin exporta (`spec/termo-e-lgpd.md`).
- [ ] "Sair de todos os aparelhos": cada admin encerra os aparelhos de qualquer membro, inclusive os
  próprios (`spec/termo-e-lgpd.md`).
- [ ] Limites do cadastro do aluno: telefone com 10 a 13 números, altura de 50 a 250 cm, até 5
  endereços, notas de até 5.000 letras (`spec/alunos.md`).
- [ ] Alunos: o cartão mostra "Aula X de Y" com X igual às aulas usadas; a opção "esconder valores" esconde só o recebido do mês e fica guardada no aparelho; mensalistas aparecem sem barra; inativos ficam no filtro "Inativos" do controle segmentado (`spec/telas-de-gestao.md`).
- [ ] Menu +: antes da agenda, "Nova aula" é a tela "Registrar aula" (segunda opção, depois de Registrar pagamento); o perfil mostra no cabeçalho o plano, "Aula X de Y" e a situação do pacote atual (`spec/telas-de-gestao.md`).
- [ ] Agenda (servidor): as aulas dos horários fixos são geradas 8 semanas à frente, no comando e no
  cron (ADR-010); remarcar "esta e as seguintes" troca o horário fixo a partir daquela aula; aula
  avulsa só a partir de hoje; cancelamento com menos de 24 h só muda depois da resposta "cobrar ou
  abonar" (o app manda a decisão de novo); cancelamento feito por mim nunca cobra; marcar como dada
  só vale até hoje; aluno inativo não gera aulas novas; o aviso de previsão usa os horários fixos
  além das 8 semanas (`spec/agenda.md`).
- [ ] Hoje (1b): a aba Hoje é a primeira tela (`/`) e a aba Alunos fica em `/alunos`. Como o
  Modo Ao Vivo só chega na 1c, a aula em destaque tem "Marcar como dada" no lugar de "Iniciar aula".
  O texto da confirmação e do lembrete de mensalidade é fixo (não há modelo editável nas
  configurações); eu edito no WhatsApp antes de enviar. "Quem não confirmou" é quem recebeu a
  mensagem aberta no WhatsApp e ainda não confirmou: a aula fica em destaque no dia. A aba Hoje
  pergunta da mensalidade só no dia do vencimento; depois dele a pendência aparece em "Precisa de
  atenção" e no cartão de cada aula do aluno. O cartão de Alunos mostra a próxima aula
  agendada, ou "Sem próxima aula agendada" (`spec/agenda.md`, `spec/mensalistas.md`).
