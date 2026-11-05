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
    const query = new URLSearchParams(window.location.search);
    const desktopMode = query.getAll("desktop").includes("1");
    const singleQueryValue = (name) => {
        const values = query.getAll(name);
        return values.length === 1 ? values[0] : "";
    };
    const desktopAttempt = desktopMode ? {
        valid: query.getAll("desktop").length === 1 && singleQueryValue("protocol_version") === "1" && /^[A-Za-z0-9_-]{43}$/.test(singleQueryValue("state")) && /^(?:[0-9]{1,5})$/.test(singleQueryValue("port")) && Number(singleQueryValue("port")) >= 1024 && Number(singleQueryValue("port")) <= 65535 && /^[A-Za-z0-9_-]{43}$/.test(singleQueryValue("code_challenge")) && singleQueryValue("code_challenge_method") === "S256",
        state: singleQueryValue("state"),
        port: Number(singleQueryValue("port")),
        codeChallenge: singleQueryValue("code_challenge"),
    } : null;
    if (desktopMode) {
        const intro = document.querySelector(".account-intro > p:not(.eyebrow)");
        const panelCopy = document.querySelector(".panel-heading p");
        const submitButton = form.querySelector("button[type=submit]");
        if (intro) intro.textContent = "Entre no HeartSpace Core com o e-mail aprovado. O Core precisa permanecer aberto neste computador até você concluir o acesso.";
        if (panelCopy) panelCopy.textContent = "Enviaremos um link seguro. A confirmação continua no HeartSpace Core.";
        if (submitButton) submitButton.textContent = "Enviar link para o Core";
    }
    const redirect = () => {
        const query = new URLSearchParams(window.location.search);
        const invite = query.get("invite") || localStorage.getItem(key("pending-invite"));
        window.location.replace(invite ? "../invite/?token=" + encodeURIComponent(invite) : "../account/" + window.location.search);
    };
    const invite = desktopMode ? "" : query.get("invite");
    if (invite) localStorage.setItem(key("pending-invite"), invite);
    if (!desktopMode) {
        const callback = new URLSearchParams(window.location.hash.slice(1));
        if (callback.get("access_token")) {
            localStorage.setItem(key("access-token"), callback.get("access_token"));
            if (callback.get("refresh_token")) localStorage.setItem(key("refresh-token"), callback.get("refresh_token"));
            if (callback.get("expires_at")) localStorage.setItem(key("expires-at"), callback.get("expires_at"));
            redirect();
        }
    }
    // A pessoa já autenticada não deve voltar a ver uma tela de login ao usar
    // os botões da página inicial; a conta renova o token quando necessário.
    if (!desktopMode && localStorage.getItem(key("access-token"))) redirect();
    if (desktopMode && !desktopAttempt.valid) {
        setStatus("Não foi possível validar esta tentativa de login do Core. Feche esta janela e inicie uma nova tentativa no HeartSpace Core.", "error");
        form.querySelector("button[type=submit]").disabled = true;
    }
    if (!configured) setStatus("A entrada ainda está sendo preparada. Volte em breve para criar ou acessar sua conta.", "");
    if (!desktopMode && query.get("beta") === "denied") {
        setStatus("Este e-mail ainda não foi liberado para o beta fechado.", "error");
    }
    form.addEventListener("submit", async (event) => {
        event.preventDefault(); if (!configured || !email.checkValidity()) { email.reportValidity(); return; }
        if (desktopMode && !desktopAttempt.valid) return;
        const button = form.querySelector("button[type=submit]"); button.disabled = true; setStatus("Enviando seu link de entrada…", "");
        try {
            const payload = desktopMode ? {
                action: "request_desktop_magic_link",
                protocol_version: 1,
                email: email.value.trim(),
                state: desktopAttempt.state,
                port: desktopAttempt.port,
                code_challenge: desktopAttempt.codeChallenge,
                code_challenge_method: "S256",
            } : { action: "request_beta_magic_link", email: email.value.trim(), redirect_to: window.location.origin + "/account/" };
            const response = await fetch(config.studioFunctionUrl, { method: "POST", headers: { "apikey": config.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await response.json().catch(() => ({}));
            if (data.code === "CAPTCHA_REQUIRED") throw new Error("O provedor de autenticação exige CAPTCHA. O login desktop precisa ser configurado para apresentar esse desafio.");
            if (response.status === 429) throw new Error("Muitas tentativas de envio. Aguarde antes de solicitar outro link.");
            if (!response.ok) throw new Error(data.error || "Não foi possível enviar o link agora.");
            setStatus(desktopMode ? "Se este e-mail estiver aprovado, enviaremos um link. Abra-o neste computador e selecione “Concluir no HeartSpace Core”." : "Se este e-mail estiver aprovado, o link de acesso chegará em instantes.", "success");
        } catch (error) { setStatus(error.message || "Não foi possível enviar o link agora.", "error"); } finally { button.disabled = false; }
    });
}());
