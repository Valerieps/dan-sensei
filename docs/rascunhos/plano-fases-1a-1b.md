# Plano de implementação: fases 1a e 1b

Brief para construir as fases 1a (pacotes) e 1b (agenda) em sessões do Claude Code, coordenadas por
uma sessão orquestradora em Sonnet.

- **Entra aqui:** a ordem das sessões, o modelo de cada uma, o prompt de cada uma e o prompt do
  orquestrador.
- **Não entra aqui:** as regras do app (`docs/spec/`, que vence este plano quando divergem), o
  desenho das tabelas (`docs/ARQUITETURA.md`) e o que falta construir (`docs/ROADMAP.md`).

Este arquivo é apagado quando a fase 1b terminar (sessão S12).

## Antes de começar

Nada aqui bloqueia o código: toda sessão testa localmente com o login de teste (ADR-007). Mas para o
Dan usar a fase 1a em produção, a Valéria precisa fechar antes:

- Issues #2, #3 e #4 (Google Cloud, segredos e deploy no Cloudflare).
- Issue #6 (identidade visual), de preferência antes da S5. As telas usam só tokens, então trocar a
  identidade depois muda só os valores do `tokens.css`.

## Como as sessões se dividem

Os arquivos de registro (`schema.ts` com `MIGRATIONS`, `api-contract.ts`, `group-service.ts`,
`strings.ts`, `App.tsx`) são compartilhados por quase toda feature. Duas sessões que mexem neles ao
mesmo tempo geram conflito de merge e números de migração repetidos. Por isso as sessões rodam **uma
de cada vez**, cada uma mergeada antes da próxima começar. A única exceção é a onda 1: a S1 mexe só
em arquivos novos de `src/domain/pacotes/`.

| Onda | Sessão | Modelo | O que entrega | Depende de |
| --- | --- | --- | --- | --- |
| 1 | S1 | Opus | Regras puras de pacote (saldo, validade, pausas, renovação, urgência) com testes | — |
| 1 | S2 | Sonnet | Navegação do app (menu lateral e celular) e cadastro de alunos | — |
| 2 | S3 | Opus | Servidor de pacotes: tabelas, comandos e consultas | S1, S2 |
| 3 | S4 | Sonnet | Telas: Alunos e pacotes, novo pacote, renovação, aula dada e falta, saldo inicial | S3 |
| 4 | S5 | Sonnet | Telas: pagamentos, pausas, "pausar todos" e planos | S4 |
| 5 | S6 | Sonnet | Mensalistas e mensalidades | S5 |
| 6 | S7 | Sonnet | WhatsApp (extrato e renovação), configurações, exportação e "sair dos aparelhos" | S6 |
| 7 | S8 | Sonnet | Fechamento da fase 1a: revisão de interface, spec contra código, roadmap | S7 |
| 8 | S9 | Opus | Agenda no domínio e no servidor: horários fixos, remarcação, cancelamento, previsão | S8 |
| 9 | S10 | Sonnet | Tela Agenda: grade do dia, semana, arrastar e remarcar | S9 |
| 10 | S11 | Sonnet | Início com a linha do tempo, confirmação de aulas e lembrete de mensalidade | S10 |
| 11 | S12 | Sonnet | Fechamento da fase 1b e remoção deste plano | S11 |

Opus fica com as três sessões de modelagem (regras de saldo, servidor de pacotes e agenda), onde um
erro custa uma migração. As telas, as revisões e o trabalho de registro ficam com Sonnet, como pede o
`CLAUDE.md`.

## Regras para toda sessão

Cada sessão filha recebe só o prompt dela e lê este arquivo. Ela não vê a conversa do orquestrador.

1. Trabalhe numa worktree nova, criada a partir da `main` atualizada (`git fetch` antes).
2. Siga o `CLAUDE.md`, em especial "Adding a feature", as regras de segurança e as de interface. Leia
   só as docs que a tarefa pede.
3. Toda regra nova ou alterada ganha testes unitários. Verifique só com `npm run typecheck`: o CI roda
   o build e os testes no PR, e o `npm run ship` espera o resultado.
