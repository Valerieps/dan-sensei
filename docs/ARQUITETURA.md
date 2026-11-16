# Arquitetura

O desenho técnico que o código não mostra sozinho.

- **Entra aqui:** as invariantes (o que precisa ser sempre verdade), o modelo de dados, o fluxo de
  eventos e as migrações.
- **Não entra aqui:** um passeio pelos arquivos (o código mostra), o porquê de cada decisão (`adr/`),
  o que falta construir (`ROADMAP.md`) e as regras de produto (`spec/`).

## Visão geral

- **App:** web app (Vite + React + TypeScript), instalável (PWA). Fala só com a própria origem.
- **Servidor:** um Cloudflare Worker serve os arquivos do app, a API em `/api`, a conexão ao vivo e
  o cron. Todos os dados do grupo ficam num único Durable Object, `Group`, com SQLite. Ver ADR-004.
- **Login:** Google, pelo fluxo de código OAuth no Worker, com cookie de sessão. Ver ADR-005.

```
app (celular) ──POST /api/query|command──► Worker ──RPC──► Group (Durable Object, SQLite)
     ▲                                       ▲                    │
     └──────── WebSocket /api/live ──────────┘                    │ "mudou: members, invites…"
                                             cron 5 min ──► tick  ▼
                                                     todos os apps abertos refazem a consulta
```

## Camadas

`domain` ← `application` ← `infrastructure` e `ui`, no app e no servidor.

- `src/domain/`: regras puras e os textos da interface (`strings.ts`). O app e o servidor usam o
  mesmo código.
- `src/application/api-contract.ts`: os nomes, entradas e saídas das consultas e dos comandos. É só
  tipo; o servidor importa com `import type`.
- `server/application/`: os casos de uso do servidor. Síncronos, dependem só das portas `Sql`,
  `Clock` e `IdGenerator`; os testes rodam sobre `node:sqlite`.
- `server/infrastructure/` e `server/entry/`: Cloudflare, Google, cookies. Finos.
- A interface chama `Backend` e `LiveUpdates` (portas em `src/application/ports.ts`), nunca a rede
  direto.

## Invariantes

- Só o servidor grava. O app não tem acesso ao banco; toda escrita é um comando que o `Group`
  confere (sessão, papel, regra) e grava numa transação só.
- Um comando roda sozinho: o Durable Object processa uma chamada por vez, e tudo o que o comando
  causa entra junto ou não entra.
- Papéis são conferidos no servidor, nunca só na interface.
- Sempre existe pelo menos um admin.
- A sessão vale só enquanto o membro está ativo. Remover alguém apaga as sessões dele e fecha os
  WebSockets abertos (o comando devolve `disconnect`), então o acesso acaba na hora.
- Um comando devolve os tópicos (`Topic`) que mudou; o `Group` avisa todos os apps abertos, que
  refazem as consultas desses tópicos.

## Modelo de dados

| Tabela | Campos principais | Observação |
| --- | --- | --- |
| `members` | `id`, `google_sub`, `email`, `name`, `photo_url`, `roles` (JSON), `active` | Removido fica com `active = 0`; um convite novo traz o mesmo membro de volta |
| `settings` | `key`, `value` | 1a | Chave PIX e modelos das mensagens; só o que difere do padrão é guardado |
| `sessions` | `token_hash`, `member_id`, `expires_at` | Só o SHA-256 do token; o cron apaga as vencidas |
| `invites` | `email`, `invited_by`, `state` (`pending`, `accepted`, `revoked`) | Um por e-mail |

Tabelas planejadas (só o desenho; cada migração vem com a sua feature):

