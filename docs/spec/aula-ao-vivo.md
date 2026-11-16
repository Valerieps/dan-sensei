# Aula ao vivo

A aula conduzida pelo iPad: o aluno lê de longe, eu registro cada série com um toque, e os dois
cronômetros da dupla rodam juntos.

- **Entra aqui:** como a aula começa, o Modo Ao Vivo individual e em dupla, o cronômetro, o registro
  das séries, o encerramento com a PSE, o volume e a aula sem internet.
- **Não entra aqui:** biblioteca e treinos (`treinos-e-exercicios.md`), o que a aula consome do
  pacote (`pacotes-e-pagamentos.md`) e o resumo enviado ao aluno (`whatsapp.md`).

## Em aberto

- [ ] O teste no iPad (tela acesa, som, dois cronômetros juntos, sem internet) precisa passar antes
  de construir esta fase. Ver a issue #7. *(1c)*

## Onde o iPad fica

O iPad fica na minha mão, no chão ou apoiado no aparelho, geralmente a 1 ou 2 m do aluno. Em alguns
exercícios o aluno se desloca e o iPad fica mais longe.

## Começar a aula

Três jeitos, todos a um toque de Hoje:

- **Treino do programa:** "Iniciar Treino B", com as cargas da última vez já sugeridas. *(1c)*
- **Repetir a última aula:** copia a aula mais recente do aluno; posso escolher outra data. *(1c)*
- **Aula livre:** começa vazia e eu acrescento exercícios durante a aula. No fim, o app oferece
  "salvar como treino". *(1c)*

## Modo Ao Vivo

- Tela cheia, iPad na horizontal, letras grandes para ler a 2 m e botões de pelo menos 64 pt. Os números usam SF Pro Rounded, como no app Fitness. As cores do momento são as mesmas no tema claro e no escuro. *(1c)*
- O cabeçalho mostra a logomarca, o aluno, os alertas de saúde e "Aula 8 de 12". *(1c)*
- A tela muda com o momento: durante a série, o exercício, a série e a carga ocupam a tela; no
  descanso, o cronômetro ocupa a tela. Os números ficam o maior possível. *(1c)*
- Um toque registra a série como feita como prescrita. Antes de confirmar, + e − ajustam a carga (no
  incremento do exercício) e as repetições. *(1c)*
  Por quê: a prioridade é a velocidade de registro; o efeito visual vem depois.
- "Carga anterior" é a última série registrada daquele exercício por aquele aluno; é calculada,
  nunca digitada. *(1c)*
- O botão "Acrescentar exercício" fica sempre visível e abre a árvore de grupos musculares
  (`treinos-e-exercicios.md`). *(1c)*
- Em bi-sets e circuitos, o app alterna os exercícios sozinho. *(1c)*
- A tela não apaga durante a aula. *(1c)*

## Cronômetro

- O descanso começa sozinho quando registro a série, com o tempo prescrito, e aceita +15 s e −15 s.
  *(1c)*
- No estilo do app Seconds: a tela inteira fica da cor do intervalo atual, legível de longe, e uma
  faixa mostra a cor do próximo intervalo. *(1c)*
  Por quê: ajuda muito em treinos intervalados mais complexos.
- As cores do cronômetro valem só dentro do Modo Ao Vivo e não usam o vermelho de cobrança nem o
  laranja de saúde: trabalho em verde esmeralda, descanso em índigo, preparação em cor de papel. *(1c)*
- O fim do descanso toca um aviso. O som é liberado no primeiro toque da aula. *(1c)*

## Aula em dupla

Cada aluno faz o seu treino, às vezes o mesmo com cargas diferentes. Hoje controlo um tempo no
celular e outro no relógio.

- A tela se divide em duas metades iguais, um aluno de cada lado, cada um com seu exercício, suas
  séries, seu registro e seu cronômetro. *(1c)*
- Cada aluno tem seus alertas, sua carga anterior, sua PSE e seu volume. *(1c)*
- Cada lado tem um som próprio de fim de descanso, que eu escolho entre: bipes (longos, curtos, mais
  ou menos repetições), apito e palavras faladas ("vai", "começou", "continua", "pausa"). *(1c)*
  Por quê: sons diferentes dizem de quem é o descanso sem eu olhar a tela.

## Encerramento

- Cada aluno dá a nota de esforço da aula (PSE, 0 a 10, escala CR10) tocando num número grande. Só
  números, sem palavras. *(1c)*
- O app guarda a duração da aula. *(1c)*
- Carga da aula = PSE × duração em minutos (método de Foster), com total semanal e gráfico no perfil
  do aluno. *(1c)*

## Volume

- Volume é o número de séries válidas por grupo muscular. Grupo primário conta 1 série; secundário
  conta 0,5. *(1c)*
- Séries de peso corporal, tempo e isometria contam igual às outras, sem "0 kg". *(1c)*
- Tonelagem (carga × repetições) aparece só como dado complementar por exercício. *(1c)*
- Gráficos de volume por semana (segunda a domingo) e por mês ficam para a fase 2. *(2)*
- O mapa de calor (uma silhueta que acende conforme as séries do dia em cada grupo) fica para a fase
  2. Ele mostra grupos trabalhados, não fadiga. *(2)*

## Como o servidor guarda a aula *(1c)*

- A aula aberta é a aula do dia já iniciada e ainda não encerrada. Posso sair e voltar: o app
  lista as abertas e reconstrói a tela pelo servidor. Só encerrar desconta do pacote, uma vez, pelas
  regras de `pacotes-e-pagamentos.md`.
- Cada aluno tem o plano da aula: uma cópia do treino (ou da última aula) feita ao iniciar. Mudar o
  treino depois não altera uma aula já iniciada. Na aula livre o plano começa vazio.
- Ao iniciar do treino ou repetindo a última, a carga sugerida de cada exercício é a última que o
  aluno usou nele; sem histórico, a prescrita. A "carga anterior" é a mesma conta, sem contar a aula
  de agora.
- Um toque registra a série como prescrita: as repetições do começo da faixa (8 em "8 a 12") e a
  carga sugerida. Dá para ajustar, corrigir e apagar séries, também depois do encerramento.
  Por quê: a faixa é o que o aluno precisa alcançar; se foi além, eu ajusto com o +.
- Em bi-set, tri-set e circuito o app alterna uma série de cada exercício até completar todos; os
  outros exercícios seguem a ordem do treino.
- Encerrar guarda a duração (do início ao fim) e a PSE de cada aluno. "Encerrar agora" encerra sem
  PSE; ela pode ser dada depois. Se mais de um pacote serve, a aula fecha "sem pacote" e eu vinculo
  depois (`pacotes-e-pagamentos.md`), porque a aula sem internet não consegue perguntar na hora.
- Corrigir uma aula encerrada: mudar a duração, abonar a aula (ela deixa de descontar) ou descontar
  de outro pacote. A carga da aula e o volume se recalculam sozinhos.

## Sem internet e sem iPad

- A aula inteira funciona sem internet: tudo é gravado no aparelho na hora e enviado quando a
  conexão volta. *(1c)*
- Cada ação entra numa fila no aparelho e vai ao servidor em ordem, com o horário em que aconteceu;
  o servidor aplica cada uma uma vez só, então reenviar não duplica nada. Uma ação que o servidor
  recusa (o aluno foi removido, por exemplo) fica na lista de recusadas para eu ver. *(1c)*
- Se eu chegar sem o iPad, ou com ele descarregado, o celular abre uma aula simples: lista de
  exercícios, registro das séries e cronômetro. *(1c)*
  Por quê: sem registro, a aula não desconta do pacote e o saldo fica errado.
