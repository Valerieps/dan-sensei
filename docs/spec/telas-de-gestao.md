# Telas de gestão

As telas que uso fora da aula: o que acontece hoje, quem precisa de atenção e a ficha de cada aluno,
no iPad e no celular.

- **Entra aqui:** a navegação, a aba Hoje, a aba Alunos, o perfil do aluno e o que o celular faz.
- **Não entra aqui:** a agenda (`agenda.md`), o Modo Ao Vivo (`aula-ao-vivo.md`) e as regras de
  pacote (`pacotes-e-pagamentos.md`).

## Aparência

- O app segue o padrão da Apple para iPhone e iPad: barra de abas, barra de ferramentas, painéis e
  listas agrupadas do iOS, letra do sistema (SF Pro) e botões em cápsula (ADR-011). *(1a)*
  Por quê: eu já sei usar esses componentes no iPhone e no iPad, e o app fica com cara de produto
  profissional.
- O tema claro ou escuro segue o ajuste do aparelho; o app não tem opção própria. Deixo o iPad no
  escuro: grafite e preto com o verde esmeralda. *(1a)*
  Por quê: a Apple desaconselha um ajuste de tema dentro do app (`dark-mode.md`).
- Verde esmeralda marca a ação principal, a aba escolhida e o progresso; vermelho só urgência de
  pacote ou pagamento (e o botão de apagar dentro da confirmação); laranja só alertas de saúde. *(1a)*
- Fora da aula, as telas têm densidade de planilha e o texto do iOS (17 pt), para usar com o iPad na
  mão ou na mesa. *(1a)*
- A logomarca (Tatame) aparece só no ícone do app e no cabeçalho do Modo Ao Vivo. *(1a)*

## Navegação

- Três abas no celular, embaixo: Hoje, Agenda e Alunos. No iPad, as mesmas três e mais Exercícios
  *(1c)*, no topo; um botão as transforma em barra lateral, onde também fica Configurações. *(1a)*
- As abas só levam às telas. As ações ficam na barra de ferramentas, à direita: o botão + (menu de
  criação), a busca e, na aba Hoje, a engrenagem de Configurações. Não há aba "Mais". *(1a)*
- Cada aba abre com o título grande ("Hoje", "Agenda", "Alunos"), que encolhe ao rolar. *(1a)*
- Ações curtas (registrar pagamento, remarcar, pausar, novo pacote, nota) abrem num painel: no
  celular sobe de baixo, com alça, e fecha ao deslizar; no iPad abre no centro. Cancelar à esquerda,
  salvar à direita. *(1a)*
- Perfil, detalhe do pacote, detalhe da aula e Configurações são listas agrupadas. Deslizar uma aula
  para a esquerda mostra Remarcar e Falta; tocar e segurar o cartão do aluno abre o menu com
  Remarcar, Registrar pagamento e Mandar extrato. *(1b)*

## Hoje

Ao abrir, o app mostra o dia de hoje, pronto para começar a próxima aula.

- A aba Hoje é uma linha do tempo do dia: as aulas na ordem do horário, com os horários livres entre
  elas. *(1b)*
- A aula que está acontecendo, ou a próxima, fica destacada com o aluno (ou a dupla), o horário, o
  endereço, os alertas de saúde e o botão "Iniciar aula". Do horário marcado até o fim previsto, é
  "aula agora"; fora disso, é a próxima aula do dia (ou do dia seguinte). *(1b)*
- "Iniciar aula" leva direto ao Modo Ao Vivo com o treino sugerido. *(1c)*
- Abaixo, "Precisa de atenção": só os alunos com algum alerta de pacote ou de pagamento, na ordem de
  urgência abaixo. Sem nenhum, a seção some. *(1b)*
- As perguntas de mensalidade do dia aparecem em Hoje (`mensalistas.md`). *(1b)*

## Alunos

- No topo há o interruptor "Esconder valores", que troca o valor recebido por •••, para quando o iPad está à vista do aluno. A escolha fica guardada no aparelho. *(1a)*
- A tela mostra todo aluno ativo em cartões com barra de progresso do pacote: nome, "Aula X de Y",
  validade, pagamento e próxima aula. Os mensalistas também, sem barra. *(1a)*
- A próxima aula aparece no cartão a partir da fase 1b. *(1b)*
- Ordem de urgência, da mais urgente para a menos: *(1a)*
  1. Pagamento pendente.
  2. Pacote vencido ou esgotado, sem renovação.
  3. Menos de 4 aulas restantes ou validade em menos de 7 dias, com destaque em vermelho.
  4. Os demais, pela próxima aula.
- O pacote Avulso e os mensalistas não recebem destaque de saldo e validade. *(1a)*
- Um controle segmentado filtra os cartões: Todos, Atenção (os que estão em destaque), Mensalistas e
  Inativos. Os inativos aparecem numa lista, sem cartão. *(1a)*
- Tocar no cartão abre o perfil. Tocar e segurar abre o menu de contexto, com Remarcar (a próxima
  aula do aluno, na Agenda), Registrar pagamento e Mandar extrato (a aba Pacotes, onde está o link
  do WhatsApp); a ação que não faz sentido some, e o cartão tem um botão "⋯" que abre o mesmo menu
  para quem não consegue segurar. *(1a)*
  Por quê: tocar e segurar é o gesto do iOS para ações rápidas sobre um item, e o botão garante que
  a função também chegue por teclado e leitor de tela.
- No topo, os números do mês: quanto recebi (a soma dos pagamentos com data no mês) e as renovações
  previstas (alunos com pacote vencido, esgotado, com menos de 4 aulas ou vencendo em menos de 7
  dias; Avulso e mensalistas ficam fora). *(1a)*

## Perfil do aluno

- O perfil tem um cabeçalho (nome, iniciais, alertas de saúde, pacote) e abas: cadastro, pacotes e
  pagamentos, mensalidades, notas, e depois treinos e histórico. *(1a)*

## Celular

- No celular eu consulto agenda, alunos e pacotes, remarco aulas, registro pagamentos e mensalidades
  e escrevo notas sobre o aluno. Prescrever treino e conduzir a aula ficam no iPad. *(1a)*
- A aba Hoje do celular é a mesma do iPad, em uma coluna. *(1b)*
- O botão + (na barra de ferramentas) oferece, nesta ordem: Registrar pagamento, Nova aula, Nota sobre aluno, Novo aluno e
  Registrar mensalidade. *(1a)*
- Se eu estiver sem o iPad, o celular abre uma aula simples (`aula-ao-vivo.md`). *(1c)*
