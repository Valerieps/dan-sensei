# Plano: teste do iPad do Dan (issue #7)

Brief para construir, em sessões do Claude Code coordenadas por uma sessão orquestradora, a tela que
o Dan usa no iPad para provar o que a fase 1c precisa (issue #7), e para transformar o resultado no
que falta construir.

- **Entra aqui:**
  - o que a tela de teste faz, etapa por etapa, e o texto que o Dan lê;
  - o registro (log) do teste e o relatório em Markdown que o Dan envia pelo WhatsApp;
  - o que cada resultado decide para a fase 1c ("O que depende do teste");
  - a ordem das sessões, o modelo de cada uma, os prompts e o prompt do orquestrador.
- **Não entra aqui:**
  - as regras da aula (`docs/spec/aula-ao-vivo.md`, que vence este plano quando divergem);
  - as sessões C5 a C9 (`plano-padrao-apple-e-fase-1c.md`);
  - o desenho visual (ADR-011, `docs/UI.md`).

Este arquivo é apagado quando a issue #7 fecha e a sessão T6 entrega o resultado à C5.

## O que o teste precisa provar

Da issue #7, no iPad do Dan (iPadOS 26.6), com o app instalado pela Tela de Início:

| # | Prova | Como a tela mede | O Dan responde |
| --- | --- | --- | --- |
| P1 | A tela não apaga durante 60 minutos | `navigator.wakeLock` existe, o pedido dá certo, e o evento `release` nunca chega sem o app ir para o fundo; marca de hora a cada minuto | "A tela ficou acesa o tempo todo?" Sim / Não |
| P2 | O som do fim do descanso toca, também depois de muito tempo com a tela em primeiro plano | Toca um aviso a cada 5 min durante os 60 min; registra o estado do `AudioContext` e a hora de cada toque | Toca em "Ouvi" quando ouve (o app mede quanto demorou) |
| P3 | Dois cronômetros rodam juntos, com sons diferentes | Dois descansos de tempos diferentes ao mesmo tempo; registra o atraso de cada fim em relação ao previsto | "Ouvi os dois, e soavam diferentes?" Sim / Não |
| P4 | Tudo funciona em modo avião (ADR-009) | O app abre do ícone sem internet (service worker) e a etapa longa roda em modo avião; registra `navigator.onLine` e se a página veio do cache | "O app abriu em modo avião?" Sim / Não |
| P5 | O app não fica lento | Atraso do relógio da página (event loop) e quadros perdidos (`requestAnimationFrame`) durante tudo | "Algum toque demorou a responder?" Sim / Não |

Além das provas, o registro guarda o que as sessões seguintes precisam para decidir sem perguntar:
navegador (Safari ou Chrome), se está instalado (`display-mode: standalone`), versão do sistema pelo
`userAgent`, tamanho e orientação da tela, e quais técnicas de som funcionaram (ver "Sons testados").

## A tela de teste

### Onde fica

- Uma aba nova, **Teste**, a primeira da barra, acima de Hoje, em `/teste-ipad`, com o ícone de
  checklist. Aparece no iPad e no celular. *(temporária)*
- Abre sem internet e sem conferir a sessão: a tela não lê nem grava dados do grupo, então pode
  ficar fora do login. As outras abas continuam pedindo login.
  Por quê: em modo avião o app não consegue conferir a sessão, e o teste P4 precisa abrir assim.
- Some do app na C9 (fechamento da fase 1c), junto com o código da tela.

### Sons testados

Cada som usa uma técnica diferente, para a C5 e a C6 saberem qual funciona:

| Som | Técnica | Usado em |
| --- | --- | --- |
| Bipes | Web Audio (`AudioContext` + oscilador), liberado no primeiro toque | P2, cronômetro A da P3 |
| Apito | `<audio>` com um WAV gerado no próprio app (`blob:`), sem arquivo da internet | cronômetro B da P3 |
| Palavras ("descanso acabou") | `speechSynthesis`, voz em português do aparelho | etapa 2, só uma vez |

### As etapas

A tela é um passo a passo. Cada etapa tem um título, o que o Dan faz (no máximo três frases curtas,
na voz do app), um botão grande de ação e, no fim, a pergunta com dois botões ("Sim" / "Não" ou
"Ouvi" / "Não ouvi"). "Não" abre um campo opcional "O que aconteceu?". O passo atual fica guardado
no aparelho, então fechar e abrir o app volta para a mesma etapa. Uma barra no topo mostra
"Etapa 3 de 7" e o botão "Recomeçar" (com confirmação) fica no fim da página.

0. **Antes de começar** — "Use o iPad que vai usar nas aulas. Deixe o volume alto e o modo
   silencioso desligado (Central de Controle). Separe uns 15 minutos agora e 1 hora em que o iPad
   pode ficar parado, ligado na tomada." Botão: **Começar**.
1. **Instalar na Tela de Início** — a tela detecta o navegador e mostra o caminho certo:
   - Safari: "Toque em Compartilhar (quadrado com seta) → Adicionar à Tela de Início → Adicionar.
     Depois feche o Safari e abra o Dan Sensei pelo ícone."
   - Chrome: "Toque em Compartilhar (no fim da barra de endereço) → Adicionar à Tela de Início."
   - Já instalado: a etapa se marca sozinha como feita e mostra "Instalado ✓".
   Botão: **Já abri pelo ícone** (só ativo quando `display-mode: standalone`; senão mostra
   "Ainda não está aberto pelo ícone").
2. **Som** — botão **Tocar os três sons**: toca bipes, apito e palavras, um depois do outro. Para
   cada um, a pergunta "Ouviu?" com **Ouvi** / **Não ouvi**.
3. **Dois cronômetros** — botão **Iniciar os dois**: o cronômetro ● (bipes) faz descansos de 20 s e o
   ■ (apito) de 35 s, três vezes cada, juntos, na tela, com o tempo grande. Pergunta: "Ouviu os dois,
   cada um com seu som?" e "Os números andaram sem travar?".
4. **Modo avião** — "Ligue o modo avião. Feche o app (deslize para cima) e abra de novo pelo ícone."
   A etapa confere sozinha, ao reabrir, que está sem internet e que a tela veio do cache. Pergunta:
   "O app abriu normalmente?". Se a tela não abrir, o Dan não vê pergunta nenhuma: o registro
   guardado mostra que a etapa 4 começou e não terminou, e ele envia o relatório depois, com internet.
5. **Uma hora acesa** — "Deixe o iPad apoiado, na tomada, com esta tela aberta. Não toque nele,
   a não ser no botão Ouvi quando escutar o aviso." Botão: **Começar a hora**. Mostra o tempo
   restante grande, o último aviso e quantos "Ouvi" foram tocados. A cada 5 min toca os bipes e
   aparece **Ouvi** (fica 60 s). Pode ser feita durante uma aula de verdade. No fim: "A tela ficou
   acesa o tempo todo?" e "Algum toque demorou a responder?".
6. **Enviar o resultado** — "Desligue o modo avião." Mostra o resumo (✓ / ✗ por prova) e os
   botões:
   - **Enviar pelo WhatsApp** — abre `https://wa.me/?text=…` com o relatório (o Dan escolhe o
     contato da Valéria);
   - **Compartilhar arquivo** — `navigator.share` com o arquivo `teste-ipad-<data>.md`, quando o
     aparelho aceita arquivo; senão o botão não aparece;
   - **Copiar** — copia o relatório inteiro.

O Dan pode pular uma etapa (link "Pular esta etapa", que registra "pulada") e fazer a etapa 5 em
outro dia: o registro fica guardado no aparelho até ele tocar em "Recomeçar".

### O registro (log)

- Cada evento vira uma linha com a hora (relógio do aparelho e tempo desde o início da etapa): etapa
  começou ou terminou, resposta do Dan, wake lock pedido, concedido, solto ou com erro, estado do
  `AudioContext`, som tocado (técnica, previsto, real, atraso), "Ouvi" (demora), app foi para o
  fundo ou voltou (`visibilitychange`), online ou offline, erros da página (`error`,
  `unhandledrejection`), e a cada minuto da etapa 5 uma linha de "ainda acesa" com o pior atraso do
  relógio e os quadros perdidos daquele minuto.
- Guardado no `localStorage` do aparelho (só no aparelho; não vai ao servidor). Até 2.000 linhas;
  passando disso, as mais antigas da etapa 5 viram uma linha de resumo.
- Nenhum dado de aluno entra no registro.

### O relatório em Markdown

O relatório é o que o Dan envia. Precisa caber num link do WhatsApp, então tem duas partes e o link
leva só a primeira; o arquivo e o "Copiar" levam as duas.

```markdown
# Teste do iPad — Dan Sensei
Data: 2026-11-20 14:03 · Safari 26.6 · iPad · instalado: sim · 1180×820 horizontal

## Resultado
- ✓ P1 Tela acesa 60 min (wake lock concedido, 0 soltas)
- ✗ P2 Som depois de muito tempo (ouviu 9 de 12; o 10º saiu com AudioContext "interrupted")
- ✓ P3 Dois cronômetros (atraso máximo 180 ms)
- ✓ P4 Modo avião (abriu do cache)
- ✓ P5 Sem lentidão (pior atraso do relógio 90 ms)
- Sons: bipes ✓ · apito ✓ · palavras ✗ (sem voz pt-BR)
- Comentários do Dan: "o 10º aviso não tocou"

## Próximos passos
- C5: usar navigator.wakeLock, pedir de novo ao voltar do fundo.
- C5: AudioContext.resume() antes de cada aviso; usar o <audio> como reserva.
- C6: opção "palavras" fica fora até haver voz pt-BR.

## Registro
(as linhas do log, só no arquivo e no "Copiar")
```

"Próximos passos" sai da tabela "O que depende do teste", escolhendo a linha certa para cada
resultado. Assim o relatório já diz às sessões seguintes o que fazer.

## O que depende do teste

Esta é a lista do que falta construir que depende do resultado. A T6 usa esta tabela para escrever o
resultado na issue #7 e no ADR-009, e a C5 começa com isso decidido.

| Resultado | Se passou | Se falhou | Onde muda |
| --- | --- | --- | --- |
| P1 wake lock | C5 usa `navigator.wakeLock`, pedindo de novo no `visibilitychange` | C5 usa o plano B: vídeo mudo em loop (técnica do NoSleep, sem biblioteca); a T6 escreve um ADR | C5, ADR novo |
| P2 som depois de muito tempo | C5 usa Web Audio, liberado no primeiro toque da aula | C5 chama `resume()` antes de cada aviso e, se o estado não for `running`, toca pelo `<audio>`; se nenhum funcionar, a T6 abre uma pergunta para a Valéria (vibração não existe no iPad) | C5, `spec/aula-ao-vivo.md` |
| P3 dois cronômetros | C6 roda dois cronômetros num só relógio da página | C6 agenda os sons pelo relógio do `AudioContext` (`start(when)`) e não por `setTimeout` | C6 |
| Sons: palavras | C6 oferece "palavras" | C6 tira "palavras" das opções; a T6 muda a regra no spec e lista em "Revisar as lacunas" | C6, `spec/aula-ao-vivo.md` |
| P4 modo avião | O service worker da T3 vira o do app (ADR-009) e a "Aula sem internet" do roadmap fica só com IndexedDB e `ServicesProvider` | A T6 investiga com o registro e abre uma issue `t:bug` `p:alta` antes da C5 | ADR-009, ROADMAP |
| P5 lentidão | Nada muda | A C5 mede antes de animar: as trocas de cor ficam instantâneas, sem animação | C5 |
| Navegador | — | Se o Dan usa Chrome, a C5 confere o mesmo no Chrome, e o passo de instalar da etapa 1 vira o texto de ajuda do app | C5 |

O que **não** depende do teste e pode seguir: C6 (exceto sons), C7 e C8 dependem da C5, que depende
deste teste; nada mais da fase 1c espera por ele.

## Decisões técnicas da tela

- Código da tela em `src/ui/screens/IpadTest.tsx` e `src/ui/ipad-test/` (lógica pura e testada:
  etapas, registro, relatório, próximos passos). As peças de navegador (wake lock, sons, relógio,
  medidor de lentidão) ficam em `src/infrastructure/device/`, já no formato que a C5 vai reusar:
  `WakeLock`, `Chime` (bipes, apito, palavras), `RestTimer` (relógio com atraso medido),
  `LagMonitor`.
- Service worker em `public/sw.js`, escrito à mão, sem biblioteca: guarda o app (HTML, JS, CSS,
  ícones, manifest) na instalação e responde do cache quando a rede falha; `/api` nunca vem do
  cache. Registrado em `src/infrastructure/`. O `_headers` já manda `sw.js` sem cache.
- CSP: os sons gerados usam `blob:`; a T3 acrescenta `media-src 'self' blob:` e `worker-src 'self'`
  e um teste em `src/security.test.ts`. Nenhuma origem nova no `network-policy.ts` (o `wa.me` já
  está em `LINK_ORIGINS`).
- O link do WhatsApp segue o ADR-008: sem número (o Dan escolhe o contato). O texto do link fica
  em no máximo 1.800 letras; se passar, corta o "Registro" (que já não vai no link).
- Textos em `src/domain/strings.ts`, na voz do app, tratando o Dan por "você".

## Lacunas que o agente decidiu (revisar)

- A aba Teste aparece também no celular e abre sem login (não mostra dado nenhum do grupo).
- O relatório não vai ao servidor; só sai pelo WhatsApp, pelo arquivo ou pelo "Copiar".
- O link do WhatsApp vai sem número: o Dan escolhe a Valéria na lista de contatos.
- Etapa longa com aviso a cada 5 min (12 avisos) e "Ouvi" disponível por 60 s.

## Sessões

### Como gastar poucos tokens

Valem as regras de `plano-padrao-apple-e-fase-1c.md` ("Como gastar poucos tokens" e "Regras para
toda sessão"), com duas mudanças:
- **T1, T2 e T3 rodam em paralelo**: cada uma mexe só nos seus arquivos novos e nenhuma toca
  `strings.ts`, `App.tsx`, `navigation.ts` ou `schema.ts`. O `npm run ship` atualiza a branch que
  ficou para trás sozinho.
- **Haiku** faz o que é transcrição ou texto: o fechamento dos docs (T5) e a leitura do relatório do
  Dan (T6a). Haiku não escreve regra nova nem decide plano B.

### Ordem e modelo

| Ordem | Sessão | Modelo | O que entrega | Depende de |
| --- | --- | --- | --- | --- |
| 1 | T1 | Sonnet | Lógica pura do teste: etapas, registro, relatório Markdown, próximos passos, link do WhatsApp com limite | — |
| 1 | T2 | Opus | Peças de navegador reusáveis: `WakeLock`, `Chime` (3 técnicas), `RestTimer`, `LagMonitor` | — |
| 1 | T3 | Opus | Service worker, registro dele, CSP (`media-src`, `worker-src`), rota que abre sem login | — |
| 2 | T4 | Sonnet | A tela: aba Teste acima de Hoje, as 7 etapas, botões, textos, enviar/compartilhar/copiar | T1, T2, T3 |
| 3 | T5 | Haiku | Docs: roadmap, rascunhos, comentário na issue #7 com o roteiro para o Dan | T4 |
| — | (Dan) | — | O Dan faz o teste e envia o relatório para a Valéria | T5 |
| 4 | T6a | Haiku | Transcreve o relatório na issue #7 (caixas marcadas, números) | relatório |
| 5 | T6b | Sonnet | Aplica "O que depende do teste": ADR-009, ADR novo se houver plano B, spec, roadmap, aviso à C5; fecha a issue #7 e apaga este plano | T6a |

### Prompts das sessões

Cada prompt é o texto inteiro que o orquestrador manda. Toda sessão lê antes a seção "Regras para
toda sessão" de `docs/rascunhos/plano-padrao-apple-e-fase-1c.md` e, deste arquivo, só as seções
que o prompt cita.

#### T1: lógica do teste (Sonnet)

> Leia "Regras para toda sessão" em `docs/rascunhos/plano-padrao-apple-e-fase-1c.md` e, em
> `docs/rascunhos/teste-ipad-issue-7.md`, as seções "O que o teste precisa provar", "As etapas",
> "O registro (log)", "O relatório em Markdown" e "O que depende do teste". Crie em
> `src/ui/ipad-test/`, só TypeScript puro com testes (sem React, sem navegador):
> - as etapas 0 a 6 como máquina de estados (atual, feita, pulada, resposta Sim/Não com comentário),
>   serializável para o `localStorage` por uma porta `TestStore` (só a interface);
> - o tipo das linhas do registro e o limite de 2.000 linhas com o resumo da etapa 5;
> - a avaliação P1 a P5 a partir do registro e das respostas;
> - o relatório Markdown do exemplo, com "Próximos passos" escolhidos pela tabela;
> - o link `https://wa.me/?text=` com no máximo 1.800 letras de texto, sem a parte "Registro".
>
> Não mexa em `strings.ts`, `App.tsx` nem `navigation.ts`: os textos das etapas ficam para a T4;
> aqui só os textos do relatório, num arquivo do próprio `ipad-test`. Pronto quando: os testes
> cobrem um teste inteiro que passou, um com P2 falhando e um link longo cortado.

#### T2: peças de navegador (Opus)

> Leia "Regras para toda sessão" em `docs/rascunhos/plano-padrao-apple-e-fase-1c.md`, em
> `docs/rascunhos/teste-ipad-issue-7.md` as seções "Sons testados", "O que depende do teste" e
> "Decisões técnicas da tela", e em `docs/spec/aula-ao-vivo.md` as seções "Cronômetro" e "Aula em
> dupla". Crie em `src/infrastructure/device/`, sem dependências novas, peças que a C5 e a C6 vão
> reusar:
> - `WakeLock`: pede, pede de novo ao voltar do fundo, avisa cada mudança (concedido, solto, erro);
> - `Chime`: liberar no primeiro toque; bipes por Web Audio, apito por `<audio>` com WAV gerado em
>   `blob:`, palavras por `speechSynthesis` pt-BR; cada toque informa a técnica, a hora prevista, a
>   real e o estado do `AudioContext`; `resume()` antes de tocar;
> - `RestTimer`: descanso com fim previsto, vários ao mesmo tempo, mede o atraso de cada fim, não
>   anda para trás quando a página volta do fundo (usa a hora real, não contagem de ticks);
> - `LagMonitor`: pior atraso do relógio e quadros perdidos por minuto.
>
> Separe a conta (pura, testada) da chamada ao navegador (fina). Não faça tela. Se a CSP precisar
> mudar, só anote no relatório: a T3 cuida disso. Pronto quando: os testes da parte pura passam e o
> `npm run typecheck` passa.

#### T3: abrir sem internet (Opus)

> Leia "Regras para toda sessão" em `docs/rascunhos/plano-padrao-apple-e-fase-1c.md`, o ADR-009,
> o ADR-002, `docs/SEGURANCA.md` e, em `docs/rascunhos/teste-ipad-issue-7.md`, as seções "Onde fica"
> e "Decisões técnicas da tela". Faça:
> - `public/sw.js` à mão: na instalação guarda o app construído (leia os nomes dos arquivos do
>   `dist/` por um manifesto gerado no build, sem biblioteca); responde do cache quando a rede
>   falha; nunca guarda `/api`; troca o cache a cada versão;
> - o registro do service worker em `src/infrastructure/` (só em produção);
> - a CSP com `media-src 'self' blob:` e `worker-src 'self'`, com teste em `src/security.test.ts`;
> - a rota `/teste-ipad` renderizada antes da conferência do login (no `App.tsx`, só a condição;
>   a tela em si é um componente vazio que a T4 preenche).
>
> Escreva no ADR-009 como o service worker ficou. Pronto quando: o build gera o manifesto, os
> testes de segurança passam e `/teste-ipad` abre sem sessão.

#### T4: a tela de teste (Sonnet)

> Leia "Regras para toda sessão" em `docs/rascunhos/plano-padrao-apple-e-fase-1c.md`, a seção
> "Padrão Apple" do `docs/UI.md` e, em `docs/rascunhos/teste-ipad-issue-7.md`, as seções "A tela de
> teste" (inteira) e "O relatório em Markdown". Use `src/ui/ipad-test/` (T1),
> `src/infrastructure/device/` (T2) e a rota `/teste-ipad` (T3). Faça:
> - a aba **Teste** em `navigation.ts`, a primeira, acima de Hoje, no iPad e no celular, com o
>   teste em `navigation.test.ts`;
> - a tela `src/ui/screens/IpadTest.tsx` com as etapas 0 a 6, os botões grandes (64 pt, como no Ao
>   Vivo), a barra "Etapa X de 7", "Pular esta etapa" e "Recomeçar" com `ConfirmDialog`;
> - o `TestStore` sobre o `localStorage`, com try/catch;
> - Enviar pelo WhatsApp (link, `target="_blank" rel="noopener noreferrer"`), Compartilhar arquivo
>   (`navigator.share` com arquivo, só se `canShare` aceitar) e Copiar;
> - todos os textos em `src/domain/strings.ts`.
>
> Use os componentes de `src/ui/components/` e só tokens. Pronto quando: o typecheck passa e
> percorro as 7 etapas na tela (pode encurtar a etapa 5 com `?rapido=1`, que troca 60 min por 2 min
> e o aviso por 20 s).

#### T5: docs e roteiro para o Dan (Haiku)

> Leia, em `docs/rascunhos/teste-ipad-issue-7.md`, as seções "As etapas" e "Lacunas que o agente
> decidiu". Faça, sem mexer em código:
> - em `docs/ROADMAP.md`, troque a observação da linha do Modo Ao Vivo para "Depois do teste no
>   iPad do Dan (issue #7): a tela de teste está na aba Teste" e acrescente as lacunas em
>   "Revisar as lacunas que o agente decidiu";
> - comente na issue #7 (`gh issue comment 7`) o roteiro para a Valéria mandar ao Dan: o endereço de
>   produção do `CLAUDE.md` com `/teste-ipad`, "abra no Safari do iPad", os 15 minutos e a hora
>   parada, e "no fim, toque em Enviar pelo WhatsApp e escolha a Valéria";
> - rode `npm run docs:check`.
>
> Envie com `npm run ship`. Pronto quando: o PR está mergeado e o comentário está na issue.

#### T6a: ler o relatório (Haiku)

> A Valéria vai colar abaixo o relatório que o Dan enviou. Leia, em
> `docs/rascunhos/teste-ipad-issue-7.md`, só a seção "O que o teste precisa provar". Sem mexer em
> arquivos: edite o corpo da issue #7 (`gh issue edit 7 --body-file`), marcando cada caixa que
> passou, e acrescente embaixo uma seção "Resultado" com os números do relatório e os comentários do
> Dan. Termine dizendo, em uma linha por prova, passou ou falhou.

#### T6b: aplicar o resultado (Sonnet)

> Leia `gh issue view 7`, a seção "O que depende do teste" de `docs/rascunhos/teste-ipad-issue-7.md`,
> o ADR-009 e a seção "Em aberto" de `docs/spec/aula-ao-vivo.md`. Para cada prova, aplique a coluna
> certa da tabela:
> - escreva no ADR-009 o que o teste mostrou e o que a C5 usa;
> - se houver plano B, escreva um ADR novo (copie `000-template.md`);
> - tire o item do "Em aberto" do spec e mude as regras que a tabela manda mudar, listando as
>   decisões em "Revisar as lacunas que o agente decidiu";
> - no `docs/rascunhos/plano-padrao-apple-e-fase-1c.md`, acrescente ao prompt da C5 e da C6 uma
>   linha "Do teste no iPad:" com o que vale;
> - apague este plano e a linha dele em `docs/rascunhos/README.md`; a aba Teste continua até a C9;
> - feche a issue #7 com o link do PR.
>
> Se uma prova falhou sem plano B na tabela, não decida: escreva a pergunta no relatório. Pronto
> quando: o PR está mergeado e a issue fechada.

### Prompt do orquestrador

A sessão orquestradora roda em **Sonnet** (ela confere merges e decide se uma sessão terminou, o que
pede mais juízo que transcrever), e recebe:

> Você é o orquestrador do teste do iPad do Dan (issue #7). Leia só
> `docs/rascunhos/teste-ipad-issue-7.md` (seção "Sessões") e o `CLAUDE.md`. Você não escreve código
> e não abre arquivos de código: você inicia as sessões, confere o resultado e inicia a próxima.
>
> 1. Inicie T1 (Sonnet), T2 (Opus) e T3 (Opus) juntas, com `start_session` (initiation
>    "user_asked", context "fresh", worktree própria). O prompt é o texto da seção de cada uma, sem
>    mudar nada.
> 2. Espere o aviso de cada uma, sem ficar consultando. Confira de verdade: o PR mergeado
>    (`gh pr list --state merged --limit 5`), `npm run branches` sem a branch dela, e
>    `git diff --stat` do merge com os arquivos que batem com o "Pronto quando". Faltou algo: mande
>    uma mensagem para a mesma sessão e espere de novo.
> 3. Com as três mergeadas, `git pull` na `main` e inicie a T4 (Sonnet); depois a T5 (Haiku).
> 4. Depois da T5, me avise que o teste está pronto para o Dan, com o link do comentário da issue, e
>    pare. Junte num só aviso as perguntas e as lacunas que as sessões relataram.
> 5. Quando eu colar o relatório do Dan, inicie a T6a (Haiku) com o prompt dela seguido do
>    relatório; depois a T6b (Sonnet).
> 6. No fim, me diga em até 8 linhas: cada prova passou ou falhou, o que muda na C5 e na C6, os PRs e
>    as issues abertas. Se uma sessão falhar duas vezes na mesma coisa, pare e me conte.
