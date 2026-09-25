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
  function fail(message) { state.textContent = message; state.className = "state error"; title.textContent = "Página indisponível"; }
  async function load() {
    if (!id || !config.studioFunctionUrl || !config.supabaseAnonKey) return fail("A publicação não está disponível.");
    try {
      const response = await fetch(config.studioFunctionUrl, { method: "POST", headers: { "Content-Type": "application/json", "apikey": config.supabaseAnonKey, "Authorization": "Bearer " + config.supabaseAnonKey }, body: JSON.stringify({ action: "get_publication", publication_id: id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const publication = data.publication || {}; title.textContent = publication.title || "Publicação"; document.title = title.textContent + " | HeartSpace";
      summary.textContent = publication.summary || "Esta publicação não possui resumo."; studio.textContent = (data.studio && data.studio.name || "HeartSpace").toUpperCase(); project.textContent = data.project && data.project.name || "";
      state.textContent = publication.visibility === "unlisted" ? "PUBLICAÇÃO NÃO LISTADA" : "PUBLICADO";
      if (publication.source_url) { source.href = publication.source_url; source.hidden = false; }
    } catch (error) { fail(error.message || "A publicação não foi encontrada."); }
  }
  document.getElementById("shareButton").addEventListener("click", async function () { try { if (navigator.share) return await navigator.share({ title: document.title, url: location.href }); await navigator.clipboard.writeText(location.href); state.textContent = "LINK COPIADO"; } catch (_) {} });
  load();
}());
