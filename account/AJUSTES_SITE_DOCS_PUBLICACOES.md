# Ajustes do website para publicações do HeartSpace Docs

Este documento delimita somente o trabalho do **website/Supabase**. O Docs é
responsável por edição e materialização local; o Hub transporta pedidos e usa a
sessão autenticada da pessoa. O site permanece a autoridade para permissões,
revisões aprovadas, snapshots públicos e páginas expostas.

## Objetivo

Receber, validar e publicar snapshots de revisões aprovadas do Docs sem expor
documentos de trabalho, IDs privados, credenciais ou conteúdo ainda não
publicado.

## Ajustes obrigatórios

### 1. Corrigir o mapa público de tipos de bloco

O Lexicon usa estes tipos relevantes:

| Tipo | Significado |
| --- | --- |
| `0` | Parágrafo |
| `1`, `2`, `3` | Títulos |
| `4`, `5`, `6` | Lista, lista numerada, checklist |
| `7` | Citação |
| `8` | Código |
| `13` | Linha/estrutura textual compatível |

O renderer e o validador público não podem interpretar `8` como citação. O
site deve aceitar `7` como citação e decidir explicitamente se `8` será
renderizado como bloco de código ou permanecerá fora do snapshot v1.

- [ ] Ajustar `safePublicationSnapshot()` na Function.
- [ ] Ajustar o mapa de renderização em `p/publication.js`.
- [ ] Atualizar o guia de integração e exemplos de snapshot.
- [ ] Criar teste de regressão para citação e código.

### 2. Tornar atualização e retirada de publicação explícitas

`save_publication` já recebe `publication_id`, mas o site deve sustentar estes
fluxos de forma inequívoca:

- uma revisão aprovada nova, enviada com `publication_id`, cria uma linha nova
  em `project_publication_revisions` e move `current_revision_id`;
- a mesma `source_revision_id` não pode criar outra versão da mesma publicação;
- atualização somente de metadados não altera snapshot, origem ou histórico;
- retirada do ar recebe `status: "withdrawn"`, preserva histórico e faz a
  página pública responder como indisponível;
- republicação exige uma nova revisão aprovada, nunca reutiliza a snapshot
  anterior silenciosamente.

- [ ] Garantir resposta específica para revisão já publicada (`409`).
- [ ] Validar que `publication_id` pertence ao mesmo projeto e estúdio.
- [ ] Tornar a criação de revisão + atualização de ponteiro atômica em RPC ou
      transação no banco.
- [ ] Registrar auditoria para publicação, atualização, retirada e restauração.
- [ ] Expor no painel a revisão pública atual e o histórico somente a pessoas autorizadas.

### 3. Respeitar o app Docs habilitado no projeto

A capacidade não basta quando o app foi desabilitado no projeto.

- [ ] Na Function, consultar `project_apps` para `app_key = 'docs'`.
- [ ] Recusar criação, atualização e retirada de publicação do Docs quando o
      app estiver desabilitado, com erro seguro e específico.
- [ ] Manter Owner/Admin e permissões de projeto como verificações adicionais,
      nunca como substitutas do estado do app.

### 4. Contrato para chamadas nativas do Hub

O Hub chama `heartspace-studio` com o token temporário da pessoa, sem cabeçalho
`Origin` de navegador.

- [ ] Aceitar requisição nativa autenticada sem `Origin`.
- [ ] Manter CORS estrito para navegadores em `HEARTSPACE_ALLOWED_ORIGINS`.
- [ ] Nunca aceitar chamada sem JWT válido por causa dessa exceção nativa.
- [ ] Não usar `service_role` fora da Edge Function.

### 5. Recibo público completo e URL canônica

O retorno da Function deve permitir que o Hub gere um recibo suficiente para o
Docs atualizar seu metadado local.

- [ ] Retornar `publication.id`, `published_at`, `status` e a URL canônica
      absoluta, por exemplo `https://www.heartspace.tools/p/?id=<id>`.
- [ ] Não retornar `project_id`, `studio_id`, `source_document_id`,
      `source_revision_id`, aprovações ou outros IDs privados à página pública.
- [ ] Definir a origem pública da URL por variável/configuração de ambiente,
      sem codificar domínio em clientes nativos.

### 6. Dados públicos e renderer seguro

O endpoint `get_publication` deve devolver somente uma página efetivamente
publicada e o snapshot aprovado atual.

- [ ] Continuar filtrando `status = 'published'` antes de qualquer dado ser
      retornado.
- [ ] Garantir que `withdrawn` e `draft` respondem como não encontrados, sem
      título, resumo ou conteúdo.
- [ ] Renderizar todo texto com `textContent`; nunca usar `innerHTML` para
      conteúdo do snapshot.
- [ ] Limitar blocos, tamanho total e caracteres por bloco no servidor.
- [ ] Rejeitar caminhos locais, HTML, atributos de evento, JavaScript e URLs
      não HTTPS quando tipos de link/mídia forem adicionados.
- [ ] Manter `unlisted` acessível só pela URL direta e fora de listagens futuras.

### 7. Mídia é uma extensão futura de contrato

O snapshot v1 é textual. Não aceitar ainda `media_manifest`, imagem, vídeo,
anexo ou HTML arbitrário sem extensão coordenada entre Docs, Hub e site.

- [ ] Documentar no painel que links de mídia HTTPS são texto no v1.
- [ ] Planejar `media_manifest` versionado com validação de origem, HTTPS,
      tamanho, `alt` e permissões de ativo.
- [ ] Implementar renderer de mídia somente junto à validação de servidor.

### 8. Observabilidade e testes de aceite

- [ ] Registrar somente metadados operacionais: ação, publicação, projeto,
      resultado e código seguro de erro; nunca snapshot, token ou URL privada.
- [ ] Medir pedidos rejeitados, pendentes e retiradas para diagnóstico.
- [ ] Testar publicação sem capacidade, sem app Docs, sem aprovação, com
      revisão de outro projeto e com snapshot inseguro.
- [ ] Testar `public`, `unlisted`, atualização com nova revisão e `withdrawn`.
- [ ] Testar que a página pública não devolve IDs internos, origem privada ou
      conteúdo de rascunho.

## Fora do escopo do website

Estes pontos pertencem ao Docs ou Hub e não devem ser resolvidos pelo painel:

- geração de snapshot e remoção de dados privados antes do pedido;
- gravação de arquivos em `ProjectRoot/Docs/`;
- fila de `sync_requests` e sincronização com Drive/provedores;
- pedido e recibo físicos em `.heartspace/`;
- cache local, recuperação offline, hash de arquivo e cópia de conflito;
- UI de aprovação, publicação, atualização e retirada dentro do editor.
