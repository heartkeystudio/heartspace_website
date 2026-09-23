(function () {
    "use strict";
    const status = document.getElementById("copyStatus");
    const message = "Link da publicação copiado.";

    async function copyPublicationLink() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            status.textContent = message;
        } catch (error) {
            status.textContent = "Copie o link pela barra de endereço.";
        }
    }

    document.getElementById("copyLink").addEventListener("click", copyPublicationLink);
    document.getElementById("shareButton").addEventListener("click", async function () {
        if (navigator.share) {
            try { await navigator.share({ title: document.title, url: window.location.href }); return; } catch (error) { if (error.name === "AbortError") return; }
        }
        copyPublicationLink();
    });
}());
