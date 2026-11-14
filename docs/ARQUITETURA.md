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
| `classes` | `id`, `starts_at`, `status` (`scheduled`, `given`, `missed`, `cancelled`, `rescheduled`), `created_at`, `duration_min`, `address`, `rescheduled_from`, `recurrence_id`, `slot_on`, `confirmed_at`; a 1c soma `finished_at` | 1a, 1b | Na 1a só aulas à mão (`given`, `missed`), ao meio-dia de São Paulo. Na 1b a agenda gera as agendadas (ADR-010); `slot_on` guarda o dia do horário fixo que a linha ocupa, mesmo depois de cancelada ou remarcada. Aula agendada tem `charge` `waived` e não consome |
| `class_students` | `class_id`, `student_id`, `package_id`, `charge` (`consumes`, `waived`), `pse` | 1a | Liga cada aluno da aula ao pacote que ela consome; `package_id` nulo com `consumes` é "sem pacote". Uma aula em dupla tem duas linhas no mesmo pacote e consome 1 aula (`pse` entra na 1c) |
| `recurrences` | `id`, `student_ids` (JSON, 1 ou 2), `weekday` (ISO 1 a 7), `time` ("HH:MM" em São Paulo), `duration_min`, `address`, `starts_on`, `ends_on`, `created_at` | 1b | Horário fixo; `address` nulo é o endereço padrão do primeiro aluno. As aulas são geradas 56 dias à frente (ADR-010) |
| `message_log` | `id`, `student_id`, `kind`, `opened_at`, `opened_by` | 1a | Mensagem aberta no WhatsApp (ADR-008) |
| `exercises` | `id`, `name`, `aliases`, `primary_groups`, `secondary_groups`, `tags`, `measure`, `load_step`, `equipment`, `media_url` | 1c | |
| `programs`, `workouts`, `prescribed_exercises` | programa → treinos → exercícios prescritos com ordem, séries, faixa, carga, descanso, método, grupo de bi-set | 1c | Editar não muda aulas passadas |
| `performed_sets` | `id`, `class_id`, `student_id`, `exercise_id`, `order`, `reps`, `load_g`, `seconds`, `meters`, `client_command_id` | 1c | `client_command_id` torna o reenvio offline idempotente (ADR-009) |
| `health_alerts`, `parq_answers`, `consents` | alerta e observação; respostas e data; termo assinado (imagem da assinatura) e data | 1c | Dados sensíveis (`docs/SEGURANCA.md`) |

**Datas e fuso:** todas as datas de negócio (validade, vencimento da mensalidade, "amanhã", semana
de segunda a domingo) são calculadas no fuso `America/Sao_Paulo`. Instantes (`starts_at`,
`paid_on` com hora) ficam em UTC no banco.

**Dinheiro:** sempre em centavos inteiros (`*_cents`), nunca em número de ponto flutuante.

## Fluxo de eventos

O app não tem um histórico de eventos próprio: a situação de cada aula (`classes.status` e
`class_students.charge`) e os pagamentos já são o histórico do pacote. A aula sem internet da fase
1c envia uma fila de comandos ao voltar a conexão (ADR-009); cada comando é gravado na mesma
transação que aplica o seu efeito.

## Migrações

`MIGRATIONS` em `server/application/schema.ts` é uma lista numerada; o `Group` aplica as que faltam
ao iniciar, cada uma numa transação, e registra em `schema_migrations`. Uma migração publicada nunca
muda: a mudança seguinte é uma migração nova. Remover uma coluna leva duas versões: primeiro o código
para de usar, depois a coluna sai. A classe do Durable Object tem suas próprias migrações no
`wrangler.jsonc` (`tag`), que também só crescem.
