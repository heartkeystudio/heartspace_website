# Discord — contrato entre o painel e o Hub

O painel é a fonte de configuração online. O Hub usa somente os identificadores já definidos; nunca pede tokens do Discord nem permite que alguém troque o servidor do estúdio localmente.

## O que o painel administra

1. Cada pessoa conecta a própria conta Discord para escolher servidores dos quais participa.
2. Owner ou Admin vincula um único servidor ao estúdio (`studio_discord_links`). O bot HeartSpace precisa estar nesse servidor.
3. Owner ou Admin escolhe um canal existente para cada projeto (`project_discord_channels`).

Os tokens OAuth são criptografados e ficam somente em `discord_connections`. O Hub não deve ler ou armazenar esses tokens.

## O que o Hub deve fazer

Ao abrir ou sincronizar um projeto, o Hub lê apenas a linha com `project_id` em `project_discord_channels`:

```text
project_id, studio_id, guild_id, channel_id, channel_name
```

Use `channel_id` como destino de mensagens. Para enviar e listar mensagens, mantenha o uso da Edge Function `discord-messages`; ela usa o token do bot no servidor. Não use o token da conta da pessoa.

Quando não houver uma linha para o projeto, o Hub pode pedir que o backend crie o canal padrão `hs-nome-do-projeto` e grave a linha. O site sempre prevalece quando uma pessoa escolhe manualmente outro canal.

## Funções Supabase

- `discord-connect`: inicia OAuth para a pessoa autenticada.
- `discord-oauth-callback`: recebe o retorno do Discord, cifra os tokens e volta para `/account/?discord=connected`.
- `discord-status`: informa se a pessoa conectou uma conta.
- `discord-studio`: lista servidores e canais, vincula o servidor do estúdio e grava o canal escolhido para um projeto.
- `discord-messages`: envio e leitura de mensagens pelo bot.

Os segredos exigidos continuam sendo `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `DISCORD_STATE_SECRET` e `DISCORD_BOT_TOKEN`. O callback também usa `HEARTSPACE_ACCOUNT_URL` para retornar ao painel.

## Regras de produto

- Uma integração Discord é compartilhada pelo estúdio, não por projeto individual.
- Canal por projeto é uma referência, não uma sincronização de permissões do Discord.
- Discord é comunicação complementar: tarefas, marcos e decisões oficiais continuam no HeartSpace. Assim evitamos conflito de origem ao integrar GitHub depois.
