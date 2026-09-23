# heartspace-studios

Edge Function do gerenciador de estúdios. Ela aceita somente `POST`, valida o
JWT no servidor e usa a service role exclusivamente dentro da Function.

## Ações atuais

| ação | entrada | saída |
| --- | --- | --- |
| `list_studios` | `{ "action": "list_studios" }` | estúdios dos quais a conta participa |
| `create_studio` | `{ "action": "create_studio", "name": "...", "slug": "opcional" }` | estúdio criado e associação de owner |

Antes de publicar, aplique `account/SUPABASE_STUDIO_SCHEMA.sql` e configure o
segredo `HEARTSPACE_ALLOWED_ORIGINS` com os domínios públicos permitidos. A
Function usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` fornecidos pelo
ambiente Supabase; nunca coloque a service role no site.

Depois da publicação, configure a URL da Function em
`account/config.js` como `studioFunctionUrl`. Convites, troca de papéis e o
pareamento do Hub serão ações separadas, com auditoria própria.
