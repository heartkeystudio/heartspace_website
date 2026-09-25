(function () {
    "use strict";
    const config = window.HEARTSPACE_ACCOUNT_CONFIG || {};
    const googleButton = document.getElementById("googleSignIn");
    const form = document.getElementById("magicLinkForm");
    const email = document.getElementById("email");
    const status = document.getElementById("authStatus");
    const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
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
    googleButton.addEventListener("click", () => {
        if (!configured) return;
        const url = new URL("/auth/v1/authorize", config.supabaseUrl);
        url.searchParams.set("provider", "google"); url.searchParams.set("prompt", "select_account"); url.searchParams.set("redirect_to", window.location.origin + window.location.pathname + window.location.search);
        window.location.assign(url.toString());
    });
    form.addEventListener("submit", async (event) => {
        event.preventDefault(); if (!configured || !email.checkValidity()) { email.reportValidity(); return; }
        const button = form.querySelector("button[type=submit]"); button.disabled = true; setStatus("Enviando seu link de entrada…", "");
        try {
            const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/otp", { method: "POST", headers: { "apikey": config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email: email.value.trim(), create_user: true, options: { emailRedirectTo: window.location.origin + window.location.pathname + window.location.search } }) });
            if (!response.ok) throw new Error(); setStatus("Pronto. Confira seu e-mail para continuar no HeartSpace.", "success");
        } catch (_) { setStatus("Não foi possível enviar o link agora.", "error"); } finally { button.disabled = false; }
    });
}());
