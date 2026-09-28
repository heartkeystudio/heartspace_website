# Implementação do HeartSpace Docs para publicações públicas

Este guia define o que o HeartSpace Docs precisa implementar para criar publicações que conversem corretamente com o painel, com as páginas públicas e com o histórico de revisões do HeartSpace. O Docs continua sendo o lugar de escrever, revisar e aprovar; o site é a camada que publica, compartilha e administra a visibilidade.

O contrato atual já suporta snapshots textuais provenientes de revisões aprovadas. A primeira implementação do Docs deve priorizar esse fluxo antes de adicionar modelos visuais complexos, galerias e mídia embutida.

## Modelo mental

Uma página pública nunca deve depender do documento que está aberto no computador de alguém. Ela é sempre uma cópia imutável de uma revisão já aprovada.

```text
Documento no Docs
  → revisão salva
  → revisão aprovada
  → snapshot público
  → publicação no projeto
  → página pública do site
```

Editar o documento depois da publicação não altera a página publicada. Para atualizar uma página, a pessoa cria e aprova uma nova revisão e então republica o conteúdo.

## O que já existe no site

O painel possui a área **Publicações** por projeto. Ela permite definir metadados, estado e visibilidade. A Function `heartspace-studios` valida a ligação entre Docs, projeto e revisão aprovada.

A migração `supabase/migrations/20260925000300_docs_publications.sql` adiciona o histórico imutável de snapshots. As principais tabelas são:

| Tabela | Responsabilidade |
| --- | --- |
| `docs` | Documento de trabalho do HeartSpace Docs, associado a um projeto. |
| `doc_revisions` | Revisões do documento. A publicação exige uma revisão com `approved_at`. |
| `project_publications` | Registro vivo da página: título, slug, estado, visibilidade e snapshot atual. |
| `project_publication_revisions` | Histórico imutável de cada snapshot publicado. Não recebe edição nem exclusão de clientes. |

A página pública fica em `p/?id=<publication_id>`. Ela chama a ação pública `get_publication` e só exibe registros com `status: "published"`.

## Responsabilidades do HeartSpace Docs

O Docs precisa oferecer uma ação explícita chamada **Publicar no HeartSpace** ou **Criar publicação pública**. Essa ação só aparece quando:

1. O documento pertence ao projeto ativo.
2. O app Docs está habilitado naquele projeto.
3. A pessoa tem `manage_publications` ou `manage_workspace` no projeto, ou é Owner/Admin do estúdio.
4. Existe uma revisão aprovada e imutável para usar como origem.

Ao abrir a ação, o Docs mostra uma ficha de publicação com título, endereço, resumo, visibilidade e tipo de página. Um documento aprovado não é publicado automaticamente.

Depois de publicar, o Docs deve guardar no metadado local do documento:

```json
{
  "publication_id": "uuid-da-publicacao",
  "last_published_source_revision_id": "uuid-da-revisao",
  "last_published_source_revision_number": 14,
  "last_published_at": "2026-09-27T12:00:00Z",
  "public_url": "https://www.heartspace.tools/p/?id=uuid-da-publicacao"
}
```

Assim o Docs consegue informar se a página está atualizada, se há uma revisão aprovada aguardando publicação e abrir a página pública.

## Fluxos que o Docs deve oferecer

### Criar uma publicação

1. A pessoa escolhe **Publicar no HeartSpace**.
2. O Docs oferece a revisão aprovada mais recente, sem permitir publicar uma revisão não aprovada.
3. A pessoa escolhe um formato, completa os metadados e confirma.
4. O Docs gera um snapshot serializado e grava um pedido durável no projeto.
5. O Hub valida o pedido, chama a Function com a sessão temporária da pessoa e
   grava o recibo.
6. O Docs consome o recibo, salva o vínculo e mostra o endereço público.

### Atualizar conteúdo publicado

1. A pessoa edita o documento normalmente.
2. Salva uma nova revisão e passa pela aprovação.
3. O Docs identifica que a revisão aprovada é diferente da última publicada.
4. A pessoa escolhe **Atualizar publicação**.
5. O Docs envia o mesmo `publication_id` com o novo snapshot.

