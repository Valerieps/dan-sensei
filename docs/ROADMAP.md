# Roadmap

O que ainda não está pronto.

- **Entra aqui:** o que falta construir, onde o código ainda não segue o spec, o que foi adiado de
  propósito e as lacunas do spec que o agente decidiu sozinho.
- **Não entra aqui:** o que já está pronto (quando uma linha fica pronta, ela sai daqui; o git e as
  issues fechadas guardam o histórico), bugs e débito técnico (issues do GitHub) e as regras (`spec/`).

## Falta construir

| Feature | Fase | Spec | Observação |
| --- | --- | --- | --- |
| Identidade visual (paleta, letra, forma) | 1a | `spec/telas-de-gestao.md` | A Valéria escolhe; as quatro direções estão na issue #6 |
| Planos e pacotes, com aula dada e falta registradas à mão | 1a | `spec/pacotes-e-pagamentos.md` | Servidor pronto; faltam as telas |
| Saldo, renovação com transferência e pausas (inclusive "pausar todos") | 1a | `spec/pacotes-e-pagamentos.md` | Servidor pronto; faltam as telas |
| Pagamentos | 1a | `spec/pacotes-e-pagamentos.md` | Servidor pronto; faltam as telas |
| Pacote da dupla (titular e participante) | 1a | `spec/pacotes-e-pagamentos.md` | Servidor pronto; faltam as telas |
| Mensalistas e mensalidades | 1a | `spec/mensalistas.md` | |
| Saldo inicial | 1a | `spec/pacotes-e-pagamentos.md` | Necessário no primeiro dia de uso. Servidor pronto; falta a tela |
| Tela Alunos e pacotes (cartões) e abas do perfil | 1a | `spec/telas-de-gestao.md` | A lista de alunos e o perfil (abas Cadastro e Notas) existem; faltam os cartões com barra de progresso, os números do mês e a aba Pacotes e pagamentos |
| Extrato e renovação pelo WhatsApp | 1a | `spec/whatsapp.md` | ADR-008 |
| Botão + completo no celular | 1a | `spec/telas-de-gestao.md` | Menu lateral, barra de baixo e + existem, só com Nota sobre aluno e Novo aluno; entram Registrar pagamento, Nova aula e Registrar mensalidade |
| Exportação completa dos dados | 1a | `spec/termo-e-lgpd.md` | |
| Horários fixos, aulas agendadas e grade do dia | 1b | `spec/agenda.md` | |
| Remarcação e regras de cancelamento | 1b | `spec/agenda.md` | |
| Previsão de validade | 1b | `spec/agenda.md` | |
| Início com a linha do tempo do dia | 1b | `spec/telas-de-gestao.md` | |
| Confirmação de aulas e lembrete de mensalidade | 1b | `spec/agenda.md`, `spec/mensalistas.md` | |
| Biblioteca de exercícios e árvore de grupos musculares | 1c | `spec/treinos-e-exercicios.md` | |
| Programas, treinos e montagem em cartões | 1c | `spec/treinos-e-exercicios.md` | |
| Modo Ao Vivo individual, cronômetro e registro das séries | 1c | `spec/aula-ao-vivo.md` | Depois do teste no iPad do Dan (issue #7) |
| Aula em dupla com dois cronômetros e sons por aluno | 1c | `spec/aula-ao-vivo.md` | |
| PSE, carga da aula e volume | 1c | `spec/aula-ao-vivo.md` | |
| Resumo da aula pelo WhatsApp | 1c | `spec/whatsapp.md` | |
| Anamnese e alertas de saúde | 1c | `spec/alunos.md` | |
| Termo e PAR-Q | 1c | `spec/termo-e-lgpd.md` | Parte do rascunho de contrato do Dan |
| Aula sem internet | 1c | `spec/aula-ao-vivo.md` | ADR-009 |
| Aula simples no celular | 1c | `spec/aula-ao-vivo.md` | |

## O código ainda não segue o spec

- `tokens.css` ainda tem a paleta do template, não o tema escuro com esmeralda do spec.

## Adiado

- Avaliação física, fotos comparativas, mapa de calor e gráficos de volume — fase 2; não bloqueiam a
  aula e os gráficos precisam de semanas de dados.
- Código de acesso ou Touch ID para abrir o app — fase 2; na fase 1 bastam o Google e o bloqueio do
  iPad.
- Notificações com o app fechado — fase 2; a fase 1b avisa no Início.
- Treino para o aluno treinar sozinho — fase 2.
- Relatório mensal de recebimentos — fase 2; o Dan não declara pelo carnê-leão hoje.
- Tempo de deslocamento, recibos e vídeos próprios — fase 3.

## Revisar as lacunas que o agente decidiu

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
- [ ] O aluno não tem foto, só iniciais (`spec/alunos.md`).
- [ ] Sem termo assinado, o app não guarda anamnese nem alertas de saúde (`spec/termo-e-lgpd.md`).
- [ ] A cor da aula na agenda mostra a situação, não o aluno (`spec/agenda.md`).
- [ ] Nenhuma mensagem de WhatsApp leva dado de saúde (`spec/whatsapp.md`).
- [ ] Limites do cadastro do aluno: telefone com 10 a 13 números, altura de 50 a 250 cm, até 5
  endereços, notas de até 5.000 letras (`spec/alunos.md`).
