/* LSD-PAGE V3 — sino de notificações para a página pública quando houver login. */
(() => {
    "use strict";
    const TOKEN_KEY = "token_lsd";
    const token = () => {
        try { const value = localStorage.getItem(TOKEN_KEY); if (value) return value; } catch (_) {}
        try { return sessionStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
    };
    const naiveIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

    function apiBase() {
        return (location.hostname === "127.0.0.1" || location.hostname === "localhost")
            ? "http://127.0.0.1:5000"
            : location.origin;
    }

    async function api(endpoint, options = {}) {
        if (!token()) return { ok: false, data: {} };
        try {
            const response = await fetch(`${apiBase()}${endpoint}`, {
                ...options,
                headers: {
                    ...(options.headers || {}),
                    Authorization: `Bearer ${token()}`,
                },
            });
            return { ok: response.ok, data: await response.json().catch(() => ({})) };
        } catch (_) {
            return { ok: false, data: {} };
        }
    }

    function escapeText(value) {
        const node = document.createElement("span");
        node.textContent = String(value ?? "");
        return node.innerHTML;
    }

    function dateText(value) {
        if (!value) return "Agora";
        const parsed = new Date(typeof value === "string" && naiveIso.test(value) ? `${value}Z` : value);
        if (Number.isNaN(parsed.getTime())) return "";
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Fortaleza",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(parsed);
    }

    function icon(type) {
        return {
            comentario: "fa-comment-dots",
            reacao: "fa-heart",
            projeto: "fa-diagram-project",
            comunidade: "fa-user-plus",
            conquista: "fa-trophy",
            comunicado: "fa-bullhorn",
        }[type] || "fa-bell";
    }

    function ensureCss() {
        if (document.getElementById("v3MobileCss")) return;
        const link = document.createElement("link");
        link.id = "v3MobileCss";
        link.rel = "stylesheet";
        link.href = "./src/css/v3-mobile.css";
        document.head.appendChild(link);
    }

    function createBell() {
        if (!token() || document.getElementById("v3NotificationBell")) return;
        const account = document.getElementById("area-usuario");
        const host = account?.parentElement || document.querySelector(".nav-account-actions") || document.querySelector(".nav-right") || document.querySelector("nav");
        if (!host) return;
        const wrap = document.createElement("div");
        wrap.className = "v3-notification-wrap v3-notification-public";
        wrap.innerHTML = `
            <button type="button" class="v3-notification-bell" id="v3NotificationBell" aria-label="Abrir notificações" aria-expanded="false">
                <i class="fas fa-bell"></i><span class="v3-notification-badge" id="v3NotificationBadge" hidden>0</span>
            </button>
            <section class="v3-notification-panel" id="v3NotificationPanel" hidden>
                <div class="v3-notification-panel-head"><strong>Notificações</strong><a href="dashboard.html">Ver perfil</a></div>
                <div class="v3-notification-items" id="v3NotificationItems"><div class="v3-notification-empty">Carregando...</div></div>
            </section>`;
        if (account && account.parentElement === host) host.insertBefore(wrap, account);
        else host.prepend(wrap);
        const button = wrap.querySelector("#v3NotificationBell");
        const panel = wrap.querySelector("#v3NotificationPanel");
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            panel.hidden = !panel.hidden;
            button.setAttribute("aria-expanded", String(!panel.hidden));
        });
        panel.addEventListener("click", (event) => event.stopPropagation());
        document.addEventListener("click", () => {
            panel.hidden = true;
            button.setAttribute("aria-expanded", "false");
        });
    }

    async function markRead(id) {
        if (!id) return;
        await api(`/api/notificacoes/${encodeURIComponent(id)}/ler`, { method: "POST" });
    }

    function showAnnouncement(item) {
        if (!item || document.querySelector(`.v3-announcement-toast[data-id="${item.id}"]`)) return;
        document.getElementById("v3AnnouncementToast")?.remove();
        const toast = document.createElement("aside");
        toast.id = "v3AnnouncementToast";
        toast.dataset.id = item.id;
        toast.className = "v3-announcement-toast";
        toast.setAttribute("role", "alert");
        toast.innerHTML = `
            <div class="v3-announcement-symbol"><i class="fas fa-bullhorn"></i></div>
            <div class="v3-announcement-copy"><strong>${escapeText(item.titulo || "Comunicado do LSD")}</strong><p>${escapeText(item.mensagem || "")}</p></div>
            <button type="button" aria-label="Marcar comunicado como lido"><i class="fas fa-check"></i></button>`;
        document.body.appendChild(toast);
        toast.querySelector("button").addEventListener("click", async () => {
            await markRead(item.id);
            toast.remove();
            refresh();
        });
    }

    async function refresh() {
        if (!token()) return;
        createBell();
        const result = await api("/api/notificacoes");
        if (!result.ok) return;
        const notifications = Array.isArray(result.data?.notificacoes) ? result.data.notificacoes : [];
        const unread = Number(result.data?.nao_lidas || notifications.filter((item) => !item.lida).length || 0);
        const badge = document.getElementById("v3NotificationBadge");
        const items = document.getElementById("v3NotificationItems");
        if (badge) {
            badge.textContent = unread > 99 ? "99+" : String(unread);
            badge.hidden = unread <= 0;
        }
        if (items) {
            items.innerHTML = notifications.length
                ? notifications.slice(0, 8).map((item) => `
                    <button type="button" class="v3-notification-item ${item.lida ? "" : "is-unread"} ${item.tipo === "comunicado" ? "is-announcement" : ""}" data-v3-notification-id="${item.id}">
                        <span class="v3-notification-icon"><i class="fas ${icon(item.tipo)}"></i></span>
                        <span class="v3-notification-copy"><strong>${escapeText(item.titulo || "Notificação")}</strong><span>${escapeText(item.mensagem || "")}</span><small>${escapeText(dateText(item.data_criacao))}</small></span>
                    </button>`).join("")
                : '<div class="v3-notification-empty">Nenhuma notificação recente.</div>';
            items.querySelectorAll("[data-v3-notification-id]").forEach((button) => button.addEventListener("click", async () => {
                await markRead(button.dataset.v3NotificationId);
                refresh();
            }));
        }
        showAnnouncement(notifications.find((item) => item.tipo === "comunicado" && !item.lida));
    }

    ensureCss();
    document.addEventListener("DOMContentLoaded", () => {
        if (!token()) return;
        createBell();
        refresh();
        setInterval(refresh, 60000);
    });
})();
