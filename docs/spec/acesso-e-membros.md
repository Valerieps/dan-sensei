# Acesso e membros

Quem entra no app, como entra e o que cada papel pode fazer. Já vem construído no template.

- **Entra aqui:** login, convites, papéis, a lista de membros, remover membro e o nome no perfil.
- **Não entra aqui:** as features do app em si (cada uma no seu arquivo de `spec/`).

## Quem usa

- Só duas pessoas entram no app, as duas como admin: eu (Dan), que uso o app no trabalho, e a
  Valéria, que faz e mantém o app. *(1a)*
- A Valéria entra primeiro, pelo e-mail configurado no servidor, me convida e me dá o papel de
  admin. *(1a)*
- Alunos nunca entram no app: não têm conta, convite nem link. *(1a)*
  Por quê: o aluno usa o app só no meu iPad, na aula (ver `termo-e-lgpd.md` e `aula-ao-vivo.md`).
- Não há outros papéis além de admin e membro. *(1a)*

## Entrar

- Eu entro só com minha conta Google. Não há login com senha. *(1a)*
- Só entra quem tem convite para o e-mail da conta Google. Com outro e-mail, o app avisa que não há
  convite e não cria a conta. *(1a)*
- Os primeiros admins entram sem convite, pelos e-mails configurados no servidor, só enquanto o
  grupo não tem nenhum admin. *(1a)*
- Eu continuo conectado por 180 dias, até sair. *(1a)*
- Um código de acesso ou o Touch ID para abrir o app fica para a fase 2. *(2)*
  Por quê: o app guarda dados de saúde e fica num iPad que circula na casa dos alunos; na fase 1 o
  login com Google e o bloqueio do próprio iPad bastam.

## Papéis

| Papel | O que pode |
| --- | --- |
| Membro | Usar o app e ver a lista de membros |
| Admin | Tudo do membro; convidar e remover membros; dar e tirar o papel de admin |

- Pode haver mais de um admin. O app não deixa tirar o papel do último. *(1a)*

## Membros

- Todos os membros veem a lista do grupo, com nome, foto e papéis. O e-mail de cada um só o admin
  vê. *(1a)*
- O admin remove um membro depois de confirmar. Ele não remove a si mesmo: outro admin faz isso.
  Assim sempre sobra um admin. *(1a)*
- Quem é removido perde o acesso na hora, inclusive no app aberto. Um convite novo traz a pessoa de
  volta, com o mesmo histórico. *(1a)*

## Perfil

- Meu nome começa como o da conta Google, e eu posso mudar. Ele tem de 1 a 40 caracteres. *(1a)*
- A foto é a da conta Google e se atualiza a cada login. *(1a)*

## Convites

- O admin convida uma pessoa pelo e-mail dela. O convite fica ligado a esse e-mail e só vale para
  quem entra com a conta Google dele. *(1a)*
- O convite não expira. Ele deixa de valer só quando o admin o revoga. *(1a)*
- O admin vê a lista de convites pendentes e aceitos e pode revogar um pendente. *(1a)*
