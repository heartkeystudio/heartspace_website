(function () {
    "use strict";
    const context = window.HeartspaceReaderContext;
    if (!context) return;
    const status = document.getElementById("readerStatus");
    const list = document.getElementById("readerDocumentList");
    const main = document.getElementById("readerMain");
    const editorLink = document.getElementById("readerEditorLink");
    const dialog = document.getElementById("readerPublishDialog");
    const publishForm = document.getElementById("readerPublishForm");
    const publishStatus = document.getElementById("readerPublishStatus");
    const titleInput = document.getElementById("readerPublishTitle");
    const slugInput = document.getElementById("readerPublishSlug");
    const summaryInput = document.getElementById("readerPublishSummary");
    const visibilityInput = document.getElementById("readerPublishVisibility");
    const ignoredTags = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "OPTION", "SVG", "VIDEO", "AUDIO"]);
    const allowedTags = new Set("A ABBR B BLOCKQUOTE BR CAPTION CODE DD DEL DETAILS DIV DL DT EM FIGCAPTION FIGURE H1 H2 H3 H4 H5 H6 HR I IMG LI MARK OL P PRE S SMALL SPAN STRONG SUB SUMMARY SUP TABLE TBODY TD TH THEAD TR U UL".split(" "));
    let loadedProjectId = "";
    let documents = [];
    let publications = [];
    let activeDocument = null;
    let currentPublication = null;
    let approvedRevision = null;
    let selectedQuote = "";
    let loading = false;
    const paperSpecs = { a4: [794, 1123], letter: [816, 1056], a5: [559, 794] };
    const marginSpecs = { narrow: [48, 48], normal: [76, 72], wide: [104, 96] };

    if (editorLink) {
        editorLink.addEventListener("click", function (event) {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            const destination = new URL(context.docsUrl, window.location.href);
            destination.searchParams.set("source", "dashboard");
            const projectId = context.getProjectId();
            if (projectId) destination.searchParams.set("project_id", projectId);
            const docsWindow = window.open(destination.toString(), "_blank");
            if (!docsWindow) setStatus("O navegador bloqueou a nova aba. Permita pop-ups para abrir o Docs.", "error");
        });
    }

    function setStatus(message, state) { status.textContent = message; status.className = "form-status" + (state ? " is-" + state : ""); }
    function setPublishStatus(message, state) { publishStatus.textContent = message; publishStatus.className = "form-status" + (state ? " is-" + state : ""); }
    function parseContent(value) { if (typeof value === "string") { try { value = JSON.parse(value); } catch (_) { value = {}; } } return value && typeof value === "object" ? value : {}; }
    async function token() { const value = await context.getAccessToken(); if (!value) throw new Error("Sua sessão expirou. Entre novamente para ler os documentos."); return value; }
    async function rest(path, options) {
        const accessToken = await token();
        const headers = Object.assign({ apikey: context.supabaseKey, Authorization: "Bearer " + accessToken, "Content-Type": "application/json" }, options && options.headers || {});
        const response = await fetch(context.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, Object.assign({ headers: headers }, options || {}));
        const body = await response.json().catch(function () { return []; });
        if (!response.ok) throw new Error(body && body.message || body && body.error || "Não foi possível acessar os documentos.");
        return body;
    }
    async function studioRequest(action, payload) {
        const accessToken = await token();
        const response = await fetch(context.studioFunctionUrl, { method: "POST", headers: { apikey: context.supabaseKey, Authorization: "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ action: action }, payload || {})) });
        const body = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(body.error || "Não foi possível concluir a publicação.");
        return body;
    }
    function slugify(value) { return (value || "documento").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "documento"; }
    function sanitizeHTML(html) {
        const template = document.createElement("template");
        template.innerHTML = typeof html === "string" ? html : "";
        template.content.querySelectorAll("[data-mermaid-block]").forEach(function (block) {
            const source = block.querySelector(".mermaid-source");
            const code = document.createElement("pre"); code.textContent = source?.value || source?.textContent || block.textContent || "Diagrama Mermaid"; block.replaceWith(code);
        });
        const walk = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
        const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
        nodes.reverse().forEach(function (node) {
            if (ignoredTags.has(node.tagName)) { node.remove(); return; }
            if (!allowedTags.has(node.tagName)) { node.replaceWith(...node.childNodes); return; }
            Array.from(node.attributes).forEach(function (attribute) {
                const name = attribute.name.toLowerCase();
                if (name.startsWith("on") || name === "contenteditable" || name === "srcset") node.removeAttribute(attribute.name);
                else if (name === "style") {
                    const safeStyles = [];
                    const textAlign = node.style.textAlign;
                    if (["left", "center", "right", "justify"].includes(textAlign)) safeStyles.push("text-align:" + textAlign);
                    const lineIndent = node.style.getPropertyValue("--line-indent").trim();
                    if (/^(?:0|[1-9]\d{0,2})px$/.test(lineIndent)) safeStyles.push("--line-indent:" + lineIndent);
                    if (safeStyles.length) node.setAttribute("style", safeStyles.join(";")); else node.removeAttribute("style");
                }
                else if (["href", "src"].includes(name)) {
                    const value = attribute.value.trim();
                    if (!/^(https:\/\/|mailto:|#)/i.test(value)) node.removeAttribute(attribute.name);
                } else if (!(["alt", "title", "colspan", "rowspan", "scope", "data-docs-image", "data-image-style", "data-caption-position", "data-caption-align", "data-list-type", "data-checklist-item", "data-indent", "data-list-marker", "data-mermaid-block"].includes(name))) node.removeAttribute(attribute.name);
            });
            if (node.tagName === "A") { node.setAttribute("rel", "noopener noreferrer"); node.setAttribute("target", "_blank"); }
        });
        return template.innerHTML;
    }
    function hydrateImages(root) {
        root.querySelectorAll("img[src]").forEach(async function (image) {
            try {
                const src = image.getAttribute("src");
                if (!src || !src.startsWith(context.supabaseUrl)) return;
                const accessToken = await token();
                const response = await fetch(src, { headers: { apikey: context.supabaseKey, Authorization: "Bearer " + accessToken } });
                if (response.ok) image.src = URL.createObjectURL(await response.blob());
                else image.removeAttribute("src");
            } catch (_) { image.removeAttribute("src"); }
        });
    }
    function renderList() {
        list.replaceChildren();
        if (!documents.length) { const empty = document.createElement("p"); empty.className = "reader-list-empty"; empty.textContent = "Nenhum documento compartilhado neste projeto."; list.append(empty); return; }
        documents.forEach(function (doc) {
            const button = document.createElement("button"); button.type = "button"; button.className = "reader-document-item" + (activeDocument && activeDocument.id === doc.id ? " is-active" : ""); button.dataset.readerDoc = doc.id;
            const title = document.createElement("strong"); title.textContent = doc.title || "Sem título";
            const detail = document.createElement("small"); detail.textContent = (doc.readerContent.layout === "canvas" ? "Prancheta" : "Livro") + " · " + new Date(doc.updated_at || doc.created_at).toLocaleDateString("pt-BR");
            button.append(title, detail); list.append(button);
        });
    }
    function emptyMain(title, copy) { main.innerHTML = ""; const box = document.createElement("div"); box.className = "reader-empty"; const symbol = document.createElement("span"); symbol.textContent = "▤"; const heading = document.createElement("h2"); heading.textContent = title; const text = document.createElement("p"); text.textContent = copy; box.append(symbol, heading, text); main.append(box); }
    function renderReader(doc) {
        activeDocument = doc; approvedRevision = null; selectedQuote = ""; renderList();
        const content = doc.readerContent;
        main.innerHTML = "";
        const toolbar = document.createElement("div"); toolbar.className = "reader-toolbar";
        const format = document.createElement("span"); format.className = "reader-format-tag"; format.textContent = content.layout === "canvas" ? "PRANCHETA" : "LIVRO";
        currentPublication = publications.find(function (publication) { return publication.source_document_id === doc.id; }) || null;
        const publishButton = document.createElement("button"); publishButton.type = "button"; publishButton.className = "portal-button"; publishButton.dataset.readerAction = "publish"; publishButton.textContent = currentPublication ? (currentPublication.status === "withdrawn" ? "Republicar na Wiki" : "Atualizar Wiki") : "Publicar na Wiki";
        toolbar.append(format, publishButton);
        const title = document.createElement("h2"); title.className = "reader-document-title"; title.textContent = doc.title || content.title || "Sem título";
        const subtitle = document.createElement("p"); subtitle.className = "reader-document-subtitle"; subtitle.textContent = content.subtitle || ""; subtitle.hidden = !subtitle.textContent;
        const bookControls = document.createElement("div"); bookControls.className = "reader-page-controls"; bookControls.hidden = content.layout === "canvas";
        const previous = document.createElement("button"); previous.type = "button"; previous.dataset.readerAction = "previous-page"; previous.textContent = "← Página anterior";
        const pageInfo = document.createElement("span"); pageInfo.textContent = "Página 1"; pageInfo.dataset.readerPageInfo = "true";
        const next = document.createElement("button"); next.type = "button"; next.dataset.readerAction = "next-page"; next.textContent = "Próxima página →";
        bookControls.append(previous, pageInfo, next);
        const stage = document.createElement("div"); stage.className = content.layout === "canvas" ? "reader-canvas-stage" : "reader-book-stage"; stage.dataset.readerStage = "true";
        const rendered = document.createElement("div"); rendered.className = "reader-rendered-content"; rendered.dataset.readerContent = "true"; rendered.innerHTML = sanitizeHTML(content.body || "<p>Este documento está vazio.</p>");
        if (content.layout === "book") {
            const pageTitle = document.createElement("h1"); pageTitle.className = "reader-book-title"; pageTitle.textContent = doc.title || content.title || "Sem título";
            const pageSubtitle = document.createElement("p"); pageSubtitle.className = "reader-book-subtitle"; pageSubtitle.textContent = content.subtitle || ""; pageSubtitle.hidden = !pageSubtitle.textContent;
            rendered.prepend(pageTitle, pageSubtitle);
            title.hidden = true; subtitle.hidden = true;
        }
        stage.append(rendered);
        const footer = document.createElement("div"); footer.className = "reader-review-footer";
        const quote = document.createElement("blockquote"); quote.className = "reader-selected-quote"; quote.dataset.readerQuote = "true"; quote.hidden = true;
        const composer = document.createElement("form"); composer.className = "reader-comment-composer"; composer.dataset.readerComposer = "true"; composer.hidden = true;
        const textarea = document.createElement("textarea"); textarea.maxLength = 8000; textarea.placeholder = "O que precisa ser revisado?"; textarea.required = true; textarea.setAttribute("aria-label", "Comentário de revisão");
        const send = document.createElement("button"); send.className = "portal-button"; send.type = "submit"; send.textContent = "Enviar comentário";
        const cancel = document.createElement("button"); cancel.className = "row-button"; cancel.type = "button"; cancel.dataset.readerAction = "cancel-comment"; cancel.textContent = "Cancelar"; composer.append(textarea, cancel, send);
        const comments = document.createElement("details"); comments.className = "reader-comments"; comments.open = false;
        const summary = document.createElement("summary"); summary.textContent = "Comentários de revisão";
        const commentList = document.createElement("div"); commentList.className = "reader-comments-list"; commentList.dataset.readerComments = "true";
        comments.append(summary, commentList); footer.append(quote, composer, comments);
        const selectionAction = document.createElement("button"); selectionAction.type = "button"; selectionAction.className = "reader-selection-action"; selectionAction.dataset.readerAction = "request-review"; selectionAction.textContent = "Solicitar revisão"; selectionAction.hidden = true;
        main.append(toolbar, title, subtitle, bookControls, stage, footer, selectionAction);
        configureReaderStage(stage, rendered, content);
        hydrateImages(rendered); loadComments(doc.id, commentList);
        if (content.layout === "book") updatePageInformation(stage, pageInfo);
        loadApprovedRevision(doc, publishButton);
        document.getSelection()?.removeAllRanges();
    }
    function configureReaderStage(stage, rendered, content) {
        if (content.layout !== "book") {
            stage.style.removeProperty("height"); stage.style.removeProperty("background-size"); stage.style.removeProperty("background-image");
            rendered.style.removeProperty("zoom"); rendered.style.removeProperty("width"); rendered.style.removeProperty("height"); rendered.style.removeProperty("padding");
            stage.dataset.pagePitch = ""; return;
        }
        const page = content.page || {};
        const size = paperSpecs[page.size] || paperSpecs.a4;
        const landscape = page.orientation === "landscape";
        const width = landscape ? size[1] : size[0];
        const height = landscape ? size[0] : size[1];
        const margin = marginSpecs[page.margin] || marginSpecs.normal;
        const availableWidth = Math.max(240, main.clientWidth || width);
        const scale = Math.min(1, availableWidth / width);
        const gap = 54;
        stage.style.setProperty("--reader-page-width", width + "px");
        stage.style.setProperty("--reader-page-height", height + "px");
        stage.style.setProperty("--reader-margin-x", margin[0] + "px");
        stage.style.setProperty("--reader-margin-y", margin[1] + "px");
        stage.style.height = Math.round(height * scale) + "px";
        stage.style.width = Math.round(width * scale) + "px";
        stage.style.marginInline = "auto";
        stage.style.backgroundColor = "#25232a";
        stage.style.backgroundSize = Math.round((width + gap) * scale) + "px " + Math.round(height * scale) + "px";
        stage.style.backgroundImage = "repeating-linear-gradient(to right, #eee9df 0, #eee9df " + Math.round(width * scale) + "px, #c9c2b8 " + Math.round(width * scale) + "px, #eee9df " + Math.round((width + 1) * scale) + "px, transparent " + Math.round((width + 1) * scale) + "px, transparent " + Math.round((width + gap) * scale) + "px)";
        stage.dataset.pagePitch = String((width + gap) * scale);
        rendered.style.width = width + "px";
        rendered.style.height = height + "px";
        rendered.style.padding = margin[1] + "px " + margin[0] + "px";
        rendered.style.marginRight = margin[0] + "px";
        rendered.style.zoom = String(scale);
    }
    function bookPageWidth(stage) { return Math.max(1, Number(stage.dataset.pagePitch) || stage.clientWidth || 760); }
    function updatePageInformation(stage, label) {
        const pitch = bookPageWidth(stage);
        const lastPageIndex = Math.max(0, Math.floor((stage.scrollWidth - 1) / pitch));
        const pageIndex = Math.min(lastPageIndex, Math.max(0, Math.round(stage.scrollLeft / pitch)));
        const page = pageIndex + 1;
        label.textContent = "Página " + page; label.dataset.page = String(page);
        const controls = label.closest(".reader-page-controls");
        const previous = controls && controls.querySelector('[data-reader-action="previous-page"]');
        const next = controls && controls.querySelector('[data-reader-action="next-page"]');
        if (previous) previous.disabled = pageIndex <= 0;
        if (next) next.disabled = pageIndex >= lastPageIndex;
    }
    async function loadComments(docId, host) {
        host.replaceChildren();
        try {
            const params = new URLSearchParams({ select: "id,author_name,body,quote,created_at", doc_id: "eq." + docId, parent_id: "is.null", order: "created_at.asc", limit: "100" });
            const rows = await rest("doc_comments?" + params.toString());
            if (!rows.length) { const empty = document.createElement("p"); empty.className = "reader-list-empty"; empty.textContent = "Ainda não há comentários. Selecione um trecho para iniciar uma revisão."; host.append(empty); return; }
            rows.forEach(function (row) { const card = document.createElement("article"); card.className = "reader-comment-card"; if (row.quote) { const selected = document.createElement("blockquote"); selected.textContent = row.quote; card.append(selected); } const body = document.createElement("p"); body.textContent = row.body; const byline = document.createElement("small"); byline.textContent = (row.author_name || "Membro") + " · " + new Date(row.created_at).toLocaleString("pt-BR"); card.append(body, byline); host.append(card); });
        } catch (error) { const note = document.createElement("p"); note.className = "reader-list-empty"; note.textContent = error.message || "Não foi possível carregar os comentários."; host.append(note); }
    }
    async function loadApprovedRevision(doc, button) {
        try {
            const params = new URLSearchParams({ select: "id,revision_number,content,approved_at", doc_id: "eq." + doc.id, approved_at: "not.is.null", order: "revision_number.desc", limit: "1" });
            const rows = await rest("doc_revisions?" + params.toString());
            approvedRevision = rows[0] || null;
            button.disabled = !approvedRevision;
            button.title = approvedRevision ? "Publica a revisão aprovada nº " + approvedRevision.revision_number : "Este documento ainda não tem uma revisão aprovada.";
        } catch (_) { button.disabled = true; button.title = "Não foi possível verificar as revisões aprovadas."; }
    }
    function snapshotFromHTML(html) {
        const fragment = document.createElement("template"); fragment.innerHTML = sanitizeHTML(html);
        const blocks = [];
        function add(type, text) { const value = (text || "").replace(/\s+/g, " ").trim(); if (value && blocks.length < 500) blocks.push({ type: type, text: value.slice(0, 12000) }); }
        function visit(node) {
            if (blocks.length >= 500 || node.nodeType !== Node.ELEMENT_NODE) return;
            const tag = node.tagName.toLowerCase();
            const types = { h1: 1, h2: 2, h3: 3, blockquote: 7, pre: 8, p: 0, li: 4 };
            if (tag === "ul" || tag === "ol") { Array.from(node.children).forEach(function (child) { if (child.tagName === "LI") add(tag === "ol" ? 5 : 4, child.textContent); }); return; }
            if (Object.prototype.hasOwnProperty.call(types, tag)) { add(types[tag], node.textContent); return; }
            Array.from(node.children).forEach(visit);
        }
        Array.from(fragment.content.children).forEach(visit);
        return { version: 1, format: "heartspace-docs-v1", blocks: blocks };
    }
    function showPublishDialog() {
        if (!activeDocument || !approvedRevision) return;
        const approvedContent = parseContent(approvedRevision.content);
        titleInput.value = approvedContent.title || activeDocument.title || "Sem título"; slugInput.dataset.edited = ""; slugInput.value = currentPublication?.slug || slugify(titleInput.value); summaryInput.value = currentPublication?.summary || approvedContent.subtitle || activeDocument.readerContent.subtitle || ""; visibilityInput.value = currentPublication?.visibility || "public"; setPublishStatus("", ""); dialog.showModal();
    }
    async function publishDocument() {
        if (!activeDocument || !approvedRevision) return;
        const projectId = context.getProjectId(); const studioId = context.getStudioId();
        if (!projectId || !studioId) throw new Error("Selecione um projeto e um estúdio antes de publicar.");
        const revisionContent = parseContent(approvedRevision.content);
        if (revisionContent.format !== "heartspace-html-v1" || typeof revisionContent.body !== "string") throw new Error("A revisão aprovada não está em um formato compatível para publicação.");
        const snapshot = snapshotFromHTML(revisionContent.body);
        if (!snapshot.blocks.length) throw new Error("Não há conteúdo textual para publicar nesta revisão.");
        const result = await studioRequest("save_publication", {
            studio_id: studioId, project_id: projectId, publication_id: currentPublication?.id || "", title: titleInput.value.trim(), slug: slugify(slugInput.value), summary: summaryInput.value.trim(), source_url: currentPublication?.source_url || "", visibility: visibilityInput.value, status: "published",
            source: { document_id: activeDocument.id, revision_id: approvedRevision.id, revision_number: approvedRevision.revision_number, format: "heartspace-docs-v1" }, snapshot: snapshot
        });
        currentPublication = Object.assign({}, currentPublication || {}, { id: result.publication.id, source_document_id: activeDocument.id, slug: slugify(slugInput.value), summary: summaryInput.value.trim(), visibility: visibilityInput.value, status: "published" });
        setPublishStatus("Publicado. ", "success");
        const publicationLink = document.createElement("a"); publicationLink.href = result.public_url; publicationLink.target = "_blank"; publicationLink.rel = "noopener"; publicationLink.textContent = "Abrir página da Wiki ↗"; publishStatus.append(publicationLink);
    }
    async function load(force) {
        if (loading) return;
        const projectId = context.getProjectId();
        if (!projectId) { loadedProjectId = ""; documents = []; activeDocument = null; renderList(); emptyMain("Escolha um projeto", "Selecione um projeto no menu lateral para carregar os documentos."); setStatus("Escolha um projeto para carregar os documentos."); return; }
        if (!force && loadedProjectId === projectId && documents.length) return;
        loading = true; loadedProjectId = projectId; setStatus("Carregando documentos…"); list.replaceChildren();
        activeDocument = null; approvedRevision = null;
        const params = new URLSearchParams({ select: "id,project_id,title,content,author,created_at,updated_at", project_id: "eq." + projectId, order: "updated_at.desc" });
        try {
            const rows = await rest("docs?" + params.toString());
            if (context.getProjectId() !== projectId) return;
            publications = [];
            try {
                const projectPublications = await studioRequest("list_publications", { studio_id: context.getStudioId(), project_id: projectId });
                publications = Array.isArray(projectPublications.publications) ? projectPublications.publications : [];
            } catch (_) { /* leitura continua disponível mesmo se não houver permissão administrativa */ }
            if (context.getProjectId() !== projectId) return;
            documents = rows.map(function (row) { const readerContent = parseContent(row.content); return Object.assign({}, row, { readerContent: readerContent }); }).filter(function (row) { return row.readerContent.format === "heartspace-html-v1" && !row.readerContent.trash?.deleted_at; });
            setStatus(documents.length + (documents.length === 1 ? " documento disponível." : " documentos disponíveis."));
            if (editorLink) {
                const destination = new URL(context.docsUrl, window.location.href);
                destination.searchParams.set("source", "dashboard");
                destination.searchParams.set("project_id", projectId);
                editorLink.href = destination.toString();
            }
            renderList();
            if (documents.length) renderReader(documents[0]); else { activeDocument = null; emptyMain("Nenhum documento encontrado", "Crie ou compartilhe um documento do Docs neste projeto."); }
        } catch (error) { documents = []; activeDocument = null; renderList(); emptyMain("Não foi possível carregar", error.message || "Verifique sua conexão e tente novamente."); setStatus(error.message || "Falha ao carregar documentos.", "error"); }
        finally { loading = false; if (context.getProjectId() && loadedProjectId !== context.getProjectId()) load(true); }
    }
    list.addEventListener("click", function (event) { const button = event.target.closest("[data-reader-doc]"); if (!button) return; const doc = documents.find(function (item) { return item.id === button.dataset.readerDoc; }); if (doc) renderReader(doc); });
    main.addEventListener("click", function (event) {
        const action = event.target.closest("[data-reader-action]"); if (!action) return;
        if (action.dataset.readerAction === "publish") showPublishDialog();
        if (action.dataset.readerAction === "request-review") {
            if (!selectedQuote) return;
            const quote = main.querySelector("[data-reader-quote]"); quote.textContent = "“" + selectedQuote + "”"; quote.hidden = false;
            const composer = main.querySelector("[data-reader-composer]"); composer.hidden = false; action.hidden = true; composer.querySelector("textarea").focus();
        }
        if (action.dataset.readerAction === "cancel-comment") { main.querySelector("[data-reader-composer]").hidden = true; main.querySelector("[data-reader-quote]").hidden = true; selectedQuote = ""; action.hidden = true; document.getSelection()?.removeAllRanges(); }
        if (["next-page", "previous-page"].includes(action.dataset.readerAction)) {
            const stage = main.querySelector("[data-reader-stage]"); const pitch = bookPageWidth(stage);
            const lastPageIndex = Math.max(0, Math.floor((stage.scrollWidth - 1) / pitch));
            const currentPageIndex = Math.min(lastPageIndex, Math.max(0, Math.round(stage.scrollLeft / pitch)));
            const direction = action.dataset.readerAction === "next-page" ? 1 : -1;
            const targetPageIndex = Math.min(lastPageIndex, Math.max(0, currentPageIndex + direction));
            stage.scrollTo({ left: targetPageIndex * pitch, behavior: "smooth" });
        }
    });
    main.addEventListener("pointerdown", function (event) {
        if (event.target.closest('[data-reader-action="request-review"]')) {
            event.preventDefault();
            const selection = document.getSelection();
            if (selection && selection.toString().trim()) selectedQuote = selection.toString().trim().slice(0, 2000);
        }
    });
    function updateSelectionAction() {
        const selectionAction = main.querySelector('[data-reader-action="request-review"]');
        const composer = main.querySelector("[data-reader-composer]");
        if (!selectionAction || !composer || !main.closest('[data-workspace-panel="docs-reader"]')?.classList.contains("is-active") || !composer.hidden) return;
        const selection = document.getSelection(); const content = main.querySelector("[data-reader-content]");
        const hasSelection = Boolean(selection && content && selection.rangeCount && content.contains(selection.anchorNode) && content.contains(selection.focusNode) && selection.toString().trim().length >= 2);
        selectedQuote = hasSelection ? selection.toString().trim().slice(0, 2000) : "";
        if (!hasSelection) { selectionAction.hidden = true; return; }
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        if (!rect.width && !rect.height) { selectionAction.hidden = true; return; }
        selectionAction.hidden = false;
        const actionRect = selectionAction.getBoundingClientRect();
        const left = Math.min(window.innerWidth - actionRect.width - 12, Math.max(12, rect.left + rect.width / 2 - actionRect.width / 2));
        const top = rect.top > actionRect.height + 16 ? rect.top - actionRect.height - 10 : Math.min(window.innerHeight - actionRect.height - 12, rect.bottom + 10);
        selectionAction.style.left = Math.round(left) + "px"; selectionAction.style.top = Math.round(top) + "px";
    }
    document.addEventListener("selectionchange", function () {
        if (activeDocument) updateSelectionAction();
    });
    main.addEventListener("scroll", function (event) { const stage = event.target.closest("[data-reader-stage]"); const info = main.querySelector("[data-reader-page-info]"); if (stage && info) updatePageInformation(stage, info); if (stage) updateSelectionAction(); }, true);
    window.addEventListener("resize", function () {
        updateSelectionAction();
        const stage = main.querySelector("[data-reader-stage]"); const rendered = main.querySelector("[data-reader-content]");
        if (activeDocument && stage && rendered) configureReaderStage(stage, rendered, activeDocument.readerContent);
    });
    main.addEventListener("submit", async function (event) {
        const form = event.target.closest("[data-reader-composer]"); if (!form || !activeDocument) return;
        event.preventDefault(); const textarea = form.querySelector("textarea"); const body = textarea.value.trim(); if (!body || !selectedQuote) return;
        const user = context.getUser() || {}; const profile = context.getProfile() || {};
        const name = profile.nickname || profile.full_name || user.user_metadata?.nickname || user.user_metadata?.full_name || user.email || "Membro";
        try {
            const inserted = await rest("doc_comments", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ doc_id: activeDocument.id, block_id: "reader-quote:" + Date.now(), author_name: String(name).slice(0, 120), body: body, quote: selectedQuote }) });
            textarea.value = ""; form.hidden = true; main.querySelector("[data-reader-quote]").hidden = true; main.querySelector('[data-reader-action="request-review"]').hidden = true; selectedQuote = ""; const comments = main.querySelector(".reader-comments"); comments.open = true;
            await loadComments(activeDocument.id, main.querySelector("[data-reader-comments]")); setStatus("Comentário de revisão registrado.", "success");
            if (inserted && inserted[0]) main.querySelector("[data-reader-comments]").scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (error) { setStatus(error.message || "Você não tem permissão para comentar neste documento.", "error"); }
    });
    document.getElementById("readerRefresh").addEventListener("click", function () { load(true); });
    document.getElementById("readerPublishClose").addEventListener("click", function () { dialog.close(); });
    document.getElementById("readerPublishCancel").addEventListener("click", function () { dialog.close(); });
    publishForm.addEventListener("submit", async function (event) { event.preventDefault(); const button = document.getElementById("readerPublishSubmit"); button.disabled = true; setPublishStatus("Publicando snapshot…"); try { await publishDocument(); } catch (error) { setPublishStatus(error.message || "Não foi possível publicar a revisão.", "error"); } finally { button.disabled = false; } });
    titleInput.addEventListener("input", function () { if (!slugInput.dataset.edited) slugInput.value = slugify(titleInput.value); });
    slugInput.addEventListener("input", function () { slugInput.dataset.edited = "true"; });
    window.HeartspaceDocsReader = { load: function () { return load(false); } };
}());
