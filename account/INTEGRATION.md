# Ativação de conta e assinatura

Esta pasta contém a interface pública da conta do HeartSpace. Ela só entra em
operação quando o Supabase e a Edge Function de billing forem configurados.

## Configuração pública do site

Edite `account/config.js` com valores próprios para o navegador:

```js
window.HEARTSPACE_ACCOUNT_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabaseAnonKey: "SUA_CHAVE_ANON_PUBLICA",
  studioFunctionUrl: "https://SEU-PROJETO.supabase.co/functions/v1/heartspace-studio",
  billingFunctionUrl: "https://SEU-PROJETO.supabase.co/functions/v1/heartspace-billing",
  plans: {
    indie: "indie",
    studio: "studio"
  }
};
```

`supabaseAnonKey` é uma chave pública e pode estar no site. Nunca adicione uma
service-role key, uma chave secreta do Stripe, um webhook secret ou preços a
esse arquivo.

Os identificadores em `plans` são apenas intenções de compra. A Edge Function
precisa ter uma lista própria dos IDs permitidos e decidir o preço do lado do
servidor.

## Supabase Auth

1. Ative Google no provedor de autenticação do projeto Supabase.
2. Cadastre `https://heartspace.tools/account/` em **Redirect URLs**.
3. Cadastre também a URL de desenvolvimento usada pela equipe, se houver.
4. Mantenha o callback nesta mesma página: ela recebe os tokens, consulta o
   usuário autenticado e guarda a sessão apenas enquanto a aba estiver aberta.
   Quando o Supabase fornecer um refresh token, a página renova a sessão sem
   transformar essa preferência em uma sessão persistente no navegador.
   A ação de sair limpa a sessão local e solicita a revogação no Supabase.
5. Faça uma tentativa de Google e outra de link mágico antes de publicar.

O Google precisa ter o domínio e a tela de consentimento configurados no
console do próprio provedor. O site não guarda segredo algum desse fluxo.

## Estúdios e convites

O painel administrativo usa uma única Function publicada no projeto como
`heartspace-studio`. O código-fonte permanece em
`supabase/functions/heartspace-studios/index.ts`; o nome da pasta não precisa
coincidir com o nome dado no dashboard do Supabase.

Antes de disponibilizar cada ação, aplique as migrations na ordem abaixo:

1. `SUPABASE_STUDIO_SCHEMA.sql`
2. `SUPABASE_STUDIO_FUNCTION_PERMISSIONS.sql`
3. `SUPABASE_STUDIOS_COMPATIBILITY.sql` — somente para a estrutura legada já
   existente deste projeto.
4. `SUPABASE_PROFILE_BRIDGE.sql` — necessário porque `studio_members` possui
   uma FK legada para `profiles`.
5. `SUPABASE_PROFILE_AUTH_SYNC.sql` — sincroniza e-mail e nome do Auth para o
   perfil legado, sem substituir dados que o Hub já tenha preenchido.
6. `SUPABASE_PROFILE_ONBOARDING.sql` — adiciona a ficha de primeiro acesso:
   nome, idade, profissão e telefone opcional.
7. `SUPABASE_STUDIO_INVITES.sql`
8. `SUPABASE_INVITE_PROFILE_BRIDGE.sql` — garante a mesma ponte de perfil ao
   aceitar um convite.
9. `SUPABASE_STUDIO_ADMINISTRATION.sql` — libera configurações, papéis,
   remoção de membros, revogação e auditoria no console.
10. `SUPABASE_STUDIO_ICONS.sql` — cria o bucket público de ícones leves de
    estúdio. O site reduz cada imagem para até 64 × 64 antes do envio.
11. `SUPABASE_PROJECT_IMAGES.sql` — cria o bucket público de imagens; mantém
    `cover_image` como perfil quadrado que o Hub já consome e adiciona
    `banner_image` para a capa horizontal (até 1600 × 900 e 600 KB).

No dashboard, publique/atualize a Function com o nome **`heartspace-studio`**
e configure `HEARTSPACE_ALLOWED_ORIGINS` com
`https://heartspace.tools,https://www.heartspace.tools`. A service role fica
somente no ambiente da Function; o navegador usa apenas a publishable key.

## Edge Function `heartspace-billing`

O site segue o contrato de billing já definido para o HeartSpace Hub:

| ação | corpo enviado pelo site | retorno exigido |
|---|---|---|
| `get_entitlements` | `{ "action": "get_entitlements" }` | `{ "entitlement_lease": { "plan", "features", "expires_at_unix" } }` |
| `create_checkout` | `{ "action": "create_checkout", "plan_id" }` | `{ "checkout_url" }` |
| `create_portal` | `{ "action": "create_portal" }` | `{ "portal_url" }` |

Todas as chamadas levam o token do usuário em `Authorization: Bearer …`. A
função precisa validar o token e nunca aceitar preço, recurso ou permissão que
venha do navegador.

## Retorno do Stripe

Ao criar a Checkout Session, a Edge Function deve mandar o cliente de volta
para uma destas URLs após o fluxo:

- sucesso: `https://heartspace.tools/account/?checkout=success`
- cancelamento: `https://heartspace.tools/account/?checkout=cancelled`

O webhook do Stripe continua sendo a fonte de verdade: valida o evento,
atualiza a assinatura e produz o lease antes de a conta exibir os recursos.
Não libere um plano com base apenas no parâmetro `checkout=success`.

## Checklist de publicação

- [ ] Google OAuth e link mágico testados em produção.
- [ ] Redirect URLs cadastradas no Supabase.
- [ ] CORS da Edge Function permite `https://heartspace.tools`.
- [ ] `create_checkout` aceita apenas IDs de plano conhecidos no servidor.
- [ ] Webhook Stripe validado e capaz de atualizar o lease.
- [ ] Retornos de sucesso e cancelamento testados.
- [ ] Portal do Stripe abre somente para a conta autenticada correta.
