(function () {
    "use strict";

    const config = window.HEARTSPACE_ACCOUNT_CONFIG || {};
    const googleButton = document.getElementById("googleSignIn");
    const magicLinkForm = document.getElementById("magicLinkForm");
    const emailInput = document.getElementById("email");
    const status = document.getElementById("authStatus");
    const accountCard = document.querySelector(".account-card");
    const accountLoading = document.getElementById("accountLoading");
    const profileOnboarding = document.getElementById("profileOnboarding");
    const profileForm = document.getElementById("profileForm");
    const profileAvatarFile = document.getElementById("profileAvatarFile");
    const profileAvatarPreview = document.getElementById("profileAvatarPreview");
    const profileFullName = document.getElementById("profileFullName");
    const profileNickname = document.getElementById("profileNickname");
    const profileAge = document.getElementById("profileAge");
    const profileProfession = document.getElementById("profileProfession");
    const profilePhone = document.getElementById("profilePhone");
    const profileStatus = document.getElementById("profileStatus");
    const memberArea = document.getElementById("memberArea");
    const memberName = document.getElementById("memberName");
    const memberRole = document.getElementById("memberRole");
    const themeToggle = document.getElementById("themeToggle");
    const planName = document.getElementById("planName");
    const planDescription = document.getElementById("planDescription");
    const billingPortal = document.getElementById("billingPortal");
    const billingStatus = document.getElementById("billingStatus");
    const signOut = document.getElementById("signOut");
    const checkoutChoice = document.getElementById("checkoutChoice");
    const selectedPlanName = document.getElementById("selectedPlanName");
    const selectedPlanCopy = document.getElementById("selectedPlanCopy");
    const checkoutButton = document.getElementById("checkoutButton");
    const query = new URLSearchParams(window.location.search);
    const selectedPlan = query.get("plan");
    const checkoutState = query.get("checkout");
    const checkoutNotice = document.getElementById("checkoutNotice");
    const securityEmail = document.getElementById("securityEmail");
    const workspaceButtons = Array.from(document.querySelectorAll("[data-workspace-view]"));
    const workspacePanels = Array.from(document.querySelectorAll("[data-workspace-panel]"));
    const studiosTitle = document.getElementById("studiosTitle");
    const studiosCopy = document.getElementById("studiosCopy");
    const studioList = document.getElementById("studioList");
    const createStudioForm = document.getElementById("createStudioForm");
    const studioName = document.getElementById("studioName");
    const studioSlug = document.getElementById("studioSlug");
    const studioTemplate = document.getElementById("studioTemplate");
    const studioStatus = document.getElementById("studioStatus");
    const inviteMemberForm = document.getElementById("inviteMemberForm");
    const inviteStudio = document.getElementById("inviteStudio");
    const inviteEmail = document.getElementById("inviteEmail");
    const inviteRole = document.getElementById("inviteRole");
    const inviteStatus = document.getElementById("inviteStatus");
    const inviteLink = document.getElementById("inviteLink");
    const membersTitle = document.getElementById("membersTitle");
    const membersCopy = document.getElementById("membersCopy");
    const studioContextSelect = document.getElementById("studioContextSelect");
    const studioContextImage = document.getElementById("studioContextImage");
    const studioContextFallback = document.getElementById("studioContextFallback");
    const overviewStudioCount = document.getElementById("overviewStudioCount");
    const overviewProjectCount = document.getElementById("overviewProjectCount");
    const overviewStudioTitle = document.getElementById("overviewStudioTitle");
    const overviewStudioCopy = document.getElementById("overviewStudioCopy");
    const studioSettingsPanel = document.getElementById("studioSettingsPanel");
    const studioSettingsForm = document.getElementById("studioSettingsForm");
    const activeStudioHeading = document.getElementById("activeStudioHeading");
    const activeStudioName = document.getElementById("activeStudioName");
    const activeStudioTemplate = document.getElementById("activeStudioTemplate");
    const activeStudioIcon = document.getElementById("activeStudioIcon");
    const activeStudioIconFile = document.getElementById("activeStudioIconFile");
    const activeStudioIconPreview = document.getElementById("activeStudioIconPreview");
    const activeStudioDescription = document.getElementById("activeStudioDescription");
    const studioSettingsStatus = document.getElementById("studioSettingsStatus");
    const studioActivityPanel = document.getElementById("studioActivityPanel");
    const studioActivityList = document.getElementById("studioActivityList");
    const studioDangerPanel = document.getElementById("studioDangerPanel");
    const deleteStudioForm = document.getElementById("deleteStudioForm");
    const deleteStudioName = document.getElementById("deleteStudioName");
    const deleteStudioConfirmation = document.getElementById("deleteStudioConfirmation");
    const deleteStudioStatus = document.getElementById("deleteStudioStatus");
    const memberList = document.getElementById("memberList");
    const pendingInvitesPanel = document.getElementById("pendingInvitesPanel");
    const pendingInviteList = document.getElementById("pendingInviteList");
    const roleCatalog = document.getElementById("roleCatalog");
    const projectList = document.getElementById("projectList");
    const projectsTitle = document.getElementById("projectsTitle");
    const projectsCopy = document.getElementById("projectsCopy");
    const createProjectForm = document.getElementById("createProjectForm");
    const projectName = document.getElementById("projectName");
    const projectDescription = document.getElementById("projectDescription");
    const projectStatus = document.getElementById("projectStatus");
    const projectContextLabel = document.getElementById("projectContextLabel");
    const projectContextSelect = document.getElementById("projectContextSelect");
    const projectSettingsPanel = document.getElementById("projectSettingsPanel");
    const projectSettingsForm = document.getElementById("projectSettingsForm");
    const activeProjectHeading = document.getElementById("activeProjectHeading");
    const activeProjectName = document.getElementById("activeProjectName");
    const activeProjectStatus = document.getElementById("activeProjectStatus");
    const activeProjectDescription = document.getElementById("activeProjectDescription");
    const activeProjectImage = document.getElementById("activeProjectImage");
    const activeProjectImageFile = document.getElementById("activeProjectImageFile");
    const activeProjectImagePreview = document.getElementById("activeProjectImagePreview");
    const activeProjectBanner = document.getElementById("activeProjectBanner");
    const activeProjectBannerFile = document.getElementById("activeProjectBannerFile");
    const activeProjectBannerPreview = document.getElementById("activeProjectBannerPreview");
    const projectDangerPanel = document.getElementById("projectDangerPanel");
    const deleteProjectForm = document.getElementById("deleteProjectForm");
    const deleteProjectName = document.getElementById("deleteProjectName");
    const deleteProjectConfirmation = document.getElementById("deleteProjectConfirmation");
    const deleteProjectStatus = document.getElementById("deleteProjectStatus");
    const publicationProjectSelect = document.getElementById("publicationProjectSelect");
    const publicationEmptyState = document.getElementById("publicationEmptyState");
    const publicationList = document.getElementById("publicationList");
    const publicationEditorPanel = document.getElementById("publicationEditorPanel");
    const publicationEditorTitle = document.getElementById("publicationEditorTitle");
    const publicationForm = document.getElementById("publicationForm");
    const publicationId = document.getElementById("publicationId");
    const publicationTitle = document.getElementById("publicationTitle");
    const publicationSlug = document.getElementById("publicationSlug");
    const publicationSummary = document.getElementById("publicationSummary");
    const publicationSourceUrl = document.getElementById("publicationSourceUrl");
    const publicationVisibility = document.getElementById("publicationVisibility");
    const publicationStatus = document.getElementById("publicationStatus");
    const publicationStatusMessage = document.getElementById("publicationStatusMessage");
    const appsProjectSelect = document.getElementById("appsProjectSelect");
    const appsEmptyState = document.getElementById("appsEmptyState");
    const projectAppsList = document.getElementById("projectAppsList");
    const refreshAuditLog = document.getElementById("refreshAuditLog");
    const auditLogNotice = document.getElementById("auditLogNotice");
    const auditLogList = document.getElementById("auditLogList");
    const refreshUsage = document.getElementById("refreshUsage");
    const usageStudios = document.getElementById("usageStudios");
    const usageProjects = document.getElementById("usageProjects");
    const usageMembers = document.getElementById("usageMembers");
    const usagePublications = document.getElementById("usagePublications");
    const usageStatus = document.getElementById("usageStatus");
    const profileWorkspaceButton = document.getElementById("profileWorkspaceButton");
    const profileOnboardingTitle = document.getElementById("profileOnboardingTitle");
    const projectSettingsStatus = document.getElementById("projectSettingsStatus");
    const projectRoleCatalogPanel = document.getElementById("projectRoleCatalogPanel");
    const roleCatalogEditor = document.getElementById("roleCatalogEditor");
    const addProjectRole = document.getElementById("addProjectRole");
    const saveProjectRoleCatalog = document.getElementById("saveProjectRoleCatalog");
    const projectRoleCatalogStatus = document.getElementById("projectRoleCatalogStatus");
    const projectRolesPanel = document.getElementById("projectRolesPanel");
    const productionRoleList = document.getElementById("productionRoleList");
    const projectRolesStatus = document.getElementById("projectRolesStatus");
    let currentStudios = [];
    let activeStudioId = sessionStorage.getItem(sessionKey("active-studio")) || "";
    let activeProjectId = sessionStorage.getItem(sessionKey("active-project")) || "";
    let activeStudioAdmin = null;
    let activeProjectAdmin = null;
    let currentStudioProjects = [];
    let currentProfile = null;
    let currentUserId = "";
    let pendingStudioIconFile = null;
    let pendingProfileAvatarFile = null;
    let pendingProjectImageFile = null;
    let pendingProjectBannerFile = null;
    const planDetails = {
        indie: { name: "Indie — Studio", copy: "Colaboração e infraestrutura para quem já está construindo junto." },
        studio: { name: "Studio", copy: "Permissões, playtests e fluxos de produção para estúdios em crescimento." }
    };

    const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);

    if (!config.billingFunctionUrl) {
        billingPortal.disabled = true;
        billingPortal.textContent = "Assinaturas em breve";
    }

    if (!selectedPlan || !planDetails[selectedPlan]) {
        checkoutChoice.hidden = true;
    } else {
        selectedPlanName.textContent = planDetails[selectedPlan].name;
        selectedPlanCopy.textContent = planDetails[selectedPlan].copy + " Você só segue para o pagamento depois de confirmar esta escolha.";
        if (!(config.plans && config.plans[selectedPlan] && config.billingFunctionUrl)) {
            checkoutButton.disabled = true;
            checkoutButton.textContent = "Plano em preparação";
        }
    }

    function setStatus(message, state) {
        status.textContent = message;
        status.className = "auth-status" + (state ? " is-" + state : "");
    }

    function requireConfiguration() {
        setStatus("A entrada ainda está sendo preparada. Volte em breve para criar ou acessar sua conta.", "");
        return false;
    }

    function sessionKey(name) {
        return "heartspace-account-" + name;
    }

    function migrateLegacySession() {
        const accessToken = localStorage.getItem(sessionKey("access-token")) || sessionStorage.getItem(sessionKey("access-token"));
        if (!accessToken || localStorage.getItem(sessionKey("access-token"))) return;
        localStorage.setItem(sessionKey("access-token"), accessToken);
        ["refresh-token", "expires-at"].forEach(function (name) { const value = sessionStorage.getItem(sessionKey(name)); if (value) localStorage.setItem(sessionKey(name), value); });
    }

    function saveSession(accessToken, refreshToken, expiresAt) {
        if (!accessToken) return;
        localStorage.setItem(sessionKey("access-token"), accessToken);
        if (refreshToken) localStorage.setItem(sessionKey("refresh-token"), refreshToken);
        else localStorage.removeItem(sessionKey("refresh-token"));
        if (expiresAt) localStorage.setItem(sessionKey("expires-at"), String(expiresAt));
        else localStorage.removeItem(sessionKey("expires-at"));
    }

    function clearSession() {
        localStorage.removeItem(sessionKey("access-token"));
        localStorage.removeItem(sessionKey("refresh-token"));
        localStorage.removeItem(sessionKey("expires-at"));
    }

    function readCallbackSession() {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        if (accessToken) {
            saveSession(accessToken, hash.get("refresh_token"), hash.get("expires_at"));
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
        return accessToken;
    }

    function accessTokenExpiresSoon() {
        const expiresAt = Number(localStorage.getItem(sessionKey("expires-at")) || 0);
        return Boolean(expiresAt && expiresAt <= (Date.now() / 1000) + 60);
    }

    async function refreshAccessToken() {
        const refreshToken = localStorage.getItem(sessionKey("refresh-token"));
        if (!refreshToken) return null;
        const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/token?grant_type=refresh_token", {
            method: "POST",
            headers: { "apikey": config.supabaseAnonKey, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (!response.ok) throw new Error("Não foi possível renovar a sessão.");
        const session = await response.json();
        saveSession(session.access_token, session.refresh_token, session.expires_at);
        return session.access_token;
    }

    async function getValidAccessToken() {
        migrateLegacySession();
        const callbackToken = readCallbackSession();
        if (callbackToken && !accessTokenExpiresSoon()) return callbackToken;
        const storedToken = localStorage.getItem(sessionKey("access-token"));
        if (!storedToken || accessTokenExpiresSoon()) return refreshAccessToken();
        return storedToken;
    }

    function showMemberArea(user, profile) {
        currentUserId = user.id || currentUserId;
        const metadata = user.user_metadata || {};
        memberName.textContent = (profile && profile.full_name) || metadata.full_name || metadata.name || user.email || "Conta HeartSpace";
        securityEmail.textContent = user.email || "Conta HeartSpace";
        accountLoading.hidden = true;
        profileOnboarding.hidden = true;
        memberArea.hidden = false;
        if (selectedPlan && planDetails[selectedPlan]) checkoutChoice.hidden = false;
        if (checkoutState === "success") {
            checkoutNotice.hidden = false;
            checkoutNotice.textContent = "Pagamento concluído. Estamos atualizando os recursos da sua conta.";
        } else if (checkoutState === "cancelled") {
            checkoutNotice.hidden = false;
            checkoutNotice.classList.add("is-cancelled");
            checkoutNotice.textContent = "O pagamento foi cancelado. Sua conta continua ativa no plano atual.";
        }
    }

    function applyTheme(theme) {
        const isLight = theme === "light";
        document.body.classList.toggle("is-light", isLight);
        themeToggle.setAttribute("aria-pressed", String(isLight));
        themeToggle.textContent = isLight ? "🌙" : "☀️";
        localStorage.setItem("heartspace-theme", isLight ? "light" : "dark");
    }

    applyTheme(localStorage.getItem("heartspace-theme") || localStorage.getItem("heartspace-account-theme") || "dark");
    themeToggle.addEventListener("click", function () {
        applyTheme(document.body.classList.contains("is-light") ? "dark" : "light");
    });

    function setProfileStatus(message, state) {
        profileStatus.textContent = message;
        profileStatus.className = "form-status" + (state ? " is-" + state : "");
    }

    async function compressProfileAvatar(file) {
        if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) throw new Error("Escolha uma foto PNG, JPEG ou WebP de até 8 MB.");
        const sourceUrl = URL.createObjectURL(file);
        try {
            const image = await new Promise(function (resolve, reject) { const element = new Image(); element.onload = function () { resolve(element); }; element.onerror = reject; element.src = sourceUrl; });
            const scale = Math.min(1, 256 / image.width, 256 / image.height);
            const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/webp", .84); });
            if (!blob || blob.size > 160 * 1024) throw new Error("Não foi possível otimizar essa foto. Escolha outra imagem.");
            return blob;
        } finally { URL.revokeObjectURL(sourceUrl); }
    }

    profileAvatarFile.addEventListener("change", async function () {
        const file = profileAvatarFile.files && profileAvatarFile.files[0]; if (!file) return;
        try { pendingProfileAvatarFile = await compressProfileAvatar(file); profileAvatarPreview.src = URL.createObjectURL(pendingProfileAvatarFile); profileAvatarPreview.hidden = false; setProfileStatus("Foto pronta para salvar.", "success"); }
        catch (error) { pendingProfileAvatarFile = null; profileAvatarFile.value = ""; setProfileStatus(error.message || "Não foi possível preparar a foto.", "error"); }
    });
    profileAvatarPreview.addEventListener("error", function () { profileAvatarPreview.hidden = true; });

    function showProfileOnboarding(profile, editing) {
        profileFullName.value = profile.full_name || "";
        profileNickname.value = profile.nickname || "";
        profileAge.value = Number.isInteger(profile.age) && profile.age > 0 ? String(profile.age) : "";
        profileProfession.value = profile.profession || "";
        profilePhone.value = profile.phone || "";
        profileAvatarFile.value = "";
        pendingProfileAvatarFile = null;
        profileAvatarPreview.hidden = !profile.avatar_url;
        if (profile.avatar_url) profileAvatarPreview.src = profile.avatar_url;
        profileOnboardingTitle.textContent = editing ? "Edite seu perfil." : "Antes de entrar, conte um pouco sobre você.";
        accountLoading.hidden = true;
        memberArea.hidden = true;
        profileOnboarding.hidden = false;
    }

    profileWorkspaceButton.addEventListener("click", function () {
        showProfileOnboarding(currentProfile || {}, true);
    });

    function selectWorkspaceView(viewName) {
        workspaceButtons.forEach(function (button) {
            const isSelected = button.dataset.workspaceView === viewName;
            button.classList.toggle("is-active", isSelected);
            button.setAttribute("aria-current", isSelected ? "page" : "false");
        });
        workspacePanels.forEach(function (panel) {
            const isSelected = panel.dataset.workspacePanel === viewName;
            panel.hidden = !isSelected;
            panel.classList.toggle("is-active", isSelected);
        });
    }

    workspaceButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            selectWorkspaceView(button.dataset.workspaceView);
            if (button.dataset.workspaceView === "publications") loadPublications();
            if (button.dataset.workspaceView === "apps") loadProjectApps();
            if (button.dataset.workspaceView === "security") loadAuditLog();
            if (button.dataset.workspaceView === "billing") loadAccountUsage();
        });
    });

    function setPublicationStatus(message, state) {
        publicationStatusMessage.textContent = message;
        publicationStatusMessage.className = "form-status" + (state ? " is-" + state : "");
    }

    function resetPublicationEditor() {
        publicationId.value = "";
        publicationTitle.value = "";
        publicationSlug.value = "";
        publicationSummary.value = "";
        publicationSourceUrl.value = "";
        publicationVisibility.value = "public";
        publicationStatus.value = "draft";
        publicationEditorTitle.textContent = "Nova publicação";
        publicationEditorPanel.hidden = !publicationProjectSelect.value;
        setPublicationStatus("", "");
    }

    function editPublication(publication) {
        publicationId.value = publication.id;
        publicationTitle.value = publication.title || "";
        publicationSlug.value = publication.slug || "";
        publicationSummary.value = publication.summary || "";
        publicationSourceUrl.value = publication.source_url || "";
        publicationVisibility.value = publication.visibility || "public";
        publicationStatus.value = publication.status || "draft";
        publicationEditorTitle.textContent = "Editar publicação";
        publicationEditorPanel.hidden = false;
    }

    async function loadPublications() {
        const projectId = publicationProjectSelect.value;
        publicationList.replaceChildren();
        publicationList.hidden = true;
        publicationEditorPanel.hidden = true;
        if (!activeStudioId || !projectId) { publicationEmptyState.textContent = "Crie ou selecione um projeto para administrar publicações."; return; }
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sessão expirada.");
            const data = await studioRequest("list_publications", token, { studio_id: activeStudioId, project_id: projectId });
            const publications = Array.isArray(data.publications) ? data.publications : [];
            publications.forEach(function (publication) {
                const controls = document.createElement("div"); controls.className = "row-controls";
                const edit = document.createElement("button"); edit.type = "button"; edit.className = "row-button"; edit.textContent = "Editar"; edit.addEventListener("click", function () { editPublication(publication); }); controls.append(edit);
                if (publication.status === "published") { const open = document.createElement("a"); open.className = "row-button"; open.href = "../p/?id=" + encodeURIComponent(publication.id); open.target = "_blank"; open.rel = "noreferrer"; open.textContent = "Abrir"; controls.append(open); }
                appendListRow(publicationList, publication.title, (publication.status === "published" ? "Publicada" : publication.status === "withdrawn" ? "Retirada do ar" : "Rascunho") + " · " + (publication.visibility === "unlisted" ? "Não listada" : "Pública") + " · /" + publication.slug, controls);
            });
            publicationList.hidden = !publications.length;
            publicationEmptyState.textContent = publications.length ? "Escolha uma publicação para editar ou comece outra abaixo." : "Ainda não há publicações para este projeto.";
            resetPublicationEditor();
        } catch (error) { publicationEmptyState.textContent = error.message || "Não foi possível carregar as publicações."; }
    }

    publicationProjectSelect.addEventListener("change", loadPublications);
    publicationTitle.addEventListener("input", function () { if (!publicationId.value) publicationSlug.value = publicationTitle.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); });
    publicationForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!activeStudioId || !publicationProjectSelect.value || !publicationTitle.checkValidity() || !publicationSlug.checkValidity()) return publicationTitle.reportValidity();
        const button = publicationForm.querySelector("button[type=submit]"); button.disabled = true; setPublicationStatus("Salvando publicação…", "");
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sessão expirada.");
            await studioRequest("save_publication", token, { studio_id: activeStudioId, project_id: publicationProjectSelect.value, publication_id: publicationId.value || undefined, title: publicationTitle.value, slug: publicationSlug.value, summary: publicationSummary.value, source_url: publicationSourceUrl.value, visibility: publicationVisibility.value, status: publicationStatus.value });
            await loadPublications(); setPublicationStatus("Publicação salva.", "success");
        } catch (error) { setPublicationStatus(error.message || "Não foi possível salvar a publicação.", "error"); }
        finally { button.disabled = false; }
    });

    const appCatalog = [
        ["docs", "Docs", "Decisões, GDDs e referências vivas."], ["tasks", "Tasks", "Backlog, sprints, bugs e playtests."],
        ["canvas", "Canvas", "Arte 2D e animação."], ["beats", "Beats", "Áudio adaptativo."], ["states", "States", "Lógica visual."],
        ["dialogues", "Dialogues", "Narrativa interativa."], ["polygons", "Polygons", "Arte 3D low poly."], ["designs", "Designs", "UI e UX."],
    ];
    async function loadProjectApps() {
        const projectId = appsProjectSelect.value; projectAppsList.replaceChildren(); projectAppsList.hidden = true;
        if (!activeStudioId || !projectId) { appsEmptyState.textContent = "Crie ou selecione um projeto para configurar seus apps."; return; }
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sessão expirada.");
            const data = await studioRequest("list_project_apps", token, { studio_id: activeStudioId, project_id: projectId });
            const state = new Map((data.apps || []).map(function (item) { return [item.app_key, item.enabled]; }));
            appCatalog.forEach(function (app) {
                const card = document.createElement("article"); const name = document.createElement("strong"); name.textContent = app[1]; const copy = document.createElement("p"); copy.textContent = app[2];
                const label = document.createElement("label"); label.className = "production-role-option"; const input = document.createElement("input"); input.type = "checkbox"; input.checked = state.has(app[0]) ? state.get(app[0]) : ["docs", "tasks"].includes(app[0]); const text = document.createElement("span"); text.textContent = input.checked ? "Ativo" : "Desativado"; label.append(input, text); input.addEventListener("change", async function () { input.disabled = true; try { const fresh = await getValidAccessToken(); if (!fresh) throw new Error("Sessão expirada."); await studioRequest("set_project_app", fresh, { studio_id: activeStudioId, project_id: projectId, app_key: app[0], enabled: input.checked }); text.textContent = input.checked ? "Ativo" : "Desativado"; } catch (_) { input.checked = !input.checked; text.textContent = "Erro ao salvar"; } finally { input.disabled = false; } }); card.append(name, copy, label); projectAppsList.append(card);
            });
            appsEmptyState.textContent = "Ative apenas as ferramentas que este projeto precisa."; projectAppsList.hidden = false;
        } catch (error) { appsEmptyState.textContent = error.message || "Não foi possível carregar os apps."; }
    }
    appsProjectSelect.addEventListener("change", loadProjectApps);

    async function loadAuditLog() {
        auditLogList.replaceChildren();
        if (!activeStudioId) { auditLogNotice.textContent = "Escolha um estúdio ativo para consultar as alterações registradas."; return; }
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sessão expirada.");
            const data = await studioRequest("list_studio_audit", token, { studio_id: activeStudioId });
            const events = Array.isArray(data.events) ? data.events : [];
            events.forEach(function (event) { appendListRow(auditLogList, String(event.action || "alteração").replace(/\./g, " · "), formatDate(event.created_at)); });
            auditLogNotice.textContent = events.length ? "Últimos eventos registrados para este estúdio." : "Ainda não há eventos registrados para este estúdio.";
        } catch (error) { auditLogNotice.textContent = error.message || "Não foi possível carregar a auditoria."; }
    }
    refreshAuditLog.addEventListener("click", loadAuditLog);

    async function loadAccountUsage() {
        usageStatus.textContent = "Calculando uso da conta…";
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sessão expirada.");
            const data = await studioRequest("get_account_usage", token);
            const usage = data.usage || {}; usageStudios.textContent = String(usage.studios || 0); usageProjects.textContent = String(usage.projects || 0); usageMembers.textContent = String(usage.members || 0); usagePublications.textContent = String(usage.publications || 0);
            usageStatus.textContent = "Uso atual da infraestrutura administrada pelo HeartSpace.";
        } catch (error) { usageStatus.textContent = error.message || "Não foi possível calcular o uso agora."; }
    }
    refreshUsage.addEventListener("click", loadAccountUsage);

    Array.from(document.querySelectorAll("[data-go-to]")).forEach(function (button) {
        button.addEventListener("click", function () {
            selectWorkspaceView(button.dataset.goTo);
            document.querySelector(".workspace-content").scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    function setStudioStatus(message, state) {
        studioStatus.textContent = message;
        studioStatus.className = "form-status" + (state ? " is-" + state : "");
    }

    async function studioRequest(action, token, payload) {
        const endpoint = config.studioFunctionUrl && config.studioFunctionUrl.replace(/\/$/, "");
        if (!endpoint) throw new Error("O gerenciamento de estúdios ainda está sendo preparado.");
        const response = await fetch(endpoint, { method: "POST", headers: { "Authorization": "Bearer " + token, "apikey": config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ action: action }, payload || {})) });
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || "Não foi possível concluir esta ação agora.");
        return data;
    }

    async function listStudiosWithRls(token) {
        const restBase = config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/";
        const headers = { "apikey": config.supabaseAnonKey, "Authorization": "Bearer " + token };
        const membersUrl = new URL(restBase + "studio_members");
        // A associação legada do Hub pode não ter `created_at`; para montar a
        // lista bastam o identificador do estúdio e o papel da pessoa.
        membersUrl.searchParams.set("select", "studio_id,role");
        if (currentUserId) membersUrl.searchParams.set("user_id", "eq." + currentUserId);
        const membershipsResponse = await fetch(membersUrl.toString(), { headers: headers });
        const memberships = await membershipsResponse.json().catch(function () { return []; });
        if (!membershipsResponse.ok || !Array.isArray(memberships)) throw new Error("A lista de estúdios não respondeu.");
        const studioIds = memberships.map(function (membership) { return membership.studio_id; }).filter(Boolean);
        if (!studioIds.length) return [];
        const studiosUrl = new URL(restBase + "studios");
        // `slug` é opcional na estrutura legada do Hub; a lista não depende dele.
        studiosUrl.searchParams.set("select", "id,name,created_at");
        studiosUrl.searchParams.set("id", "in.(" + studioIds.join(",") + ")");
        const studiosResponse = await fetch(studiosUrl.toString(), { headers: headers });
        const studios = await studiosResponse.json().catch(function () { return []; });
        if (!studiosResponse.ok || !Array.isArray(studios)) throw new Error("Os dados dos estúdios não responderam.");
        const studiosById = new Map(studios.map(function (studio) { return [studio.id, studio]; }));
        return memberships.map(function (membership) { return Object.assign({}, membership, { studios: studiosById.get(membership.studio_id) }); }).filter(function (membership) { return membership.studios; });
    }

    async function loadProfile(token) {
        if (!config.studioFunctionUrl) return null;
        try {
            const data = await studioRequest("get_profile", token);
            return data.profile || null;
        } catch (error) {
            return null;
        }
    }

    profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!profileForm.checkValidity()) return profileForm.reportValidity();
        const button = profileForm.querySelector("button[type=submit]");
        button.disabled = true; setProfileStatus("Salvando sua ficha…", "");
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
            let avatarUrl = profileAvatarPreview.getAttribute("src") || "";
            if (pendingProfileAvatarFile) {
                const upload = await studioRequest("upload_profile_avatar", token, { image_base64: await blobToDataUrl(pendingProfileAvatarFile) });
                avatarUrl = upload.avatar_url || avatarUrl; pendingProfileAvatarFile = null;
            }
            await studioRequest("update_profile", token, { full_name: profileFullName.value, nickname: profileNickname.value, age: Number(profileAge.value), profession: profileProfession.value, phone: profilePhone.value, avatar_url: avatarUrl });
            currentProfile = { full_name: profileFullName.value.trim(), nickname: profileNickname.value.trim(), age: Number(profileAge.value), profession: profileProfession.value.trim(), phone: profilePhone.value.trim(), avatar_url: avatarUrl, profile_completed_at: new Date().toISOString() };
            const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/user", { headers: { "apikey": config.supabaseAnonKey, "Authorization": "Bearer " + token } });
            const user = response.ok ? await response.json() : { email: securityEmail.textContent };
            showMemberArea(user, { full_name: profileFullName.value.trim(), nickname: profileNickname.value.trim(), avatar_url: avatarUrl }); await loadEntitlements(token); await loadStudios(token);
        } catch (error) { setProfileStatus(error.message || "Não foi possível salvar sua ficha agora.", "error"); }
        finally { button.disabled = false; }
    });

    function clearStudioAdministration() {
        activeStudioAdmin = null;
        memberRole.hidden = true;
        studioSettingsPanel.hidden = true;
        studioActivityPanel.hidden = true;
        studioDangerPanel.hidden = true;
        studioDangerPanel.open = false;
        memberList.hidden = true;
        pendingInvitesPanel.hidden = true;
        roleCatalog.hidden = true;
        projectList.hidden = true;
        overviewProjectCount.textContent = "—";
        clearProjectAdministration();
    }

    function clearProjectAdministration() {
        activeProjectAdmin = null;
        projectSettingsPanel.hidden = true;
        projectRoleCatalogPanel.hidden = true;
        roleCatalogEditor.replaceChildren();
        projectRolesPanel.hidden = true;
        productionRoleList.replaceChildren();
        projectContextLabel.hidden = true;
        projectDangerPanel.hidden = true;
        projectDangerPanel.open = false;
    }

    function updateStudioContextMark(studio) {
        const logoUrl = studio && studio.logo_url;
        studioContextImage.hidden = !logoUrl;
        studioContextFallback.hidden = Boolean(logoUrl);
        studioContextImage.removeAttribute("src");
        if (logoUrl) studioContextImage.src = logoUrl;
    }

    function activeStudioFromMemberships(studios) {
        return studios.map(function (membership) { return membership.studios || membership.studio; }).find(function (studio) { return studio && studio.id === activeStudioId; }) || null;
    }

    studioContextImage.addEventListener("error", function () {
        studioContextImage.hidden = true;
        studioContextFallback.hidden = false;
    });

    function renderStudios(studios) {
        currentStudios = studios;
        studioList.replaceChildren();
        inviteStudio.replaceChildren();
        studioContextSelect.replaceChildren();
        overviewStudioCount.textContent = String(studios.length);
        if (!studios.length) {
            studiosTitle.textContent = "Nenhum estúdio ainda.";
            studiosCopy.textContent = "Use o seletor lateral e escolha “Criar novo estúdio” para começar.";
            const option = new Option("Criar novo estúdio…", "__create__"); studioContextSelect.add(option); studioContextSelect.disabled = false;
            overviewStudioTitle.textContent = "Crie seu primeiro estúdio";
            overviewStudioCopy.textContent = "Seu estúdio organiza pessoas, acessos e projetos compartilhados. O trabalho continua local no Hub.";
            studioList.hidden = true;
            inviteMemberForm.hidden = true;
            activeStudioId = "";
            updateStudioContextMark(null);
            sessionStorage.removeItem(sessionKey("active-studio"));
            clearStudioAdministration();
            return;
        }
        studiosTitle.textContent = studios.length === 1 ? "1 estúdio conectado." : studios.length + " estúdios conectados.";
        studiosCopy.textContent = "Escolha o espaço ativo pelo seletor lateral. Para criar outro, use a última opção da lista.";
        studios.forEach(function (membership) {
            const studio = membership.studios || membership.studio;
            if (!studio) return;
            const item = document.createElement("div"); item.className = "studio-list-item";
            const name = document.createElement("strong"); name.textContent = studio.name;
            const role = document.createElement("span"); role.textContent = membership.role === "owner" ? "Owner" : membership.role;
            item.append(name, role); studioList.append(item);
            const option = document.createElement("option"); option.value = studio.id; option.textContent = studio.name; inviteStudio.append(option);
            const contextOption = document.createElement("option"); contextOption.value = studio.id; contextOption.textContent = studio.name; studioContextSelect.append(contextOption);
        });
        studioContextSelect.add(new Option("＋ Criar novo estúdio", "__create__"));
        studioList.hidden = studioList.childElementCount === 0;
        if (inviteStudio.childElementCount) {
            if (!Array.from(studioContextSelect.options).some(function (option) { return option.value === activeStudioId; })) activeStudioId = studioContextSelect.options[0].value;
            studioContextSelect.value = activeStudioId;
            studioContextSelect.disabled = false;
            inviteStudio.value = activeStudioId;
            updateStudioContextMark(activeStudioFromMemberships(studios));
            const selectedName = studioContextSelect.options[studioContextSelect.selectedIndex].textContent || "Estúdio ativo";
            overviewStudioTitle.textContent = studios.length === 1 ? "Seu estúdio está pronto." : studios.length + " estúdios, um só controle.";
            overviewStudioCopy.textContent = selectedName + " está conectado à sua conta. Use os papéis e convites para organizar quem pode colaborar.";
            membersTitle.textContent = "Convide alguém para colaborar.";
            membersCopy.textContent = "O link vale por 7 dias e só pode ser aceito pela conta do e-mail informado.";
            sessionStorage.setItem(sessionKey("active-studio"), activeStudioId);
        }
    }

    async function loadStudios(token) {
        if (!config.studioFunctionUrl) return;
        try {
            const data = await studioRequest("list_studios", token);
            renderStudios(Array.isArray(data.studios) ? data.studios : []);
            if (activeStudioId) await loadActiveStudio(token);
        }
        catch (error) {
            try {
                const studios = await listStudiosWithRls(token);
                renderStudios(studios);
                if (activeStudioId) await loadActiveStudio(token);
            } catch (fallbackError) {
                studiosTitle.textContent = "Não foi possível carregar seus estúdios.";
                studiosCopy.textContent = "A conexão com a conta falhou. Atualize a página; se persistir, use o Hub enquanto verificamos o serviço.";
                overviewStudioTitle.textContent = "Estúdios indisponíveis agora";
                overviewStudioCopy.textContent = "A sua sessão continua protegida; tente atualizar a página para consultar seus espaços.";
            }
        }
    }

    function setSettingsStatus(message, state) {
        studioSettingsStatus.textContent = message;
        studioSettingsStatus.className = "form-status" + (state ? " is-" + state : "");
    }

    function updateStudioIconPreview(value) {
        const url = typeof value === "string" ? value.trim() : "";
        activeStudioIconPreview.hidden = !url;
        activeStudioIconPreview.removeAttribute("src");
        if (url) activeStudioIconPreview.src = url;
    }

    activeStudioIcon.addEventListener("input", function () {
        pendingStudioIconFile = null;
        updateStudioIconPreview(activeStudioIcon.value);
    });
    activeStudioIconPreview.addEventListener("error", function () {
        activeStudioIconPreview.hidden = true;
    });

    async function compressStudioIcon(file) {
        if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) throw new Error("Escolha uma imagem PNG, JPEG ou WebP de até 8 MB.");
        const sourceUrl = URL.createObjectURL(file);
        try {
            const image = await new Promise(function (resolve, reject) { const element = new Image(); element.onload = function () { resolve(element); }; element.onerror = reject; element.src = sourceUrl; });
            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 64 / image.width, 64 / image.height);
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/webp", .82); });
            if (!blob || blob.size > 96 * 1024) throw new Error("Não foi possível otimizar esse ícone. Escolha outra imagem.");
            return blob;
        } finally { URL.revokeObjectURL(sourceUrl); }
    }

    function blobToDataUrl(blob) {
        return new Promise(function (resolve, reject) { const reader = new FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = reject; reader.readAsDataURL(blob); });
    }

    activeStudioIconFile.addEventListener("change", async function () {
        const file = activeStudioIconFile.files && activeStudioIconFile.files[0];
        if (!file) return;
        try {
            const compressed = await compressStudioIcon(file);
            pendingStudioIconFile = compressed;
            const previewUrl = URL.createObjectURL(compressed);
            updateStudioIconPreview(previewUrl);
            setSettingsStatus("Ícone pronto para salvar (64 × 64 px).", "success");
        } catch (error) {
            pendingStudioIconFile = null;
            activeStudioIconFile.value = "";
            setSettingsStatus(error.message || "Não foi possível preparar a imagem.", "error");
        }
    });

    function formatDate(value) {
        if (!value) return "—";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    }

    function appendListRow(container, title, meta, controls) {
        const row = document.createElement("div"); row.className = "admin-list-row";
        const details = document.createElement("div");
        const heading = document.createElement("strong"); heading.textContent = title;
        const detail = document.createElement("span"); detail.textContent = meta;
        details.append(heading, detail); row.append(details);
        if (controls) row.append(controls);
        container.append(row);
    }

    function renderActiveStudio(data) {
        activeStudioAdmin = data;
        const studio = data.studio;
        const role = data.membership && data.membership.role;
        const canManage = role === "owner" || role === "admin";
        const isOwner = role === "owner";
        activeStudioHeading.textContent = studio.name;
        memberRole.textContent = role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Membro";
        memberRole.hidden = false;
        activeStudioName.value = studio.name || "";
        activeStudioTemplate.value = studio.role_template_key || "blank";
        activeStudioIcon.value = studio.logo_url || "";
        activeStudioIconFile.value = "";
        pendingStudioIconFile = null;
        updateStudioIconPreview(activeStudioIcon.value);
        activeStudioDescription.value = studio.description || "";
        Array.from(studioSettingsForm.elements).forEach(function (element) { element.disabled = !canManage; });
        studioSettingsPanel.hidden = false;

        projectList.replaceChildren();
        const projects = Array.isArray(data.projects) ? data.projects : [];
        currentStudioProjects = projects;
        overviewProjectCount.textContent = String(projects.length);
        projectsTitle.textContent = projects.length ? (projects.length === 1 ? "1 projeto neste estúdio." : projects.length + " projetos neste estúdio.") : "Seu próximo projeto começa aqui.";
        projectsCopy.textContent = projects.length ? "Os projetos criados aqui já podem ser reconhecidos pelo Hub. O conteúdo e os arquivos continuam locais." : "O site cria a referência compartilhada. Quando você abrir o Hub, ela se transforma no seu espaço de trabalho local.";
        projects.forEach(function (project) { appendListRow(projectList, project.name || "Projeto sem título", (project.status === "archived" ? "Arquivado" : "Ativo") + " · " + (project.description || "Sem descrição") + " · criado em " + formatDate(project.created_at)); });
        projectList.hidden = !projects.length;
        createProjectForm.hidden = !canManage;
        projectContextSelect.replaceChildren();
        projects.forEach(function (project) { projectContextSelect.add(new Option(project.name || "Projeto sem título", project.id)); });
        publicationProjectSelect.replaceChildren();
        projects.forEach(function (project) { publicationProjectSelect.add(new Option(project.name || "Projeto sem título", project.id)); });
        publicationProjectSelect.disabled = !projects.length;
        if (projects.length) publicationProjectSelect.value = activeProjectId && projects.some(function (project) { return project.id === activeProjectId; }) ? activeProjectId : projects[0].id;
        appsProjectSelect.replaceChildren();
        projects.forEach(function (project) { appsProjectSelect.add(new Option(project.name || "Projeto sem título", project.id)); });
        appsProjectSelect.disabled = !projects.length;
        if (projects.length) appsProjectSelect.value = activeProjectId && projects.some(function (project) { return project.id === activeProjectId; }) ? activeProjectId : projects[0].id;
        projectContextLabel.hidden = !projects.length;
        if (!projects.some(function (project) { return project.id === activeProjectId; })) activeProjectId = projects.length ? projects[0].id : "";
        if (activeProjectId) {
            projectContextSelect.value = activeProjectId;
            sessionStorage.setItem(sessionKey("active-project"), activeProjectId);
        } else {
            sessionStorage.removeItem(sessionKey("active-project"));
            clearProjectAdministration();
        }

        memberList.replaceChildren();
        const members = Array.isArray(data.members) ? data.members : [];
        members.forEach(function (member) {
            const controls = document.createElement("div"); controls.className = "row-controls";
            if (isOwner && member.role !== "owner") {
                const select = document.createElement("select"); select.className = "compact-select"; select.dataset.memberRole = member.user_id; select.dataset.previousRole = member.role; select.value = member.role; select.setAttribute("aria-label", "Alterar cargo de " + (member.display_name || member.email || "membro"));
                ["member", "admin"].forEach(function (memberRole) { const option = new Option(memberRole === "admin" ? "Admin" : "Membro", memberRole); select.add(option); });
                const remove = document.createElement("button"); remove.type = "button"; remove.className = "row-button row-button-danger"; remove.dataset.removeMember = member.user_id; remove.textContent = "Remover";
                controls.append(select, remove);
            }
            const display = member.display_name || member.email || "Conta HeartSpace";
            appendListRow(memberList, display, (member.role === "owner" ? "Owner" : member.role === "admin" ? "Admin" : "Membro") + " · desde " + formatDate(member.created_at), controls.childElementCount ? controls : null);
        });
        memberList.hidden = !members.length;
        membersTitle.textContent = members.length === 1 ? "1 pessoa no estúdio." : members.length + " pessoas no estúdio.";
        membersCopy.textContent = isOwner ? "Você pode ajustar os papéis de admins e membros ou remover acessos a qualquer momento." : "Os papéis e acessos são controlados pelos owners do estúdio.";
        roleCatalog.hidden = !members.length;

        pendingInviteList.replaceChildren();
        const invites = Array.isArray(data.invites) ? data.invites : [];
        invites.forEach(function (invite) {
            const controls = document.createElement("div"); controls.className = "row-controls";
            const revoke = document.createElement("button"); revoke.type = "button"; revoke.className = "row-button row-button-danger"; revoke.dataset.revokeInvite = invite.id; revoke.textContent = "Revogar"; controls.append(revoke);
            appendListRow(pendingInviteList, invite.email, (invite.role === "admin" ? "Admin" : "Membro") + " · expira " + formatDate(invite.expires_at), controls);
        });
        pendingInvitesPanel.hidden = !invites.length;
        inviteMemberForm.hidden = !canManage;
        inviteStudio.value = studio.id;

        studioActivityList.replaceChildren();
        const activity = Array.isArray(data.activity) ? data.activity : [];
        activity.forEach(function (event) { appendListRow(studioActivityList, String(event.action || "alteração").replace(/\./g, " · "), formatDate(event.created_at)); });
        studioActivityPanel.hidden = !activity.length;
        studioDangerPanel.hidden = !isOwner;
        studioDangerPanel.open = false;
        deleteStudioName.textContent = studio.name;
        deleteStudioConfirmation.value = "";
    }

    async function loadActiveStudio(token) {
        if (!activeStudioId) return clearStudioAdministration();
        try {
            const data = await studioRequest("get_studio_admin", token, { studio_id: activeStudioId });
            renderActiveStudio(data);
            if (activeProjectId) await loadActiveProject(token);
        } catch (error) {
            clearStudioAdministration();
            memberRole.hidden = true;
            membersTitle.textContent = "Não foi possível carregar a equipe.";
            membersCopy.textContent = "Atualize a página ou confirme se a Function administrativa foi atualizada.";
        }
    }

    studioContextSelect.addEventListener("change", async function () {
        activeStudioId = studioContextSelect.value;
        if (activeStudioId === "__create__") {
            activeStudioId = "";
            updateStudioContextMark(null);
            sessionStorage.removeItem(sessionKey("active-studio"));
            clearStudioAdministration();
            selectWorkspaceView("create-studio");
            studioName.focus();
            return;
        }
        updateStudioContextMark(activeStudioFromMemberships(currentStudios));
        sessionStorage.setItem(sessionKey("active-studio"), activeStudioId);
        const token = await getValidAccessToken().catch(function () { return null; });
        if (token) await loadActiveStudio(token);
    });

    studioSettingsForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!activeStudioId || !activeStudioName.checkValidity()) return activeStudioName.reportValidity();
        const button = studioSettingsForm.querySelector("button[type=submit]"); button.disabled = true; setSettingsStatus("Salvando alterações…", "");
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
            let logoUrl = activeStudioIcon.value.trim();
            if (pendingStudioIconFile) {
                const upload = await studioRequest("upload_studio_icon", token, { studio_id: activeStudioId, image_base64: await blobToDataUrl(pendingStudioIconFile) });
                logoUrl = upload.logo_url || logoUrl;
                activeStudioIcon.value = logoUrl;
                pendingStudioIconFile = null;
            }
            await studioRequest("update_studio", token, { studio_id: activeStudioId, name: activeStudioName.value.trim(), description: activeStudioDescription.value.trim(), logo_url: logoUrl, role_template_key: activeStudioTemplate.value });
            setSettingsStatus("Alterações salvas.", "success"); await loadStudios(token);
        } catch (error) { setSettingsStatus(error.message || "Não foi possível salvar as alterações.", "error"); }
        finally { button.disabled = false; }
    });

    deleteStudioForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!activeStudioAdmin || !activeStudioId) return;
        const studioName = activeStudioAdmin.studio && activeStudioAdmin.studio.name || "";
        if (deleteStudioConfirmation.value.trim() !== studioName) {
            deleteStudioStatus.textContent = "Digite o nome do estúdio exatamente como aparece acima.";
            deleteStudioStatus.className = "form-status is-error";
            return;
        }
        if (!window.confirm("Excluir definitivamente o estúdio ‘" + studioName + "’? Essa ação não pode ser desfeita.")) return;
        const button = deleteStudioForm.querySelector("button[type=submit]"); button.disabled = true;
        deleteStudioStatus.textContent = "Excluindo estúdio…";
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
            await studioRequest("delete_studio", token, { studio_id: activeStudioId, confirmation: deleteStudioConfirmation.value.trim() });
            activeStudioId = "";
            sessionStorage.removeItem(sessionKey("active-studio"));
            clearStudioAdministration();
            await loadStudios(token);
            selectWorkspaceView("studios");
        } catch (error) {
            deleteStudioStatus.textContent = error.message || "Não foi possível excluir o estúdio.";
            deleteStudioStatus.className = "form-status is-error";
        } finally { button.disabled = false; }
    });

    function setProjectStatus(message, state) {
        projectStatus.textContent = message;
        projectStatus.className = "form-status" + (state ? " is-" + state : "");
    }

    function setProjectSettingsStatus(message, state) {
        projectSettingsStatus.textContent = message;
        projectSettingsStatus.className = "form-status" + (state ? " is-" + state : "");
    }

    function updateProjectImagePreview(value) {
        const url = typeof value === "string" ? value.trim() : "";
        activeProjectImagePreview.hidden = !url;
        activeProjectImagePreview.removeAttribute("src");
        if (url) activeProjectImagePreview.src = url;
    }

    function updateProjectBannerPreview(value) {
        const url = typeof value === "string" ? value.trim() : "";
        activeProjectBannerPreview.hidden = !url;
        activeProjectBannerPreview.removeAttribute("src");
        if (url) activeProjectBannerPreview.src = url;
    }

    async function compressProjectProfileImage(file) {
        if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) throw new Error("Escolha uma imagem PNG, JPEG ou WebP de até 8 MB.");
        const sourceUrl = URL.createObjectURL(file);
        try {
            const image = await new Promise(function (resolve, reject) { const element = new Image(); element.onload = function () { resolve(element); }; element.onerror = reject; element.src = sourceUrl; });
            const scale = Math.min(1, 64 / image.width, 64 / image.height);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/webp", .82); });
            if (!blob || blob.size > 96 * 1024) throw new Error("Não foi possível otimizar essa imagem de perfil.");
            return blob;
        } finally { URL.revokeObjectURL(sourceUrl); }
    }

    async function compressProjectImage(file) {
        if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 12 * 1024 * 1024) throw new Error("Escolha uma imagem PNG, JPEG ou WebP de até 12 MB.");
        const sourceUrl = URL.createObjectURL(file);
        try {
            const image = await new Promise(function (resolve, reject) { const element = new Image(); element.onload = function () { resolve(element); }; element.onerror = reject; element.src = sourceUrl; });
            const scale = Math.min(1, 1600 / image.width, 900 / image.height);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/webp", .82); });
            if (!blob || blob.size > 600 * 1024) throw new Error("A imagem ficou grande demais após a compressão. Escolha outra imagem.");
            return blob;
        } finally { URL.revokeObjectURL(sourceUrl); }
    }

    function humanizeProductionRole(key) {
        const labels = { game_designer: "Game Designer", artist: "Artista", programmer: "Programador(a)", audio: "Áudio", narrative: "Narrativa", qa: "QA", producer: "Produção", marketing: "Marketing", direction: "Direção", design: "Design", illustration: "Ilustração", video: "Vídeo", writing: "Redação", production: "Produção", strategy: "Estratégia", content: "Conteúdo", paid_media: "Mídia paga", social: "Social", analytics: "Analytics", management: "Gestão", accounting: "Contábil", tax: "Fiscal", payroll: "Folha", finance: "Financeiro", service: "Atendimento" };
        return labels[key] || key.replace(/_/g, " ").replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
    }

    const projectPermissionLabels = {
        manage_workspace: "Gerenciar projeto", manage_roles: "Gerenciar cargos", manage_billing: "Gerenciar assinatura",
        delete_sprints: "Excluir sprints", create_sprints: "Criar sprints", view_all_tasks: "Ver todas as tarefas",
        manage_wiki_visibility: "Controlar visibilidade da wiki", can_edit_wiki: "Editar wiki", can_comment_wiki: "Comentar na wiki", can_view_wiki: "Ver wiki",
        docs_view: "Ver Docs", docs_edit: "Editar Docs", tasks_view: "Ver Tasks", tasks_edit: "Editar Tasks",
        canvas_view: "Ver Canvas", canvas_edit: "Editar Canvas", beats_view: "Ver Beats", beats_edit: "Editar Beats",
        states_view: "Ver States", states_edit: "Editar States", dialogues_view: "Ver Dialogues", dialogues_edit: "Editar Dialogues",
        polygons_view: "Ver Polygons", polygons_edit: "Editar Polygons", designs_view: "Ver Designs", designs_edit: "Editar Designs"
    };

    function appendRoleEditor(role, canManage) {
        const card = document.createElement("article"); card.className = "role-editor-card";
        const fields = document.createElement("div"); fields.className = "role-editor-fields";
        const keyLabel = document.createElement("label"); keyLabel.textContent = "Identificador";
        const keyInput = document.createElement("input"); keyInput.type = "text"; keyInput.value = role.key || ""; keyInput.maxLength = 40; keyInput.dataset.roleKey = ""; keyInput.placeholder = "ex.: artista"; keyInput.disabled = !canManage || Boolean(role.locked);
        keyLabel.append(keyInput);
        const nameLabel = document.createElement("label"); nameLabel.textContent = "Nome";
        const nameInput = document.createElement("input"); nameInput.type = "text"; nameInput.value = role.label || ""; nameInput.maxLength = 48; nameInput.dataset.roleLabel = ""; nameInput.placeholder = "Ex.: Artista"; nameInput.disabled = !canManage;
        nameLabel.append(nameInput);
        const colorLabel = document.createElement("label"); colorLabel.textContent = "Cor";
        const colorInput = document.createElement("input"); colorInput.type = "color"; colorInput.value = /^#[0-9a-f]{6}$/i.test(role.color || "") ? role.color : "#9501d8"; colorInput.dataset.roleColor = ""; colorInput.disabled = !canManage;
        colorLabel.append(colorInput); fields.append(keyLabel, nameLabel, colorLabel); card.append(fields);
        const permissionList = document.createElement("div"); permissionList.className = "role-permission-checks";
        Object.keys(projectPermissionLabels).forEach(function (permission) {
            const label = document.createElement("label");
            const input = document.createElement("input"); input.type = "checkbox"; input.value = permission; input.dataset.rolePermission = ""; input.checked = Array.isArray(role.permissions) && role.permissions.includes(permission); input.disabled = !canManage;
            const text = document.createElement("span"); text.textContent = projectPermissionLabels[permission]; label.append(input, text); permissionList.append(label);
        });
        card.append(permissionList);
        if (canManage) { const remove = document.createElement("button"); remove.type = "button"; remove.className = "row-button row-button-danger"; remove.dataset.removeProjectRole = ""; remove.textContent = "Remover cargo"; card.append(remove); }
        roleCatalogEditor.append(card);
    }

    function renderRoleCatalog(data, canManage) {
        roleCatalogEditor.replaceChildren();
        const project = data.project || {};
        const permissions = project.role_permissions && typeof project.role_permissions === "object" ? project.role_permissions : {};
        const colors = project.role_colors && typeof project.role_colors === "object" ? project.role_colors : {};
        const labels = project.role_labels && typeof project.role_labels === "object" ? project.role_labels : {};
        Object.keys(permissions).forEach(function (key) { appendRoleEditor({ key: key, label: labels[key] || humanizeProductionRole(key), color: colors[key], permissions: Object.keys(permissions[key] || {}), locked: true }, canManage); });
        projectRoleCatalogPanel.hidden = false;
        addProjectRole.hidden = !canManage;
        saveProjectRoleCatalog.hidden = !canManage;
    }

    function renderProjectRoles(data, canManage) {
        productionRoleList.replaceChildren();
        const permissions = data.project && data.project.role_permissions && typeof data.project.role_permissions === "object" ? data.project.role_permissions : {};
        const keys = Object.keys(permissions);
        if (!keys.length) {
            const note = document.createElement("p"); note.className = "field-note";
            note.textContent = "Este estúdio foi criado sem um modelo de papéis. Os próximos projetos podem nascer com um modelo ao criar outro estúdio.";
            productionRoleList.append(note);
            projectRolesPanel.hidden = false;
            return;
        }
        (data.project_members || []).forEach(function (member) {
            const row = document.createElement("div"); row.className = "production-member-row";
            const identity = document.createElement("div");
            const name = document.createElement("strong"); name.textContent = member.display_name || member.email || "Membro";
            const meta = document.createElement("small"); meta.textContent = member.role === "owner" ? "Owner do estúdio" : member.role === "admin" ? "Admin do estúdio" : "Membro do estúdio";
            identity.append(name, meta);
            const checks = document.createElement("div"); checks.className = "production-role-checks";
            const activeRoles = Array.isArray(member.project_roles) ? member.project_roles : [];
            keys.forEach(function (roleKey) {
                const label = document.createElement("label"); label.className = "production-role-option";
                const input = document.createElement("input"); input.type = "checkbox"; input.value = roleKey; input.checked = activeRoles.includes(roleKey); input.disabled = !canManage;
                input.dataset.projectRoleMember = member.user_id;
                const text = document.createElement("span"); text.textContent = humanizeProductionRole(roleKey);
                label.append(input, text); checks.append(label);
            });
            row.append(identity, checks); productionRoleList.append(row);
        });
        projectRolesPanel.hidden = false;
    }

    function renderActiveProject(data) {
        activeProjectAdmin = data;
        const project = data.project;
        const role = data.membership && data.membership.role;
        const canManage = role === "owner" || role === "admin";
        activeProjectHeading.textContent = project.name || "Projeto";
        activeProjectName.value = project.name || "";
        activeProjectStatus.value = project.status === "archived" ? "archived" : "active";
        activeProjectDescription.value = project.description || "";
        activeProjectImage.value = project.cover_image || "";
        activeProjectBanner.value = project.banner_image || "";
        activeProjectImageFile.value = "";
        activeProjectBannerFile.value = "";
        pendingProjectImageFile = null;
        pendingProjectBannerFile = null;
        updateProjectImagePreview(activeProjectImage.value);
        updateProjectBannerPreview(activeProjectBanner.value);
        Array.from(projectSettingsForm.elements).forEach(function (element) { element.disabled = !canManage; });
        projectSettingsPanel.hidden = false;
        renderRoleCatalog(data, canManage);
        renderProjectRoles(data, canManage);
        projectDangerPanel.hidden = role !== "owner";
        projectDangerPanel.open = false;
        deleteProjectName.textContent = project.name || "";
        deleteProjectConfirmation.value = "";
    }

    async function loadActiveProject(token) {
        if (!activeStudioId || !activeProjectId) return clearProjectAdministration();
        try {
            const data = await studioRequest("get_project_admin", token, { studio_id: activeStudioId, project_id: activeProjectId });
            renderActiveProject(data);
        } catch (error) {
            clearProjectAdministration();
            setProjectSettingsStatus(error.message || "Não foi possível carregar as configurações do projeto.", "error");
        }
    }

    projectContextSelect.addEventListener("change", async function () {
        activeProjectId = projectContextSelect.value;
        sessionStorage.setItem(sessionKey("active-project"), activeProjectId);
        const token = await getValidAccessToken().catch(function () { return null; });
        if (token) await loadActiveProject(token);
    });

    addProjectRole.addEventListener("click", function () {
        appendRoleEditor({ key: "", label: "", color: "#9501d8", permissions: [] }, true);
        const input = roleCatalogEditor.lastElementChild && roleCatalogEditor.lastElementChild.querySelector("[data-role-key]"); if (input) input.focus();
    });

    roleCatalogEditor.addEventListener("click", function (event) {
        const button = event.target.closest("[data-remove-project-role]"); if (button) button.closest(".role-editor-card").remove();
    });

    saveProjectRoleCatalog.addEventListener("click", async function () {
        if (!activeStudioId || !activeProjectId) return;
        const cards = Array.from(roleCatalogEditor.querySelectorAll(".role-editor-card"));
        const roles = cards.map(function (card) {
            return {
                key: card.querySelector("[data-role-key]").value.trim(),
                label: card.querySelector("[data-role-label]").value.trim(),
                color: card.querySelector("[data-role-color]").value,
                permissions: Array.from(card.querySelectorAll("[data-role-permission]:checked")).map(function (input) { return input.value; })
            };
        });
        if (roles.some(function (role) { return !role.key || !role.label; })) {
            projectRoleCatalogStatus.textContent = "Preencha identificador e nome para cada cargo."; projectRoleCatalogStatus.className = "form-status is-error"; return;
        }
        saveProjectRoleCatalog.disabled = true; projectRoleCatalogStatus.textContent = "Salvando cargos e permissões…"; projectRoleCatalogStatus.className = "form-status";
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
            await studioRequest("save_project_role_catalog", token, { studio_id: activeStudioId, project_id: activeProjectId, roles: roles });
            projectRoleCatalogStatus.textContent = "Cargos e permissões atualizados."; projectRoleCatalogStatus.className = "form-status is-success";
            await loadActiveProject(token);
        } catch (error) { projectRoleCatalogStatus.textContent = error.message || "Não foi possível salvar os cargos."; projectRoleCatalogStatus.className = "form-status is-error"; }
        finally { saveProjectRoleCatalog.disabled = false; }
    });

    productionRoleList.addEventListener("change", async function (event) {
        const target = event.target;
        if (!target.matches("[data-project-role-member]") || !activeStudioId || !activeProjectId) return;
        const memberId = target.dataset.projectRoleMember;
        const selected = Array.from(productionRoleList.querySelectorAll("[data-project-role-member='" + memberId + "']:checked")).map(function (input) { return input.value; });
        const inputs = Array.from(productionRoleList.querySelectorAll("[data-project-role-member='" + memberId + "']"));
        inputs.forEach(function (input) { input.disabled = true; });
        projectRolesStatus.textContent = "Salvando papéis…";
        projectRolesStatus.className = "form-status";
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
            await studioRequest("set_project_member_roles", token, { studio_id: activeStudioId, project_id: activeProjectId, target_id: memberId, roles: selected });
            projectRolesStatus.textContent = "Papéis atualizados para este projeto.";
            projectRolesStatus.className = "form-status is-success";
            await loadActiveProject(token);
        } catch (error) {
            projectRolesStatus.textContent = error.message || "Não foi possível salvar os papéis.";
            projectRolesStatus.className = "form-status is-error";
            const token = await getValidAccessToken().catch(function () { return null; }); if (token) await loadActiveProject(token);
        } finally { inputs.forEach(function (input) { input.disabled = false; }); }
    });

    activeProjectImage.addEventListener("input", function () {
        pendingProjectImageFile = null;
        updateProjectImagePreview(activeProjectImage.value);
    });
    activeProjectImagePreview.addEventListener("error", function () { activeProjectImagePreview.hidden = true; });
    activeProjectImageFile.addEventListener("change", async function () {
        const file = activeProjectImageFile.files && activeProjectImageFile.files[0];
        if (!file) return;
        try {
            const compressed = await compressProjectProfileImage(file);
            pendingProjectImageFile = compressed;
            updateProjectImagePreview(URL.createObjectURL(compressed));
            setProjectSettingsStatus("Imagem de perfil pronta para salvar (64 × 64 px).", "success");
        } catch (error) {
            pendingProjectImageFile = null;
            activeProjectImageFile.value = "";
            setProjectSettingsStatus(error.message || "Não foi possível preparar a imagem.", "error");
        }
    });

    activeProjectBanner.addEventListener("input", function () {
        pendingProjectBannerFile = null;
        updateProjectBannerPreview(activeProjectBanner.value);
    });
    activeProjectBannerPreview.addEventListener("error", function () { activeProjectBannerPreview.hidden = true; });
    activeProjectBannerFile.addEventListener("change", async function () {
        const file = activeProjectBannerFile.files && activeProjectBannerFile.files[0];
        if (!file) return;
        try {
            const compressed = await compressProjectImage(file);
            pendingProjectBannerFile = compressed;
            updateProjectBannerPreview(URL.createObjectURL(compressed));
            setProjectSettingsStatus("Imagem de capa pronta para salvar (até 1600 × 900 px).", "success");
        } catch (error) {
            pendingProjectBannerFile = null;
            activeProjectBannerFile.value = "";
            setProjectSettingsStatus(error.message || "Não foi possível preparar a imagem.", "error");
        }
    });

    projectSettingsForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!activeStudioId || !activeProjectId || !activeProjectName.checkValidity()) return activeProjectName.reportValidity();
        const button = projectSettingsForm.querySelector("button[type=submit]"); button.disabled = true; setProjectSettingsStatus("Salvando alterações…", "");
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
            let coverImage = activeProjectImage.value.trim();
            let bannerImage = activeProjectBanner.value.trim();
            if (pendingProjectImageFile) {
                const upload = await studioRequest("upload_project_image", token, { studio_id: activeStudioId, project_id: activeProjectId, kind: "profile", image_base64: await blobToDataUrl(pendingProjectImageFile) });
                coverImage = upload.cover_image || coverImage;
                activeProjectImage.value = coverImage;
                pendingProjectImageFile = null;
            }
            if (pendingProjectBannerFile) {
                const upload = await studioRequest("upload_project_image", token, { studio_id: activeStudioId, project_id: activeProjectId, kind: "banner", image_base64: await blobToDataUrl(pendingProjectBannerFile) });
                bannerImage = upload.banner_image || bannerImage;
                activeProjectBanner.value = bannerImage;
                pendingProjectBannerFile = null;
            }
            await studioRequest("update_project", token, { studio_id: activeStudioId, project_id: activeProjectId, name: activeProjectName.value.trim(), description: activeProjectDescription.value.trim(), cover_image: coverImage, banner_image: bannerImage, status: activeProjectStatus.value });
            setProjectSettingsStatus("Alterações salvas.", "success");
            await loadActiveStudio(token);
        } catch (error) { setProjectSettingsStatus(error.message || "Não foi possível salvar o projeto.", "error"); }
        finally { button.disabled = false; }
    });

    deleteProjectForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const name = activeProjectAdmin && activeProjectAdmin.project && activeProjectAdmin.project.name || "";
        if (!activeStudioId || !activeProjectId || deleteProjectConfirmation.value.trim() !== name) { deleteProjectStatus.textContent = "Digite o nome do projeto exatamente como aparece acima."; deleteProjectStatus.className = "form-status is-error"; return; }
        if (!window.confirm("Excluir definitivamente o projeto ‘" + name + "’? Essa ação não pode ser desfeita.")) return;
        const button = deleteProjectForm.querySelector("button[type=submit]"); button.disabled = true; deleteProjectStatus.textContent = "Excluindo projeto…";
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sessão expirada.");
            await studioRequest("delete_project", token, { studio_id: activeStudioId, project_id: activeProjectId, confirmation: name });
            activeProjectId = ""; sessionStorage.removeItem(sessionKey("active-project")); await loadActiveStudio(token);
        } catch (error) { deleteProjectStatus.textContent = error.message || "Não foi possível excluir o projeto."; deleteProjectStatus.className = "form-status is-error"; }
        finally { button.disabled = false; }
    });

    createProjectForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!activeStudioId || !projectName.checkValidity()) return projectName.reportValidity();
        const button = createProjectForm.querySelector("button[type=submit]");
        button.disabled = true; setProjectStatus("Criando projeto…", "");
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
            const data = await studioRequest("create_project", token, { studio_id: activeStudioId, name: projectName.value, description: projectDescription.value });
            createProjectForm.reset();
            setProjectStatus("Projeto criado. Abra o Hub para começar a trabalhar nele.", "success");
            activeProjectId = data.project && data.project.id || activeProjectId;
            if (activeProjectId) sessionStorage.setItem(sessionKey("active-project"), activeProjectId);
            await loadActiveStudio(token);
            if (data.project) projectStatus.textContent = "Projeto criado. Abra o Hub para começar a trabalhar nele.";
        } catch (error) { setProjectStatus(error.message || "Não foi possível criar o projeto agora.", "error"); }
        finally { button.disabled = false; }
    });

    memberList.addEventListener("change", async function (event) {
        const target = event.target;
        if (!target.matches("[data-member-role]")) return;
        const previousRole = target.dataset.previousRole || "member";
        const nextLabel = target.value === "admin" ? "Admin" : "Membro";
        if (!window.confirm("Alterar o cargo desta pessoa para “" + nextLabel + "”?")) { target.value = previousRole; return; }
        target.disabled = true;
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sessão expirada.");
            await studioRequest("update_member_role", token, { studio_id: activeStudioId, target_id: target.dataset.memberRole, role: target.value });
            await loadActiveStudio(token);
        }
        catch (error) { target.value = previousRole; inviteStatus.textContent = error.message || "Não foi possível alterar o cargo."; }
        finally { target.disabled = false; }
    });

    memberList.addEventListener("click", async function (event) {
        const target = event.target.closest("[data-remove-member]"); if (!target) return;
        if (!window.confirm("Remover esta pessoa do estúdio?")) return;
        try { const token = await getValidAccessToken(); if (!token) throw new Error("Sessão expirada."); await studioRequest("remove_member", token, { studio_id: activeStudioId, target_id: target.dataset.removeMember }); await loadActiveStudio(token); }
        catch (error) { inviteStatus.textContent = error.message || "Não foi possível remover a pessoa."; }
    });

    pendingInviteList.addEventListener("click", async function (event) {
        const target = event.target.closest("[data-revoke-invite]"); if (!target) return;
        if (!window.confirm("Revogar este convite?")) return;
        try { const token = await getValidAccessToken(); if (!token) throw new Error("Sessão expirada."); await studioRequest("revoke_invite", token, { studio_id: activeStudioId, target_id: target.dataset.revokeInvite }); await loadActiveStudio(token); }
        catch (error) { inviteStatus.textContent = error.message || "Não foi possível revogar o convite."; }
    });

    if (config.studioFunctionUrl) createStudioForm.hidden = false;
    createStudioForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!config.studioFunctionUrl || !studioName.checkValidity()) { if (!config.studioFunctionUrl) return; studioName.reportValidity(); return; }
        const submitButton = createStudioForm.querySelector("button[type=submit]");
        submitButton.disabled = true; setStudioStatus("Criando seu estúdio…", "");
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sua sessão expirou. Entre novamente para continuar.");
            await studioRequest("create_studio", token, { name: studioName.value.trim(), slug: studioSlug.value.trim(), role_template_key: studioTemplate.value });
            createStudioForm.reset(); setStudioStatus("Estúdio criado. Você já é o owner inicial.", "success"); await loadStudios(token); selectWorkspaceView("studios");
        } catch (error) {
            const localPreview = window.location.protocol === "file:";
            const unavailable = error instanceof TypeError;
            setStudioStatus(localPreview
                ? "Para criar um estúdio, abra o site pelo domínio publicado. Arquivos abertos diretamente no computador não podem chamar o serviço seguro."
                : unavailable ? "Não foi possível alcançar o serviço de estúdios. Confira se a Function publicada permite este domínio."
                : error.message || "Não foi possível criar o estúdio agora.", "error");
        }
        finally { submitButton.disabled = false; }
    });

    inviteMemberForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!inviteEmail.checkValidity() || !inviteStudio.value) { inviteEmail.reportValidity(); return; }
        const button = inviteMemberForm.querySelector("button[type=submit]"); button.disabled = true; inviteStatus.textContent = "Criando convite…"; inviteLink.hidden = true;
        try {
            const token = await getValidAccessToken(); if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
            const data = await studioRequest("create_invite", token, { studio_id: inviteStudio.value, email: inviteEmail.value.trim(), role: inviteRole.value });
            inviteLink.href = data.invite_url; inviteLink.hidden = false; inviteStatus.textContent = "Link criado. Copie-o e envie apenas para a pessoa convidada.";
            if (navigator.clipboard) navigator.clipboard.writeText(data.invite_url).catch(function () {});
            inviteEmail.value = "";
        } catch (error) { inviteStatus.textContent = error.message || "Não foi possível criar o convite."; }
        finally { button.disabled = false; }
    });

    async function apiRequest(action, token, payload) {
        const endpoint = config.billingFunctionUrl && config.billingFunctionUrl.replace(/\/$/, "");
        if (!endpoint) throw new Error("O gerenciamento de assinatura ainda está sendo preparado.");
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
            body: JSON.stringify(Object.assign({ action: action }, payload || {}))
        });
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || "Não foi possível concluir esta ação agora.");
        return data;
    }

    async function loadEntitlements(token) {
        if (!config.billingFunctionUrl) return;
        try {
            const data = await apiRequest("get_entitlements", token);
            const entitlement = data.entitlement_lease || data.entitlement || data;
            if (entitlement.plan) {
                planName.textContent = planDetails[entitlement.plan] ? planDetails[entitlement.plan].name : entitlement.plan;
                const features = Array.isArray(entitlement.features) ? entitlement.features : [];
                planDescription.textContent = features.length
                    ? "Recursos ativos: " + features.join(", ") + "."
                    : "Seu plano, uso e recursos disponíveis são gerenciados aqui.";
                billingStatus.textContent = entitlement.expires_at_unix
                    ? "Acesso ativo até " + new Date(entitlement.expires_at_unix * 1000).toLocaleDateString("pt-BR") + "."
                    : "Seu acesso está ativo.";
            }
        } catch (error) {
            billingStatus.textContent = "Ainda não foi possível carregar os detalhes do plano.";
        }
    }

    async function restoreSession() {
        if (!isConfigured) { window.location.replace("../login/"); return; }
        let token;
        try {
            token = await getValidAccessToken();
        } catch (error) {
            clearSession();
            window.location.replace("../login/");
            return;
        }
        if (!token) { window.location.replace("../login/"); return; }
        try {
            const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/user", {
                headers: { "apikey": config.supabaseAnonKey, "Authorization": "Bearer " + token }
            });
            if (!response.ok) throw new Error("Sessão expirada");
            const user = await response.json();
            const profile = await loadProfile(token);
            currentProfile = profile;
            const profileComplete = profile && profile.profile_completed_at && profile.full_name && profile.nickname && Number(profile.age) > 0 && profile.profession;
            if (!profileComplete) {
                showProfileOnboarding(profile || {});
                return;
            }
            showMemberArea(user, profile);
            await loadEntitlements(token);
            await loadStudios(token);
        } catch (error) {
            clearSession();
            window.location.replace("../login/");
        }
    }

    if (googleButton && magicLinkForm) {
    googleButton.addEventListener("click", function () {
        if (!isConfigured) return requireConfiguration();

        const authUrl = new URL("/auth/v1/authorize", config.supabaseUrl);
        authUrl.searchParams.set("provider", "google");
        authUrl.searchParams.set("prompt", "select_account");
        authUrl.searchParams.set("redirect_to", window.location.origin + window.location.pathname);
        window.location.assign(authUrl.toString());
    });

    magicLinkForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!isConfigured) return requireConfiguration();
        if (!emailInput.checkValidity()) {
            emailInput.reportValidity();
            return;
        }

        const submitButton = magicLinkForm.querySelector("button[type=submit]");
        submitButton.disabled = true;
        setStatus("Enviando seu link de entrada…", "");

        try {
            const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/otp", {
                method: "POST",
                headers: {
                    "apikey": config.supabaseAnonKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: emailInput.value.trim(),
                    create_user: true,
                    options: { emailRedirectTo: window.location.origin + window.location.pathname }
                })
            });
            if (!response.ok) throw new Error("Não foi possível enviar o link agora.");
            setStatus("Pronto. Confira seu e-mail para continuar no HeartSpace.", "success");
        } catch (error) {
            setStatus(error.message || "Não foi possível enviar o link agora.", "error");
        } finally {
            submitButton.disabled = false;
        }
    });
    }

    billingPortal.addEventListener("click", async function () {
        let token;
        try { token = await getValidAccessToken(); } catch (error) { return; }
        if (!token) return;
        billingPortal.disabled = true;
        billingStatus.textContent = "Abrindo o gerenciamento da assinatura…";
        try {
            const data = await apiRequest("create_portal", token);
            if (!data.portal_url) throw new Error("O portal de assinatura não está disponível agora.");
            window.location.assign(data.portal_url);
        } catch (error) {
            billingStatus.textContent = error.message || "Não foi possível abrir o portal agora.";
        } finally {
            billingPortal.disabled = false;
        }
    });

    checkoutButton.addEventListener("click", async function () {
        let token;
        try { token = await getValidAccessToken(); } catch (error) { return; }
        const planId = config.plans && config.plans[selectedPlan];
        if (!token || !planId) return;
        checkoutButton.disabled = true;
        checkoutButton.textContent = "Preparando pagamento…";
        try {
            const data = await apiRequest("create_checkout", token, { plan_id: planId });
            if (!data.checkout_url) throw new Error("O checkout não está disponível agora.");
            window.location.assign(data.checkout_url);
        } catch (error) {
            checkoutButton.disabled = false;
            checkoutButton.textContent = "Tentar novamente";
            billingStatus.textContent = error.message || "Não foi possível abrir o checkout agora.";
        }
    });

    signOut.addEventListener("click", function () {
        const token = localStorage.getItem(sessionKey("access-token"));
        clearSession();
        memberArea.hidden = true;
        window.location.replace("../login/");
        if (isConfigured && token) {
            fetch(config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/logout", {
                method: "POST",
                headers: { "apikey": config.supabaseAnonKey, "Authorization": "Bearer " + token }
            }).catch(function () {
                /* A interface já removeu a sessão local; não reintroduza o token em caso de falha de rede. */
            });
        }
    });

    restoreSession();
}());
