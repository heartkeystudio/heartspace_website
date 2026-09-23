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
    const accessToken = sessionStorage.getItem(sessionKey("access-token"));
    if (!accessToken) { title.textContent = "Entre para aceitar"; setStatus("Use sua conta HeartSpace para confirmar este convite.", ""); action.href = "../login/?invite=" + encodeURIComponent(token); action.hidden = false; return; }
    if (!config.studioFunctionUrl) { title.textContent = "Convites em preparação"; setStatus("O serviço de estúdios ainda não está disponível.", "error"); return; }
    (async function () {
        try {
            const response = await fetch(config.studioFunctionUrl, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "apikey": config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept_invite", token: token }) });
            const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Não foi possível aceitar este convite.");
            title.textContent = "Você entrou no estúdio."; setStatus("Pronto. Seu acesso foi adicionado com segurança.", "success"); action.href = "../account/"; action.textContent = "Abrir painel"; action.hidden = false;
        } catch (error) { title.textContent = "Não foi possível aceitar"; setStatus(error.message || "Este convite pode ter expirado.", "error"); }
    }());
}());