Cada atualização cria uma linha nova em `project_publication_revisions` e atualiza o snapshot atual da publicação. Não há sobrescrita do histórico.

### Alterar somente metadados

Para mudar título, resumo, slug, visibilidade ou retirar do ar sem criar uma revisão nova, o Docs chama `save_publication` somente com os metadados. Neste caso, não envie `source` nem `snapshot`; o site preserva o snapshot atual.

Não reenvie a mesma `source_revision_id` como uma nova publicação. O histórico possui unicidade por `publication_id` e `source_revision_id`; uma revisão aprovada só pode originar uma versão pública uma vez.

### Retirar do ar e restaurar

- **Retirar do ar** salva `status: "withdrawn"`. O link deixa de responder publicamente, mas o documento e o histórico permanecem.
- **Republicar** exige uma nova revisão aprovada com snapshot. Não reutilize silenciosamente a revisão que já originou uma versão pública.

## Contrato da API — Hub → site

O **Hub**, e não o Docs, chama a mesma Supabase Edge Function do painel. O
Docs só cria pedidos em `.heartspace/docs_publication_requests/`; assim ele não
precisa conhecer URL de Function, domínio público, token persistente ou detalhes
de transporte. O Hub usa a sessão temporária da própria pessoa para encaminhar
o pedido:

```text
POST {HEARTSPACE_ACCOUNT_CONFIG.studioFunctionUrl}
```

Use estes cabeçalhos:

```http
Authorization: Bearer <access_token_do_usuario>
apikey: <supabase_anon_key>
Content-Type: application/json
```

O Hub usa o token temporário da sessão da pessoa. Nunca use `service_role`,
chaves privadas ou tokens de outra pessoa. A Function confere associação ao
estúdio, projeto, app habilitado, cargos e aprovação da revisão no servidor.

### Corpo encaminhado pelo Hub para publicar uma revisão aprovada

```json
{
  "action": "save_publication",
  "studio_id": "uuid-do-estudio",
  "project_id": "uuid-do-projeto",
  "publication_id": "uuid-opcional-quando-atualiza",
  "title": "Press kit de Aurora Vale",
  "slug": "press-kit",
  "summary": "Informações oficiais, imagens e contatos para imprensa.",
  "source_url": "https://docs.heartspace.tools/documento/uuid",
  "visibility": "public",
  "status": "published",
  "source": {
    "document_id": "uuid-em-docs",
    "revision_id": "uuid-da-revisao-aprovada",
    "revision_number": 14,
    "format": "heartspace-docs-v1"
  },
  "snapshot": {
    "version": 1,
    "format": "heartspace-docs-v1",
    "blocks": []
  }
}
```

Validações aplicadas pelo site:

- `title`: 1 a 160 caracteres.
- `slug`: letras minúsculas, números e hífens; único dentro de cada projeto.
- `summary`: até 500 caracteres.
- `source_url`: opcional, HTTPS e até 2048 caracteres.
- `visibility`: `public` ou `unlisted`.
- `status`: `draft`, `published` ou `withdrawn`.
- `source` e `snapshot`: quando enviados, exigem `status: "published"`.
- A revisão precisa pertencer ao documento, o documento precisa pertencer ao projeto e a revisão precisa ter `approved_at`.

O retorno contém `publication.id`, que deve ser salvo pelo Docs.

Ele também devolve `publication.status`, `publication.published_at` e `public_url`. A URL canônica é calculada no servidor a partir de `HEARTSPACE_PUBLIC_SITE_URL` (com fallback para `https://www.heartspace.tools`), portanto o Hub e o Docs não precisam codificar domínio.

## Snapshot textual versão 1

O snapshot atual transporta apenas texto estruturado e o renderer público usa `textContent`; não há HTML, CSS, scripts, caminhos locais ou execução de conteúdo remoto.

```json
{
  "version": 1,
  "format": "heartspace-docs-v1",
  "blocks": [
    { "type": 1, "text": "Aurora Vale" },
    { "type": 0, "text": "Um jogo de aventura sobre explorar uma cidade esquecida." },
    { "type": 2, "text": "Informações rápidas" },
    { "type": 4, "text": "Plataformas: PC e Linux" },
    { "type": 4, "text": "Lançamento previsto: 2027" },
    { "type": 2, "text": "Contato" },
    { "type": 0, "text": "imprensa@estudio.example" }
  ]
}
```

