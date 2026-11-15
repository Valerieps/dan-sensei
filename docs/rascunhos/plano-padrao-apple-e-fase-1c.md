# Plano de implementação: padrão Apple e fase 1c

Brief para construir, em sessões do Claude Code coordenadas por uma sessão orquestradora em Sonnet:
- o padrão Apple em todas as telas já prontas (fases 1a e 1b);
- a fase 1c inteira (aula), já no padrão Apple.

- **Entra aqui:**
  - a ordem das sessões e o modelo de cada uma;
  - o prompt de cada sessão;
  - o prompt do orquestrador;
  - as regras para gastar poucos tokens.
- **Não entra aqui:**
  - as regras do app (`docs/spec/`, que vence este plano quando divergem);
  - o desenho visual (ADR-011, `docs/UI.md` e o design system citado no ADR);
  - o que falta construir (`docs/ROADMAP.md`).

Este arquivo é apagado na última sessão (C9).

## Antes de começar

- A identidade visual já está no `tokens.css` (ADR-011). Nenhuma sessão muda os valores dos tokens.
  Uma sessão pode criar um token novo, nos dois temas, quando nenhum servir.
- A aula em dupla segue a proposta A (Metades) do design system. Se a Valéria escolher outra no
  artifact "Propostas da aula em dupla" (link no ADR-011) antes da C6, vale a escolhida.
