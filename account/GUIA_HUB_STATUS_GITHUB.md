# Guia para o Hub — status técnico do GitHub

## Objetivo

O Hub exibe o contexto técnico de um projeto sem acessar diretamente o GitHub. A configuração, a chave privada do GitHub App e os tokens temporários ficam exclusivamente no servidor e no painel web.

## Regra de segurança

O Hub **não deve** receber nem salvar:

- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_WEBHOOK_SECRET`
- token de instalação do GitHub
- token OAuth de uma pessoa

O Hub já possui a sessão HeartSpace da pessoa. Use-a para chamar a Edge Function existente.

## Chamada

**Endpoint:**

```text
https://yhjetfilhsjtjfvgqfod.supabase.co/functions/v1/heartspace-studio
```

**Método:** `POST`

**Headers:**

```text
Authorization: Bearer <access_token_da_sessao_HeartSpace>
apikey: <publishable_key_do_Supabase>
Content-Type: application/json
```

**Body:**

```json
{
  "action": "get_hub_project_github_status",
  "project_id": "uuid-do-projeto"
}
```

## Resposta

Quando ainda não houver repositório vinculado ou nenhum status tiver sido consultado pelo site:

```json
{ "snapshot": null }
```

Quando houver dados:

```json
{
  "snapshot": {
    "repository_full_name": "organizacao/repositorio",
    "default_branch": "main",
    "open_pull_requests": 2,
    "open_issues": 5,
    "open_milestones": 1,
    "checks_state": "passing",
    "latest_release_name": "v0.8.0",
    "latest_release_url": "https://github.com/organizacao/repositorio/releases/tag/v0.8.0",
    "fetched_at": "2026-09-27T12:00:00.000Z",
    "payload": {
      "pulls": [
        { "number": 42, "title": "Adicionar inventário", "html_url": "https://github.com/...", "updated_at": "..." }
      ],
      "issues": [
        { "number": 19, "title": "Corrigir colisão", "html_url": "https://github.com/...", "updated_at": "..." }
      ]
    }
  }
}
```

`checks_state` pode ser `passing`, `attention` ou `unknown`.

## Interface sugerida no Hub

Na página de resumo do projeto, crie um bloco compacto **GitHub**:

1. Nome do repositório e branch.
2. Três contadores: PRs abertos, issues abertas e milestones.
3. Selo de checks: verde para `passing`, amarelo/vermelho para `attention`, neutro para `unknown`.
4. Release mais recente como link externo, se existir.
5. Lista curta dos PRs e issues do `payload`, com ação “Abrir no GitHub”.
6. Data `fetched_at` para deixar claro que é um snapshot, não uma cópia local em tempo real.

Se `snapshot` for `null`, mostre uma ação informativa: “Configure o GitHub no painel web do HeartSpace”. O Hub não deve tentar instalar o App nem pedir URL de repositório.

## Atualização

O painel web consulta o GitHub e atualiza o snapshot. Webhooks registram novos eventos, mas não entregam tokens ao Hub. No Hub, carregue o snapshot ao abrir o projeto e permita “Atualizar” apenas como nova leitura da Function; não faça polling contínuo.

## Limite desta primeira versão

O Hub consome contexto técnico. Ele ainda não cria issues, PRs, releases nem sincroniza tarefas automaticamente. Qualquer conversão de issue/PR em tarefa HeartSpace deve ser uma ação explícita em uma próxima fase.