| Tipo | Renderização atual | Uso recomendado no Docs |
| --- | --- | --- |
| `0` | Parágrafo | Texto normal, descrição, biografia e contatos. |
| `1` | `h1` | Título principal; use no máximo uma vez. |
| `2` | `h2` | Seção principal. |
| `3` | `h3` | Subseção. |
| `4` | Item de lista | Lista comum: fatos, plataformas, créditos ou links descritos em texto. |
| `5` | Item de lista | Lista numerada do Docs; no site v1 ainda aparece como lista textual. |
| `6` | Item de lista | Checklist do Docs; no site v1 ainda aparece como lista textual. |
| `7` | Citação | Depoimento, frase de imprensa ou declaração oficial. |
| `8` | Bloco de código | Trecho técnico preservado como texto monoespaçado. |
| `13` | Parágrafo | Texto simples compatível com o formato atual do Docs. |

Limites do contrato:

- Até 500 blocos por snapshot.
- Até 12.000 caracteres por bloco.
- Até 500 KB após serialização.
- Não use `file://`, `res://`, `user://`, HTML, atributos de evento ou JavaScript no texto.
- A ordem dos blocos é preservada; itens consecutivos aparecem na mesma lista.

O serializador do Docs deve ignorar blocos decorativos, controles internos, comentários privados, estados de seleção, URLs locais e qualquer conteúdo que não seja seguro para leitura pública.

## Formatos que o Docs deve disponibilizar

Os formatos são modelos de documento e uma ajuda de preenchimento. Todos produzem o mesmo snapshot v1 por enquanto; eles não exigem uma nova API.

### Press kit

Use para imprensa, criadores de conteúdo, parceiros e lojas. O modelo deve trazer, nesta ordem:

1. Nome do projeto.
2. Resumo curto.
3. Descrição completa.
4. Informações rápidas: gênero, plataformas, janela de lançamento, preço quando aplicável, idiomas, classificação indicativa e site.
5. História ou proposta do projeto.
6. Principais recursos em lista.
7. Créditos do estúdio e do projeto.
8. Contato de imprensa.
9. Links de mídia e materiais oficiais em texto.

O Docs sugere `title: "Press kit de Nome do Projeto"`, `slug: "press-kit"` e `visibility: "public"`. Para projetos ainda não anunciados, sugira `unlisted`.

### Página do projeto

Use para uma apresentação pública permanente: título, apresentação, contexto, recursos, status atual, equipe, links e contato.

### Atualização de desenvolvimento

Use para comunicar um marco, demo, teste ou mudança de direção: período, resumo, o que mudou, links externos, próximos passos e contato. Inclua data ou número no título para evitar colisão de slug.

### Comunicado de imprensa

Use para anúncio pontual: título, cidade e data, abertura, anúncio, citações, informações do projeto, contatos e links. A pessoa deve revisar cuidadosamente a visibilidade antes de publicar.

### Documento de referência público

Use para FAQ, manual, créditos, regras de comunidade ou wiki curta: título, introdução, seções hierárquicas, listas e data de atualização.

## Mídia e links no press kit

O renderer público v1 ainda não renderiza imagens, vídeo, tabelas, botões, anexos ou hyperlinks dentro do snapshot. Isso é uma limitação conhecida, não um erro do Docs.

Para o primeiro lançamento, o Docs deve:

- Manter o texto completo do press kit no snapshot.
- Publicar links HTTPS para uma pasta de mídia, trailer, página de loja ou download de logos como texto legível.
- Usar `source_url` apenas como link de retorno ao documento de origem quando ele puder ser público ou acessível à audiência desejada.
- Nunca expor URLs de disco local, caminhos `res://`/`user://` ou links que dependam de autorização privada.

Para uma evolução posterior, crie um `media_manifest` versionado no Docs com capa, logo, screenshots, trailer e arquivos para download. Essa extensão deve ser implementada junto ao site: o endpoint atual só aceita o snapshot textual e a página pública ainda não possui renderer de mídia.

