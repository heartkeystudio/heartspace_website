import { buildDocsPublication, stagePublicationFiles, sha256, imageMime, IMAGE_LIMIT } from "./docs_publication.ts";
import { safePublicationSnapshot } from "./publication_snapshot.ts";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=/^[a-f0-9]{64}$/;
type Dependencies={respond:(body:any,status:number,origin:string|null)=>Response;access:(admin:any,studio:string,project:string,user:string)=>Promise<any>;enabled:(admin:any,project:string,app:string)=>Promise<any>;publicUrl:(id:string)=>string};
export async function publicationAsset(admin:any,payload:any,origin:string|null,respond:Dependencies["respond"],authorize?:{project:string;revision:string}) {
  try {
  if(!hash.test(payload.asset_id||""))return respond({error:"Imagem indisponível."},404,origin);
  let revisionId=authorize?.revision, projectId=authorize?.project;
  if(!authorize) {
    if(!uuid.test(payload.publication_id||""))return respond({error:"Página indisponível."},404,origin);
    const {data:publication,error}=await admin.from("project_publications").select("source_revision_id,project_id,snapshot_json").eq("id",payload.publication_id).eq("status","published").maybeSingle();
    const snapshot:any=safePublicationSnapshot(publication?.snapshot_json);
    if(error||!publication||snapshot?.version!==2||!snapshot.assets.some((a:any)=>a.id===payload.asset_id))return respond({error:"Imagem indisponível."},404,origin);
    revisionId=publication.source_revision_id;projectId=publication.project_id;
  }
  const {data:media,error}=await admin.from("docs_publication_media").select("path,mime,bytes,sha256").eq("source_revision_id",revisionId).eq("project_id",projectId).eq("sha256",payload.asset_id).maybeSingle();
  if(error||!media)return respond({error:"Imagem indisponível."},404,origin);
  const {data:blob}=await admin.storage.from("docs-publications").download(media.path);
  if(!blob||blob.size!==media.bytes||blob.size>IMAGE_LIMIT)return respond({error:"Imagem indisponível."},503,origin);
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(await sha256(bytes)!==media.sha256||imageMime(bytes)!==media.mime)return respond({error:"Imagem indisponível."},503,origin);
  return new Response(new Uint8Array(bytes).buffer,{headers:{"Content-Type":media.mime,"Content-Length":String(bytes.length),"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Vary":"Origin",...(origin?{"Access-Control-Allow-Origin":origin}:{})}});
  } catch { return respond({error:"Imagem indisponível."},503,origin); }
}

