# Integração entre HeartSpace Docs e páginas públicas

Este documento define como o HeartSpace Docs deve enviar documentos aprovados para as páginas públicas do HeartSpace. O painel administra a publicação; o Docs continua sendo a fonte do conteúdo e das revisões.

## Princípio

Uma publicação pública é uma referência a uma revisão aprovada de um documento. Publicar não move, apaga ou transforma o arquivo local do Docs. A publicação cria uma cópia de leitura para a web e registra qual revisão a originou.

O fluxo deve ser sempre:

`documento no Docs → revisão aprovada → snapshot de publicação → página pública`

Nunca use o documento de trabalho em edição como conteúdo público direto.

## O que já existe no site

O painel cria registros na tabela `project_publications`. Cada registro possui:

| Campo | Uso |
| --- | --- |
| `id` | Identificador estável usado no link público. |
| `studio_id` e `project_id` | Contexto do estúdio e projeto. |
| `title` | Título mostrado na página. |
| `slug` | Endereço legível único dentro do projeto. |
| `summary` | Introdução curta da página. |
| `source_url` | Link opcional para o documento ou revisão de origem no Docs. |
| `visibility` | `public` ou `unlisted`. |
| `status` | `draft`, `published` ou `withdrawn`. |
| `published_at` | Data da última publicação. |

O endpoint administrativo é a Function `heartspace-studio`, ação `save_publication`. Apenas `owner` e `admin` do estúdio podem chamá-lo.

Uma página pública usa `p/?id=<publication_id>`. Ela chama a ação pública `get_publication`, que só devolve publicações com estado `published`. Uma página `unlisted` não aparece em listagens futuras, mas pode ser aberta por quem possui o link.

## Responsabilidade do Docs

O Docs deve oferecer uma ação explícita como **Publicar no HeartSpace**. Ela precisa aparecer apenas para quem possui permissão de publicação no projeto.

Antes de chamar o site, o Docs deve:

1. Confirmar que o documento pertence ao projeto ativo.
2. Exigir uma revisão aprovada e imutável.
3. Criar um snapshot serializado dessa revisão.
4. Pedir título, slug, visibilidade e resumo, se ainda não existirem.
5. Enviar o snapshot e os metadados para a API administrativa.
6. Guardar no próprio documento o `publication_id`, o número da revisão e a data de publicação retornados.

O Docs deve permitir criar uma nova revisão pública a partir de uma edição posterior, mas não deve alterar silenciosamente uma página já publicada.

## Contrato recomendado para o Docs

Além dos campos atuais, a próxima versão da integração deve enviar estes campos:

```json
{
  "action": "save_publication",
  "studio_id": "uuid-do-estudio",
  "project_id": "uuid-do-projeto",
  "publication_id": "uuid-opcional-para-atualizar",
  "title": "Press kit",
  "slug": "press-kit",
  "summary": "Resumo para imprensa",
  "visibility": "public",
  "status": "published",
  "source": {
    "document_id": "id-local-ou-remoto-do-docs",
    "revision_id": "id-da-revisao-aprovada",
    "revision_number": 14,
    "format": "heartspace-docs-v1"
  },
  "snapshot": {
    "blocks": []
  }
}
```

`snapshot` deve ser autocontido: texto, estrutura, links e referências de mídia já resolvidas. O site não deve precisar abrir o arquivo de trabalho no computador de quem publicou.

## Formato do snapshot

Use blocos JSON versionados, em vez de HTML cru. O site converte blocos conhecidos para HTML seguro.

```json
{
  "version": 1,
  "blocks": [
    { "type": "heading", "level": 1, "text": "Press kit" },
    { "type": "paragraph", "text": "Apresentação do projeto." },
    { "type": "image", "asset_id": "uuid", "alt": "Imagem do projeto" },
    { "type": "link", "label": "Site oficial", "href": "https://example.com" }
  ]
}
```

Não aceite `script`, eventos HTML, CSS arbitrário ou URLs que não sejam `https`. O servidor deve validar tamanho, tipos de bloco, URLs e permissões antes de salvar.

## Estados e regras

- **Draft**: salvo para edição, invisível publicamente.
- **Published**: snapshot disponível na página pública.
- **Withdrawn**: página deixa de responder publicamente; o snapshot e o histórico permanecem para restauração.
- **Public**: aparecerá em uma futura lista pública do projeto.
- **Unlisted**: acessível apenas pelo link direto, sem indexação ou listagem.

Ao retirar do ar, o Docs não perde o documento nem a revisão. Ao republicar, deve criar uma nova versão pública e registrar quem a aprovou.

## Permissões esperadas

O Docs deve consultar os cargos do projeto. A permissão recomendada é `manage_publications`; até ela existir no catálogo central, use `manage_workspace` para publicar e `can_view_wiki` ou `docs_view` para visualizar o documento de origem.

Owner e Admin de estúdio continuam podendo administrar o estado da publicação pelo site. Os cargos de produção só concedem publicação quando a permissão apropriada estiver presente.

## Próxima extensão do site

O painel atual já administra metadados e estado. Para renderizar o documento inteiro, a tabela e a Function devem receber `source_document_id`, `source_revision_id`, `snapshot_json`, `snapshot_version`, `approved_by` e `approved_at`.

Depois disso, a página pública deve renderizar `snapshot_json`, exibir a revisão publicada e manter um link de retorno ao documento apenas quando o estúdio escolher expô-lo.
