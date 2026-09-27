export const publicationBlockTypes = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 13]);

export function safePublicationSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.version !== 1 || snapshot.format !== "heartspace-docs-v1" || !Array.isArray(snapshot.blocks) || snapshot.blocks.length > 500) return null;
  const blocks: Array<Record<string, unknown>> = [];
  for (const raw of snapshot.blocks) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const block = raw as Record<string, unknown>;
    const type = Number(block.type);
    const text = typeof block.text === "string" ? block.text.trim() : "";
    if (!Number.isInteger(type) || !publicationBlockTypes.has(type) || text.length > 12000) return null;
    if (/\b(?:res|user|file):\/\//i.test(text) || /<\s*script\b|on\w+\s*=/i.test(text)) return null;
    blocks.push({ type, text });
  }
  const clean = { version: 1, format: "heartspace-docs-v1", blocks };
  return JSON.stringify(clean).length <= 500000 ? clean : null;
}
