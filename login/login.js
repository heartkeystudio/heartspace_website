(function () {
    "use strict";
    const config = window.HEARTSPACE_ACCOUNT_CONFIG || {};
    const form = document.getElementById("magicLinkForm");
    const email = document.getElementById("email");
    const status = document.getElementById("authStatus");
    const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && config.studioFunctionUrl);
    const key = (name) => "heartspace-account-" + name;
    const savedTheme = localStorage.getItem("heartspace-theme") || localStorage.getItem("heartspace-account-theme") || "dark";
    document.body.classList.toggle("is-light", savedTheme === "light");
    const setStatus = (message, state) => { status.textContent = message; status.className = "auth-status" + (state ? " is-" + state : ""); };
    const redirect = () => {
        const query = new URLSearchParams(window.location.search);
        const invite = query.get("invite") || localStorage.getItem(key("pending-invite"));
        window.location.replace(invite ? "../invite/?token=" + encodeURIComponent(invite) : "../account/" + window.location.search);
    };
    const invite = new URLSearchParams(window.location.search).get("invite");
    if (invite) localStorage.setItem(key("pending-invite"), invite);
    const callback = new URLSearchParams(window.location.hash.slice(1));
    if (callback.get("access_token")) {
        localStorage.setItem(key("access-token"), callback.get("access_token"));
        if (callback.get("refresh_token")) localStorage.setItem(key("refresh-token"), callback.get("refresh_token"));
        if (callback.get("expires_at")) localStorage.setItem(key("expires-at"), callback.get("expires_at"));
        redirect();
    }
    // A pessoa já autenticada não deve voltar a ver uma tela de login ao usar
    // os botões da página inicial; a conta renova o token quando necessário.
    if (localStorage.getItem(key("access-token"))) redirect();
    if (!configured) setStatus("A entrada ainda está sendo preparada. Volte em breve para criar ou acessar sua conta.", "");
    if (new URLSearchParams(window.location.search).get("beta") === "denied") {
        setStatus("Este e-mail ainda não foi liberado para o beta fechado.", "error");
    }
    form.addEventListener("submit", async (event) => {
        event.preventDefault(); if (!configured || !email.checkValidity()) { email.reportValidity(); return; }
        const button = form.querySelector("button[type=submit]"); button.disabled = true; setStatus("Enviando seu link de entrada…", "");
        try {
            const response = await fetch(config.studioFunctionUrl, { method: "POST", headers: { "apikey": config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify({ action: "request_beta_magic_link", email: email.value.trim(), redirect_to: window.location.origin + "/account/" }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Não foi possível enviar o link agora.");
            setStatus("Se este e-mail estiver aprovado, o link de acesso chegará em instantes.", "success");
        } catch (error) { setStatus(error.message || "Não foi possível enviar o link agora.", "error"); } finally { button.disabled = false; }
    });
}());
