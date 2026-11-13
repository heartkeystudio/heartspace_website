# Domínios regionais do HeartSpace

## Política

- `https://www.heartspace.com.br` é a porta brasileira do produto.
- `https://www.heartspace.tools` continua como a porta internacional.
- Ambos servem a mesma aplicação e a mesma conta Supabase. Não há contas, estúdios ou dados duplicados.

Não redirecione visitantes automaticamente entre os domínios. A escolha explícita preserva links, idioma e sessão; quando a versão internacional ganhar conteúdo em inglês, ela pode ser tratada como `x-default` e a brasileira como `pt-BR`.

## Hospedagem e DNS

A migração para Cloudflare Pages está preparada em [`CLOUDFLARE_PAGES_MIGRATION.md`](../CLOUDFLARE_PAGES_MIGRATION.md). Associe `www.heartspace.tools` e `www.heartspace.com.br` ao mesmo projeto Pages e redirecione cada domínio raiz para seu `www` correspondente. Não redirecione brasileiros automaticamente para o domínio internacional.

O `CNAME` legado permanece no repositório para facilitar rollback ao GitHub Pages; ele não associa domínios no Pages. Faça a troca de DNS somente após conferir a prévia e a emissão TLS no Pages.

## Supabase

Em **Authentication → URL Configuration**, adicione:

```text
https://www.heartspace.com.br/account/
https://heartspace.com.br/account/
https://www.heartspace.tools/account/
https://heartspace.tools/account/
```

Atualize o segredo da Function principal e faça deploy:

```bash
npx supabase@latest secrets set --project-ref yhjetfilhsjtjfvgqfod \
  HEARTSPACE_ALLOWED_ORIGINS="https://heartspace.tools,https://www.heartspace.tools,https://heartspace.com.br,https://www.heartspace.com.br"

npx supabase@latest functions deploy heartspace-studio --project-ref yhjetfilhsjtjfvgqfod --no-verify-jwt
npx supabase@latest functions deploy github-oauth-start --project-ref yhjetfilhsjtjfvgqfod --no-verify-jwt
npx supabase@latest functions deploy github-project-status --project-ref yhjetfilhsjtjfvgqfod --no-verify-jwt
```

O domínio usado no callback de GitHub ainda é o configurado em `GITHUB_OAUTH_REDIRECT_URI`. Por enquanto mantenha-o em `www.heartspace.tools`; após o callback, a conta funciona nos dois domínios. Uma próxima etapa pode preservar o domínio de origem também nesse retorno.
