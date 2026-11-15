# Interface

Regras visuais e de uso que valem para toda tela do app.

- **Entra aqui:** as regras de interface que valem para todas as telas, e onde cada uma é conferida.
- **Não entra aqui:** os valores (cores, tamanhos: ficam em `src/ui/theme/tokens.css`), o que cada
  tela faz (`docs/spec/`) e rascunhos de tela (`docs/rascunhos/`).

## O que o build confere

`src/ui/theme/tokens.test.ts` roda no `npm test` e no `npm run build`, e falha quando uma regra
abaixo é quebrada. Ao corrigir, use um token. Se nenhum servir, crie um no `tokens.css` (as cores
nos dois temas). Nunca afrouxe o teste.

1. **Nenhum valor solto fora do `tokens.css`:** cor (hex, `rgb()`, `white`), comprimento (`px`,
   `rem`, `em`), duração, tamanho, peso ou altura de linha de fonte. Isso vale para CSS, para TSX e
   para `style={{}}` (percentagens podem).
2. **Só tokens que existem:** um `var(--x)` sem definição falha.
3. **Escala tipográfica:** cada tamanho é de 1,125 a 1,5 vez o anterior. Os tamanhos
   `--font-size-display*` (um número em destaque, o título de uma tela de abertura) podem saltar
   mais. Nada abaixo de 12px. O texto corrido tem pelo menos 16px.
4. **Espaçamento na grade de 4px.**
5. **Contraste AA nos dois temas:** texto com 4,5:1 sobre o fundo em que aparece. Borda de
   controle, anel de foco e ícone com 3:1. Uma cor nova que leva texto ou marca um controle entra na
   lista de pares do teste.
6. **O tema escuro redefine todas as cores** do claro.
7. **Alvo de toque com 44px ou mais** (`--size-touch`).

## Padrão Apple

O app segue as Human Interface Guidelines da Apple para iOS e iPadOS 26 (ADR-011). O desenho de cada
componente, com prévia e motivo, está no design system (artifact "Dan Sensei", link no ADR-011).

- **A barra de abas só navega.** As ações ficam na barra de ferramentas: o + à direita, uma única
  ação principal.
- **O vidro só fica na camada de controles:** barra de abas, barra de ferramentas e botões redondos
  de ícone, com `--color-glass` e `--blur-glass`. Cartões, listas e conteúdo são opacos. Com
  `prefers-reduced-transparency` ou `prefers-contrast: more`, o vidro vira fundo opaco.
- **Cartões e seções** usam `--color-surface` sobre `--color-bg`, com `--radius-card` e sem borda.
  Separadores só entre linhas de lista.
- **Botões** são cápsulas (`--radius-full`), em três estilos:
  - principal: `--color-brand`;
  - secundário: `--color-fill` com texto `--color-brand`;
  - texto: só o texto.

  O tamanho grande é `--size-button-large`. Pressionado, o botão encolhe (`--scale-pressed`) e
  esmaece (`--opacity-pressed`).
- **Ações curtas abrem num painel** (`--radius-sheet`). No celular, o painel tem alça e fecha ao
  deslizar. Cancelar fica à esquerda e salvar à direita. Um painel por vez.
- **Ação destrutiva** pede confirmação numa caixa com o botão em `--color-danger` e "Cancelar". O
  botão destrutivo nunca é o principal.
- **Ícones** no estilo dos SF Symbols, com traço arredondado. As abas usam a versão preenchida.
  Os SF Symbols em si não podem ser usados na web.
- **Tema:** o tema segue o aparelho, e o app não tem ajuste próprio.
- **Modo Ao Vivo:** usa `--font-rounded`, alvos de `--size-touch-live` e as cores `--color-live-*`,
  que são iguais nos dois temas.
- **Áreas seguras:** o conteúdo respeita a barra de status e o indicador de início
  (`env(safe-area-inset-*)`).
- **Tamanho de letra do aparelho (Dynamic Type):** os tamanhos de fonte do `tokens.css` são `rem` do
  tamanho da raiz. No Safari do iOS e do iPadOS a raiz usa `font: -apple-system-body` e o texto
  segue o tamanho escolhido nos Ajustes; nos outros navegadores a raiz tem 17px. O `rem` só existe
  no `tokens.css`: telas e componentes usam `var(--font-size-*)`. O corpo é 1rem, o que mantém o
  "pelo menos 16px" do teste. Com o texto bem pequeno nos Ajustes, o iOS pode dar zoom ao focar um
  campo.

