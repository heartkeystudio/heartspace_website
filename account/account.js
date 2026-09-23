(function () {
    "use strict";

    const config = window.HEARTSPACE_ACCOUNT_CONFIG || {};
    const googleButton = document.getElementById("googleSignIn");
    const magicLinkForm = document.getElementById("magicLinkForm");
    const emailInput = document.getElementById("email");
    const status = document.getElementById("authStatus");
    const accountCard = document.querySelector(".account-card");
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
        memberEmail.textContent = user.email || "Conta HeartSpace";
        securityEmail.textContent = user.email || "Conta HeartSpace";
        accountCard.hidden = true;
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

    function renderStudios(studios) {
        studioList.replaceChildren();
        if (!studios.length) {
            studiosTitle.textContent = "Seu primeiro estúdio começa aqui.";
            studiosCopy.textContent = "Crie um espaço para organizar equipe, projetos compartilhados e publicações. Você será o owner inicial.";
            studioList.hidden = true;
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
        });
        studioList.hidden = studioList.childElementCount === 0;
    }

    async function loadStudios(token) {
        if (!config.studioFunctionUrl) return;
        try { const data = await studioRequest("list_studios", token); renderStudios(Array.isArray(data.studios) ? data.studios : []); }
        catch (error) { studiosTitle.textContent = "Não foi possível carregar seus estúdios."; studiosCopy.textContent = "Confira sua conexão e tente novamente mais tarde."; }
    }

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
        } catch (error) { setStudioStatus(error.message || "Não foi possível criar o estúdio agora.", "error"); }
        finally { submitButton.disabled = false; }
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
        if (!isConfigured) return;
        let token;
        try {
            token = await getValidAccessToken();
        } catch (error) {
            clearSession();
            return;
        }
        if (!token) { window.location.replace("../login/"); return; }
        try {
            const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/user", {
                headers: { "apikey": config.supabaseAnonKey, "Authorization": "Bearer " + token }
            });
            if (!response.ok) throw new Error("Sessão expirada");
            const user = await response.json();
            showMemberArea(user);
            await loadEntitlements(token);
            await loadStudios(token);
        } catch (error) {
            clearSession();
            window.location.replace("../login/");
        }
    }

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