```json
{
  "media_manifest": {
    "cover": { "url": "https://cdn.example/cover.webp", "alt": "Capa de Aurora Vale" },
    "gallery": [],
    "downloads": [],
    "trailer_url": "https://www.youtube.com/watch?v=..."
  }
}
```

Não envie esse manifesto ao endpoint atual até que a extensão seja feita no site.

## Estados, visibilidade e segurança

| Campo | Valor | Comportamento |
| --- | --- | --- |
| Estado | `draft` | Metadados salvos, invisível para o público. Não pode receber snapshot de revisão. |
| Estado | `published` | Página disponível e pode receber snapshot aprovado. |
| Estado | `withdrawn` | Página retirada do ar, com histórico preservado. |
| Visibilidade | `public` | Preparada para listagem pública futura e indexação quando essa camada existir. |
| Visibilidade | `unlisted` | Acessível somente pelo link direto; não usar em listas públicas. |

O Docs deve mostrar aviso claro antes de publicar publicamente e ao mudar de `unlisted` para `public`.

Visualizar ou editar documento não implica poder publicar. A permissão preferida é `manage_publications`; enquanto ela não estiver disponível em todos os modelos de cargo, aceite `manage_workspace`. Owner e Admin do estúdio também podem publicar. A Function é a autoridade final.

O snapshot nunca deve incluir comentários, histórico interno, autores privados, e-mails pessoais, tokens, dados de sessão, caminhos locais ou material protegido por NDA.

## Comunicação Docs ↔ Hub e sincronização de arquivos

O Docs é o ambiente de criação, edição, revisão e aprovação. O Hub é o orquestrador do projeto: entrega o contexto de sessão, escolhe a pasta local do projeto, observa alterações e envia arquivos à nuvem configurada no site. Essa separação é obrigatória para manter o Docs leve, permitir trabalho offline e nunca expor credenciais de provedores externos dentro do aplicativo.

```text
Docs salva no projeto local
  → grava pedido durável de sincronização
  → Hub adiciona à fila local
  → Hub consulta a configuração de nuvem definida no site
  → Hub envia ao Drive/pasta remota do projeto
  → Hub atualiza o status de sincronização
```

### Contexto recebido ao abrir pelo Hub

O Docs deve ser aberto pelo Hub sempre que possível. O contexto de abertura identifica, no mínimo, `studio_id`, `project_id`, a raiz local do projeto e uma alça temporária para trocar a sessão com o Session Broker local.

Após a troca, o Docs pode receber:

- token de sessão temporário do usuário para APIs HeartSpace/Supabase;
- configuração pública da API (`base_url` e chave publicável);
- identidade do usuário (`user_id`, e-mail e nome de exibição);
- capacidades efetivas do projeto, como `docs_view`, `docs_edit`, `docs_comment` e `manage_publications`;
- lease de plano/entitlements para recursos pagos;
- `docs_remote_schema_version`, atualmente `1`.

O arquivo de contexto não é uma credencial permanente. O Docs não pode persistir token, alça, Drive token, lease ou identidade no documento, em logs de produção, em arquivos exportados ou no repositório. Ao expirar a sessão, renove a alça pelo Broker ou mostre que a pessoa precisa reabrir o Docs pelo Hub.

O Docs precisa validar antes de qualquer operação remota que o `project_id` do contexto seja o mesmo do documento aberto. Um documento pertencente a outro projeto nunca deve ser salvo, publicado ou sincronizado usando o projeto ativo atual.

### Estrutura local obrigatória

Todos os dados de trabalho do Docs ficam dentro da pasta local definida no Hub para aquele projeto:

```text
<ProjectRoot>/
  Docs/
    ...documentos, capas, índices e anexos do Docs...
  .heartspace/
    sync_requests/
    docs_publication_requests/
    docs_publication_receipts/
```

Regras:

