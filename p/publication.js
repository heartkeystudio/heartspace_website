(function () {
  "use strict";
  const config = window.HEARTSPACE_ACCOUNT_CONFIG || {};
  const id = new URLSearchParams(window.location.search).get("id");
  const state = document.getElementById("publicationState");
  const title = document.getElementById("publicationTitle");
  const summary = document.getElementById("publicationSummary");
  const studio = document.getElementById("studioName");
  const project = document.getElementById("projectName");
  const source = document.getElementById("publicationSource");
  const content = document.createElement("section"); content.className = "publication-content"; summary.after(content);
  function fail(message) { state.textContent = message; state.className = "state error"; title.textContent = "Página indisponível"; }
  const imageUrls = new Set();
  async function imageBytes(asset) {
    const response = await fetch(config.studioFunctionUrl, {method:"POST",headers:{"Content-Type":"application/json",apikey:config.supabaseAnonKey,Authorization:"Bearer "+config.supabaseAnonKey},body:JSON.stringify({action:"get_publication_asset",publication_id:id,asset_id:asset.id}),cache:"no-store"});
    if(!response.ok || response.headers.get("Content-Type")!==asset.mime || !response.body)throw new Error("Imagem indisponível.");
    const reader=response.body.getReader(),parts=[];let count=0;
    try {while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>asset.bytes||count>4194304){await reader.cancel();throw new Error("Imagem inválida.");}parts.push(value);}}finally{reader.releaseLock();}
    if(count!==asset.bytes)throw new Error("Imagem incompleta.");
    const blob=new Blob(parts,{type:asset.mime}),bytes=await blob.arrayBuffer();
    const actual=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(b=>b.toString(16).padStart(2,"0")).join("");
    if(actual!==asset.id)throw new Error("Imagem inválida.");
    const url=URL.createObjectURL(blob);imageUrls.add(url);return url;
  }
  function renderSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.blocks) || snapshot.blocks.length>500) throw new Error("Formato de página não suportado.");
    const modern=snapshot.version===2 && snapshot.format==="heartspace-docs-publication-v2";
    if(!modern && !(snapshot.version===1&&snapshot.format==="heartspace-docs-v1"))throw new Error("Formato de página não suportado.");
    const tags = modern ? {heading:"h2",paragraph:"p",quote:"blockquote",code:"pre","list-item":"li"} : {0:"p",1:"h1",2:"h2",3:"h3",4:"li",5:"li",6:"li",7:"blockquote",8:"pre",13:"p"};
    let list=null;
    const loads=new Map();
    snapshot.blocks.forEach(function(block) {
      if(modern&&block.type==="image") {
        list=null;
        const asset=(snapshot.assets||[]).find(a=>a.id===block.asset);
        if(!asset||!/^[a-f0-9]{64}$/.test(asset.id)||!["image/png","image/jpeg","image/webp"].includes(asset.mime)||!Number.isInteger(asset.bytes)||asset.bytes<1||asset.bytes>4194304)return;
        const figure=document.createElement("figure"),img=document.createElement("img"),caption=document.createElement("figcaption");img.alt=typeof block.alt==="string"?block.alt:"";caption.textContent="Carregando imagem…";figure.append(img,caption);content.append(figure);
        if(!loads.has(asset.id))loads.set(asset.id,imageBytes(asset));
        loads.get(asset.id).then(url=>{img.src=url;caption.remove();}).catch(()=>{img.remove();caption.textContent="Não foi possível carregar esta imagem. Atualize a página para tentar novamente.";});return;
      }
      if(typeof block.text!=="string"||block.text.length>12000)return;
      const tag=modern&&block.type==="heading"&&Number.isInteger(block.level)&&block.level>=1&&block.level<=6?"h"+block.level:tags[block.type];if(!tag)return;
      if(tag==="li"){if(!list){list=document.createElement("ul");content.append(list);}const item=document.createElement("li");item.textContent=block.text;list.append(item);return;}
      list=null;const element=document.createElement(tag);
      if(tag==="pre"){const code=document.createElement("code");code.textContent=block.text;element.append(code);}else element.textContent=block.text;
      content.append(element);
    });
  }
  window.addEventListener("pagehide",()=>{imageUrls.forEach(url=>URL.revokeObjectURL(url));imageUrls.clear();});
  async function load() {
    if (!id || !config.studioFunctionUrl || !config.supabaseAnonKey) return fail("A publicação não está disponível.");
    try {
      const response = await fetch(config.studioFunctionUrl, { method: "POST", headers: { "Content-Type": "application/json", "apikey": config.supabaseAnonKey, "Authorization": "Bearer " + config.supabaseAnonKey }, body: JSON.stringify({ action: "get_publication", publication_id: id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const publication = data.publication || {}; title.textContent = publication.title || "Publicação"; document.title = title.textContent + " | HeartSpace";
      summary.textContent = publication.summary || "Esta publicação não possui resumo."; studio.textContent = (data.studio && data.studio.name || "HeartSpace").toUpperCase(); project.textContent = data.project && data.project.name || "";
      state.textContent = publication.visibility === "unlisted" ? "PUBLICAÇÃO NÃO LISTADA" : "PUBLICADO";
      renderSnapshot(publication.snapshot_json);
      if (typeof publication.source_url === "string" && /^https:\/\//i.test(publication.source_url)) { source.href = publication.source_url; source.hidden = false; }
    } catch (error) { fail(error.message || "A publicação não foi encontrada."); }
  }
  document.getElementById("shareButton").addEventListener("click", async function () { try { if (navigator.share) return await navigator.share({ title: document.title, url: location.href }); await navigator.clipboard.writeText(location.href); state.textContent = "LINK COPIADO"; } catch (_) {} });
  load();
}());
