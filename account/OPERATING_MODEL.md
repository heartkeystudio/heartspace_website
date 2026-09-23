# Modelo operacional: Site, Hub e serviços

## Uma identidade, dois lugares de uso

O HeartSpace usa uma única conta Supabase. O site e o Hub jamais criam contas
separadas: ambos identificam a pessoa pelo mesmo `auth.users.id`.

| Camada | Responsabilidade | Não deve fazer |
|---|---|---|
| Site | entrada, recuperação de acesso, perfil, segurança, assinatura, faturas, membros, convites, publicações públicas | editar arquivos e operar apps de produção |
| Hub | trabalhar offline, abrir projetos, instalar apps, sincronizar, abrir Docs/Tasks/Canvas e guardar arquivos locais | cobrar, gerir cartão/fatura ou manter regras de plano |
| Backend | autorização, papéis, convites, entitlement lease, publicação e auditoria | confiar em valores ou permissões enviados pelo navegador/Hub |

Assim, a pessoa faz administração no site e criação no Hub, sem duas telas para
o mesmo assunto.

## Fluxo recomendado

1. A pessoa cria ou acessa a conta no site.
2. O site apresenta conta, estúdios, convites, plano e documentos públicos.
3. Ao abrir o Hub, ele pede apenas **Conectar esta instalação**.
4. O Hub cria um pedido de vínculo de uso único, com expiração curta.
5. O site autenticado confirma a instalação; o backend entrega ao Hub uma
   sessão própria e curta.
6. O Hub busca o perfil, os estúdios e o entitlement lease. Só então libera
   recursos online; criação local continua disponível no plano gratuito.

## Vínculo seguro de instalação

Não passar `access_token` ou `refresh_token` pela URL, deep link, QR code ou
clipboard. Em vez disso, criar três operações de backend:

| Operação | Quem chama | Resultado |
|---|---|---|
| `hub_link_start` | Hub sem sessão | `request_id`, código curto e expiração de 5 minutos |
| `hub_link_confirm` | Site autenticado | associa o pedido ao usuário, após confirmação visual |
| `hub_link_exchange` | Hub | sessão do Hub uma única vez, ou estado pendente/expirado |

Regras obrigatórias: `request_id` aleatório e não enumerável, uso único,
expiração, limite de tentativas, auditoria de dispositivo/data/IP e revogação
pela página de segurança do site. O backend deve validar a conta, a associação
e a validade de cada pedido.

## O que migra do Hub para o site

- login, cadastro, recuperação e sessões/dispositivos;
- perfil, conta e segurança;
- plano, checkout, faturas e cancelamento;
- criação de estúdio, membros, papéis e convites;
- configurações de publicação pública e retirada de conteúdo.

O Hub mantém apenas uma visão resumida: conta conectada, estúdio ativo, papel,
plano efetivo e botão **Gerenciar no site**.

## Ordem de implementação

1. Criar as tabelas/Edge Function do vínculo de instalação e a página de
   confirmação no site.
2. Trocar o callback OAuth direto do Hub pelo vínculo de uso único.
3. Mover membros/convites e gerenciamento de estúdio para o site.
4. Criar `heartspace-billing`; o Hub lê somente o entitlement lease.
5. Adicionar sessões/dispositivos e opção de revogar instalações no site.

## Fundação de dados para estúdios

`SUPABASE_STUDIO_SCHEMA.sql` contém a primeira migration para perfis, estúdios,
membros, convites, referências de projetos e auditoria. Ela aplica RLS desde o
início: cada pessoa lê apenas os estúdios dos quais participa, e o navegador
não tem permissão direta para criar estúdios, alterar papéis ou aceitar convites.

Essas mutações pertencem a Edge Functions autenticadas, que validam JWT, papel,
limites do plano e transições de estado. O token puro de convite nunca entra no
banco; somente o hash gerado no servidor é armazenado.
