import { assertEquals } from "jsr:@std/assert@1";
import { safePublicationSnapshot } from "./publication_snapshot.ts";

Deno.test("snapshot público preserva citação e código nos tipos corretos", () => {
  const snapshot = safePublicationSnapshot({
    version: 1,
    format: "heartspace-docs-v1",
    blocks: [
      { type: 7, text: "Uma citação de imprensa." },
      { type: 8, text: "const heartspace = true;" },
    ],
  });
  assertEquals(snapshot, {
    version: 1,
    format: "heartspace-docs-v1",
    blocks: [
      { type: 7, text: "Uma citação de imprensa." },
      { type: 8, text: "const heartspace = true;" },
    ],
  });
});

Deno.test("snapshot público rejeita bloco com caminho local", () => {
  assertEquals(safePublicationSnapshot({
    version: 1,
    format: "heartspace-docs-v1",
    blocks: [{ type: 0, text: "file:///home/dev_ao/privado.md" }],
  }), null);
});