- O Docs cria e usa apenas `Docs/` para seus arquivos de trabalho. Não salve na raiz do projeto, em `Canvas/`, `Beats/`, `States/` ou em pastas globais do aplicativo.
- Caminhos enviados ao Hub são sempre relativos à raiz do projeto, usam `/` e não podem conter `..`, caminho absoluto, `res://`, `user://` ou `file://`.
- Arquivos temporários devem usar uma extensão temporária, como `.writing` ou `.tmp`, e só receber o nome definitivo após gravação atômica. O pedido de sync só é criado depois que o arquivo definitivo existir.
- O Docs não sincroniza cache de renderização, thumbnails regeneráveis, seleção de UI, histórico local, backups automáticos ou arquivos de sessão. Sincronize somente fonte de documento, metadados necessários, capas e anexos explicitamente vinculados.
- O Hub preserva a hierarquia abaixo de `Docs/` ao espelhar para a pasta `Docs` do projeto remoto. Não crie uma segunda pasta `HeartSpace`, `Drive` ou o nome do projeto dentro de `Docs/`.

### Pedido de sincronização para o Hub

Após criar, salvar, renomear, mover, importar ou remover uma versão persistente de arquivo, o Docs deve gravar um pedido JSON em:

```text
<ProjectRoot>/.heartspace/sync_requests/<id-unico>.json
```

Formato v1:

```json
{
  "schema_version": 1,
  "app_id": "docs",
  "project_id": "uuid-do-projeto",
  "relative_path": "Docs/gdd/combat.heartdoc",
  "changed_at_unix": 1790000000
}
```

O Hub aceita o Docs somente para caminhos iniciados por `Docs/`. Ele consolida pedidos repetidos para o mesmo arquivo e mantém a fila em disco; portanto, o Docs pode continuar salvando enquanto estiver offline sem tentar implementar seu próprio uploader ou repetir requisições HTTP.

Ao receber o pedido, o Docs mostra `Saved locally · waiting for HeartSpace sync`. O estado não deve ser tratado como `Synced` até haver uma confirmação do Hub ou uma reconciliação remota posterior. Se o Hub estiver fechado, a solicitação permanece no disco e será processada na próxima abertura.

### Drive e outros provedores configurados pelo site

Conta, permissões, pasta remota, OAuth e escolha de Drive pertencem ao site HeartSpace. O Docs não deve possuir tela de login Google, salvar refresh token, escolher pasta do Drive, chamar a API do Drive diretamente nem exibir segredo de provedor.

O Hub consulta a configuração do projeto e envia a fila apenas quando existe uma pasta remota válida. Caso a nuvem não esteja configurada, a alteração continua segura no computador e o Hub informa que a pessoa deve configurar a nuvem no site. Isso também vale para futuros provedores: o contrato do Docs continua sendo arquivo local + pedido de sync, sem código específico de Google Drive.

### Download, conflitos e trabalho offline

A primeira versão deve tratar o diretório local como cópia de trabalho ativa e o Hub como responsável pelo upload. Não sobrescreva um documento aberto quando uma cópia remota chegar.

Para a evolução de download/reconciliação, o Docs deve adotar estes campos em seu manifesto ou metadado por documento:

```json
{
  "document_id": "uuid",
  "revision_number": 14,
  "content_hash": "sha256-do-arquivo",
  "updated_at": "2026-09-27T12:00:00Z",
  "last_synced_hash": "sha256-da-ultima-versao-confirmada"
}
```

Política de conflito:

1. Sem mudança local desde `last_synced_hash`: pode baixar/aplicar a versão remota após confirmação segura.
2. Sem mudança remota: envia a cópia local normalmente.
3. Mudança nos dois lados: nunca sobrescreva silenciosamente. Crie uma cópia de conflito, por exemplo `combat (conflict - 2026-09-27).heartdoc`, e apresente comparação para a pessoa.
4. Revisões aprovadas e publicadas são imutáveis: conflito de arquivo de trabalho não pode alterar snapshot público nem histórico de publicação.

Enquanto estiver offline, a edição, as revisões locais, comentários pendentes e pedidos de sincronização continuam disponíveis. Ações que exigem autoridade do servidor — aprovar revisão compartilhada, publicar, alterar visibilidade, buscar menções remotas ou confirmar upload — devem mostrar estado pendente e ser repetidas somente com confirmação/idempotência segura quando a sessão voltar.

