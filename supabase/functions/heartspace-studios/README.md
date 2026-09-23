# heartspace-studio

Edge Function do gerenciador de estúdios. Ela aceita somente `POST`, valida o
JWT no servidor e usa a service role exclusivamente dentro da Function.

## Ações atuais

| ação | entrada | saída |
| --- | --- | --- |
| `list_studios` | `{ "action": "list_studios" }` | estúdios dos quais a conta participa |
| `create_studio` | `{ "action": "create_studio", "name": "...", "slug": "opcional" }` | estúdio criado e associação de owner |
| `create_invite` | `{ "action": "create_invite", "studio_id": "...", "email": "...", "role": "admin|member" }` | link de convite de uso único, válido por 7 dias |
| `accept_invite` | `{ "action": "accept_invite", "token": "..." }` | associação da conta convidada ao estúdio |

Antes de publicar, aplique `account/SUPABASE_STUDIO_SCHEMA.sql` e configure o
segredo `HEARTSPACE_ALLOWED_ORIGINS` com os domínios públicos permitidos. A
Function usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` fornecidos pelo
ambiente Supabase; nunca coloque a service role no site.

No dashboard do Supabase, publique esta Function com o nome
**`heartspace-studio`**. A pasta local conserva o nome plural apenas para
organizar o código; a URL configurada no site é singular:
`/functions/v1/heartspace-studio`.

Depois da publicação, configure a URL da Function em `account/config.js` como
`studioFunctionUrl`. Antes das duas ações de convite, aplique também
`account/SUPABASE_STUDIO_INVITES.sql` e
`account/SUPABASE_INVITE_PROFILE_BRIDGE.sql`. Troca de papéis e pareamento do
Hub serão ações separadas, com auditoria própria.
