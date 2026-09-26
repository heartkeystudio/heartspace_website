# HeartSpace Hub — sincronização em nuvem configurada pelo site

## Objetivo

O Hub não configura mais contas de nuvem. A conta compartilhada pertence ao estúdio e é conectada no painel web por Owner ou Admin. Cada projeto recebe uma pasta própria sob a raiz `HeartSpace — <estúdio>`.

O Hub continua local-first: trabalha na pasta local do usuário, compara manifestos e transfere alterações. O site apenas administra a origem online, permissões e credenciais de curta duração.

## O que nunca deve ficar no Hub

- `refresh_token` do Google, Dropbox ou qualquer provedor;
- `client_secret` OAuth;
- configuração permanente da conta do estúdio;
- autorização para trocar ou desconectar a conta de nuvem.

Esses dados ficam no backend do site, cifrados na tabela `studio_cloud_connections`.

## Contrato da Edge Function

O Hub usa a Function já existente:

```text
POST /functions/v1/exchange_drive_token
Authorization: Bearer <sessão Supabase do usuário>
apikey: <publishable key>
```

### Pedir autorização temporária no momento da sincronização

```json
{ "action": "refresh", "project_id": "uuid-do-projeto" }
```

Resposta atual para Google Drive:

```json
{
  "provider": "google_drive",
  "access_token": "token-de-curta-duração",
  "expires_in": 3600,
  "folder_id": "id-da-pasta-do-projeto"
}
```

O Hub mantém esse token apenas em memória e o descarta ao encerrar a sincronização. Ao expirar, solicita outro. Nunca o grava no arquivo de configuração, cache, log, relatório de erro ou histórico do projeto.

## Fluxo de sincronização recomendado

1. O Hub autentica o usuário no HeartSpace.
2. Consulta `get_hub_project_cloud_sync`.
3. Pede `refresh` imediatamente antes de acessar o provedor. A Function procura primeiro a conexão compartilhada do estúdio; se não houver, mantém o fallback compatível para a conexão legada por projeto.
4. Lê e atualiza um manifesto interno em `.heartspace-sync/manifest.json` dentro da pasta remota do projeto.
5. Compara caminhos relativos, hash SHA-256, tamanho, data e versão local/remota.
6. Envia ou baixa apenas mudanças necessárias.
7. Em alterações concorrentes, preserva ambas as cópias: `arquivo (conflito - dispositivo - data).ext`. Nunca substitui silenciosamente o arquivo local.
8. Reporta ao backend, em uma ação futura, cursor, resultado, quantidades e último erro — sem enviar o conteúdo dos arquivos ao HeartSpace.

## Estrutura de arquivos remota

```text
HeartSpace — Estúdio
└── Nome do projeto
    ├── .heartspace-sync/
    │   └── manifest.json
    ├── assets/
    ├── docs/
    └── ...conteúdo do projeto
```

O identificador definitivo é `folder_id`, não o nome da pasta. Renomear uma pasta no Drive não deve quebrar a conexão.

## Permissões

- Owner/Admin: conectam ou desconectam a conta compartilhada e criam a pasta do projeto no site.
- Membro: pode sincronizar somente projetos aos quais já possui acesso no estúdio.
- Projeto arquivado: não emite token de sincronização.

No futuro, a regra de acesso do Hub pode ser refinada para exigir uma permissão de produção específica, como `cloud_sync`.

## Provedores futuros

O Hub deve tratar `provider` como uma interface, nunca como uma condição espalhada pelo código:

```text
CloudProviderAdapter
  listChanges(cursor)
  download(item)
  upload(item)
  delete(item)
  createFolder(name)
  getRevision(item)
```

Google Drive é o primeiro adaptador. Dropbox e OneDrive reutilizam a mesma configuração de estúdio, pasta por projeto, manifesto e política de conflitos; apenas OAuth e APIs de alteração diferem.

## Limite atual

O backend emite token temporário para Google Drive por meio da Function `exchange_drive_token`. O Hub mantém seu adaptador, manifesto, hashes, fila de transferências e tratamento de conflito; não é necessário manter uma tela de OAuth no aplicativo.