### Leitura no Hub, eventos e atualizações

O Hub é leitor leve da Wiki; o Docs continua sendo o editor completo. Ao salvar conteúdo, o Docs deve atualizar seus índices/metadados locais dentro de `Docs/` para que o Hub consiga listar livros, pranchetas, capas, estrutura e conteúdo de leitura sem abrir o executável do Docs.

O formato de leitura deve separar:

- metadados leves para a biblioteca do Hub: `document_id`, título, tipo, categoria, capa, ordem, `updated_at`, revisão atual e permissões de leitura;
- conteúdo estruturado do documento, carregado somente quando a pessoa abre a leitura;
- dados privados de edição, comentários de rascunho, cursores e caches, que não entram no leitor do Hub nem em snapshots públicos.

Quando houver alteração relevante, o Docs deve gravar o arquivo final, atualizar o índice e só então emitir o pedido de sync. A sequência inversa pode fazer o Hub ler índice apontando para arquivo inexistente. O Hub pode reabrir o leitor ou invalidar o cache depois de detectar o novo índice; o Docs não deve depender de reiniciar o Hub para tornar um livro novo visível.

Menções, comentários e revisão usam as permissões entregues pelo Hub e o Supabase como autoridade. O Docs pode criar notificações e comentários remotos usando a sessão do usuário, mas deve manter uma fila local idempotente se a rede cair. Cada operação precisa de um `client_operation_id` único para não duplicar comentário, menção ou notificação depois de uma tentativa incerta.

### Publicação via Hub

O Docs sempre cria um pedido de publicação para o Hub. Mesmo quando uma sessão
está ativa, o Hub é o único componente nativo que chama `save_publication`; sem
sessão ou com Hub fechado, o pedido apenas permanece durável até poder ser
processado:

```text
<ProjectRoot>/.heartspace/docs_publication_requests/<request_id>.json
```

O pedido precisa conter `schema_version: 1`, `request_id`, `app_id: "docs"`, `studio_id`, `project_id`, uma `operation` explícita e um `payload`. Operações aceitas pelo Hub:

- `publish`: cria uma publicação nova; não envie `publication_id`; exige `document_id`, `revision_id`, `revision_number`, título, slug, resumo, visibilidade e snapshot.
- `republish`: atualiza uma publicação existente com nova revisão aprovada; exige os mesmos campos de `publish` mais `publication_id`.
- `update_metadata`: altera título, slug, resumo, visibilidade ou estado sem enviar snapshot; exige `publication_id` e os metadados completos.
- `withdraw`: retira uma publicação do ar; exige `publication_id` e os metadados completos para o contrato atual da Function.

O Hub valida projeto, app habilitado, permissão e formato antes de chamar a Function `save_publication`. Não omita `operation` e não reutilize uma mesma `request_id`.

O retorno é gravado pelo Hub em:

```text
<ProjectRoot>/.heartspace/docs_publication_receipts/<request_id>.json
```

Estados esperados do recibo:

- `published`: guardar `publication_id`, URL pública e revisão publicada no metadado do documento;
- `rejected`: mostrar o erro para a pessoa e não reenviar automaticamente;
- sem recibo: manter como `Waiting for HeartSpace` e permitir cancelar a solicitação local.

Não crie um segundo pedido para a mesma revisão enquanto houver uma solicitação pendente. O `request_id` torna a operação rastreável, mas o Docs continua responsável por impedir duplicação visual e por respeitar a unicidade de revisão publicada.

## Checklist de implementação no Docs

