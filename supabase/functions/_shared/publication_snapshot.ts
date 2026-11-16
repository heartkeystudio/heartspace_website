export const publicationBlockTypes = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 13]);

export function safePublicationSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.version === 2) return safeReadingSnapshot(snapshot);
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

function safeReadingSnapshot(snapshot: Record<string,unknown>) {
  if(snapshot.format!=="heartspace-docs-publication-v2" || !Array.isArray(snapshot.blocks) || snapshot.blocks.length>500 || !Array.isArray(snapshot.assets) || snapshot.assets.length>100 || !Array.isArray(snapshot.omissions) || snapshot.omissions.length>20) return null;
  const assets:Array<{id:string;mime:string;bytes:number}> = [], blocks:Array<Record<string,unknown>>=[], omissions:Array<{kind:string;count:number}>=[];
  for(const a of snapshot.assets) {
    if(!a || !/^[a-f0-9]{64}$/.test(a.id) || !["image/png","image/jpeg","image/webp"].includes(a.mime) || !Number.isInteger(a.bytes) || a.bytes<1 || a.bytes>4194304 || assets.some(x=>x.id===a.id))return null;
    assets.push({id:a.id,mime:a.mime,bytes:a.bytes});
  }
  if(assets.reduce((n,a)=>n+a.bytes,0)>33554432)return null;
  for(const b of snapshot.blocks) {
    if(!b || typeof b!=="object")return null;
    if(b.type==="image") {if(!assets.some(a=>a.id===b.asset) || typeof b.alt!=="string" || b.alt.length>500)return null;blocks.push({type:"image",asset:b.asset,alt:b.alt});continue;}
    if(!["heading","paragraph","quote","code","list-item"].includes(b.type) || typeof b.text!=="string" || b.text.length>12000)return null;
    if(b.type==="heading" && (!Number.isInteger(b.level)||b.level<1||b.level>6))return null;
    blocks.push({type:b.type,...(b.type==="heading"?{level:b.level}:{}),text:b.text});
  }
  for(const o of snapshot.omissions) {if(!o||typeof o.kind!=="string"||o.kind.length>100||!Number.isInteger(o.count)||o.count<1)return null;omissions.push({kind:o.kind,count:o.count});}
  const clean={version:2,format:"heartspace-docs-publication-v2",blocks,assets,omissions};
  return JSON.stringify(clean).length<=500000?clean:null;
}
