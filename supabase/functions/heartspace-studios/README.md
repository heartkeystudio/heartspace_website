# heartspace-studio

Edge Function do gerenciador de estúdios. As operações da aplicação aceitam
`POST`, validam o JWT no servidor e usam a service role exclusivamente dentro
da Function. O callback OAuth do Google Drive é a exceção: ele recebe `GET`
com estado temporário e de uso único.

## Ações atuais

| ação | entrada | saída |
| --- | --- | --- |
| `list_studios` | `{ "action": "list_studios" }` | estúdios dos quais a conta participa |
| `create_studio` | `{ "action": "create_studio", "name": "...", "slug": "opcional" }` | estúdio criado e associação de owner |
| `create_invite` | `{ "action": "create_invite", "studio_id": "...", "email": "...", "role": "admin|member" }` | link de convite de uso único, válido por 7 dias |
| `accept_invite` | `{ "action": "accept_invite", "token": "..." }` | associação da conta convidada ao estúdio |
| `get_profile` | `{ "action": "get_profile" }` | ficha privada da conta autenticada |
| `update_profile` | `{ "action": "update_profile", "full_name": "...", "age": 24, "profession": "...", "phone": "opcional" }` | conclui a ficha de primeiro acesso |
| `create_project` | `{ "action": "create_project", "studio_id": "...", "name": "...", "description": "opcional" }` | cria um projeto do estúdio que será reconhecido pelo Hub |
| `get_studio_admin` | `{ "action": "get_studio_admin", "studio_id": "..." }` | configurações, equipe, convites, referências de projeto e atividade |
| `update_studio` | `{ "action": "update_studio", "studio_id": "...", "name": "...", "description": "..." }` | configurações atualizadas por owner/admin |
| `update_member_role` | `{ "action": "update_member_role", "studio_id": "...", "target_id": "...", "role": "admin|member" }` | papel atualizado por owner |
| `remove_member` | `{ "action": "remove_member", "studio_id": "...", "target_id": "..." }` | acesso removido por owner |
| `revoke_invite` | `{ "action": "revoke_invite", "studio_id": "...", "target_id": "..." }` | convite pendente revogado por owner/admin |
| `get_cloud_sync` | `{ "action": "get_cloud_sync", "studio_id": "..." }` | conexão compartilhada e pastas de cada projeto |
| `start_google_drive_connection` | `{ "action": "start_google_drive_connection", "studio_id": "..." }` | URL OAuth para Owner/Admin conectar a conta do estúdio |
| `configure_project_cloud_sync` | `{ "action": "configure_project_cloud_sync", "studio_id": "...", "project_id": "..." }` | cria/atualiza a pasta online do projeto |
| `get_hub_project_cloud_sync` | `{ "action": "get_hub_project_cloud_sync", "project_id": "..." }` | metadados seguros de sincronização para o Hub |
| `issue_hub_cloud_access` | `{ "action": "issue_hub_cloud_access", "project_id": "..." }` | token de acesso curto, mantido apenas em memória pelo Hub |
| `request_desktop_magic_link` | versão 1, e-mail, state, porta loopback e challenge PKCE do Core | envia OTP somente após validar o acesso ao beta; resposta não revela se o e-mail está aprovado |

## Login desktop do Core (protocolo v1)

O login desktop usa PKCE do Core e não cria sessão no navegador. A ação
`request_desktop_magic_link` valida `protocol_version`, e-mail, `state`, porta
entre 1024 e 65535, `code_challenge` e `code_challenge_method: "S256"`. Para
e-mails aprovados, a Function chama diretamente `/auth/v1/otp` com o challenge
recebido e o método `s256`; não usa o SDK Admin para gerar um verificador
concorrente. E-mails não aprovados recebem a mesma resposta `200 {"ok":true}`.
Limites de envio da API Auth são preservados como `429`; a Function não registra
o link, o código nem o corpo enviado ao Auth.

Antes de publicar a Function e o site:

1. Inclua `https://www.heartspace.tools/login/desktop-callback/` na allowlist de
   redirects do Supabase Auth, mantendo o domínio e o caminho exatos e permitindo
   somente a query dinâmica prevista no documento `CORE_DESKTOP_AUTH_V1.md` do
   projeto HeartSpace.
2. Confirme que o template de confirmação usa a URL de confirmação do Supabase
   e preserva o `redirect_to` para que o retorno chegue como `?code=...` junto
   de `protocol_version`, `state` e `port`. Não configure retorno de tokens em
   fragmento.