| Tabela | Campos principais | Fase | Observação |
| --- | --- | --- | --- |
| `students` | `id`, `name`, `phone`, `birth_date`, `height_cm`, `emergency_contact`, `status`, `billing` (`package`, `monthly`), `notes` | 1a | Aluno; não é membro e nunca faz login |
| `student_addresses` | `id`, `student_id`, `label`, `address`, `is_default` | 1a | |
| `plans` | `id`, `name`, `classes`, `price_cents`, `validity_days`, `active` | 1a | `price_cents` é o preço de uma aula. Os quatro de fábrica entram na migração |
| `packages` | `id`, `holder_id`, `participant_id`, `plan_id`, cópia de `classes`/`price_cents`/`validity_days`, `transferred_in`, `used_before_app`, `first_class_on`, `closed_at`, `closed_note` | 1a | Saldo e vencimento nunca são gravados: calculados de `classes` e das aulas. `first_class_on` é só a data do saldo inicial (a primeira aula é a mais antiga entre ela e as aulas que consomem). `previous_package_id` liga ao pacote encerrado na renovação |
| `package_pauses` | `id`, `package_id`, `starts_on`, `ends_on`, `reason` | 1a | Só as pausas próprias do pacote; contam nos 30 dias |
| `global_pauses` | `id`, `starts_on`, `ends_on`, `created_at` | 1a | "Pausar todos os pacotes": uma linha que vale para todo pacote, sem cópia por pacote; nunca conta nos 30 dias |
| `payments` | `id`, `package_id`, `paid_on`, `amount_cents`, `method` (`pix`, `cash`, `card`) | 1a | |
| `monthly_fees` | `student_id`, `amount_cents`, `due_day`, `paid_through` | 1a | Um por mensalista; `paid_through` é o último mês pago antes do app (saldo inicial) |
| `monthly_payments` | `id`, `student_id`, `month`, `paid_on`, `amount_cents`, `method` | 1a | Um por aluno e mês; os meses pendentes são calculados, nunca guardados |
| `classes` | `id`, `starts_at`, `status` (`scheduled`, `given`, `missed`, `cancelled`, `rescheduled`), `created_at`, `duration_min`, `address`, `rescheduled_from`, `recurrence_id`, `slot_on`, `confirmed_at`, `confirmation_asked_at`; a 1c soma `started_at`, `finished_at` e `actual_min` (duração real, editável) | 1a, 1b | Na 1a só aulas à mão (`given`, `missed`), ao meio-dia de São Paulo. Na 1b a agenda gera as agendadas (ADR-010); `slot_on` guarda o dia do horário fixo que a linha ocupa, mesmo depois de cancelada ou remarcada. Aula agendada tem `charge` `waived` e não consome |
| `class_students` | `class_id`, `student_id`, `package_id`, `charge` (`consumes`, `waived`), `pse` | 1a | Liga cada aluno da aula ao pacote que ela consome; `package_id` nulo com `consumes` é "sem pacote". Uma aula em dupla tem duas linhas no mesmo pacote e consome 1 aula (`pse`, de 0 a 10, entra na 1c) |
| `recurrences` | `id`, `student_ids` (JSON, 1 ou 2), `weekday` (ISO 1 a 7), `time` ("HH:MM" em São Paulo), `duration_min`, `address`, `starts_on`, `ends_on`, `created_at` | 1b | Horário fixo; `address` nulo é o endereço padrão do primeiro aluno. As aulas são geradas 56 dias à frente (ADR-010) |
| `message_log` | `id`, `student_id`, `kind`, `opened_at`, `opened_by` | 1a | Mensagem aberta no WhatsApp (ADR-008) |
| `exercises` | `id`, `name`, `name_key` (único, sem maiúsculas e acentos), `aliases`, `primary_groups`, `secondary_groups`, `tags` (listas JSON), `measure`, `load_step_g`, `equipment`, `media_url`, `archived` | 1c | Vem com a lista pronta (migração 8). Os grupos musculares são fixos no domínio (`src/domain/treinos`), não uma tabela. Sem grupo primário é "Exercício sem músculos". Carga em gramas |
| `programs`, `workouts`, `workout_groups`, `prescribed_exercises` | programa (do aluno, opcional) → treinos (do aluno, `program_id` nulo se avulso) → exercícios prescritos com ordem, séries, faixa, carga, descanso, método, RIR ou PSE-alvo e `group_id` | 1c | Bi-set, tri-set e circuito são linhas de `workout_groups`, com o tipo derivado do tamanho. Editar ou apagar não muda aulas passadas: as séries feitas (`performed_sets`) guardam o próprio `exercise_id` e não apontam para o treino |
| `class_plan` | `id` (`<aula>:<aluno>:<n>`, ou o id do cliente se acrescentado), `class_id`, `student_id`, `exercise_id`, `sort`, `sets`, `reps_min`, `reps_max`, `load_g`, `rest_s`, `group_key`, `group_kind` | 1c | A cópia do treino que a aula faz ao iniciar; mudar o treino não a altera |
| `performed_sets` | `id` (= `client_command_id`), `class_id`, `student_id`, `plan_id`, `exercise_id`, `order`, `reps`, `load_g`, `seconds`, `meters`, `client_command_id`, `created_at` | 1c | Aponta para o exercício, não para o treino. A carga anterior é a última `load_g` do aluno naquele exercício em outra aula |
| `client_commands` | `id`, `name`, `result` (JSON), `applied_at` | 1c | Todo comando `live.*` grava o id que o cliente mandou; o mesmo id de novo devolve a resposta guardada sem aplicar (ADR-009). Só sucesso é guardado |
| `consents`, `parq_responses`, `anamneses`, `health_conditions`, `student_alerts` | termo assinado (imagem PNG da assinatura, versão do termo, data, quem colheu); respostas do PAR-Q e data; objetivos; a lista de condições que eu edito; alerta (aluno + condição) com observação | 1c | Dados sensíveis (`docs/SEGURANCA.md`). Sem linha em `consents` o servidor recusa PAR-Q, anamnese e alerta (`consent_required`). A imagem da assinatura nunca vai nas views, só o cabeçalho (versão e data); o aluno traz `healthAlerts` para o perfil, Hoje e os cartões |

**Datas e fuso:** todas as datas de negócio (validade, vencimento da mensalidade, "amanhã", semana
de segunda a domingo) são calculadas no fuso `America/Sao_Paulo`. Instantes (`starts_at`,
`paid_on` com hora) ficam em UTC no banco.

**Dinheiro:** sempre em centavos inteiros (`*_cents`), nunca em número de ponto flutuante.

## Fluxo de eventos

O app não tem um histórico de eventos próprio: a situação de cada aula (`classes.status` e
`class_students.charge`) e os pagamentos já são o histórico do pacote. A aula sem internet da fase
1c envia uma fila de comandos ao voltar a conexão (ADR-009); cada comando é gravado na mesma
transação que aplica o seu efeito (`client_commands`). O comando leva `at`, o horário no aparelho, que o
servidor usa se for válido (não futuro, até 7 dias atrás) para o início, o fim e a duração da aula.

## Migrações

`MIGRATIONS` em `server/application/schema.ts` é uma lista numerada; o `Group` aplica as que faltam
ao iniciar, cada uma numa transação, e registra em `schema_migrations`. Uma migração publicada nunca
muda: a mudança seguinte é uma migração nova. Remover uma coluna leva duas versões: primeiro o código
para de usar, depois a coluna sai. A classe do Durable Object tem suas próprias migrações no
`wrangler.jsonc` (`tag`), que também só crescem.