export async function docsPublicationAction(admin:any,payload:any,userId:string,origin:string|null,deps:Dependencies):Promise<Response|null> {
  if(!["docs_publication_context","prepare_docs_publication","publish_docs_revision","get_docs_publication_preview_asset"].includes(payload.action))return null;
  const reply=(body:any,status=200)=>deps.respond(body,status,origin);
  try {
    const projectId=String(payload.project_id||""), documentId=String(payload.document_id||payload.source?.document_id||"");
    if(!uuid.test(projectId)||!uuid.test(documentId))return reply({error:"Selecione um documento sincronizado."},400);
    const {data:project}=await admin.from("projects").select("id,studio_id").eq("id",projectId).maybeSingle();
    const access=project?await deps.access(admin,project.studio_id,projectId,userId):null;
    if(!access?.allowed)return reply({error:"Você não pode publicar neste projeto."},403);
    const enabled=await deps.enabled(admin,projectId,"docs");if(enabled.error||!enabled.enabled)return reply({error:"O Docs não está disponível neste projeto."},409);
    const {data:document}=await admin.from("docs").select("id,title,project_id").eq("id",documentId).eq("project_id",projectId).maybeSingle();
    if(!document)return reply({error:"Documento não encontrado no projeto."},404);
    if(payload.action==="docs_publication_context") {
      const [{data:revisions,error:revisionError},{data:publications,error:publicationError}]=await Promise.all([
        admin.from("doc_revisions").select("id,revision_number,approved_at,created_at,created_by_name").eq("doc_id",documentId).order("revision_number",{ascending:false}).limit(50),
        admin.from("project_publications").select("id,title,slug,summary,visibility,status,source_url,source_document_id,current_revision_id,updated_at").eq("project_id",projectId).order("updated_at",{ascending:false}).limit(100),
      ]);
      if(revisionError||publicationError)return reply({error:"Não foi possível carregar as revisões e publicações."},503);
      return reply({studio_id:project.studio_id,can_approve:access.canApprove===true,document,revisions:revisions||[],publications:publications||[]});
    }
    const revisionId=String(payload.revision_id||payload.source?.revision_id||"");
    if(!uuid.test(revisionId))return reply({error:"Selecione uma revisão aprovada."},400);
    const {data:revision}=await admin.from("doc_revisions").select(payload.action==="get_docs_publication_preview_asset"?"id,doc_id,revision_number,approved_by,approved_at":"id,doc_id,revision_number,content,content_hash,approved_by,approved_at").eq("id",revisionId).eq("doc_id",documentId).maybeSingle();
    if(!revision || (!revision.approved_at && (!access.canApprove || payload.action==="publish_docs_revision")))return reply({error:"A revisão ainda não foi aprovada."},409);
    if(payload.action==="get_docs_publication_preview_asset")return await publicationAsset(admin,payload,origin,deps.respond,{project:projectId,revision:revisionId});
    if(payload.action==="prepare_docs_publication") {
      const prepared=await buildDocsPublication(admin,projectId,revision);
      await stagePublicationFiles(admin,revision.id,projectId,prepared.files);
      return reply({approved_at:revision.approved_at,snapshot:prepared.snapshot,prepared_digest:prepared.digest,source:{document_id:documentId,revision_id:revisionId,revision_number:revision.revision_number,format:"heartspace-html-v1"}});
    }
    const title=typeof payload.title==="string"?payload.title.trim().replace(/\s+/g," "):"";
    const slug=typeof payload.slug==="string"?payload.slug.trim():"";
    const summary=typeof payload.summary==="string"?payload.summary.trim():"";
    const sourceUrl=typeof payload.source_url==="string"?payload.source_url.trim():"";
    if(!title||title.length>160||!slug||slug.length>160||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||summary.length>500||sourceUrl.length>2048||(sourceUrl&&!/^https:\/\//i.test(sourceUrl))||!["public","unlisted"].includes(payload.visibility)||!uuid.test(payload.operation_id||"")||!hash.test(payload.prepared_digest||"")||payload.source?.format!=="heartspace-html-v1"||payload.source?.document_id!==documentId||payload.source?.revision_id!==revisionId||payload.source?.revision_number!==revision.revision_number||payload.studio_id!==project.studio_id||payload.snapshot!==undefined)return reply({error:"Pedido de publicação inválido. Prepare a página novamente."},400);
    const publicationId=payload.publication_id||null;
    if(publicationId && (!uuid.test(publicationId)||!Object.hasOwn(payload,"expected_current_revision_id")||typeof payload.expected_updated_at!=="string"||!Number.isFinite(Date.parse(payload.expected_updated_at))||(payload.expected_current_revision_id!==null&&!uuid.test(payload.expected_current_revision_id))))return reply({error:"Atualize a publicação antes de substituir a página."},409);
    // The request receipt precedes rebuilding: retries remain possible even when
    // an old editable image has since been removed from its private source.
    const requestHash=await sha256(JSON.stringify({projectId,documentId,revisionId,publicationId,title,slug,summary,sourceUrl,visibility:payload.visibility,digest:payload.prepared_digest,expected:payload.expected_current_revision_id||null,updated:payload.expected_updated_at||null}));
    const {data:receipt,error:receiptError}=await admin.from("docs_publication_receipts").select("project_id,request_hash,result").eq("actor_id",userId).eq("operation_id",payload.operation_id).maybeSingle();
    if(receiptError)return reply({error:"A publicação requer a migração de transporte de publicações."},503);
    if(receipt) {if(receipt.project_id!==projectId||receipt.request_hash!==requestHash)return reply({error:"Este pedido já foi usado com outro conteúdo."},409);return reply({publication:receipt.result,public_url:deps.publicUrl(receipt.result.id),replayed:true});}
    // Rebuild from the approved revision, checking source image bytes again.
    // A changed legacy image path requires a new explicit review/digest.
    const prepared=await buildDocsPublication(admin,projectId,revision);
    if(prepared.digest!==payload.prepared_digest)return reply({error:"As imagens ou a página mudaram desde a conferência. Prepare e confira novamente."},409);
    await stagePublicationFiles(admin,revision.id,projectId,prepared.files);
    const {data,error}=await admin.rpc("heartspace_publish_docs_revision_v1",{
      p_actor_id:userId,p_operation_id:payload.operation_id,p_request_hash:requestHash,p_project_id:projectId,p_studio_id:project.studio_id,
      p_publication_id:publicationId,p_expected_revision_id:payload.expected_current_revision_id||null,p_expected_updated_at:payload.expected_updated_at||null,
      p_source_revision_id:revisionId,p_content_hash:revision.content_hash,p_snapshot:prepared.snapshot,
      p_title:title,p_slug:slug,p_summary:summary,p_source_url:sourceUrl,p_visibility:payload.visibility,
    });
    if(error)return reply({error:["23505","P0001","40001"].includes(error.code)?error.message:"Não foi possível confirmar a publicação. O mesmo pedido pode ser retomado."},["23505","P0001","40001"].includes(error.code)?409:503);
    return reply({publication:data,public_url:deps.publicUrl(data.id)});
  } catch(error) { console.error("docs publication preparation failed",error);return reply({error:error instanceof Error?error.message:"Não foi possível preparar a publicação."},422); }
}
