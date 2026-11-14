# Segurança

As regras que todo código do app segue. Curtas de propósito: as que podem ser testadas são
conferidas pelo `src/security.test.ts`, que roda em todo build.

- **Entra aqui:** as regras de segurança e de privacidade.
- **Não entra aqui:** como cada regra foi implementada (`adr/`) e o que falta verificar (issues
  `t:debito-tecnico` e `t:vulnerability`).

## 1. Rede

- O app fala só com a própria origem (o Worker) e com as listadas em `network-policy.ts`; a CSP abre
  `connect-src` e `img-src` só para elas. O servidor (`server/`) chama só as origens de
  `SERVER_ORIGINS`.
- As chamadas de rede ficam em `src/infrastructure/`; o resto do código não as faz.
- Sem analytics nem telemetria de terceiros sem uma decisão registrada num ADR. O Wrangler roda com
  `send_metrics: false`.
- Segredos nunca vão para o código do cliente: tudo que está no bundle é público. O segredo do login
  Google, e qualquer chave de API, ficam só no Worker (`wrangler secret put`; localmente no `.dev.vars`).
- **Dados que o app guarda:** dos alunos, nome, telefone, endereços, data de nascimento, altura,
  contato de emergência, pacotes, pagamentos, agenda, treinos e séries; a partir da fase 1c, termo
  assinado, PAR-Q, alertas de saúde e PSE; na fase 2, laudos de bioimpedância e fotos. Dos membros,
  nome, e-mail e foto da conta Google.
- **Sensíveis (LGPD):** anamnese, PAR-Q, alertas de saúde, laudos e fotos. Só entram depois do termo
  assinado (`spec/termo-e-lgpd.md`), nunca vão em mensagens de WhatsApp nem em logs, e saem do app só
  pela exportação. Dinheiro (pagamentos) não é sensível pela LGPD, mas segue as mesmas regras.
- **WhatsApp:** o app só abre um link `https://wa.me/` com o texto pronto, que o próprio membro
  envia; não chama nenhuma API do WhatsApp (ADR-008).

## 2. Acesso e dados

- Só entra quem tem convite para o e-mail da conta Google. Sem convite, nada é gravado.
- O login de teste sem Google (ADR-007) só existe com `DEV_SIGN_IN=1` no `.dev.vars` e em
  `localhost`; nunca no `wrangler.jsonc`.
- O app não acessa o banco. Toda leitura e escrita passa pela API, que confere a sessão e o papel
  no servidor.
- A sessão é um cookie `HttpOnly`, `Secure`, `SameSite=Lax`; o banco guarda só o hash do token.
  Remover um membro corta o acesso na hora.
- Toda chamada que muda dados, e a conexão ao vivo, precisa vir da própria origem do app (`Origin`).
- Segredos que chegam ao servidor (de webhooks, por exemplo) são comparados em tempo constante
  (`constantTimeEqual`).

## 3. Para todo app

- Texto do usuário nunca é inserido como HTML (`textContent`, nunca `innerHTML` ou `dangerouslySetInnerHTML`).
- Links abrem com `target="_blank" rel="noopener noreferrer"`.
- Dependências mínimas, com versões exatas, instaladas com `npm ci` e empacotadas no build; nada de CDN.
- A CSP é injetada no build de produção (ADR-002) e os cabeçalhos ficam em `public/_headers`.
- Nenhum dado pessoal vai para a URL: as entradas da API vão sempre no corpo JSON.
