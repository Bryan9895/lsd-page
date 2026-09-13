/* LSD-PAGE V3 — melhorias progressivas carregadas depois do dashboard principal. */
(() => {
    "use strict";

    const TOKEN_KEY = "token_lsd";
    const NAIVE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

    const token = () => localStorage.getItem(TOKEN_KEY);
    const usuario = () => {
        try {
            return typeof usuarioAtual !== "undefined" ? usuarioAtual : null;
        } catch (_) {
            return null;
        }
    };

    function apiBase() {
        return (location.hostname === "127.0.0.1" || location.hostname === "localhost")
            ? "http://127.0.0.1:5000"
            : location.origin;
    }

    async function api(endpoint, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (token()) headers.Authorization = `Bearer ${token()}`;
        if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }
        try {
            const response = await fetch(`${apiBase()}${endpoint}`, { ...options, headers });
            const data = await response.json().catch(() => ({}));
            return { ok: response.ok, status: response.status, data };
        } catch (_) {
            return { ok: false, status: 0, data: {} };
        }
    }

    function ensureMobileCss() {
        if (document.getElementById("v3MobileCss")) return;
        const link = document.createElement("link");
        link.id = "v3MobileCss";
        link.rel = "stylesheet";
        link.href = "./src/css/v3-mobile.css";
        document.head.appendChild(link);
    }

    function normalizeDate(value) {
        return typeof value === "string" && NAIVE_ISO.test(value) ? `${value}Z` : value;
    }

    // Corrige datetimes UTC antigos que chegavam sem o sufixo Z.
    try {
        if (typeof formatarData === "function") {
            const baseFormatarData = formatarData;
            formatarData = function v3FormatarData(value) {
                return baseFormatarData(normalizeDate(value));
            };
        }
    } catch (_) { /* mantém o formatador original */ }

    function formatNotificationDate(value) {
        if (!value) return "Agora";
        const date = new Date(normalizeDate(value));
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Fortaleza",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(date);
    }

    function escapeText(value) {
        const el = document.createElement("span");
        el.textContent = String(value ?? "");
        return el.innerHTML;
    }

    function iconForType(type) {
        return {
            comentario: "fa-comment-dots",
            reacao: "fa-heart",
            projeto: "fa-diagram-project",
            comunidade: "fa-user-plus",
            conquista: "fa-trophy",
            comunicado: "fa-bullhorn",
        }[type] || "fa-bell";
    }

    function createBell() {
        if (!token() || document.getElementById("v3NotificationBell")) return;
        const host = document.querySelector(".nav-account-actions") || document.querySelector(".nav-right");
        if (!host) return;

        const wrap = document.createElement("div");
        wrap.className = "v3-notification-wrap";
        wrap.innerHTML = `
            <button type="button" class="v3-notification-bell" id="v3NotificationBell"
                    aria-label="Abrir notificações" aria-expanded="false">
                <i class="fas fa-bell" aria-hidden="true"></i>
                <span class="v3-notification-badge" id="v3NotificationBadge" hidden>0</span>
            </button>
            <section class="v3-notification-panel" id="v3NotificationPanel" hidden aria-label="Notificações recentes">
                <div class="v3-notification-panel-head">
                    <strong>Notificações</strong><span>Recentes</span>
                </div>
                <div class="v3-notification-items" id="v3NotificationItems">
                    <div class="v3-notification-empty">Carregando...</div>
                </div>
            </section>`;
        host.prepend(wrap);

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

    async function refreshBell() {
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
                ? notifications.slice(0, 10).map((item) => `
                    <button type="button" class="v3-notification-item ${item.lida ? "" : "is-unread"} ${item.tipo === "comunicado" ? "is-announcement" : ""}"
                            data-v3-notification-id="${item.id}">
                        <span class="v3-notification-icon"><i class="fas ${iconForType(item.tipo)}"></i></span>
                        <span class="v3-notification-copy">
                            <strong>${escapeText(item.titulo || "Notificação")}</strong>
                            <span>${escapeText(item.mensagem || "")}</span>
                            <small>${escapeText(formatNotificationDate(item.data_criacao))}</small>
                        </span>
                    </button>`).join("")
                : '<div class="v3-notification-empty">Nenhuma notificação recente.</div>';

            items.querySelectorAll("[data-v3-notification-id]").forEach((node) => {
                node.addEventListener("click", async () => {
                    await markRead(node.dataset.v3NotificationId);
                    node.classList.remove("is-unread");
                    refreshBell();
                });
            });
        }

        const announcement = notifications.find((item) => item.tipo === "comunicado" && !item.lida);
        if (announcement) showAnnouncement(announcement);
    }

    function showAnnouncement(item) {
        const current = document.getElementById("v3AnnouncementToast");
        if (current?.dataset.id === String(item.id)) return;
        current?.remove();
        const toast = document.createElement("aside");
        toast.id = "v3AnnouncementToast";
        toast.dataset.id = item.id;
        toast.className = "v3-announcement-toast";
        toast.setAttribute("role", "alert");
        toast.innerHTML = `
            <div class="v3-announcement-symbol"><i class="fas fa-bullhorn"></i></div>
            <div class="v3-announcement-copy">
                <strong>${escapeText(item.titulo || "Comunicado do LSD")}</strong>
                <p>${escapeText(item.mensagem || "")}</p>
            </div>
            <button type="button" aria-label="Marcar comunicado como lido"><i class="fas fa-check"></i></button>`;
        document.body.appendChild(toast);
        toast.querySelector("button").addEventListener("click", async () => {
            await markRead(item.id);
            toast.remove();
            refreshBell();
        });
    }

    function enforceCardAssignment() {
        const select = document.getElementById("cardResponsavel");
        if (!select) return;
        const apply = () => {
            const current = usuario();
            if (!current || current.is_admin) return;
            Array.from(select.options).forEach((option) => {
                if (!["", "logado", String(current.id)].includes(String(option.value))) option.remove();
            });
            if (!["", "logado", String(current.id)].includes(String(select.value))) select.value = "";
            const label = select.closest("label");
            if (label && !label.querySelector(".v3-field-help")) {
                const help = document.createElement("small");
                help.className = "v3-field-help";
                help.textContent = "Você pode assumir a tarefa ou deixá-la sem responsável. Apenas administradores atribuem tarefas a outras pessoas.";
                label.appendChild(help);
            }
        };
        apply();
        new MutationObserver(apply).observe(select, { childList: true });
    }

    function addPasswordResetAction() {
        const form = document.getElementById("formEditarPerfil");
        if (!form || document.getElementById("v3ResetPasswordButton")) return;
        const actions = form.querySelector(".modal-acoes");
        if (!actions) return;
        const block = document.createElement("div");
        block.className = "v3-security-block";
        block.innerHTML = `
            <div><strong><i class="fas fa-shield-halved"></i> Segurança</strong>
            <span>A alteração de senha é confirmada por um link enviado ao seu e-mail cadastrado.</span></div>
            <button type="button" id="v3ResetPasswordButton" class="v3-reset-password">Alterar senha por e-mail</button>`;
        actions.before(block);
        block.querySelector("button").addEventListener("click", async (event) => {
            const button = event.currentTarget;
            const current = usuario();
            if (!current?.email) {
                window.alert("Não foi possível identificar o e-mail desta conta.");
                return;
            }
            button.disabled = true;
            button.textContent = "Enviando link...";
            const result = await api("/api/recuperar-senha", {
                method: "POST",
                body: JSON.stringify({ email: current.email }),
            });
            button.disabled = false;
            button.textContent = "Alterar senha por e-mail";
            window.alert(result.ok
                ? "Se o serviço de e-mail estiver configurado, o link para alterar sua senha foi enviado."
                : (result.data?.message || "Não foi possível solicitar a alteração de senha agora."));
        });
    }

    function injectMemberLevel(data) {
        const container = document.getElementById("membroPerfilConteudo");
        if (!container) return;
        container.querySelector(".v3-member-level")?.remove();
        const level = data?.nivel || data?.membro?.nivel;
        if (!level) return;
        const card = document.createElement("section");
        card.className = "v3-member-level";
        const progress = Math.max(0, Math.min(100, Number(level.progresso || 0)));
        card.innerHTML = `
            <div><span>Nível da conta</span><strong>Nível ${escapeText(level.nivel || 1)}</strong></div>
            <div class="v3-level-track"><span style="width:${progress}%"></span></div>
            <small>${escapeText(level.pontos ?? data?.membro?.pontos ?? 0)} pontos</small>`;
        container.prepend(card);
    }

    try {
        if (typeof renderizarPerfilPublico === "function") {
            const baseRenderizarPerfilPublico = renderizarPerfilPublico;
            renderizarPerfilPublico = function v3RenderizarPerfilPublico(data) {
                const result = baseRenderizarPerfilPublico(data);
                injectMemberLevel(data);
                return result;
            };
        }
    } catch (_) { /* perfil continua com o renderizador base */ }

    function normalizeStaticPlaceholders() {
        const name = document.getElementById("perfilNome");
        const role = document.getElementById("perfilFuncao");
        if (name && /bryan william/i.test(name.textContent || "")) name.textContent = "Seu perfil";
        if (role && /desenvolvedor full stack/i.test(role.textContent || "")) role.textContent = "Sua função no LSD";
        const headerButton = document.getElementById("btnNovoCardHeader");
        headerButton?.remove();
    }

    function waitForUserFeatures(attempt = 0) {
        if (usuario()) {
            enforceCardAssignment();
            addPasswordResetAction();
            refreshBell();
            return;
        }
        if (attempt < 30) setTimeout(() => waitForUserFeatures(attempt + 1), 150);
    }

    ensureMobileCss();
    document.addEventListener("DOMContentLoaded", () => {
        normalizeStaticPlaceholders();
        createBell();
        waitForUserFeatures();
        setInterval(refreshBell, 60000);
    });
})();