### Componentes

Tudo em `src/ui/components/`; use antes de escrever CSS novo.

| Componente | Para quê |
| --- | --- |
| `Button`, `ButtonLink` | Cápsula: `primary`, `secondary`, `text`, `danger`; tamanho `normal` ou `large` |
| `IconButton` | Botão redondo de ícone em vidro (`glass`) ou o ✓ principal (`brand`); sempre com `label` |
| `Icon` | Ícones no estilo SF Symbols; `filled` nas abas; sem `label` fica escondido do leitor de tela |
| `Sheet` | O painel: sobe de baixo no celular (alça, altura média e grande, fecha ao deslizar), abre no centro no iPad; × e ✓ no cabeçalho; foco preso e Esc fecha |
| `ConfirmDialog` | Confirmação de ação destrutiva; o foco começa em Cancelar |
| `GroupedList`, `ListSection`, `ListRow`, `ListContent` | Lista agrupada: título, subtítulo, valor, ícone, seta; a seção tem cabeçalho e rodapé; `ListContent` guarda um formulário ou texto livre numa linha |
| `SegmentedControl`, `Switch`, `Stepper` | Controle segmentado (grupo de rádio), interruptor (`role="switch"`) e − / + |
| `StudentCard` | O cartão do aluno: iniciais, nome, próxima aula, selo e a faixa; toque abre o perfil, toque longo e o botão "⋯" abrem o menu de contexto |
| `Badge` | O selo em cápsula: neutro, `brand`, `danger` ou `health` (este sempre com o escudo) |
| `PackageProgress`, `Belt` | A faixa do pacote: um gomo por aula, barra contínua acima de 20 |
| `Field`, `SelectField` | Campo preenchido, sem borda, com rótulo sempre visível e erro ligado ao campo |
| `Notice`, `EmptyState`, `Loading` | Aviso da tela (sem borda colorida), lista vazia e carregamento |

A lógica que não depende do DOM fica em arquivos `.ts` ao lado (`sheet-logic`, `segmented-logic`,
`stepper-logic`, `package-belt`) e é a que os testes cobrem.

## O que a revisão confere

Estas regras pedem julgamento. Quem revisa a interface (skill `ui-review`) olha estas, e não as de
cima.

**Hierarquia**
- Uma ação principal por tela (`<Button>` primário). As outras são `secondary`.
- Um `h1` por tela. Os níveis de título não pulam (`h1`, depois `h2`).
- Tamanho e peso marcam importância. Nunca três tamanhos diferentes no mesmo card.
- Coisas relacionadas ficam mais perto entre si do que de outros grupos (proximidade).

**Componentes**
- Use os de `src/ui/components/` (`Button`, `ButtonLink`, `Field`, `Notice`) antes de escrever
  CSS novo. Quando um padrão se repete em duas telas, ele vira componente.
- Todo campo tem rótulo visível. Placeholder não é rótulo.
- Ações que apagam ou removem pedem confirmação; o botão de apagar, dentro da confirmação, usa `danger`.

**Estados**
- Toda lista e toda tela que carrega dados tem os estados vazio, carregando e erro. O vazio diz o
  que fazer em seguida.
- Botão que dispara uma ação fica desabilitado enquanto ela roda.

**Acessibilidade além do contraste**
- Tudo funciona pelo teclado, na ordem visual, com foco visível (`:focus-visible` no
  `global.css`).
- Ícone sem texto tem `aria-label`. Imagem decorativa tem `alt=""`.
- Cor nunca é o único sinal: erro também tem texto, e o estado ativo também tem forma ou peso.
- Animação respeita `prefers-reduced-motion` (o `global.css` já zera as durações).

**Layout**
- Funciona em 320px de largura sem rolagem horizontal. Texto longo (nome, e-mail) quebra ou corta
  com reticências, sem empurrar o layout.
- Conteúdo com no máximo `--size-content` de largura.

**Texto**
- Os textos da interface ficam em `src/domain/strings.ts`, com os termos do `docs/GLOSSARIO.md`.
- O botão diz o que acontece ("Enviar convite"), não "OK".

## Mudar a identidade visual

Mude só os valores do `tokens.css`, sem renomear os tokens. Depois, mude as mesmas cores no
`index.html`, no manifest e nos ícones (`src/app-identity.test.ts` confere). Rode `npm test`: o
teste de contraste diz qual par ficou ilegível.