- [ ] Garantir que `docs.project_id` seja conhecido no documento aberto.
- [ ] Criar e persistir revisões com `id`, `doc_id`, `revision_number`, `approved_by` e `approved_at`.
- [ ] Impedir publicação sem revisão aprovada.
- [ ] Criar a ficha com tipo, título, slug, resumo, visibilidade e estado.
- [ ] Implementar o serializador `heartspace-docs-v1` para os dez tipos aceitos.
- [ ] Remover conteúdo local, privado ou inseguro antes de gerar o snapshot.
- [ ] Chamar `save_publication` com o token da sessão da pessoa.
- [ ] Guardar `publication_id` e a última revisão publicada no metadado do documento.
- [ ] Mostrar “há alterações aprovadas ainda não publicadas” quando necessário.
- [ ] Permitir retirar do ar sem apagar documento nem histórico.
- [ ] Criar os modelos de Press kit, Página do projeto, Atualização, Comunicado e Referência pública.
- [ ] Tratar imagens, anexos e vídeo como links externos até existir o manifesto de mídia no site.
- [ ] Abrir somente com contexto do Hub e validar `studio_id`/`project_id` contra o documento aberto.
- [ ] Respeitar `docs_view`, `docs_edit`, `docs_comment` e `manage_publications` no cliente, mantendo o servidor como autoridade final.
- [ ] Salvar todos os dados de trabalho dentro de `Docs/` na pasta local definida pelo Hub.
- [ ] Atualizar primeiro o arquivo final e o índice de biblioteca; só depois criar o pedido de sync.
- [ ] Criar pedidos v1 em `.heartspace/sync_requests/` para cada arquivo persistente que precisa espelhar na nuvem.
- [ ] Não implementar upload direto para Google Drive, OAuth de provedor ou persistência de credenciais no Docs.
- [ ] Exibir separadamente `Saved locally`, `Waiting for HeartSpace sync`, `Synced` e `Sync needs attention`.
- [ ] Excluir cache, thumbnails regeneráveis, sessão e conteúdo privado da fila de sync e dos snapshots públicos.
- [ ] Preparar hash e revisão por documento para download/reconciliação sem sobrescrita silenciosa.
- [ ] Criar cópia de conflito quando versões local e remota forem modificadas desde a última sincronização.
- [ ] Implementar pedido/recibo de publicação para continuidade quando a sessão do Docs estiver indisponível.
- [ ] Usar identificador de operação idempotente em comentários, menções e notificações pendentes.

## Testes de aceite

1. Pessoa sem permissão de publicação não vê a ação e recebe `403` se chamar a API.
2. Revisão não aprovada retorna erro e não cria página pública.
3. Revisão aprovada do projeto correto cria uma publicação `published` e abre em `p/?id=<id>`.
4. Conteúdo público continua igual depois que o documento de trabalho é alterado.
5. Nova revisão aprovada cria uma entrada em `project_publication_revisions` e atualiza a página.
6. Tentar publicar a mesma revisão duas vezes é bloqueado pelo Docs antes da API.
7. `withdrawn` torna a página indisponível, sem apagar documento ou histórico.
8. Snapshot com HTML, JavaScript ou caminho local é recusado.
9. Press kit com listas e citações aparece com hierarquia correta na página pública.
10. Link de mídia HTTPS aparece como texto seguro, sem expor arquivos privados.
11. Salvar um documento cria arquivo dentro de `Docs/` e pedido válido em `.heartspace/sync_requests/`; o Hub envia o arquivo para a pasta remota `Docs/` sem criar níveis duplicados.
12. Com o Hub fechado ou a nuvem desconectada, o Docs mostra salvamento local e o pedido permanece até o Hub voltar, sem perda nem duplicação.
13. O Docs não contém refresh token, segredo de provedor ou login Google e não faz upload direto ao Drive.
14. Uma alteração feita no Docs atualiza o índice local; um livro/página novo aparece no leitor Wiki do Hub após a atualização de cache, sem abrir o Docs novamente.
15. Um documento alterado local e remotamente gera cópia de conflito ou tela de resolução; a cópia local nunca é sobrescrita silenciosamente.
16. Uma publicação solicitada sem sessão gera pedido local; o recibo `published` atualiza o vínculo no documento e o recibo `rejected` não é reenviado automaticamente.

## Referências no repositório do site

- `supabase/functions/heartspace-studios/index.ts`: ações `save_publication` e `get_publication`, permissões e validação do snapshot.
- `supabase/migrations/20260925000300_docs_publications.sql`: esquema e imutabilidade do histórico.
- `p/publication.js`: renderer público atual e mapa de tipos de bloco.
- `account/index.html` e `account/account.js`: administração de publicações pelo painel.
