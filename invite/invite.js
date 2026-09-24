(function () {
    "use strict";
    const config = window.HEARTSPACE_ACCOUNT_CONFIG || {};
    const token = new URLSearchParams(window.location.search).get("token");
    const status = document.getElementById("inviteStatus");
    const title = document.getElementById("inviteTitle");
    const action = document.getElementById("inviteAction");
    const sessionKey = (name) => "heartspace-account-" + name;
    const setStatus = (message, state) => { status.textContent = message; status.className = "auth-status" + (state ? " is-" + state : ""); };
    if (!token) { title.textContent = "Convite incompleto"; setStatus("Este link não contém um convite válido.", "error"); return; }
    // Sessões antigas ficam disponíveis só até esta primeira abertura; migre-as
    // para a sessão persistente adotada pelo site.
    let accessToken = localStorage.getItem(sessionKey("access-token")) || sessionStorage.getItem(sessionKey("access-token"));
    if (accessToken && !localStorage.getItem(sessionKey("access-token"))) {
        localStorage.setItem(sessionKey("access-token"), accessToken);
        ["refresh-token", "expires-at"].forEach((name) => { const value = sessionStorage.getItem(sessionKey(name)); if (value) localStorage.setItem(sessionKey(name), value); });
    }
    if (!config.studioFunctionUrl) { title.textContent = "Convites em preparação"; setStatus("O serviço de estúdios ainda não está disponível.", "error"); return; }
    (async function () {
        try {
            const expiresAt = Number(localStorage.getItem(sessionKey("expires-at")) || 0);
            const refreshToken = localStorage.getItem(sessionKey("refresh-token"));
            if ((!accessToken || (expiresAt && expiresAt <= Date.now() / 1000 + 60)) && refreshToken) {
                const refreshResponse = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { "apikey": config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }) });
                if (!refreshResponse.ok) throw new Error("Sua sessão expirou.");
                const session = await refreshResponse.json(); accessToken = session.access_token;
                localStorage.setItem(sessionKey("access-token"), session.access_token); localStorage.setItem(sessionKey("refresh-token"), session.refresh_token); localStorage.setItem(sessionKey("expires-at"), String(session.expires_at));
            }
            if (!accessToken) { title.textContent = "Entre para aceitar"; setStatus("Use sua conta HeartSpace para confirmar este convite.", ""); action.href = "../login/?invite=" + encodeURIComponent(token); action.hidden = false; return; }
            const response = await fetch(config.studioFunctionUrl, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "apikey": config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept_invite", token: token }) });
            const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Não foi possível aceitar este convite.");
            localStorage.removeItem(sessionKey("pending-invite"));
            title.textContent = "Você entrou no estúdio."; setStatus("Pronto. Seu acesso foi adicionado com segurança.", "success"); action.href = "../account/"; action.textContent = "Abrir painel"; action.hidden = false;
        } catch (error) {
            if (/sessão expirou/i.test(error.message || "")) { title.textContent = "Entre para aceitar"; setStatus("Sua sessão expirou; entre novamente e o convite será mantido.", ""); action.href = "../login/?invite=" + encodeURIComponent(token); action.hidden = false; return; }
            title.textContent = "Não foi possível aceitar"; setStatus(error.message || "Este convite pode ter expirado.", "error");
        }
    }());
}());
