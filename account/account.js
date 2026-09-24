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
    const profileFullName = document.getElementById("profileFullName");
    const profileAge = document.getElementById("profileAge");
    const profileProfession = document.getElementById("profileProfession");
    const profilePhone = document.getElementById("profilePhone");
    const profileStatus = document.getElementById("profileStatus");
    const memberArea = document.getElementById("memberArea");
    const memberEmail = document.getElementById("memberEmail");
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
    const overviewStudioCount = document.getElementById("overviewStudioCount");
    const overviewProjectCount = document.getElementById("overviewProjectCount");
    const overviewStudioTitle = document.getElementById("overviewStudioTitle");
    const overviewStudioCopy = document.getElementById("overviewStudioCopy");
    const studioSettingsPanel = document.getElementById("studioSettingsPanel");
    const studioSettingsForm = document.getElementById("studioSettingsForm");
    const activeStudioHeading = document.getElementById("activeStudioHeading");
    const activeStudioRole = document.getElementById("activeStudioRole");
    const activeStudioName = document.getElementById("activeStudioName");
    const activeStudioDescription = document.getElementById("activeStudioDescription");
    const studioSettingsStatus = document.getElementById("studioSettingsStatus");
    const studioActivityPanel = document.getElementById("studioActivityPanel");
    const studioActivityList = document.getElementById("studioActivityList");
    const memberList = document.getElementById("memberList");
    const pendingInvitesPanel = document.getElementById("pendingInvitesPanel");
    const pendingInviteList = document.getElementById("pendingInviteList");
    const projectList = document.getElementById("projectList");
    const projectsTitle = document.getElementById("projectsTitle");
    const projectsCopy = document.getElementById("projectsCopy");
    const createProjectForm = document.getElementById("createProjectForm");
    const projectName = document.getElementById("projectName");
    const projectDescription = document.getElementById("projectDescription");
    const projectStatus = document.getElementById("projectStatus");
    let currentStudios = [];
    let activeStudioId = sessionStorage.getItem(sessionKey("active-studio")) || "";
    let activeStudioAdmin = null;
    let currentUserId = "";
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

    function saveSession(accessToken, refreshToken, expiresAt) {
        if (!accessToken) return;
        sessionStorage.setItem(sessionKey("access-token"), accessToken);
        if (refreshToken) sessionStorage.setItem(sessionKey("refresh-token"), refreshToken);
        else sessionStorage.removeItem(sessionKey("refresh-token"));
        if (expiresAt) sessionStorage.setItem(sessionKey("expires-at"), String(expiresAt));
        else sessionStorage.removeItem(sessionKey("expires-at"));
    }

    function clearSession() {
        sessionStorage.removeItem(sessionKey("access-token"));
        sessionStorage.removeItem(sessionKey("refresh-token"));
        sessionStorage.removeItem(sessionKey("expires-at"));
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
        const expiresAt = Number(sessionStorage.getItem(sessionKey("expires-at")) || 0);
        return Boolean(expiresAt && expiresAt <= (Date.now() / 1000) + 60);
    }

    async function refreshAccessToken() {
        const refreshToken = sessionStorage.getItem(sessionKey("refresh-token"));
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
        const callbackToken = readCallbackSession();
        if (callbackToken && !accessTokenExpiresSoon()) return callbackToken;
        const storedToken = sessionStorage.getItem(sessionKey("access-token"));
        if (!storedToken || accessTokenExpiresSoon()) return refreshAccessToken();
        return storedToken;
    }

    function showMemberArea(user) {
        currentUserId = user.id || currentUserId;
        memberEmail.textContent = user.email || "Conta HeartSpace";
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

    function setProfileStatus(message, state) {
        profileStatus.textContent = message;
        profileStatus.className = "form-status" + (state ? " is-" + state : "");
    }

    function showProfileOnboarding(profile) {
        profileFullName.value = profile.full_name || "";
        profileAge.value = Number.isInteger(profile.age) && profile.age > 0 ? String(profile.age) : "";
        profileProfession.value = profile.profession || "";
        profilePhone.value = profile.phone || "";
        accountLoading.hidden = true;
        memberArea.hidden = true;
        profileOnboarding.hidden = false;
    }

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
        });
    });

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
            await studioRequest("update_profile", token, { full_name: profileFullName.value, age: Number(profileAge.value), profession: profileProfession.value, phone: profilePhone.value });
            const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/user", { headers: { "apikey": config.supabaseAnonKey, "Authorization": "Bearer " + token } });
            const user = response.ok ? await response.json() : { email: memberEmail.textContent };
            showMemberArea(user); await loadEntitlements(token); await loadStudios(token);
        } catch (error) { setProfileStatus(error.message || "Não foi possível salvar sua ficha agora.", "error"); }
        finally { button.disabled = false; }
    });

    function clearStudioAdministration() {
        activeStudioAdmin = null;
        studioSettingsPanel.hidden = true;
        studioActivityPanel.hidden = true;
        memberList.hidden = true;
        pendingInvitesPanel.hidden = true;
        projectList.hidden = true;
        overviewProjectCount.textContent = "—";
    }

    function renderStudios(studios) {
        currentStudios = studios;
        studioList.replaceChildren();
        inviteStudio.replaceChildren();
        studioContextSelect.replaceChildren();
        overviewStudioCount.textContent = String(studios.length);
        if (!studios.length) {
            studiosTitle.textContent = "Seu primeiro estúdio começa aqui.";
            studiosCopy.textContent = "Crie um espaço para organizar equipe, projetos compartilhados e publicações. Você será o owner inicial.";
            const option = new Option("Nenhum estúdio", ""); studioContextSelect.add(option); studioContextSelect.disabled = true;
            overviewStudioTitle.textContent = "Crie seu primeiro estúdio";
            overviewStudioCopy.textContent = "Seu estúdio organiza pessoas, acessos e projetos compartilhados. O trabalho continua local no Hub.";
            studioList.hidden = true;
            inviteMemberForm.hidden = true;
            activeStudioId = "";
            sessionStorage.removeItem(sessionKey("active-studio"));
            clearStudioAdministration();
            return;
        }
        studiosTitle.textContent = studios.length === 1 ? "1 estúdio conectado." : studios.length + " estúdios conectados.";
        studiosCopy.textContent = "Você pode criar outro estúdio ou escolher um deles quando o seletor de estúdio for ativado.";
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
        studioList.hidden = studioList.childElementCount === 0;
        if (inviteStudio.childElementCount) {
            if (!Array.from(studioContextSelect.options).some(function (option) { return option.value === activeStudioId; })) activeStudioId = studioContextSelect.options[0].value;
            studioContextSelect.value = activeStudioId;
            studioContextSelect.disabled = false;
            inviteStudio.value = activeStudioId;
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
        activeStudioRole.textContent = role === "owner" ? "OWNER" : role === "admin" ? "ADMIN" : "MEMBRO";
        activeStudioName.value = studio.name || "";
        activeStudioDescription.value = studio.description || "";
        Array.from(studioSettingsForm.elements).forEach(function (element) { element.disabled = !canManage; });
        studioSettingsPanel.hidden = false;

        projectList.replaceChildren();
        const projects = Array.isArray(data.projects) ? data.projects : [];
        overviewProjectCount.textContent = String(projects.length);
        projectsTitle.textContent = projects.length ? (projects.length === 1 ? "1 projeto neste estúdio." : projects.length + " projetos neste estúdio.") : "Seu próximo projeto começa aqui.";
        projectsCopy.textContent = projects.length ? "Os projetos criados aqui já podem ser reconhecidos pelo Hub. O conteúdo e os arquivos continuam locais." : "O site cria a referência compartilhada. Quando você abrir o Hub, ela se transforma no seu espaço de trabalho local.";
        projects.forEach(function (project) { appendListRow(projectList, project.name || "Projeto sem título", (project.description || "Sem descrição") + " · criado em " + formatDate(project.created_at)); });
        projectList.hidden = !projects.length;
        createProjectForm.hidden = !canManage;

        memberList.replaceChildren();
        const members = Array.isArray(data.members) ? data.members : [];
        members.forEach(function (member) {
            const controls = document.createElement("div"); controls.className = "row-controls";
            if (isOwner && member.role !== "owner") {
                const select = document.createElement("select"); select.className = "compact-select"; select.dataset.memberRole = member.user_id; select.value = member.role;
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
    }

    async function loadActiveStudio(token) {
        if (!activeStudioId) return clearStudioAdministration();
        try {
            const data = await studioRequest("get_studio_admin", token, { studio_id: activeStudioId });
            renderActiveStudio(data);
        } catch (error) {
            clearStudioAdministration();
            membersTitle.textContent = "Não foi possível carregar a equipe.";
            membersCopy.textContent = "Atualize a página ou confirme se a Function administrativa foi atualizada.";
        }
    }

    studioContextSelect.addEventListener("change", async function () {
        activeStudioId = studioContextSelect.value;
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
            await studioRequest("update_studio", token, { studio_id: activeStudioId, name: activeStudioName.value.trim(), description: activeStudioDescription.value.trim() });
            setSettingsStatus("Alterações salvas.", "success"); await loadStudios(token);
        } catch (error) { setSettingsStatus(error.message || "Não foi possível salvar as alterações.", "error"); }
        finally { button.disabled = false; }
    });

    function setProjectStatus(message, state) {
        projectStatus.textContent = message;
        projectStatus.className = "form-status" + (state ? " is-" + state : "");
    }

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
            await loadActiveStudio(token);
            if (data.project) projectStatus.textContent = "Projeto criado. Abra o Hub para começar a trabalhar nele.";
        } catch (error) { setProjectStatus(error.message || "Não foi possível criar o projeto agora.", "error"); }
        finally { button.disabled = false; }
    });

    memberList.addEventListener("change", async function (event) {
        const target = event.target;
        if (!target.matches("[data-member-role]")) return;
        try { const token = await getValidAccessToken(); if (!token) throw new Error("Sessão expirada."); await studioRequest("update_member_role", token, { studio_id: activeStudioId, target_id: target.dataset.memberRole, role: target.value }); await loadActiveStudio(token); }
        catch (error) { inviteStatus.textContent = error.message || "Não foi possível alterar o papel."; }
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
            await studioRequest("create_studio", token, { name: studioName.value.trim(), slug: studioSlug.value.trim() });
            createStudioForm.reset(); setStudioStatus("Estúdio criado. Você já é o owner inicial.", "success"); await loadStudios(token);
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
            if (profile && !profile.profile_completed_at) {
                showProfileOnboarding(profile);
                return;
            }
            showMemberArea(user);
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
        const token = sessionStorage.getItem(sessionKey("access-token"));
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
