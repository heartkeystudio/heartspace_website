// parse5 is an inert HTML parser, never a browser or raw-HTML renderer.
import { parseFragment } from "npm:parse5@7.3.0";
import { safePublicationSnapshot } from "./publication_snapshot.ts";

type Node = { nodeName: string; tagName?: string; value?: string; attrs?: {name:string;value:string}[]; childNodes?: Node[] };
export const IMAGE_LIMIT = 4 * 1024 * 1024;
const extensions: Record<string,string> = {"image/png":"png","image/jpeg":"jpg","image/webp":"webp"};
const hashPattern = /^[a-f0-9]{64}$/;
export async function sha256(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer))).map(x=>x.toString(16).padStart(2,"0")).join("");
}
// Same static-image envelope used by Docs' optimizer: no SVG/animation,
// up to 40 MP and a 20,000 px edge. Header validation is not a full decoder.
export function imageMime(bytes: Uint8Array) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const is=(offset:number,value:string)=>offset+value.length<=bytes.length&&[...value].every((c,i)=>bytes[offset+i]===c.charCodeAt(0));
  let mime="",width=0,height=0;
  if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)&&is(12,"IHDR")) {
    mime="image/png";width=view.getUint32(16);height=view.getUint32(20);
    for(let offset=8;offset+12<=bytes.length;) {const size=view.getUint32(offset);if(is(offset+4,"acTL"))throw new Error("Use uma imagem estática.");if(is(offset+4,"IDAT"))break;offset+=12+size;}
  } else if(bytes.length>=12&&is(0,"RIFF")&&is(8,"WEBP")) {
    mime="image/webp";
    for(let offset=12;offset+8<=bytes.length;) {
      const size=view.getUint32(offset+4,true);if(offset+8+size>bytes.length)throw new Error("Imagem WebP incompleta.");
      if(is(offset,"ANIM")||is(offset,"ANMF"))throw new Error("Use uma imagem estática.");
      if(is(offset,"VP8X")&&size>=10){if(bytes[offset+8]&2)throw new Error("Use uma imagem estática.");width=1+bytes[offset+12]+(bytes[offset+13]<<8)+(bytes[offset+14]<<16);height=1+bytes[offset+15]+(bytes[offset+16]<<8)+(bytes[offset+17]<<16);}
      if(is(offset,"VP8 ")&&size>=10&&is(offset+11,"\x9d\x01\x2a")){width=view.getUint16(offset+14,true)&16383;height=view.getUint16(offset+16,true)&16383;}
      if(is(offset,"VP8L")&&size>=5&&bytes[offset+8]===47){width=1+bytes[offset+9]+((bytes[offset+10]&63)<<8);height=1+(bytes[offset+10]>>6)+(bytes[offset+11]<<2)+((bytes[offset+12]&15)<<10);}
      offset+=8+size+size%2;
    }
  } else if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216) {
    mime="image/jpeg";let offset=2;
    while(offset+4<=bytes.length){if(bytes[offset++]!==255)break;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===218||marker===217)break;if(marker===1||(marker>=208&&marker<=215))continue;if(offset+2>bytes.length)break;const size=view.getUint16(offset);if(size<2||offset+size>bytes.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7){width=view.getUint16(offset+5);height=view.getUint16(offset+3);break;}offset+=size;}
  }
  if(!mime||!width||!height||width*height>40000000||Math.max(width,height)>20000)throw new Error("Use uma imagem PNG, JPEG ou WebP estática de até 40 megapixels.");
  return mime;
}

const attr = (n:Node,key:string) => n.attrs?.find(a=>a.name===key)?.value || "";
const has = (n:Node,cls:string) => attr(n,"class").split(/\s+/).includes(cls);
const children = (n:Node) => n.childNodes || [];
function find(n:Node,cls:string):Node|undefined { if(has(n,cls)) return n; for(const child of children(n)) { const found=find(child,cls); if(found)return found; } }
const hidden = (n:Node) => n.attrs?.some(a=>a.name==="hidden") || attr(n,"aria-hidden")==="true";
const excluded = (n:Node) => hidden(n) || ["script","style","template","iframe","object","embed","svg","math","form","button","input","textarea","select"].includes(n.tagName || "") || ["authoring-decoration","narrative-meta","narrative-marker","mermaid-source","narrative-choice-target"].some(c=>has(n,c));
function plain(n:Node):string { if(excluded(n))return ""; if(n.nodeName==="#text")return n.value || ""; if(n.tagName==="br")return "\n"; const value=children(n).map(plain).join(""); return ["p","div","li"].includes(n.tagName||"")?value+"\n":value; }
const text = (n:Node) => plain(n).replace(/[\t ]+/g," ").trim();
export type PublicationFile = {id:string;mime:string;bytes:Uint8Array;path:string};

