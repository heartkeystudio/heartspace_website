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
| `get_profile` | `{ "action": "get_profile" }` | ficha privada da conta autenticada |
| `update_profile` | `{ "action": "update_profile", "full_name": "...", "age": 24, "profession": "...", "phone": "opcional" }` | conclui a ficha de primeiro acesso |
| `create_project` | `{ "action": "create_project", "studio_id": "...", "name": "...", "description": "opcional" }` | cria um projeto do estúdio que será reconhecido pelo Hub |
| `get_studio_admin` | `{ "action": "get_studio_admin", "studio_id": "..." }` | configurações, equipe, convites, referências de projeto e atividade |
| `update_studio` | `{ "action": "update_studio", "studio_id": "...", "name": "...", "description": "..." }` | configurações atualizadas por owner/admin |
| `update_member_role` | `{ "action": "update_member_role", "studio_id": "...", "target_id": "...", "role": "admin|member" }` | papel atualizado por owner |
| `remove_member` | `{ "action": "remove_member", "studio_id": "...", "target_id": "..." }` | acesso removido por owner |
| `revoke_invite` | `{ "action": "revoke_invite", "studio_id": "...", "target_id": "..." }` | convite pendente revogado por owner/admin |

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