4. Envie com `npm run ship -- "<mensagem em inglês>"`. Se o CI falhar, corrija e rode o ship de novo
   até o merge. Nunca rode os passos do `gh pr` à mão.
5. Faltou uma regra de negócio: não pare. Se ela está no "Em aberto" do spec com uma proposta, siga a
   proposta. Se não está, decida, escreva a regra no arquivo de `docs/spec/` e liste em "Revisar as
   lacunas que o agente decidiu" no `docs/ROADMAP.md`. Pare só se a dúvida impedir o trabalho, e aí
   escreva a pergunta no relatório final.
6. Tire do `docs/ROADMAP.md` as linhas que ficaram prontas, e acerte o `docs/ARQUITETURA.md` se as
   tabelas mudaram em relação ao desenho.
7. Não mude os valores do `tokens.css` (identidade visual é a issue #6) nem afrouxe testes. Não use o
   navegador.
8. Textos da interface em `src/domain/strings.ts`, em português, com os termos do
   `docs/GLOSSARIO.md` ("aula", nunca "sessão").
9. Achou outro problema fora do escopo? Abra uma issue (`t:bug` ou `t:debito-tecnico`, com `p:` e
   `s:`) e não conserte.
10. Termine com um relatório curto: o link do PR mergeado, o que ficou fora, as lacunas que você
    decidiu e as issues que abriu.

## Prompts das sessões

Cada prompt é o texto inteiro que o orquestrador manda para a sessão filha.

### S1: regras puras de pacote (Opus)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão") e
> `docs/spec/pacotes-e-pagamentos.md` e `docs/spec/mensalistas.md` inteiros. Crie em
> `src/domain/pacotes/` as regras puras de pacote, sem acesso a banco, rede ou React, com testes
> unitários cobrindo cada regra e cada exemplo do spec:
> - Situação do pacote: aguardando início, ativo, vencido, esgotado, encerrado.
> - Saldo: usadas (aulas dadas + faltas cobradas + "usadas antes do app"), restantes, total com as
>   aulas transferidas.
> - Validade: começa na primeira aula que consome; soma os dias de pausa; o limite de 30 dias por
>   pacote, que só passa com motivo; a pausa geral ("pausar todos") não conta no limite. Datas no fuso
>   `America/Sao_Paulo`.
> - Renovação: quantas aulas transferir e a anotação do pacote encerrado.
> - Pagamento: pago ou pendente a partir da soma dos pagamentos, em centavos.
> - Ordem de urgência da tela Alunos e pacotes, com as exceções do Avulso e dos mensalistas.
> - Mensalidade pendente a partir do dia de vencimento e do último mês pago.
> - De que pacote uma aula desconta (aluno sozinho, dupla, aluno da dupla com pacote próprio, "sem
>   pacote" quando esgotado).
>
> Não mexa em `schema.ts`, `api-contract.ts`, `group-service.ts`, `strings.ts` nem em `src/ui/`:
> outra sessão está mexendo neles agora. Exporte tipos simples que o servidor e as telas possam usar.
> Pronto quando: as regras e os testes estão na `main`.

### S2: navegação e cadastro de alunos (Sonnet)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão"), `docs/spec/alunos.md`
> (só o que é *(1a)*) e `docs/spec/telas-de-gestao.md`. Faça:
> - A navegação do app: menu lateral no iPad na horizontal, com as entradas Alunos e pacotes, Membros
>   e Convites; no celular, uma barra embaixo e o botão + (só com as ações que já existirem; as outras
>   entram nas sessões seguintes). Troque a tela de exemplo `Home` e apague `src/domain/greeting.ts` e
>   o teste dele. A primeira tela passa a ser a lista de alunos, provisória até a S4 fazer os cartões.
> - Cadastro do aluno: a tabela `students` e `student_addresses` (próximas entradas de `MIGRATIONS`;
>   ver `docs/ARQUITETURA.md`), os comandos criar, editar e mudar status, e as consultas.
> - Perfil do aluno com cabeçalho (nome, iniciais) e abas: Cadastro e Notas, com espaço para as abas
>   das próximas sessões. Notas livres editáveis.
>
> Não crie nada em `src/domain/pacotes/`: outra sessão está criando essa pasta agora.
> Pronto quando: consigo cadastrar, editar, inativar e anotar um aluno, no iPad e no celular.

### S3: servidor de pacotes (Opus)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão"),
> `docs/spec/pacotes-e-pagamentos.md`, `docs/ARQUITETURA.md` e as regras em `src/domain/pacotes/`. No
> servidor, crie as tabelas `plans` (com os quatro planos de fábrica), `packages`, `package_pauses`,
> `global_pauses`, `payments`, `classes` e `class_students`, e os comandos e consultas:
> - Planos: listar, criar, editar.
> - Pacote: criar a partir de um plano (com titular e participante opcional), com a transferência das
>   aulas que sobraram e o encerramento do anterior numa transação só.
> - Saldo inicial: criar pacote com aulas "usadas antes do app" e data da primeira aula.
> - Registrar aula dada ou falta (cobrada ou abonada) à mão, com data e 1 ou 2 alunos, escolhendo de
>   que pacote desconta; ligar uma aula "sem pacote" ao pacote seguinte.
> - Pausa de um pacote (com motivo acima de 30 dias) e "pausar todos".
> - Pagamentos: registrar, corrigir, apagar.
> - Consultas: a lista de Alunos e pacotes já na ordem de urgência e com os números do mês, e o
>   extrato de um pacote (aulas, pausas, pagamentos, transferências).
>
> Todo cálculo de saldo, validade e situação usa `src/domain/pacotes/`; nada de saldo gravado.
> Crie os `Topic` novos. Testes de cada caso de uso sobre `node:sqlite`. Sem telas nesta sessão.
> Pronto quando: os comandos e consultas estão na `main` com testes.

### S4: telas de pacotes (Sonnet)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão"),
> `docs/spec/telas-de-gestao.md`, `docs/spec/pacotes-e-pagamentos.md` e `docs/UI.md`. Usando os
> comandos e consultas que já existem no servidor, faça:
> - A tela Alunos e pacotes em cartões com barra de progresso, na ordem de urgência, com vermelho só
>   para urgência, os números do mês no topo e a opção "esconder valores" (proposta do "Em aberto").
> - A aba Pacotes do perfil: pacote atual, extrato e pacotes anteriores.
> - Novo pacote e renovação, com o aviso "N aulas do pacote anterior serão transferidas".
> - Registrar aula dada ou falta, para 1 ou 2 alunos, com o aviso de pacote pendente ou esgotado.
> - Saldo inicial.
>
> Use os componentes de `src/ui/components/` antes de criar CSS novo; quando um padrão se repetir em
> duas telas, crie um componente. Todo estado vazio diz o que fazer em seguida.
> Pronto quando: consigo cadastrar o saldo inicial de um aluno, registrar aulas e renovar com
> transferência, e a tela mostra tudo na ordem certa.

### S5: pagamentos, pausas e planos (Sonnet)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão"),
> `docs/spec/pacotes-e-pagamentos.md` (Pagamentos, Pausas, Planos) e `docs/spec/telas-de-gestao.md`.
> Faça as telas, usando o que já existe no servidor:
> - Registrar, corrigir e apagar pagamento (PIX, dinheiro, cartão), no perfil e pelo botão + do
>   celular ("Registrar pagamento" em primeiro).
> - Pausar um pacote, com o motivo obrigatório acima de 30 dias.
> - "Pausar todos os pacotes", numa tela de configurações.
> - Planos: listar, criar e editar, na mesma tela de configurações.
>
> Pronto quando: um pacote pendente vira pago, uma pausa estende a validade e a pausa geral não conta
> no limite de 30 dias de ninguém.

### S6: mensalistas (Sonnet)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão") e
> `docs/spec/mensalistas.md` (só o que é *(1a)*). Crie `monthly_fees` e `monthly_payments`, os
> comandos (valor e dia de vencimento do aluno, registrar mensalidade paga, saldo inicial do
> mensalista) e as consultas, usando a regra de mensalidade pendente de `src/domain/pacotes/`. Nas
> telas: o mensalista aparece em Alunos e pacotes sem barra de progresso, com "mensalidade pendente"
> quando for o caso; a aba Mensalidades no perfil; "Registrar mensalidade" no botão + do celular.
> Pronto quando: um mensalista com o mês em atraso aparece como pendente e deixa de aparecer ao
> registrar o pagamento.

### S7: WhatsApp, configurações e exportação (Sonnet)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão"),
> `docs/spec/whatsapp.md`, ADR-008, `docs/SEGURANCA.md` e `docs/spec/termo-e-lgpd.md`. Faça:
> - Configurações: chave PIX e os modelos de texto das mensagens, editáveis.
> - O extrato do pacote e o parágrafo de renovação (menos de 4 aulas ou menos de 7 dias), abertos
>   como link `wa.me` com o texto pronto, só para o titular. Monte o texto numa função pura em
>   `src/domain/`, com testes, incluindo o caso das aulas transferidas e a garantia de que nenhum dado
>   de saúde entra.
> - `message_log`: o app marca a mensagem como aberta e mostra quem ainda não recebeu o extrato da
>   última aula.
> - Exportação completa dos dados em planilha (CSV por tabela, num arquivo `.zip` ou em arquivos
>   separados; escolha o mais simples sem dependência nova).
> - "Sair de todos os aparelhos", para um iPad ou celular perdido, se o template ainda não tiver.
>
> Pronto quando: o extrato abre no WhatsApp com o texto certo e a exportação baixa todos os dados.

### S8: fechamento da fase 1a (Sonnet)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão"). A fase 1a acabou de
> ser construída. Faça:
> - Rode a skill `ui-review` sobre as telas da fase 1a e corrija o que for de interface.
> - Compare cada regra *(1a)* de `docs/spec/` com o código. Corrija o que for pequeno; o que for
>   grande vira linha em "O código ainda não segue o spec" do `docs/ROADMAP.md` ou uma issue.
> - Confira que nenhuma linha *(1a)* pronta ficou no roadmap.
> - No relatório, liste para a Valéria o que ela precisa conferir no iPad do Dan antes de ele cadastrar
>   o saldo inicial, e as lacunas decididas nesta fase.
>
> Pronto quando: o PR está mergeado e o relatório lista o que conferir.

### S9: agenda no domínio e no servidor (Opus)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão"), `docs/spec/agenda.md`,
> `docs/spec/pacotes-e-pagamentos.md` (Aula dada e falta), `docs/ARQUITETURA.md` e o código de
> `classes` e `class_students` feito na fase 1a. Faça:
> - `recurrences` (horário fixo) e a geração das aulas agendadas. Decida e registre num ADR quanto à
>   frente as aulas são geradas e quando (no comando, no cron ou na leitura).
> - Aula avulsa, 1 ou 2 alunos, endereço do cadastro ou outro endereço do aluno, duração de até 60 min.
> - Remarcar com vínculo à aula original, "só esta" e "esta e as seguintes".
> - Cancelar: com 24 h ou mais vira cancelada; com menos, cobrar ou abonar, com "cobrar"
>   pré-selecionado; falta sem aviso sugere falta cobrada. Datas e horas no fuso `America/Sao_Paulo`.
> - Marcar aula como dada a partir da agenda, consumindo o pacote pelas regras da fase 1a.
> - Previsão de validade: a data prevista da última aula do pacote contra o vencimento, e o vencimento
>   previsto do pacote aguardando início.
> - Confirmação: marcar a aula como confirmada.
> - Consultas para a grade do dia, a semana e o Início.
>
> Regras puras em `src/domain/`, com testes; casos de uso com testes sobre `node:sqlite`. Sem telas.
> Pronto quando: os comandos e consultas estão na `main` com testes.

### S10: tela Agenda (Sonnet)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão"), `docs/spec/agenda.md`
> e `docs/UI.md`. Usando o que já existe no servidor, faça a tela Agenda:
> - O dia em grade de horas como padrão, com os horários livres visíveis e o intervalo entre aulas; a
>   visão da semana.
> - A cor da aula pela situação (agendada, dada, falta), sem usar o vermelho de cobrança nem o âmbar de
>   saúde; a situação também em texto, nunca só na cor.
> - Arrastar para remarcar, e remarcar tocando na aula em até 3 toques, com "só esta" ou "esta e as
>   seguintes".
> - Nova aula avulsa e novo horário fixo; "Nova aula" no botão + do celular.
> - Cancelar e registrar falta com as perguntas do spec.
> - A previsão de validade no cartão do aluno quando a última aula cai depois do vencimento.
>
> Arrastar precisa funcionar com o dedo no iPad e ter uma alternativa por toque (acessibilidade).
> Pronto quando: monto a semana de um aluno com horário fixo, remarco uma aula arrastando e cancelo
> outra com menos de 24 h.

### S11: Início, confirmação e lembrete de mensalidade (Sonnet)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão"),
> `docs/spec/telas-de-gestao.md` (Início e Celular), `docs/spec/agenda.md` (Confirmação),
> `docs/spec/mensalistas.md` e `docs/spec/whatsapp.md`. Faça:
> - O Início como linha do tempo do dia, com a aula agora ou a próxima destacada, e "Precisa de
>   atenção" embaixo. Ele vira a primeira tela do app. No celular, o mesmo em uma coluna.
> - "Iniciar aula" ainda não existe (fase 1c): no lugar, "Marcar como dada".
> - "Confirmar aulas de amanhã": abre o WhatsApp de cada aluno escolhido com a mensagem pronta; um
>   toque marca a aula como confirmada; quem não confirmou fica em destaque no dia seguinte.
> - A pergunta de mensalidade no dia do vencimento (registrar ou enviar lembrete), e de novo no cartão
>   de cada aula do aluno enquanto estiver pendente.
> - A próxima aula nos cartões de Alunos e pacotes.
>
> Pronto quando: abro o app de manhã e vejo o dia, quem precisa de atenção e quem ainda não confirmou.

### S12: fechamento da fase 1b (Sonnet)

> Leia `docs/rascunhos/plano-fases-1a-1b.md` (seção "Regras para toda sessão"). A fase 1b acabou de
> ser construída. Faça o mesmo fechamento da S8 para as regras *(1b)*. Depois apague este plano e a
> linha dele em `docs/rascunhos/README.md`. No relatório, liste o que a Valéria e o Dan precisam
> conferir no iPad e no celular, as lacunas decididas e as issues abertas nas fases 1a e 1b.
> Pronto quando: o PR está mergeado.

## Prompt do orquestrador

Abra uma sessão nova no app do Claude (aba Code), na pasta do repositório, com o modelo **Sonnet**,
e cole:

> Você é o orquestrador das fases 1a e 1b do Dan Sensei. Leia `docs/rascunhos/plano-fases-1a-1b.md`
> inteiro e o `CLAUDE.md`. Você não escreve código: você inicia as sessões, confere o resultado e
> inicia a próxima.
>
> Para cada onda da tabela "Como as sessões se dividem", na ordem:
> 1. Inicie cada sessão da onda com `start_session` (initiation "user_asked", context "fresh",
>    worktree própria), com o modelo da tabela e, como prompt, o texto da seção "Prompts das sessões"
>    dela, sem mudar nada. Na onda 1, inicie S1 e S2 juntas; nas outras, uma por vez.
> 2. Espere o aviso de que a sessão terminou o turno. Não fique consultando.
> 3. Confira o resultado de verdade, não só o relatório: o PR está mergeado
>    (`gh pr list --state merged --limit 5`), `npm run branches` não mostra a branch dela pendente, e
>    o "Pronto quando" do prompt foi atendido pelo que o diff mostra.
> 4. Se faltou algo, mande uma mensagem para a mesma sessão dizendo o que falta, e espere de novo.
>    Se a sessão parou com uma pergunta de regra de negócio que ela não podia decidir, junte as
>    perguntas e me pergunte de uma vez, depois repasse a resposta para ela.
> 5. Com a onda mergeada, faça `git pull` na `main` e passe para a próxima.
>
> Depois da S8, me avise que a fase 1a está pronta para o Dan usar, com a lista de conferência do
> relatório da S8, e siga para a fase 1b sem esperar. Se uma sessão falhar duas vezes na mesma coisa,
> pare e me conte. No fim, me dê um resumo: os PRs, as lacunas decididas (do `docs/ROADMAP.md`) e as
> issues abertas.
