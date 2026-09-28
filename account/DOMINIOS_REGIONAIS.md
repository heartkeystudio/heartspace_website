# Domínios regionais do HeartSpace

## Política

- `https://www.heartspace.com.br` é a porta brasileira do produto.
- `https://www.heartspace.tools` continua como a porta internacional.
- Ambos servem a mesma aplicação e a mesma conta Supabase. Não há contas, estúdios ou dados duplicados.

Não redirecione visitantes automaticamente entre os domínios. A escolha explícita preserva links, idioma e sessão; quando a versão internacional ganhar conteúdo em inglês, ela pode ser tratada como `x-default` e a brasileira como `pt-BR`.

## Hospedagem e DNS

O arquivo `CNAME` deste repositório contém somente `www.heartspace.tools`. Isso é normal: GitHub Pages permite apenas um domínio principal por repositório.

1. Mantenha `www.heartspace.tools` como domínio principal do host atual.
2. No provedor do domínio `.com.br`, crie `www.heartspace.com.br` como alias/proxy para o mesmo host de produção. Se usar Cloudflare, prefira um **CNAME flattening** ou uma regra de proxy; se o host oferecer “custom domain alias”, cadastre-o nele.
3. Crie redirecionamentos de ápice: `heartspace.com.br` → `www.heartspace.com.br` e `heartspace.tools` → `www.heartspace.tools`.
4. Emita SSL para os quatro endereços antes de divulgar o domínio brasileiro.

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
