# GitHub App — fundação do HeartSpace

## Estado desta entrega

O painel já grava um repositório GitHub por projeto em `project_github_repositories`. Isso permite definir a relação entre produção e código antes de conceder qualquer permissão ao GitHub.

O campo aceita somente URLs canônicas como `https://github.com/organizacao/repositorio` (sem token, SSH URL ou URL local). A leitura de issues, pull requests, milestones e releases continua desligada até a instalação do GitHub App.

## Modelo de origem dos dados

| Dado | Fonte principal | Uso no HeartSpace |
| --- | --- | --- |
| Código, commits, pull requests, releases e checks | GitHub | Estado técnico do projeto |
| Tarefas de produção, responsáveis, playtests e decisões | HeartSpace | Planejamento e contexto do estúdio |
| Milestones | HeartSpace inicialmente | Depois, associação opcional com milestone do GitHub |

Não haverá sincronização bidirecional automática no primeiro lançamento. Cada evento recebido do GitHub será mostrado como atualização técnica; uma pessoa decide quando transformá-lo em tarefa ou marco de produção.

## Quando criar o GitHub App

Crie um **GitHub App**, não um PAT pessoal. Configure:

- **Homepage URL:** `https://www.heartspace.tools/`
- **Webhook URL:** `https://yhjetfilhsjtjfvgqfod.supabase.co/functions/v1/github-webhook`
- **Webhook secret:** gere um valor aleatório e armazene-o como `GITHUB_WEBHOOK_SECRET` no Supabase.

Em **Redirect URI**, use `https://yhjetfilhsjtjfvgqfod.supabase.co/functions/v1/github-oauth-callback`. O painel abre a instalação em uma nova aba e, quando você retorna, pede uma confirmação OAuth explícita. Isso permite verificar que a pessoa também administra a instalação escolhida.

## Fluxo de vínculo no painel

1. Owner/Admin clica em **Instalar GitHub App** e conclui a instalação no GitHub.
2. De volta à aba do HeartSpace, clica em **Confirmar instalação**.
3. O GitHub autoriza a conta da pessoa e o servidor lista apenas as instalações desse App às quais ela tem acesso.
4. Havendo uma instalação, ela é vinculada automaticamente; havendo várias, Owner/Admin escolhe uma no painel.

Permissões iniciais mínimas:

- Repository contents: Read-only
- Issues: Read-only
- Pull requests: Read-only
- Checks: Read-only
- Metadata: Read-only (obrigatória)

Eventos iniciais:

- `installation`, `installation_repositories`
- `push`
- `pull_request`
- `issues`
- `milestone`
- `release`
- `check_suite`

Guarde a chave privada PEM apenas como secret `GITHUB_APP_PRIVATE_KEY`; nunca no site ou no Hub. Também serão necessários `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_REDIRECT_URI` e `GITHUB_WEBHOOK_SECRET`.

## Próxima entrega técnica

1. `github-oauth-start` e `github-oauth-callback` confirmam uma instalação acessível pela conta GitHub da pessoa e a registram em `studio_github_installations`.
2. `github-webhook` valida `X-Hub-Signature-256`, atualiza o estado técnico e registra eventos idempotentes.
3. O painel lista os repositórios autorizados pela instalação, substituindo a URL manual por um seletor validado.
4. A página do projeto mostra PRs abertos, issues, checks, releases e marcos vinculados.

## Snapshot para o Hub

A Function `github-project-status` cria no servidor um token de instalação que expira rapidamente, consulta o GitHub e grava um snapshot em `project_github_status_snapshots`. O Hub deve chamar a ação `get_hub_project_github_status` da Function `heartspace-studio` e usar somente o campo `snapshot` devolvido.

O snapshot contém o repositório, branch padrão, contagem de PRs/issues/milestones abertos, estado dos checks, release mais recente e pequenas listas de PRs/issues. A chave PEM e qualquer token de instalação permanecem exclusivamente no servidor.

Tokens de instalação devem ser gerados apenas no servidor e usados por pouco tempo. O Hub recebe somente os dados que precisar exibir; ele não recebe a chave privada do App.

> Segurança: a Setup URL recebe `installation_id`, mas esse parâmetro isolado não prova quem realizou a instalação. A próxima etapa inclui OAuth do usuário GitHub para confirmar que a instalação pertence à conta que a pessoa pode administrar antes de vinculá-la ao estúdio.
