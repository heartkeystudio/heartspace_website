(function () {
    "use strict";
    const config = window.HEARTSPACE_ACCOUNT_CONFIG || {};
    const googleButton = document.getElementById("googleSignIn");
    const form = document.getElementById("magicLinkForm");
    const email = document.getElementById("email");
    const status = document.getElementById("authStatus");
    const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
    const key = (name) => "heartspace-account-" + name;
    const setStatus = (message, state) => { status.textContent = message; status.className = "auth-status" + (state ? " is-" + state : ""); };
    const redirect = () => window.location.replace("../account/" + window.location.search);
    const callback = new URLSearchParams(window.location.hash.slice(1));
    if (callback.get("access_token")) {
        sessionStorage.setItem(key("access-token"), callback.get("access_token"));
        if (callback.get("refresh_token")) sessionStorage.setItem(key("refresh-token"), callback.get("refresh_token"));
        if (callback.get("expires_at")) sessionStorage.setItem(key("expires-at"), callback.get("expires_at"));
        redirect();
    }
    if (!configured) setStatus("A entrada ainda está sendo preparada. Volte em breve para criar ou acessar sua conta.", "");
    googleButton.addEventListener("click", () => {
        if (!configured) return;
        const url = new URL("/auth/v1/authorize", config.supabaseUrl);
        url.searchParams.set("provider", "google"); url.searchParams.set("redirect_to", window.location.origin + window.location.pathname);
        window.location.assign(url.toString());
    });
    form.addEventListener("submit", async (event) => {
        event.preventDefault(); if (!configured || !email.checkValidity()) { email.reportValidity(); return; }
        const button = form.querySelector("button[type=submit]"); button.disabled = true; setStatus("Enviando seu link de entrada…", "");
        try {
            const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/otp", { method: "POST", headers: { "apikey": config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email: email.value.trim(), create_user: true, options: { emailRedirectTo: window.location.origin + window.location.pathname } }) });
            if (!response.ok) throw new Error(); setStatus("Pronto. Confira seu e-mail para continuar no HeartSpace.", "success");
        } catch (_) { setStatus("Não foi possível enviar o link agora.", "error"); } finally { button.disabled = false; }
    });
}());
