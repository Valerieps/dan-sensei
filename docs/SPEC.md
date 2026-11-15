# Spec

O que o app faz. É a fonte da verdade: quando outro documento diverge daqui, vale o spec.

- **Entra aqui:** o que o app é, para quem, as fases e qual arquivo de `spec/` cobre cada feature.
- **Não entra aqui:** as regras em si (ficam em `spec/`), o que falta construir (`ROADMAP.md`) e
  como o app é construído (`ARQUITETURA.md` e `adr/`).

## O app

Eu sou o Dan, personal trainer que atende em domicílio. O Dan Sensei é a minha ferramenta de
trabalho: controla pacotes, pagamentos e agenda dos meus alunos, e conduz a aula no iPad, legível a
2 m, com o cronômetro e o registro das séries. Hoje faço esse controle de memória e pelo WhatsApp; o
app substitui os dois.

Só eu uso o app. A Valéria faz e mantém o app e também é admin. Os alunos não têm login: usam o app
só no meu iPad (termo, nota de esforço) e recebem as mensagens pelo WhatsApp. O app não será vendido.

**Escala:** hoje cerca de 7 alunos e 13 a 15 aulas por semana; o objetivo é chegar a 30 aulas por
semana. Nenhuma tela precisa de paginação ou busca sofisticada.

**Aparelhos:** iPad 8ª geração (10,2", iPadOS 26.6, Touch ID, Apple Pencil 1ª geração) para tudo, e
celular para consulta e gestão. O app é instalado pela Tela de Início (PWA). Não há versão para
computador.

Neste spec, "eu" é o Dan.

## Fases

Cada fase precisa ser usável sozinha. Cada regra em `spec/` diz de que fase vale, como *(1a)*.

| Fase | O que entra |
| --- | --- |
| 1a | Alunos e pacotes: cadastro, planos, pacotes, registro de aula dada ou falta, saldo, renovação, pausas, pagamentos, mensalistas, saldo inicial, a aba Alunos e o extrato pelo WhatsApp |
| 1b | Agenda: horários fixos, remarcação, regras de cancelamento, previsão de validade, a aba Hoje com a linha do tempo do dia, confirmação de aulas e o lembrete de mensalidade |
| 1c | Aula: biblioteca de exercícios, treinos, Modo Ao Vivo (individual e em dupla), cronômetro, PSE, resumo pelo WhatsApp, anamnese e alertas de saúde, termo e PAR-Q, aula sem internet e a aula simples no celular |
| 2 | Avaliação física, mapa de calor, gráficos de volume, fotos comparativas, treino para o aluno treinar sozinho, código de acesso ou Touch ID, notificações, relatório de recebimentos |
| 3 | Tempo de deslocamento na agenda, recibos, vídeos próprios de execução |

Por quê: a Valéria faz o app sozinha. Em etapas, eu já uso cada parte antes da próxima, e a parte
mais arriscada no iPad (tela acesa, som, dois cronômetros, sem internet) vem por último, depois do
teste no meu iPad.

**Fora do escopo:** app nativo de App Store, mensalidade para alunos novos, acesso do aluno (link ou
app), dobras cutâneas e perímetros, integração com Google Agenda, importação de histórico e envio
automático de mensagens pelo WhatsApp.

## Arquivos

| Arquivo | O que cobre |
| --- | --- |
| [spec/acesso-e-membros.md](spec/acesso-e-membros.md) | Login com Google, convites, papéis e membros |
| [spec/alunos.md](spec/alunos.md) | Cadastro do aluno, anamnese, alertas de saúde, metas e avaliação física |
| [spec/pacotes-e-pagamentos.md](spec/pacotes-e-pagamentos.md) | Planos, pacotes, saldo, faltas, renovação, pausas, pagamentos, dupla e saldo inicial |
| [spec/mensalistas.md](spec/mensalistas.md) | Alunos que pagam mensalidade |
| [spec/agenda.md](spec/agenda.md) | Horários fixos, aulas agendadas, remarcação, cancelamento e confirmação |
| [spec/telas-de-gestao.md](spec/telas-de-gestao.md) | Hoje, Alunos, perfil do aluno e o celular |
| [spec/treinos-e-exercicios.md](spec/treinos-e-exercicios.md) | Biblioteca de exercícios, programas, treinos e prescrição |
| [spec/aula-ao-vivo.md](spec/aula-ao-vivo.md) | Modo Ao Vivo, dupla, cronômetro, registro das séries, PSE e volume |
| [spec/whatsapp.md](spec/whatsapp.md) | Mensagens prontas: extrato, resumo, renovação, confirmação e lembrete |
| [spec/termo-e-lgpd.md](spec/termo-e-lgpd.md) | Termo de consentimento, PAR-Q, dados sensíveis e exportação |
| [spec/_modelo.md](spec/_modelo.md) | Modelo para um arquivo de feature novo |

Os termos estão definidos em [GLOSSARIO.md](GLOSSARIO.md).