// Only images actually embedded in the selected document are candidates. Scene,
// character and project registries are never walked or exposed to the reader.
export async function buildDocsPublication(admin:any, projectId:string, revision:any) {
  let source = revision.content;
  if(typeof source==="string") { try{source=JSON.parse(source);}catch{throw new Error("A revisão não contém uma fonte válida.");} }
  if(source?.format!=="heartspace-html-v1" || typeof source.body!=="string" || source.body.length>8*1024*1024) throw new Error("Esta revisão não usa o formato atual do Docs ou excede o limite de preparação.");
  let markupCount=0;
  for(const char of source.body)if(char==="<"&&++markupCount>50000)throw new Error("A estrutura da página excede o limite de preparação.");
  const tree=parseFragment(source.body) as unknown as Node;
  const stack=[{node:tree,depth:0}];let nodes=0;
  while(stack.length){const entry=stack.pop()!;if(++nodes>50000||entry.depth>150)throw new Error("A estrutura da página excede o limite de preparação.");for(const node of children(entry.node))stack.push({node,depth:entry.depth+1});}
  const blocks:any[] = [], files = new Map<string,PublicationFile>(), omitted = new Map<string,number>();
  let totalBytes=0, visited=0;
  const note=(kind:string)=>omitted.set(kind,(omitted.get(kind)||0)+1);
  function add(type:string,value:string,level?:number) { if(!value)return; if(value.length>12000 || blocks.length>=500)throw new Error("A página excede o limite de blocos ou de texto por bloco."); blocks.push({type,...(level?{level}:{}),text:value}); }
  async function download(bucket:string,path:string) { const {data,error}=await admin.storage.from(bucket).download(path); if(error||!data||data.size>IMAGE_LIMIT)throw new Error("Não foi possível preparar uma imagem da revisão."); return new Uint8Array(await data.arrayBuffer()); }
  async function image(n:Node) {
    let bytes:Uint8Array, expected="", expectedMime="", expectedBytes=0;
    const wire=attr(n,"data-docs-media"), remote=attr(n,"data-remote-image"), src=attr(n,"src");
    if(wire) {
      let ref:any; try{ref=JSON.parse(wire);}catch{throw new Error("Referência de imagem inválida.");}
      if(ref.schema_version!==1 || ref.bucket!=="docs-media" || ref.project_id!==projectId || !hashPattern.test(ref.sha256) || !extensions[ref.mime] || ref.path!==`${projectId}/${ref.sha256}.${extensions[ref.mime]}` || !Number.isInteger(ref.bytes) || ref.bytes<1 || ref.bytes>IMAGE_LIMIT)throw new Error("A imagem não pertence a esta revisão/projeto.");
      const {data,error}=await admin.from("docs_media_objects").select("path,mime,bytes").eq("project_id",projectId).eq("sha256",ref.sha256).maybeSingle();
      if(error||!data||data.path!==ref.path||data.mime!==ref.mime||data.bytes!==ref.bytes)throw new Error("Imagem sem registro válido.");
      expected=ref.sha256; expectedMime=ref.mime; expectedBytes=ref.bytes; bytes=await download("docs-media",ref.path);
    } else if(remote) {
      if(!remote.startsWith(projectId+"/") || !/^[a-zA-Z0-9_./-]+$/.test(remote) || remote.includes("..") || !/\.(png|jpe?g|webp)$/i.test(remote))throw new Error("Caminho de imagem inválido.");
      bytes=await download("docs-assets",remote);
    } else if(/^data:image\/(png|jpeg|webp);base64,/i.test(src)) {
      const encoded=src.slice(src.indexOf(",")+1); if(encoded.length>Math.ceil(IMAGE_LIMIT/3)*4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new Error("Imagem incorporada inválida.");
      let decoded:string; try{decoded=atob(encoded);}catch{throw new Error("Imagem incorporada inválida.");} bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
      expectedMime=src.slice(5,src.indexOf(";"));
    } else throw new Error("Uma imagem só existe no dispositivo ou usa um endereço externo. Incorpore-a e salve uma nova revisão antes de publicar.");
    if(!bytes.length||bytes.length>IMAGE_LIMIT)throw new Error("Imagem acima do limite de 4 MiB.");
    const mime=imageMime(bytes), id=await sha256(bytes);
    if(expected && (expected!==id || expectedMime!==mime || expectedBytes!==bytes.length))throw new Error("Os bytes da imagem não correspondem à revisão.");
    if(expectedMime && expectedMime!==mime)throw new Error("O formato declarado da imagem não corresponde aos bytes.");
    if(!files.has(id)) { totalBytes+=bytes.length; if(files.size>=100||totalBytes>32*1024*1024)throw new Error("As imagens desta página excedem o limite de preparação (32 MiB / 100 arquivos)."); files.set(id,{id,mime,bytes,path:`${projectId}/${revision.id}/${id}.${extensions[mime]}`}); }
    if(blocks.length>=500)throw new Error("A página excede o limite de blocos.");
    blocks.push({type:"image",asset:id,alt:attr(n,"alt").slice(0,500)});
  }
  async function walk(n:Node,depth=0):Promise<void> {
    if(++visited>50000||depth>150)throw new Error("A estrutura da página excede o limite de preparação.");
    if(excluded(n))return;
    if(has(n,"mermaid-block")||has(n,"mermaid-figure")||attr(n,"data-mermaid-id")||has(n,"mermaid-preview")) { note("diagramas"); return; }
    if(has(n,"narrative-block")) {
      const type=attr(n,"data-narrative-type");
      if(type==="pause"||type==="signal") {note("comandos de cena");return;}
      if(type==="dialogue"||type==="narration") { const body=find(n,"narrative-text");if(body)await walk(body,depth+1);return; }
      if(type==="variation") {
        const versions=children(n).flatMap(c=>has(c,"narrative-variation-version")?[c]:children(c).filter(v=>has(v,"narrative-variation-version")));
        const chosen=versions.find(v=>attr(v,"data-default-version")==="true")||versions.find(v=>attr(v,"data-active")==="true")||versions[0];
        if(chosen)await walk(chosen,depth+1); note("versões alternativas"); return;
      }
      if(type==="choice") {const prompt=find(n,"narrative-choice-prompt");if(prompt)add("paragraph",text(prompt));
        const visit=(c:Node)=>{if(has(c,"narrative-choice-text")){add("list-item",text(c));return;}children(c).forEach(visit);};visit(n);note("ligações e condições das escolhas");return;}
    }
    if(n.tagName==="img") {await image(n);return;}
    if(["audio","video","canvas"].includes(n.tagName||"")){note("mídia interativa");return;}
    if(n.tagName==="table"){note("tabelas");return;}
    if(n.tagName==="pre"){add("code",plain(n).trim());return;}
    if(n.nodeName==="#text"){add("paragraph",text(n));return;}
    const type=/^h[1-6]$/.test(n.tagName||"")?"heading":n.tagName==="blockquote"?"quote":n.tagName==="pre"?"code":n.tagName==="li"?"list-item":n.tagName==="p"?"paragraph":"";
    // Preserve image ordering in mixed text/image blocks; never flatten nested
    // blocks into one long paragraph or use innerHTML in a public snapshot.
    const inline=(c:Node):boolean => (c.nodeName==="#text"||["span","em","strong","b","i","u","s","a","code","br","small","sub","sup","mark","del","ins","kbd","samp","var","wbr"].includes(c.tagName||""))&&children(c).every(inline);
    const containsImage=(c:Node):boolean=>c.tagName==="img"||children(c).some(containsImage);
    if(n.tagName==="blockquote"&&!containsImage(n)){add("quote",text(n));return;}
    if(type && children(n).every(inline)){add(type,text(n),type==="heading"?Number(n.tagName![1]):undefined);return;}
    if(has(n,"narrative-text")&&children(n).every(inline)){add("paragraph",text(n));return;}
    let buffer="";
    const flush=()=>{add(type||"paragraph",buffer.replace(/[\t ]+/g," ").trim(),type==="heading"?Number(n.tagName![1]):undefined);buffer="";};
    for(const child of children(n)){if(inline(child))buffer+=plain(child);else{flush();await walk(child,depth+1);}}flush();
  }
  add("heading",String(source.title||"").slice(0,160),1);
  add("paragraph",String(source.subtitle||""));
  await walk(tree);
  const snapshot=safePublicationSnapshot({version:2,format:"heartspace-docs-publication-v2",blocks,assets:[...files.values()].map(f=>({id:f.id,mime:f.mime,bytes:f.bytes.length})),omissions:[...omitted].map(([kind,count])=>({kind,count}))});
  if(!snapshot)throw new Error("Não foi possível montar uma página pública válida.");
  return {snapshot,digest:await sha256(JSON.stringify(snapshot)),files:[...files.values()]};
}

export async function stagePublicationFiles(admin:any,revisionId:string,projectId:string,files:PublicationFile[]) {
  for(const file of files) {
    const {error}=await admin.storage.from("docs-publications").upload(file.path,file.bytes,{contentType:file.mime,upsert:false});
    if(error) {const {data}=await admin.storage.from("docs-publications").download(file.path);if(!data||data.size!==file.bytes.length||await sha256(new Uint8Array(await data.arrayBuffer()))!==file.id)throw new Error("Não foi possível proteger uma imagem para publicação.");}
    const {error:rowError}=await admin.from("docs_publication_media").upsert({source_revision_id:revisionId,project_id:projectId,sha256:file.id,path:file.path,mime:file.mime,bytes:file.bytes.length},{onConflict:"source_revision_id,sha256",ignoreDuplicates:true});
    if(rowError)throw new Error("Não foi possível registrar as imagens da publicação. Confira a migração de publicações.");
  }
}