- O orquestrador para antes da C5 e pergunta à Valéria se o teste no iPad do Dan (issue #7)
  passou. Sem esse teste, o Modo Ao Vivo não começa.

## Como gastar poucos tokens

Cada passo de uma sessão relê a conversa inteira dela. O plano corta tokens assim:

1. **Orquestrador em Sonnet que não lê código.** Ele só inicia as sessões, confere se o PR foi
   mergeado (`gh pr list --state merged --limit 5`, `npm run branches` e `git diff --stat` do merge)
   e inicia a próxima. Ele não abre os arquivos do diff.
2. **Sessões curtas e frescas.** Cada sessão recebe só o seu prompt, que já diz o que ler. Ela não
   vê a conversa do orquestrador, e o prompt diz o que ler e com que limite: só a seção do spec, via
   Grep nos títulos.
3. **Opus só onde um erro custa caro.** As sessões que modelam dados ou desenham a base usam Opus
   (A2, C1, C4, C5): um erro ali custa uma migração ou retrabalho em todas as telas. O resto usa
   Sonnet.
4. **Uma sessão por vez, sempre mergeada antes da próxima.** Os arquivos de registro (`schema.ts`,
   `api-contract.ts`, `group-service.ts`, `strings.ts`, `App.tsx`) são compartilhados, e sessões em
   paralelo gerariam conflitos que custam mais que a espera.
5. **Sem navegador e sem build local.** Cada sessão verifica só com `npm run typecheck`. O CI roda o
   build e os testes, e o `npm run ship` espera o resultado. O navegador só aparece nas sessões de
   fechamento (A7 e C9), e só pelo texto da página.
6. **Revisão de interface em lote.** A skill `ui-review` roda uma vez por bloco, na A7 e na C9, e não
   a cada tela.
7. **Perguntas juntas.** Uma sessão que precisa de resposta da Valéria escreve a pergunta no
   relatório e segue com a proposta do spec. O orquestrador junta as perguntas e faz todas de uma
   vez.

## Como as sessões se dividem

| Ordem | Sessão | Modelo | O que entrega | Depende de |
| --- | --- | --- | --- | --- |
| 1 | A1 | Sonnet | Fechamento da fase 1b (a S12 do plano anterior) e remoção do plano anterior | — |
| 2 | A2 | Opus | Base de componentes no padrão Apple: botões, painel, lista agrupada, controles, faixa, selo, ícones, vidro | A1 |
| 3 | A3 | Sonnet | Navegação: barra de abas (iPad em cima e lateral, celular embaixo), barra de ferramentas com +, títulos grandes, Hoje e Alunos | A2 |
| 4 | A4 | Sonnet | Hoje e Agenda no padrão Apple, com deslizar para Remarcar e Falta | A3 |
| 5 | A5 | Sonnet | Alunos, perfil, Configurações, Membros e Convites no padrão Apple, com o menu de contexto | A4 |
| 6 | A6 | Sonnet | Todos os painéis e formulários no componente de painel | A5 |
| 7 | A7 | Sonnet | Fechamento do padrão Apple: revisão de interface, spec contra código, roadmap | A6 |
| 8 | C1 | Opus | Exercícios, grupos musculares, tags, programas e treinos no domínio e no servidor | A7 |
| 9 | C2 | Sonnet | Telas: aba Exercícios (lista e detalhe), árvore, montagem de treino em cartões | C1 |
| 10 | C3 | Sonnet | Anamnese, alertas de saúde, termo e PAR-Q (domínio, servidor e telas) | C2 |
| 11 | C4 | Opus | Aula no domínio e no servidor: aula aberta, séries, PSE, carga, volume, fila local sem internet (ADR-009) | C3 |
| 12 | C5 | Opus | Modo Ao Vivo individual: tela, cronômetro, cores do momento, som, tela acesa | C4 e issue #7 |
| 13 | C6 | Sonnet | Aula em dupla: duas metades, dois cronômetros, sons por aluno | C5 |
| 14 | C7 | Sonnet | Encerramento: PSE, carga da aula, volume, resumo pelo WhatsApp | C6 |
| 15 | C8 | Sonnet | Aula simples no celular e conferência da aula sem internet | C7 |
| 16 | C9 | Sonnet | Fechamento da fase 1c e remoção deste plano | C8 |

## Regras para toda sessão

Cada sessão filha recebe só o prompt dela e lê esta seção. Ela não vê a conversa do orquestrador.

1. Trabalhe numa worktree nova, criada a partir da `main` atualizada (`git fetch` antes).
2. Siga o `CLAUDE.md`, em especial "Adding a feature" e as regras de segurança e de interface.
   - Leia só as docs que o prompt cita, e delas só a seção que importa (Grep nos títulos `^#`,
     depois Read com `offset` e `limit`).
   - Toda tela segue a seção "Padrão Apple" do `docs/UI.md`.
   - Para ver o desenho de um componente, leia só o `README.md` e o `preview.html` dele no design
     system (Artifact `read` do link no ADR-011, com `path` do componente). Nunca leia o design
     system inteiro.
3. Toda regra nova ou alterada ganha testes unitários. Verifique só com `npm run typecheck`.
4. Envie com `npm run ship -- "<mensagem em inglês>"`. Se o CI falhar, corrija e rode o ship de novo
   até o merge. Nunca rode os passos do `gh pr` à mão.
5. Faltou uma regra de negócio: não pare.
   - Se a regra está no "Em aberto" do spec com uma proposta, siga a proposta.
   - Se não está, decida, escreva a regra no `docs/spec/` e liste-a em "Revisar as lacunas que o
     agente decidiu" no `docs/ROADMAP.md`.
6. Tire do `docs/ROADMAP.md` as linhas que ficaram prontas. Acerte o `docs/ARQUITETURA.md` se as
   tabelas mudaram.
7. Não mude os valores do `tokens.css` nem afrouxe testes. Não use o navegador (só A7 e C9).
8. Os textos da interface ficam em `src/domain/strings.ts`, com os termos do `docs/GLOSSARIO.md`.
9. Achou um problema fora do escopo? Abra uma issue (`t:bug` ou `t:debito-tecnico`, com `p:` e `s:`)
   e não conserte.
10. Termine com um relatório de no máximo 10 linhas:
    - o link do PR mergeado;
    - o que ficou fora;
    - as lacunas que decidiu;
    - as issues que abriu;
    - as perguntas para a Valéria.

## Prompts das sessões

Cada prompt é o texto inteiro que o orquestrador manda para a sessão filha.

### A1: fechamento da fase 1b (Sonnet)

> Leia `docs/rascunhos/plano-padrao-apple-e-fase-1c.md` (seção "Regras para toda sessão") e a seção
> "S8" e "S12" de `docs/rascunhos/plano-fases-1a-1b.md`. Faça o fechamento da fase 1b como a S12
> descreve: revise as regras *(1b)* do spec contra o código, acerte o `docs/ROADMAP.md` e abra
> issues para o que faltar. Depois, apague `docs/rascunhos/plano-fases-1a-1b.md` e a linha dele em
> `docs/rascunhos/README.md`. Não mexa em telas: o padrão Apple vem nas próximas sessões.
> Pronto quando: o PR está mergeado e o plano antigo não existe mais.

### A2: base de componentes no padrão Apple (Opus)

> Leia a seção "Regras para toda sessão" do plano, o ADR-011, a seção "Padrão Apple" do
> `docs/UI.md`, o `tokens.css` e `src/ui/components/`. No design system, leia só os componentes
> Botao, Controles, Lista, Painel, Faixa e Selo. Faça, em `src/ui/components/`, usando só tokens:
> - `Button` e `ButtonLink` em cápsula, com os estilos principal, secundário e texto, os tamanhos
>   normal e grande, o estado pressionado e o botão redondo de ícone em vidro.
> - `Sheet`: o painel. No celular sobe de baixo, com alça, altura média e grande, e fecha ao
>   deslizar. No iPad abre no centro. Tem cabeçalho com Cancelar (×) e salvar (✓) e fundo
>   `--color-scrim`. Foco preso dentro e Esc fecha.
> - `GroupedList`, `ListRow` (título, subtítulo, valor, seta, ícone) e `ListSection` (cabeçalho e
>   rodapé).
> - `SegmentedControl` (com papel de grupo de rádio), `Switch` (com `role="switch"`) e `Stepper`.
> - `Badge`, o selo: cápsula, em `danger`, `health`, `brand` ou neutro.
> - `PackageProgress` como a faixa em gomos de cápsula, com barra contínua acima de 20 aulas.
> - `Icon`: um módulo de SVG no estilo dos SF Symbols, com traço e versão preenchida para as abas, e
>   `aria-hidden` quando há texto ao lado.
> - `ConfirmDialog`: a caixa de confirmação de ação destrutiva.
> - `Field` e `SelectField` com o visual de campo do iOS. `Notice` sem borda colorida.
>
> Ajuste o `global.css` para a letra do sistema e as áreas seguras, e faça o vidro virar fundo
> opaco com `prefers-reduced-transparency`. Se o texto puder seguir o tamanho de letra escolhido no
> aparelho (`font: -apple-system-body` com `rem`) sem quebrar o `tokens.test.ts`, faça. Se não
> puder, registre num ADR por que não. As telas existentes podem continuar com o visual antigo onde
> ainda não usam os componentes novos, mas o typecheck e os testes passam. Atualize a lista de
> componentes no `docs/UI.md` e no `CLAUDE.md`.
> Pronto quando: os componentes estão na `main`, com testes do que tiver lógica (o painel, o
> controle segmentado e a faixa).

### A3: navegação no padrão Apple (Sonnet)

> Leia a seção "Regras para toda sessão" do plano e a seção "Navegação" de
> `docs/spec/telas-de-gestao.md`. No design system, leia só os componentes EstruturaIPad e
> EstruturaIPhone. Troque o menu lateral e a barra com + pela navegação do spec:
> - No iPad, uma barra de abas em vidro no topo (Hoje, Agenda, Alunos; Exercícios entra na C2), com
>   um botão que a transforma em barra lateral. A barra lateral mostra também Configurações e o
>   estado da sincronização.
> - No celular, uma barra de abas flutuante embaixo, com Hoje, Agenda e Alunos.
> - Uma barra de ferramentas em cada aba: + (menu na ordem do spec), busca e, em Hoje, a
>   engrenagem de Configurações.
> - Um título grande em cada aba.
> - "Início" passa a se chamar "Hoje", e "Alunos e pacotes" passa a se chamar "Alunos", em
>   `strings.ts` e no `GLOSSARIO.md`. As rotas continuam as mesmas.
> - A logomarca sai das telas de gestão.
>
> Pronto quando: as três abas e o + funcionam no celular e no iPad, e a linha "As telas ainda usam
> menu lateral" sai do `docs/ROADMAP.md`.

### A4: Hoje e Agenda (Sonnet)

> Leia a seção "Regras para toda sessão" do plano, as seções "Hoje" e "Navegação" de
> `docs/spec/telas-de-gestao.md` e `docs/spec/agenda.md` (só o que diz respeito à tela). No design
> system, leia só LinhaDoTempo. Passe a aba Hoje e a Agenda para os componentes da A2:
> - Linha do tempo em cartões (`--radius-card`), com a aula agora contornada em `--color-brand`.
> - Horário livre em faixa hachurada, com o tempo escrito.
> - Os jeitos de começar num controle segmentado. Até a 1c, fica só "Marcar como dada".
> - "Precisa de atenção" como lista agrupada.
> - Agenda com Dia e Semana num controle segmentado.
> - Deslizar uma aula para a esquerda mostra Remarcar e Falta, e cada uma tem também um botão
>   acessível pelo teclado.
>
> Pronto quando: as duas abas usam só os componentes novos.

### A5: Alunos, perfil e Configurações (Sonnet)

> Leia a seção "Regras para toda sessão" do plano e as seções "Alunos" e "Perfil do aluno" de
> `docs/spec/telas-de-gestao.md`. No design system, leia só CartaoAluno e Lista. Passe para os
> componentes da A2:
> - A aba Alunos, com cartões sem borda, iniciais, selo, faixa e filtros num controle segmentado.
>   Tocar e segurar o cartão abre o menu de contexto (Remarcar, Registrar pagamento, Mandar extrato),
>   que também tem um botão acessível.
> - O perfil, com o cabeçalho e as abas em listas agrupadas.
> - Configurações, Membros e Convites, em listas agrupadas.
>
> Pronto quando: essas telas usam só os componentes novos.

### A6: painéis e formulários (Sonnet)

> Leia a seção "Regras para toda sessão" do plano e a seção "Navegação" de
> `docs/spec/telas-de-gestao.md`. No design system, leia só Painel e Controles. Passe todas as telas
> de ação curta para o `Sheet` da A2:
> - registrar pagamento, novo pacote e renovação, pausar pacote;
> - registrar aula, registrar mensalidade, nova aula, detalhe da aula, cadastro do aluno.
>
> Use o controle segmentado e o interruptor no lugar de select e checkbox quando houver de 2 a 4
> opções. Ações destrutivas passam a usar o `ConfirmDialog`.
> Pronto quando: nenhuma tela de ação curta abre fora do `Sheet`.

### A7: fechamento do padrão Apple (Sonnet)

> Leia a seção "Regras para toda sessão" do plano. Rode a skill `ui-review` em todas as telas, contra
> o `docs/UI.md`. Conserte o que for regra quebrada e abra issue para o que for julgamento. Confira o
> spec de `telas-de-gestao.md` contra o código e acerte o `docs/ROADMAP.md`. Abra o app com
> `npm run dev` e o login de teste, e leia o texto de cada aba (só texto, sem capturas de tela). No
> relatório, liste o que a Valéria e o Dan precisam conferir no iPad e no celular.
> Pronto quando: o PR está mergeado e o roadmap não tem mais linhas do padrão Apple.

### C1: exercícios e treinos no servidor (Opus)

> Leia a seção "Regras para toda sessão" do plano, `docs/spec/treinos-e-exercicios.md` inteiro e o
> `docs/ARQUITETURA.md`. No domínio e no servidor, crie:
> - a biblioteca de exercícios, com grupos musculares (primário e secundário), tags funcionais e
>   incremento de carga;
> - a árvore de grupos (glúteo, quadríceps, e assim por diante);
> - os programas e os treinos A, B e C, com séries, faixa de repetições, carga sugerida, descanso,
>   método, RIR ou PSE-alvo, bi-set e circuito;
> - "Exercício sem músculos" como aviso.
>
> Inclua as migrações, as consultas e os comandos, com testes no `node:sqlite`. Não faça telas.
> Pronto quando: o servidor tem tudo o que as telas da C2 vão chamar.

### C2: telas de exercícios e montagem de treino (Sonnet)

> Leia a seção "Regras para toda sessão" do plano e `docs/spec/treinos-e-exercicios.md`. No design
> system, leia só Lista e Controles. Faça:
> - A aba Exercícios no iPad (fora do celular), com lista e detalhe lado a lado, busca, filtros por
>   tag e "Criar exercício".
> - A árvore de grupos musculares, que a C5 reusa no "Acrescentar exercício".
> - A montagem de treino em cartões com + e −, cartões compactos que abrem ao toque, e bi-set
>   unido por uma faixa lateral. Ela abre no perfil, na aba Treinos.
>
> Pronto quando: monto o Treino B de um aluno sem digitar, a não ser os números.

### C3: saúde, termo e PAR-Q (Sonnet)

> Leia a seção "Regras para toda sessão" do plano, `docs/spec/termo-e-lgpd.md` e as seções de
> anamnese e alertas de `docs/spec/alunos.md`. Faça o domínio, o servidor e as telas (painel e lista
> agrupada):
> - termo e PAR-Q, com a assinatura no iPad e a versão do termo;
> - anamnese;
> - alertas de saúde, com o selo `health` e o ícone de escudo;
> - a regra "sem termo assinado, não guarda anamnese".
>
> Pronto quando: os alertas aparecem no perfil, em Hoje e nos cartões.

### C4: a aula no domínio e no servidor (Opus)

> Leia a seção "Regras para toda sessão" do plano, `docs/spec/aula-ao-vivo.md` inteiro, o
> ADR-009 e o `docs/ARQUITETURA.md`. Crie no domínio e no servidor:
> - a aula aberta: iniciar com o treino, repetir a última ou aula livre; sair e voltar; encerrar e
>   encerrar agora;
> - o registro das séries, com a carga anterior calculada e a alternância em bi-set e circuito;
> - a PSE, a carga da aula (método de Foster) e o volume por grupo;
> - o desconto no pacote e a correção de aula encerrada.
>
> Faça também a fila local de comandos do ADR-009, para a aula funcionar sem internet, com
> idempotência e testes de reenvio. Não faça a tela do Modo Ao Vivo.
> Pronto quando: um teste roda uma aula inteira sem internet e o servidor recebe tudo uma vez só.

### C5: Modo Ao Vivo individual (Opus)

> Leia a seção "Regras para toda sessão" do plano, `docs/spec/aula-ao-vivo.md` (Modo Ao Vivo e
> Cronômetro) e a seção "Padrão Apple" do `docs/UI.md`. No design system, leia só AoVivoIndividual,
> Botao e o `modo-ao-vivo.md`. Faça a tela cheia, com cabeçalho e base fixos e o centro trocando
> entre série e descanso:
> - no descanso, a tela inteira fica em `--color-live-rest`, com o tempo em `--font-rounded` o maior
>   possível;
> - a faixa do próximo intervalo cresce nos 10 s finais;
> - +15 s e −15 s;
> - "Série feita" e "Pular descanso" ficam no mesmo lugar;
> - "Acrescentar exercício" usa a árvore da C2, e "Trocar exercício" troca o exercício;
> - a tela não apaga (Screen Wake Lock) e o som é liberado no primeiro toque;
> - com `prefers-reduced-motion`, as trocas são instantâneas.
>
> Os números da escala do Ao Vivo entram no `tokens.css` como tokens novos
> (`--font-size-display-live-*`). Ligue o "Iniciar aula" de Hoje, da Agenda e do perfil.
> Pronto quando: dou uma aula individual inteira no iPad.

### C6: aula em dupla (Sonnet)

> Leia a seção "Regras para toda sessão" do plano e a seção "Aula em dupla" de
> `docs/spec/aula-ao-vivo.md`. No design system, leia só AoVivoDupla (ou a proposta escolhida, se o
> orquestrador avisar). Faça as duas metades, cada uma com seu momento e seu cronômetro. Cada lado se
> identifica pelo nome, pela forma (● e ■) e pelo som escolhido na preparação: bipes, apito ou
> palavras. Reuse as peças da C5.
> Pronto quando: dou uma aula em dupla com os dois em ritmos diferentes.

### C7: encerramento (Sonnet)

> Leia a seção "Regras para toda sessão" do plano, as seções "Encerramento" e "Volume" de
> `docs/spec/aula-ao-vivo.md` e o resumo da aula em `docs/spec/whatsapp.md`. No design system, leia
> só EscalaPSE. Faça:
> - a escala de esforço, com 11 teclas e uma linha por aluno na dupla;
> - a carga da aula e o volume do dia;
> - as pendências;
> - "Enviar resumo" pelo WhatsApp, destacando o que melhorou.
>
> Pronto quando: encerro a aula e mando o resumo.

### C8: aula simples no celular (Sonnet)

> Leia a seção "Regras para toda sessão" do plano e a seção "Sem internet e sem iPad" de
> `docs/spec/aula-ao-vivo.md`. Faça a aula simples no celular:
> - lista de exercícios, "Série feita", carga com + e −;
> - o cronômetro na cor do momento;
> - na dupla, um aluno por vez, trocando no topo;
> - só busca, sem a árvore;
> - PSE e resumo no fim.
>
> Confira que a aula do iPad e a do celular gravam sem internet e enviam ao voltar.
> Pronto quando: dou uma aula pelo celular em modo avião e ela aparece no iPad depois.

### C9: fechamento da fase 1c (Sonnet)

> Leia a seção "Regras para toda sessão" do plano. Faça para as regras *(1c)* o mesmo fechamento da
> A7: rode `ui-review` no Modo Ao Vivo e nas telas novas, confira o spec contra o código e acerte o
> roadmap. Depois apague este plano e a linha dele em `docs/rascunhos/README.md`. No relatório,
> liste o que conferir no iPad do Dan, as lacunas decididas e as issues abertas.
> Pronto quando: o PR está mergeado.

## Prompt do orquestrador

Abra uma sessão nova no app do Claude (aba Code), na pasta do repositório, com o modelo **Sonnet**,
e cole:

> Você é o orquestrador do padrão Apple e da fase 1c do Dan Sensei. Leia só
> `docs/rascunhos/plano-padrao-apple-e-fase-1c.md` e o `CLAUDE.md`. Você não escreve código e não
> abre arquivos de código: você inicia as sessões, confere o resultado e inicia a próxima.
>
> Para cada sessão da tabela "Como as sessões se dividem", na ordem:
> 1. Inicie a sessão com `start_session` (initiation "user_asked", context "fresh", worktree
>    própria), com o modelo da tabela. O prompt é o texto da seção dela em "Prompts das sessões",
>    sem mudar nada.
> 2. Espere o aviso de que a sessão terminou o turno, sem ficar consultando.
> 3. Confira o resultado de verdade, e não só o relatório:
>    - o PR está mergeado (`gh pr list --state merged --limit 5`);
>    - `npm run branches` não mostra a branch dela pendente;
>    - `git diff --stat` do merge mostra arquivos que batem com o "Pronto quando".
> 4. Se faltou algo, mande uma mensagem para a mesma sessão dizendo o que falta e espere de novo.
>    Guarde as perguntas para a Valéria: faça todas de uma vez, ao fim do bloco A ou antes da C5.
> 5. Com a sessão mergeada, faça `git pull` na `main` e passe para a próxima.
>
> Depois da A7, me avise que o padrão Apple está pronto, com a lista de conferência da A7, e siga
> para a C1 sem esperar. Antes da C5, pare e me pergunte:
> - se o teste no iPad (issue #7) passou;
> - qual proposta da aula em dupla vale.
>
> Repasse a resposta da dupla para a C6. Se uma sessão falhar duas vezes na mesma coisa, pare e me
> conte. No fim, me dê um resumo: os PRs, as lacunas decididas (do `docs/ROADMAP.md`) e as issues
> abertas.