3. Se a Function não receber a variável padrão `SUPABASE_ANON_KEY`, configure-a
   com a chave pública de Auth do mesmo projeto. A service role continua apenas
   no servidor.
4. O domínio publicado usa GitHub Pages atrás do Cloudflare e atualmente não
   envia `Cache-Control: no-store` para páginas HTML. Crie no Cloudflare uma
   regra de resposta para `/login/desktop-callback/*` que defina
   `Cache-Control: no-store` e `Referrer-Policy: no-referrer`, além de ignorar
   cache nessa rota. A meta `no-referrer` da página é defesa adicional; ela não
   substitui o cabeçalho HTTP. A integração não está pronta para produção até
   essa regra estar ativa e verificada.
5. Se CAPTCHA estiver habilitado no Auth, a ação retorna `CAPTCHA_REQUIRED` e
   não contorna a proteção. Adapte a tela para coletar e encaminhar o desafio
   antes de ativar o fluxo desktop.

O callback do site valida os parâmetros, remove query/fragment da barra de
endereço antes de qualquer navegação adicional e mantém os valores somente em
memória. O botão navega para o IP loopback e caminho fixos definidos no contrato;
somente o Core troca o código por uma sessão.

Antes de publicar, aplique `account/SUPABASE_STUDIO_SCHEMA.sql` e configure o
segredo `HEARTSPACE_ALLOWED_ORIGINS` com os domínios públicos permitidos. A
Function usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` fornecidos pelo
ambiente Supabase; nunca coloque a service role no site.

No dashboard do Supabase, publique esta Function com o nome
**`heartspace-studio`**. A pasta local conserva o nome plural apenas para
organizar o código; a URL configurada no site é singular:
`/functions/v1/heartspace-studio`.

Como o callback OAuth não possui JWT, publique esta Function com a verificação
de JWT do gateway desativada (`--no-verify-jwt`). As ações `POST` continuam
validando o Bearer token explicitamente no código; o callback aceita somente
um `state` aleatório, com validade de dez minutos e uso único.

Depois da publicação, configure a URL da Function em `account/config.js` como
`studioFunctionUrl`. Antes das duas ações de convite, aplique também
`account/SUPABASE_STUDIO_INVITES.sql` e
`account/SUPABASE_INVITE_PROFILE_BRIDGE.sql`. Para o console completo de
configurações, equipe, revogação e auditoria, aplique também
`account/SUPABASE_STUDIO_ADMINISTRATION.sql`. O pareamento do Hub permanece
uma ação separada, com auditoria própria.

Em projetos que já utilizam a tabela legada `public.profiles` do Hub, aplique
também `account/SUPABASE_PROFILE_AUTH_SYNC.sql`. Ela cria uma sincronização
não destrutiva de e-mail e nome entre Auth e o perfil público, evitando que o
Hub receba `null` após uma conta ser vinculada a um estúdio.

Para ativar a ficha inicial do site, aplique também
`account/SUPABASE_PROFILE_ONBOARDING.sql`. Nome, idade e profissão são
obrigatórios; telefone é opcional e não é exposto automaticamente à equipe.

## Google Drive compartilhado

Antes de habilitar a seção **Nuvem** no painel, aplique
`account/SUPABASE_CLOUD_SYNC.sql` e configure estes segredos na Edge Function:

```text
GOOGLE_CLIENT_ID=<já usado pelo exchange_drive_token>
GOOGLE_CLIENT_SECRET=<já usado pelo exchange_drive_token>
DRIVE_TOKEN_SECRET=<já usado pelo exchange_drive_token>
HEARTSPACE_GOOGLE_REDIRECT_URI=https://yhjetfilhsjtjfvgqfod.supabase.co/functions/v1/heartspace-studio
HEARTSPACE_ACCOUNT_URL=https://www.heartspace.tools/account/
```

Cadastre exatamente o mesmo `HEARTSPACE_GOOGLE_REDIRECT_URI` nas credenciais OAuth
Web do Google e habilite a Google Drive API no projeto Google Cloud. O segredo
`DRIVE_TOKEN_SECRET` já cifra os refresh tokens no mesmo formato usado pela
Function `exchange_drive_token`; ele não pode ser adicionado ao site ou ao Hub.
O contrato completo do
aplicativo está em `account/INTEGRACAO_HUB_SINCRONIZACAO_NUVEM.md`.

Se a primeira versão de `SUPABASE_CLOUD_SYNC.sql` já foi aplicada antes desta
integração passar a reutilizar `DRIVE_TOKEN_SECRET`, execute uma vez também
`account/SUPABASE_CLOUD_SYNC_REPAIR.sql`.
