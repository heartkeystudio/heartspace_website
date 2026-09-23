# Contrato de Publicações Públicas

As publicações devem ser geradas pelo Hub/Docs a partir de uma revisão
explicitamente aprovada. O site público nunca lê diretamente as tabelas
privadas de `docs`.

## Endereços públicos

```text
/p/{studio_slug}/{project_slug}/
/p/{studio_slug}/{project_slug}/{document_slug}/
```

O par de slugs é estável depois da primeira publicação. Alterar título não
deve quebrar links já compartilhados.

## Registro de projeto

```json
{
  "studio_slug": "luma-studio",
  "project_slug": "aurora-vale",
  "studio_name": "Luma Studio",
  "project_name": "Aurora Vale",
  "summary": "Um mundo que aprende a lembrar de si mesmo.",
  "updated_at": "2026-09-22T12:00:00Z",
  "documents": [
    {
      "slug": "press-kit",
      "title": "Press kit",
      "kind": "press_kit",
      "summary": "O essencial para imprensa e parceiros.",
      "revision": 4,
      "published_at": "2026-09-22T12:00:00Z"
    }
  ]
}
```

## Registro de documento

Cada documento público deve ser uma cópia materializada da revisão aprovada,
nunca uma consulta ao rascunho atual. O registro precisa guardar:

- `project_id`, `document_id` e `revision_id` internos;
- `slug`, título, resumo, tipo e versão visíveis;
- conteúdo renderizável em blocos ou HTML já sanitizado;
- data de publicação e de atualização;
- estado `public`, `unlisted` ou `withdrawn`.

`withdrawn` devolve uma página 404/indisponível, sem vazar título ou conteúdo.
`unlisted` continua acessível apenas pela URL direta e não aparece no índice do
projeto.

## Fluxo no Hub

1. Uma pessoa com permissão escolhe **Publicar revisão** no HeartSpace Docs.
2. O Hub cria uma revisão imutável e pede confirmação de visibilidade.
3. O backend valida a permissão no projeto, sanitiza o conteúdo e grava a
   cópia pública.
4. A publicação invalida o cache dessas URLs.
5. Para atualizar, o mesmo fluxo gera uma nova revisão; links não mudam.

## Segurança

- O navegador público não recebe token, ID interno ou link para arquivos
  privados.
- Assets públicos recebem URLs próprias ou assinadas de longa duração; assets
  privados não são reutilizados.
- A autorização de publicar, atualizar ou retirar vive no backend.
- Previews sociais usam apenas dados já públicos da revisão.
