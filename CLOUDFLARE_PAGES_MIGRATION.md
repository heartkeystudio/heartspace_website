# Migração do site para Cloudflare Pages

Este site é HTML, CSS e JavaScript estáticos. As Edge Functions e migrações de banco continuam no Supabase; elas não são implantadas pelo Cloudflare Pages.

## Criar a prévia

No painel Cloudflare, abra **Workers & Pages → Create application → Pages → Connect to Git** e conecte o repositório `heartkeystudio/heartspace_website`:

- **Production branch:** `master`
- **Root directory:** raiz do repositório
- **Framework preset:** `None`
- **Build command:** deixe em branco
- **Build output directory:** `.`

Use o endereço `*.pages.dev` para conferir a implantação antes de associar qualquer domínio. A publicação da branch de produção pelo Git conectado é automática; faça a conexão quando estiver pronto para habilitar essa publicação.

## Associar os domínios

Depois de revisar a prévia, no projeto Pages vá a **Custom domains → Set up a domain** e adicione:

- `www.heartspace.tools`
- `www.heartspace.com.br`

Os dois nomes servem o mesmo site e a mesma conta Supabase. Não redirecione um domínio ao outro: `.com.br` é a entrada brasileira e `.tools` a internacional. Os domínios raiz `heartspace.tools` e `heartspace.com.br` devem redirecionar para suas variantes `www` por Redirect Rules no Cloudflare.

Para gerenciar os dois redirecionamentos de raiz no Cloudflare, ambos os domínios precisam estar ativos como zones na mesma conta. Para um subdomínio `www` isolado, também é possível manter o DNS em outro provedor e criar lá o CNAME indicado pelo Pages.

Cadastre cada hostname na tela **Custom domains** do projeto Pages. Não crie manualmente apenas um CNAME para `pages.dev`: a associação do hostname no projeto é necessária para o Pages ativá-lo e emitir TLS.

## Troca de tráfego

Faça a troca somente após conferir a versão em `pages.dev` e confirmar que os domínios estão ativos no Pages, com TLS válido. Na janela de mudança, remova ou substitua os registros DNS que ainda apontem ao GitHub Pages pelos registros indicados pelo Pages; não deixe o mesmo hostname conectado simultaneamente aos dois hosts. Mantenha a configuração de GitHub Pages disponível durante a validação para permitir rollback.

O arquivo `CNAME` continua no repositório durante a transição para facilitar o rollback ao GitHub Pages. Ele não configura um domínio no Cloudflare Pages; os hostnames são associados no painel Cloudflare.

## Rotas e cabeçalhos

O arquivo `_headers` define `Cache-Control: no-store` e `Referrer-Policy: no-referrer` na rota de callback do login desktop. Ele é aplicado pelo Pages a respostas de arquivos estáticos. As regras de cache/security existentes na zona Cloudflare também devem ser revisadas para evitar conflito.

## Pós-migração

1. Teste a página inicial e rotas como `/account/`, `/login/` e `/login/desktop-callback/` nos dois domínios.
2. Confira o login do site, retorno do login desktop, compartilhamento de documentos e chamadas às Supabase Functions.
3. Em Supabase Auth, mantenha os quatro redirects registrados em `account/DOMINIOS_REGIONAIS.md`.
4. Só desative GitHub Pages depois da validação e de um período de operação estável.

Referências oficiais: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [configuração de build](https://developers.cloudflare.com/pages/configuration/build-configuration/), [domínios personalizados](https://developers.cloudflare.com/pages/configuration/custom-domains/) e [cabeçalhos](https://developers.cloudflare.com/pages/configuration/headers/).
