/**
 * Painel Dashboard LSD
 * JavaScript corrigido e integrado com a API Flask
 */

const API_BASE =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
        ? "http://127.0.0.1:5000"
        : window.location.origin;

const TOKEN_KEY = "token_lsd";
const TEMA_STORAGE_KEY = "lsd_dashboard_tema";

let usuarioAtual = null;
let cards = [];
let excluindoId = null;
let membros = [];
let posts = [];
let advertencias = [];
let backups = [];
let membrosDiretorio = [];
let perfilMembroAbertoId = null;

const ABA_STORAGE_KEY = "lsd_dashboard_aba";
const ABAS_VALIDAS = new Set(["kanban", "comunidade", "membros", "admin"]);

let abaAtual = sessionStorage.getItem(ABA_STORAGE_KEY) || "kanban";
let feedCarregado = false;
let adminCarregado = false;
let membrosCarregados = false;

// Evita o flash do Kanban antes de restaurar a aba usada pelo usuário.
document.documentElement.classList.add("dashboard-inicializando");



// ============================================================
// TEMA CLARO / ESCURO
// ============================================================

function temaEscuroAtivo() {
    return document.documentElement.classList.contains("tema-escuro");
}


function atualizarBotaoTema() {
    const botao = document.getElementById("btnTemaDashboard");
    if (!botao) return;

    const escuro = temaEscuroAtivo();
    const icone = botao.querySelector("i");
    const texto = botao.querySelector("span");

    if (icone) {
        icone.className = escuro ? "fas fa-sun" : "fas fa-moon";
    }

    if (texto) {
        texto.textContent = escuro ? "Claro" : "Escuro";
    }

    botao.setAttribute(
        "aria-label",
        escuro ? "Ativar modo claro" : "Ativar modo escuro"
    );
}


function definirTemaDashboard(tema) {
    const escuro = tema === "escuro";
    document.documentElement.classList.toggle("tema-escuro", escuro);
    localStorage.setItem(TEMA_STORAGE_KEY, escuro ? "escuro" : "claro");
    atualizarBotaoTema();
}


function inicializarTemaDashboard() {
    const botao = document.getElementById("btnTemaDashboard");

    atualizarBotaoTema();

    botao?.addEventListener("click", () => {
        definirTemaDashboard(
            temaEscuroAtivo() ? "claro" : "escuro"
        );
    });
}


// ============================================================
// AUTENTICAÇÃO
// ============================================================

function obterToken() {
    const token = localStorage.getItem(TOKEN_KEY);

    if (
        !token ||
        token === "null" ||
        token === "undefined"
    ) {
        return null;
    }

    return token;
}

function redirecionarLogin() {
    localStorage.removeItem(TOKEN_KEY);

    if (!window.location.pathname.endsWith("entrar-login.html")) {
        window.location.href = "entrar-login.html";
    }
}


// ============================================================
// COMUNICAÇÃO COM API
// ============================================================

async function chamarAPI(endpoint, opcoes = {}) {

    const token = obterToken();

    if (!token) {
        redirecionarLogin();

        return {
            ok: false,
            status: 401,
            dados: {
                success: false,
                message: "Não autenticado."
            }
        };
    }

    const headers = {
        ...(opcoes.headers || {})
    };

    headers["Authorization"] = `Bearer ${token}`;

    // Não colocar Content-Type manualmente em FormData.
    // O navegador precisa definir o boundary automaticamente.
    if (!(opcoes.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    const configuracao = {
        ...opcoes,
        headers
    };

    try {

        const resposta = await fetch(
            `${API_BASE}${endpoint}`,
            configuracao
        );

        const contentType =
            resposta.headers.get("content-type") || "";

        let dados;

        if (contentType.includes("application/json")) {

            try {
                dados = await resposta.json();
            } catch (erro) {
                dados = {
                    success: false,
                    message: "O servidor retornou um JSON inválido."
                };
            }

        } else {

            const texto = await resposta.text();

            dados = {
                success: false,
                message:
                    texto ||
                    `Erro no servidor (${resposta.status}).`
            };
        }

        // Token expirado ou inválido
        if (resposta.status === 401) {

            localStorage.removeItem(TOKEN_KEY);

            alert(
                dados.message ||
                "Sua sessão expirou. Faça login novamente."
            );

            redirecionarLogin();

            return {
                ok: false,
                status: 401,
                dados
            };
        }

        return {
            ok: resposta.ok,
            status: resposta.status,
            dados
        };

    } catch (erro) {

        console.error(
            "Falha de rede/requisição:",
            erro
        );

        return {
            ok: false,
            status: 0,
            dados: {
                success: false,
                message:
                    "Não foi possível conectar ao servidor."
            }
        };
    }
}


// ============================================================
// UTILITÁRIOS
// ============================================================

function normalizarUrlImagem(
    path,
    fallback = "./src/images/equipe/avatar/default-avatar.png"
) {

    if (!path) {
        return fallback;
    }

    if (
        path.startsWith("http://") ||
        path.startsWith("https://") ||
        path.startsWith("./") ||
        path.startsWith("data:")
    ) {
        return path;
    }

    return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}


function escapeHTML(texto) {

    const div = document.createElement("div");

    div.textContent =
        texto === null ||
        texto === undefined
            ? ""
            : String(texto);

    return div.innerHTML;
}


function normalizarUrlExterna(url) {
    if (!url) return "";

    try {
        const valor = String(url).trim();
        const urlCompleta = /^https?:\/\//i.test(valor)
            ? valor
            : `https://${valor}`;
        const parsed = new URL(urlCompleta);

        if (!["http:", "https:"].includes(parsed.protocol)) return "";
        return parsed.href;
    } catch (erro) {
        return "";
    }
}


function formatarData(data) {

    if (!data) {
        return "Agora";
    }

    try {

        const dataObj = new Date(data);

        if (Number.isNaN(dataObj.getTime())) {
            return "Agora";
        }

        return dataObj.toLocaleString(
            "pt-BR",
            {
                dateStyle: "short",
                timeStyle: "short"
            }
        );

    } catch (erro) {

        return "Agora";
    }
}



// ============================================================
// UI / UX — FEEDBACK E DIÁLOGOS
// ============================================================

function mostrarToast(mensagem, tipo = "info", duracao = 3200) {
    let container = document.getElementById("toastContainer");

    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        container.setAttribute("aria-live", "polite");
        container.setAttribute("aria-atomic", "true");
        document.body.appendChild(container);
    }

    const icones = {
        sucesso: "fa-circle-check",
        erro: "fa-circle-exclamation",
        aviso: "fa-triangle-exclamation",
        info: "fa-circle-info"
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;
    toast.setAttribute("role", tipo === "erro" ? "alert" : "status");
    toast.innerHTML = `
        <i class="fas ${icones[tipo] || icones.info}"></i>
        <span>${escapeHTML(mensagem)}</span>
        <button type="button" class="toast-fechar" aria-label="Fechar notificação">
            <i class="fas fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    const remover = () => {
        toast.classList.remove("visivel");
        setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector(".toast-fechar")?.addEventListener("click", remover);
    requestAnimationFrame(() => toast.classList.add("visivel"));
    setTimeout(remover, duracao);
}


function abrirDialogoBase({ titulo, mensagem, valorInicial = null, perigoso = false }) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "ux-dialog-overlay";
        overlay.innerHTML = `
            <div class="ux-dialog" role="dialog" aria-modal="true" aria-labelledby="uxDialogTitulo">
                <button type="button" class="ux-dialog-x" aria-label="Fechar">
                    <i class="fas fa-xmark"></i>
                </button>

                <div class="ux-dialog-icone ${perigoso ? "perigo" : ""}">
                    <i class="fas ${perigoso ? "fa-triangle-exclamation" : "fa-circle-question"}"></i>
                </div>

                <h3 id="uxDialogTitulo">${escapeHTML(titulo)}</h3>
                <p>${escapeHTML(mensagem)}</p>

                ${valorInicial !== null ? `
                    <input
                        type="text"
                        class="ux-dialog-input"
                        value="${escapeHTML(valorInicial)}"
                        maxlength="100"
                        autocomplete="off"
                    >
                ` : ""}

                <div class="ux-dialog-acoes">
                    <button type="button" class="ux-dialog-cancelar">Cancelar</button>
                    <button type="button" class="ux-dialog-confirmar ${perigoso ? "perigo" : ""}">
                        ${valorInicial !== null ? "Salvar" : "Confirmar"}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add("dialog-aberto");

        const input = overlay.querySelector(".ux-dialog-input");
        const btnConfirmar = overlay.querySelector(".ux-dialog-confirmar");

        const fechar = (resultado) => {
            document.removeEventListener("keydown", teclaEsc);
            overlay.classList.remove("visivel");
            document.body.classList.remove("dialog-aberto");
            setTimeout(() => overlay.remove(), 180);
            resolve(resultado);
        };

        overlay.querySelector(".ux-dialog-cancelar")?.addEventListener("click", () => fechar(null));
        overlay.querySelector(".ux-dialog-x")?.addEventListener("click", () => fechar(null));
        overlay.addEventListener("click", (evento) => {
            if (evento.target === overlay) fechar(null);
        });

        btnConfirmar?.addEventListener("click", () => {
            if (input) {
                const valor = input.value.trim();
                if (!valor) {
                    input.focus();
                    input.classList.add("invalido");
                    return;
                }
                fechar(valor);
            } else {
                fechar(true);
            }
        });

        input?.addEventListener("input", () => input.classList.remove("invalido"));
        input?.addEventListener("keydown", (evento) => {
            if (evento.key === "Enter") btnConfirmar?.click();
            if (evento.key === "Escape") fechar(null);
        });

        const teclaEsc = (evento) => {
            if (evento.key === "Escape") {
                document.removeEventListener("keydown", teclaEsc);
                fechar(null);
            }
        };
        document.addEventListener("keydown", teclaEsc);

        requestAnimationFrame(() => {
            overlay.classList.add("visivel");
            (input || btnConfirmar)?.focus();
            input?.select();
        });
    });
}


async function confirmarAcao(titulo, mensagem, perigoso = false) {
    return (await abrirDialogoBase({ titulo, mensagem, perigoso })) === true;
}


async function solicitarTexto(titulo, mensagem, valorInicial = "") {
    return await abrirDialogoBase({ titulo, mensagem, valorInicial, perigoso: false });
}


async function trocarAba(nomeAba, { salvar = true, carregar = true } = {}) {
    if (!ABAS_VALIDAS.has(nomeAba)) {
        nomeAba = "kanban";
    }

    if (nomeAba === "admin" && !usuarioAtual?.is_admin) {
        nomeAba = "kanban";
    }

    abaAtual = nomeAba;

    if (salvar) {
        sessionStorage.setItem(ABA_STORAGE_KEY, nomeAba);
    }

    document.querySelectorAll("[data-aba]").forEach((botao) => {
        const ativa = botao.dataset.aba === nomeAba;
        botao.classList.toggle("ativa", ativa);
        botao.setAttribute("aria-selected", String(ativa));
        botao.setAttribute("tabindex", ativa ? "0" : "-1");
    });

    document.querySelectorAll(".aba-conteudo").forEach((aba) => {
        const ativa = aba.id === `aba-${nomeAba}`;
        aba.hidden = !ativa;
        aba.classList.toggle("ativa", ativa);
    });

    if (!carregar) return;

    if (nomeAba === "kanban" && !cards.length) {
        await carregarCards();
    }

    if (nomeAba === "comunidade" && !feedCarregado) {
        await carregarPosts({ mostrarLoading: true });
        feedCarregado = true;
    }

    if (nomeAba === "membros" && !membrosCarregados) {
        await carregarDiretorioMembros();
        membrosCarregados = true;
    }

    if (nomeAba === "admin" && usuarioAtual?.is_admin && !adminCarregado) {
        await Promise.allSettled([
            carregarMembros({ mostrarLoading: true }),
            carregarBackups({ mostrarLoading: true })
        ]);
        adminCarregado = true;
    }
}


// ============================================================
// MODAIS E ABAS
// ============================================================

function inicializarModaisEAbas() {

    // --------------------------------------------------------
    // EDITAR PERFIL
    // --------------------------------------------------------

    const btnEditarPerfil =
        document.getElementById("btnEditarPerfil");

    if (btnEditarPerfil) {

        btnEditarPerfil.addEventListener(
            "click",
            () => {

                if (usuarioAtual) {

                    const inputNome =
                        document.getElementById("perfilNomeInput");

                    const inputFuncao =
                        document.getElementById("perfilFuncaoInput");

                    const inputBio =
                        document.getElementById("perfilBioInput");

                    const inputLocalizacao =
                        document.getElementById("perfilLocalizacaoInput");

                    const inputGithub =
                        document.getElementById("perfilGithubInput");

                    const inputInstagram =
                        document.getElementById("perfilInstagramInput");

                    if (inputNome) {
                        inputNome.value =
                            usuarioAtual.nome || "";
                    }

                    if (inputFuncao) {
                        inputFuncao.value =
                            usuarioAtual.funcao || "";
                    }

                    if (inputBio) {
                        inputBio.value =
                            usuarioAtual.bio || "";
                    }

                    if (inputLocalizacao) {
                        inputLocalizacao.value =
                            usuarioAtual.localizacao || "";
                    }

                    if (inputGithub) {
                        inputGithub.value =
                            usuarioAtual.github || "";
                    }

                    if (inputInstagram) {
                        inputInstagram.value =
                            usuarioAtual.instagram || "";
                    }

                    const linguagensAtuais = new Set(
                        Array.isArray(usuarioAtual.linguagens)
                            ? usuarioAtual.linguagens
                            : []
                    );

                    document
                        .querySelectorAll('#tecnologiasSeletor input[name="linguagens"]')
                        .forEach((checkbox) => {
                            checkbox.checked = linguagensAtuais.has(checkbox.value);
                        });
                }

                const modal =
                    document.getElementById(
                        "modalEditarPerfil"
                    );

                if (modal) {
                    modal.hidden = false;
                }
            }
        );
    }


    // --------------------------------------------------------
    // EDITAR CAPA
    // --------------------------------------------------------

    const btnEditarCapa =
        document.getElementById("btnEditarCapa");

    if (btnEditarCapa) {

        btnEditarCapa.addEventListener(
            "click",
            () => {

                const modal =
                    document.getElementById(
                        "modalEditarCapa"
                    );

                if (modal) {
                    modal.hidden = false;
                }
            }
        );
    }


    // --------------------------------------------------------
    // NOVO CARD
    // --------------------------------------------------------

    const abrirModalNovoCard = async () => {

        await carregarResponsaveisCards();

        const formCard =
            document.getElementById("formCard") ||
            document.getElementById("form-card");

        if (formCard) {
            formCard.reset();
        }

        // Card novo sempre começa em A Fazer.
        const cardStatus =
            document.getElementById("cardStatus");

        if (cardStatus) {
            cardStatus.value = "afazer";
        }

        const modal =
            document.getElementById("modalOverlay");

        if (modal) {
            modal.hidden = false;
        }
    };


    const btnNovoCard =
        document.getElementById("btnNovoCard");

    if (btnNovoCard) {
        btnNovoCard.addEventListener(
            "click",
            abrirModalNovoCard
        );
    }


    const btnNovoCardHeader =
        document.getElementById("btnNovoCardHeader");

    if (btnNovoCardHeader) {
        btnNovoCardHeader.addEventListener(
            "click",
            abrirModalNovoCard
        );
    }


    // --------------------------------------------------------
    // FECHAR MODAIS
    // --------------------------------------------------------

    document
        .querySelectorAll(
            "[data-modal-cancel], .modal-fechar, #modalFechar, #modalCancelar"
        )
        .forEach((botao) => {

            botao.addEventListener(
                "click",
                () => {

                    const modal =
                        botao.closest(".modal-overlay") ||
                        botao.closest(".modal") ||
                        botao.closest("[role='dialog']");

                    if (modal) {
                        modal.hidden = true;
                    }

                    // Compatibilidade com estrutura antiga
                    const ids = [
                        "modalOverlay",
                        "modalEditarPerfil",
                        "modalEditarCapa"
                    ];

                    ids.forEach((id) => {

                        const elemento =
                            document.getElementById(id);

                        if (
                            elemento &&
                            elemento.contains(botao)
                        ) {
                            elemento.hidden = true;
                        }
                    });
                }
            );
        });


    // --------------------------------------------------------
    // CANCELAR EXCLUSÃO
    // --------------------------------------------------------

    const confirmCancelar =
        document.getElementById("confirmCancelar");

    if (confirmCancelar) {

        confirmCancelar.addEventListener(
            "click",
            () => {

                const confirmOverlay =
                    document.getElementById(
                        "confirmOverlay"
                    );

                if (confirmOverlay) {
                    confirmOverlay.hidden = true;
                }

                excluindoId = null;
            }
        );
    }


    // --------------------------------------------------------
    // ABAS
    // --------------------------------------------------------

    document
        .querySelectorAll("[data-aba]")
        .forEach((botao) => {

            botao.addEventListener(
                "click",
                async (evento) => {

                    evento.preventDefault();
                    if (document.documentElement.classList.contains("dashboard-inicializando")) return;

                    const abaAlvo = botao.dataset.aba;

                    if (!abaAlvo) {
                        return;
                    }

                    await trocarAba(abaAlvo);
                }
            );
        });
}



// ============================================================
// CONQUISTAS - DASHBOARD
// ============================================================

async function carregarConquistasDashboard() {
    const grid = document.getElementById("conquistasDashboardGrid");
    const contador = document.getElementById("conquistasDashboardContador");

    if (!grid) return;

    const resposta = await chamarAPI("/api/conquistas/minhas");

    if (!resposta.ok || !resposta.dados?.success) {
        grid.innerHTML = `
            <div class="conquistas-dashboard-vazio">
                <i class="fas fa-triangle-exclamation"></i>
                Não foi possível carregar.
            </div>
        `;
        return;
    }

    const conquistas = Array.isArray(resposta.dados.conquistas)
        ? resposta.dados.conquistas
        : [];

    if (contador) {
        contador.textContent = `${conquistas.length}/9`;
    }

    if (!conquistas.length) {
        grid.innerHTML = `
            <div class="conquistas-dashboard-vazio">
                <i class="fas fa-lock"></i>
                Nenhuma conquista ainda.
            </div>
        `;
        return;
    }

    grid.innerHTML = conquistas.map((conquista) => `
        <div
            class="conquista-dashboard-selo"
            title="${escapeHTML(conquista.descricao || conquista.nome || "Conquista")}"
            aria-label="${escapeHTML(conquista.descricao || conquista.nome || "Conquista")}"
            tabindex="0"
        >
            <img
                src="${normalizarUrlImagem(conquista.icone, '')}"
                alt="Selo ${escapeHTML(conquista.nome || "Conquista")}"
            >
            <span>${escapeHTML(conquista.nome || "Conquista")}</span>
        </div>
    `).join("");
}


// ============================================================
// PERFIL
// ============================================================

async function carregarPerfil() {

    const resposta =
        await chamarAPI("/api/perfil");

    if (!resposta.ok) {
        return;
    }

    const dados = resposta.dados;

    if (!dados || typeof dados !== "object") {
        return;
    }

    usuarioAtual = dados;

    renderizarPerfil();
}


function renderizarPerfil() {

    const avatarCriadorPost =
        document.getElementById("avatarCriadorPost");

    if (avatarCriadorPost && usuarioAtual) {
        avatarCriadorPost.src = normalizarUrlImagem(usuarioAtual.foto);
    }

    if (!usuarioAtual) {
        return;
    }


    // Nome
    document
        .querySelectorAll("#perfilNome")
        .forEach((elemento) => {

            elemento.textContent =
                usuarioAtual.nome || "Membro LSD";
        });


    // Função
    document
        .querySelectorAll("#perfilFuncao")
        .forEach((elemento) => {

            elemento.textContent =
                usuarioAtual.funcao ||
                "Membro LSD";
        });


    // Avatar
    const avatars =
        document.querySelectorAll(
            ".perfil-avatar, .post-criador-avatar"
        );

    avatars.forEach((img) => {

        img.src =
            normalizarUrlImagem(
                usuarioAtual.foto
            );
    });


    // Capa
    const capa =
        document.querySelector(
            ".perfil-capa img"
        );

    if (capa) {

        capa.src =
            normalizarUrlImagem(
                usuarioAtual.capa,
                "./src/images/lab/lsd_panorama.JPG"
            );
    }


    // Pontos
    const pontosDisplay =
        document.getElementById(
            "userPontosDisplay"
        );

    if (pontosDisplay) {

        pontosDisplay.textContent =
            `${usuarioAtual.pontos || 0} pts`;
    }


    // Outros campos que podem existir no dashboard
    const bio =
        document.getElementById("perfilBio");

    if (bio) {
        bio.textContent =
            usuarioAtual.bio || "";
    }


    const localizacao =
        document.getElementById(
            "perfilLocalizacao"
        );

    if (localizacao) {
        localizacao.textContent =
            usuarioAtual.localizacao || "";
    }


    renderizarSobre();


    // Mostra a aba de Admin apenas para administradores.
    const btnAbaAdmin =
        document.getElementById(
            "btnAbaAdmin"
        );

    if (btnAbaAdmin) {

        if (usuarioAtual.is_admin) {

            btnAbaAdmin.removeAttribute(
                "style"
            );

            carregarMembros();

        } else {

            btnAbaAdmin.style.display =
                "none";
        }
    }
}


// ============================================================
// SIDEBAR "SOBRE"
// ============================================================

function renderizarSobre() {

    const lista =
        document.querySelector(
            ".sidebar-left .card-lateral .lista-info"
        );

    if (!lista || !usuarioAtual) {
        return;
    }

    const itens = [];

    if (usuarioAtual.email) {
        itens.push(
            `<li><i class="fas fa-envelope"></i> ${escapeHTML(usuarioAtual.email)}</li>`
        );
    }

    if (usuarioAtual.localizacao) {
        itens.push(
            `<li><i class="fas fa-location-dot"></i> ${escapeHTML(usuarioAtual.localizacao)}</li>`
        );
    }

    if (usuarioAtual.github) {
        itens.push(
            `<li><i class="fab fa-github"></i> ${escapeHTML(usuarioAtual.github)}</li>`
        );
    }

    if (usuarioAtual.instagram) {
        itens.push(
            `<li><i class="fab fa-instagram"></i> ${escapeHTML(usuarioAtual.instagram)}</li>`
        );
    }

    if (usuarioAtual.data_entrada) {
        itens.push(
            `<li><i class="fas fa-calendar"></i> Desde ${escapeHTML(formatarData(usuarioAtual.data_entrada))}</li>`
        );
    }

    lista.innerHTML =
        itens.length
            ? itens.join("")
            : `<li><i class="fas fa-envelope"></i> Nenhuma informação cadastrada.</li>`;
}


// ============================================================
// EVENTOS DO PERFIL
// ============================================================

function inicializarEventosPerfil() {

    // --------------------------------------------------------
    // EDITAR PERFIL
    // --------------------------------------------------------

    const formPerfil =
        document.getElementById(
            "formEditarPerfil"
        );

    if (formPerfil) {

        formPerfil.addEventListener(
            "submit",
            async (evento) => {

                evento.preventDefault();

                const formData =
                    new FormData(formPerfil);

                const resposta =
                    await chamarAPI(
                        "/api/perfil",
                        {
                            method: "PUT",
                            body: formData
                        }
                    );

                if (
                    resposta.ok &&
                    resposta.dados.success
                ) {

                    const modal =
                        document.getElementById(
                            "modalEditarPerfil"
                        );

                    if (modal) {
                        modal.hidden = true;
                    }

                    await carregarPerfil();
                    await carregarDestaques();

                    alert(
                        "Perfil atualizado com sucesso!"
                    );

                } else {

                    alert(
                        resposta.dados.message ||
                        "Erro ao salvar perfil."
                    );
                }
            }
        );
    }


    // --------------------------------------------------------
    // EDITAR CAPA
    // --------------------------------------------------------

    const formCapa =
        document.getElementById(
            "formEditarCapa"
        );

    if (formCapa) {

        formCapa.addEventListener(
            "submit",
            async (evento) => {

                evento.preventDefault();

                const formData =
                    new FormData(formCapa);

                const resposta =
                    await chamarAPI(
                        "/api/perfil",
                        {
                            method: "PUT",
                            body: formData
                        }
                    );

                if (
                    resposta.ok &&
                    resposta.dados.success
                ) {

                    const modal =
                        document.getElementById(
                            "modalEditarCapa"
                        );

                    if (modal) {
                        modal.hidden = true;
                    }

                    await carregarPerfil();

                    alert(
                        "Capa atualizada com sucesso!"
                    );

                } else {

                    alert(
                        resposta.dados.message ||
                        "Erro ao salvar capa."
                    );
                }
            }
        );
    }
}


// ============================================================
// RESPONSÁVEIS DOS CARDS
// ============================================================

async function carregarResponsaveisCards() {
    const select = document.getElementById("cardResponsavel");

    if (!select) return;

    // Sempre reconstrói a lista para remover IDs antigos/stale.
    select.innerHTML = `
        <option value="">Ninguém (Não atribuído)</option>
        <option value="logado">Assumir por mim</option>
    `;

    const resposta = await chamarAPI("/api/membros");

    if (!resposta.ok || !Array.isArray(resposta.dados)) {
        console.error("Não foi possível carregar os responsáveis:", resposta.dados);
        return;
    }

    resposta.dados.forEach((membro) => {
        if (!membro || membro.id == null) return;

        // O próprio usuário já é representado por "Assumir por mim".
        if (usuarioAtual && String(membro.id) === String(usuarioAtual.id)) return;

        const option = document.createElement("option");
        option.value = String(membro.id);
        option.textContent = membro.nome || `Membro #${membro.id}`;
        select.appendChild(option);
    });
}


// ============================================================
// KANBAN
// ============================================================

async function carregarCards() {

    const resposta =
        await chamarAPI("/api/cards");

    if (!resposta.ok) {
        return;
    }

    if (!Array.isArray(resposta.dados)) {

        console.error(
            "Resposta inválida de /api/cards:",
            resposta.dados
        );

        return;
    }

    cards = resposta.dados;

    renderizarKanban();

    // Uma conclusão de card pode liberar conquistas de pontuação.
    carregarConquistasDashboard();
}


function renderizarKanban() {

    const listas = {
        afazer:
            document.getElementById(
                "lista-afazer"
            ),

        andamento:
            document.getElementById(
                "lista-andamento"
            ),

        concluido:
            document.getElementById(
                "lista-concluido"
            )
    };


    Object.entries(listas).forEach(
        ([status, lista]) => {

            if (!lista) {
                return;
            }

            const itens =
                cards.filter(
                    (card) =>
                        card.status === status
                );


            const contador =
                document.getElementById(
                    `contador-${status}`
                );

            if (contador) {
                contador.textContent =
                    itens.length;
            }


            lista.innerHTML =
                itens.length
                    ? itens
                        .map(cardParaHTML)
                        .join("")
                    : `
                        <div class="kanban-vazio">
                            Sem tarefas.
                        </div>
                    `;
        }
    );


    renderizarProgresso();

    // IMPORTANTE:
    // Não adicionamos listeners nas listas aqui.
    // O sistema utiliza delegação de eventos.
}


// ============================================================
// HTML DOS CARDS
// ============================================================

function cardParaHTML(card) {

    const isConcluido =
        card.status === "concluido";

    let respHTML = "";


    if (card.responsavel) {

        respHTML = `
            <div class="post-it-user">

                <img
                    src="${normalizarUrlImagem(
                        card.responsavel.foto
                    )}"
                    style="
                        width:24px;
                        height:24px;
                        border-radius:50%;
                        object-fit:cover;
                    "
                    alt=""
                >

                <span>
                    ${escapeHTML(
                        card.responsavel.nome
                    )}
                </span>

            </div>
        `;

    } else {

        respHTML = `
            <button
                type="button"
                class="btn-assumir"
                data-id="${card.id}"
            >
                <i class="fas fa-user-plus"></i>
                Assumir
            </button>
        `;
    }


    return `
        <article
            class="post-it cor-${escapeHTML(
                card.cor || "amarelo"
            )}"
            draggable="${!isConcluido}"
            data-id="${card.id}"
            style="${
                isConcluido
                    ? "opacity:0.85; border:2px solid #27ae60;"
                    : ""
            }"
        >

            <div
                class="post-it-topo"
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                "
            >

                <span class="tag-prioridade">
                    ${escapeHTML(
                        card.prioridade || "Média"
                    )}
                </span>


                <div
                    style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                    "
                >

                    ${
                        isConcluido
                            ? `
                                <span
                                    style="
                                        color:#27ae60;
                                        font-weight:bold;
                                        font-size:12px;
                                    "
                                >
                                    <i class="fas fa-check-circle"></i>
                                    Concluído
                                </span>
                            `
                            : ""
                    }


                    <button
                        type="button"
                        class="post-it-excluir"
                        data-id="${card.id}"
                        title="Excluir Card"
                    >
                        <i class="fas fa-trash"></i>
                    </button>

                </div>

            </div>


            <h3>
                ${escapeHTML(card.titulo)}
            </h3>


            ${
                card.descricao
                    ? `
                        <p>
                            ${escapeHTML(
                                card.descricao
                            )}
                        </p>
                    `
                    : ""
            }


            <div
                class="post-it-rodape"
                style="margin-top:10px;"
            >
                ${respHTML}
            </div>

        </article>
    `;
}


// ============================================================
// PROGRESSO
// ============================================================

function renderizarProgresso() {

    const total =
        cards.length;

    const concluidos =
        cards.filter(
            (card) =>
                card.status === "concluido"
        ).length;

    const emAndamento =
        cards.filter(
            (card) =>
                card.status === "andamento"
        ).length;

    const pct =
        total > 0
            ? Math.round(
                (concluidos / total) * 100
            )
            : 0;


    const miniTotal =
        document.getElementById(
            "miniTotal"
        );

    if (miniTotal) {
        miniTotal.textContent =
            total;
    }


    const miniAndamento =
        document.getElementById(
            "miniAndamento"
        );

    if (miniAndamento) {
        miniAndamento.textContent =
            emAndamento;
    }


    const miniConcluido =
        document.getElementById(
            "miniConcluido"
        );

    if (miniConcluido) {
        miniConcluido.textContent =
            concluidos;
    }


    const miniBarra =
        document.getElementById(
            "miniBarra"
        );

    if (miniBarra) {
        miniBarra.style.width =
            `${pct}%`;
    }


    const miniPct =
        document.getElementById(
            "miniPct"
        );

    if (miniPct) {
        miniPct.textContent =
            pct;
    }
}


// ============================================================
// EVENTOS DO KANBAN
// ============================================================

function inicializarEventosKanban() {

    // --------------------------------------------------------
    // CRIAR CARD
    // --------------------------------------------------------

    const formCard =
        document.getElementById("formCard") ||
        document.getElementById("form-card");


    if (formCard) {

        formCard.addEventListener(
            "submit",
            async (evento) => {

                evento.preventDefault();


                const titulo =
                    document
                        .getElementById("cardTitulo")
                        ?.value
                        .trim() || "";


                const descricao =
                    document
                        .getElementById("cardDescricao")
                        ?.value
                        .trim() || "";


                const cor =
                    document
                        .getElementById("cardCor")
                        ?.value ||
                    "amarelo";


                const prioridade =
                    document
                        .getElementById("cardPrioridade")
                        ?.value ||
                    "media";


                // Respeita a coluna escolhida pelo usuário no modal
                // (bug antigo: o valor selecionado era ignorado e
                // o card sempre nascia em "A Fazer").
                const statusEscolhido =
                    document
                        .getElementById("cardStatus")
                        ?.value ||
                    "afazer";


                if (!titulo) {

                    alert(
                        "Digite um título para o card."
                    );

                    return;
                }


                if (statusEscolhido === "concluido") {

                    alert(
                        "Um card novo não pode ser criado como concluído. Escolha 'A Fazer' ou 'Em Andamento'."
                    );

                    return;
                }


                const payload = {

                    titulo,

                    descricao,

                    status: statusEscolhido,

                    cor,

                    prioridade,

                    responsavel_id: (() => {
                        const valor = document
                            .getElementById("cardResponsavel")
                            ?.value;

                        return valor ? valor : null;
                    })()
                };


                const resposta =
                    await chamarAPI(
                        "/api/cards",
                        {
                            method: "POST",
                            body: JSON.stringify(
                                payload
                            )
                        }
                    );


                if (
                    resposta.ok &&
                    resposta.dados.success
                ) {

                    const modal =
                        document.getElementById(
                            "modalOverlay"
                        );

                    if (modal) {
                        modal.hidden = true;
                    }


                    formCard.reset();


                    const cardStatus =
                        document.getElementById(
                            "cardStatus"
                        );

                    if (cardStatus) {
                        cardStatus.value =
                            "afazer";
                    }


                    await carregarCards();

                } else {

                    alert(
                        resposta.dados.message ||
                        "Erro ao criar card."
                    );
                }
            }
        );
    }


    // --------------------------------------------------------
    // DELEGAÇÃO DE EVENTOS
    // --------------------------------------------------------
    //
    // Em vez de adicionar um listener em cada card
    // toda vez que o Kanban renderiza, usamos um único
    // listener no board.
    //

    const kanbanBoard =
        document.querySelector(
            ".kanban-board"
        );


    if (kanbanBoard) {

        kanbanBoard.addEventListener(
            "click",
            async (evento) => {

                // ------------------------------
                // ASSUMIR
                // ------------------------------

                const btnAssumir =
                    evento.target.closest(
                        ".btn-assumir"
                    );


                if (btnAssumir) {

                    const id =
                        btnAssumir.dataset.id;

                    if (!id) {
                        return;
                    }


                    btnAssumir.disabled =
                        true;


                    const resposta =
                        await chamarAPI(
                            `/api/cards/${id}/assumir`,
                            {
                                method: "POST"
                            }
                        );


                    if (resposta.ok) {

                        await carregarCards();

                    } else {

                        alert(
                            resposta.dados.message ||
                            "Não foi possível assumir o card."
                        );

                        btnAssumir.disabled =
                            false;
                    }

                    return;
                }


                // ------------------------------
                // EXCLUIR
                // ------------------------------

                const btnExcluir =
                    evento.target.closest(
                        ".post-it-excluir"
                    );


                if (btnExcluir) {

                    excluindoId =
                        btnExcluir.dataset.id;


                    const confirmOverlay =
                        document.getElementById(
                            "confirmOverlay"
                        );


                    if (confirmOverlay) {

                        confirmOverlay.hidden =
                            false;
                    }

                    return;
                }
            }
        );
    }


    // --------------------------------------------------------
    // CONFIRMAR EXCLUSÃO
    // --------------------------------------------------------

    const confirmExcluir =
        document.getElementById(
            "confirmExcluir"
        );


    if (confirmExcluir) {

        confirmExcluir.addEventListener(
            "click",
            async () => {

                if (!excluindoId) {
                    return;
                }


                confirmExcluir.disabled =
                    true;


                const id =
                    excluindoId;


                const resposta =
                    await chamarAPI(
                        `/api/cards/${id}`,
                        {
                            method: "DELETE"
                        }
                    );


                confirmExcluir.disabled =
                    false;


                if (resposta.ok) {

                    const confirmOverlay =
                        document.getElementById(
                            "confirmOverlay"
                        );


                    if (confirmOverlay) {
                        confirmOverlay.hidden =
                            true;
                    }


                    excluindoId =
                        null;


                    await carregarCards();

                    await carregarPerfil();

                    await carregarDestaques();

                } else {

                    alert(
                        resposta.dados.message ||
                        "Erro ao excluir o card."
                    );
                }
            }
        );
    }


    // --------------------------------------------------------
    // DRAG AND DROP
    // --------------------------------------------------------

    inicializarDragNDrop();
}


// ============================================================
// DRAG AND DROP
// ============================================================
//
// IMPORTANTE:
// Esta função é chamada UMA ÚNICA VEZ.
//
// O erro anterior era chamar ativarDragNDrop()
// toda vez que o Kanban era renderizado.
// Isso acumulava listeners.
//

function inicializarDragNDrop() {

    const board =
        document.querySelector(
            ".kanban-board"
        );


    if (!board) {
        return;
    }


    board.addEventListener(
        "dragstart",
        (evento) => {

            const card =
                evento.target.closest(
                    ".post-it[draggable='true']"
                );


            if (!card) {
                return;
            }


            card.classList.add(
                "dragging"
            );


            evento.dataTransfer.effectAllowed =
                "move";

            evento.dataTransfer.setData(
                "text/plain",
                card.dataset.id
            );
        }
    );


    board.addEventListener(
        "dragend",
        (evento) => {

            const card =
                evento.target.closest(
                    ".post-it"
                );


            if (card) {

                card.classList.remove(
                    "dragging"
                );
            }
        }
    );


    board.addEventListener(
        "dragover",
        (evento) => {

            const lista =
                evento.target.closest(
                    ".kanban-lista"
                );


            if (!lista) {
                return;
            }


            evento.preventDefault();

            evento.dataTransfer.dropEffect =
                "move";
        }
    );


    board.addEventListener(
        "drop",
        async (evento) => {

            evento.preventDefault();


            const lista =
                evento.target.closest(
                    ".kanban-lista"
                );


            if (!lista) {
                return;
            }


            const id =
                evento.dataTransfer.getData(
                    "text/plain"
                );


            if (!id) {
                return;
            }


            const novoStatus =
                lista.dataset.status;


            if (!novoStatus) {
                return;
            }


            const card =
                cards.find(
                    (item) =>
                        String(item.id) ===
                        String(id)
                );


            if (!card) {
                return;
            }


            // ------------------------------------------------
            // CONCLUÍDO É DEFINITIVO
            // ------------------------------------------------

            if (
                card.status ===
                "concluido"
            ) {

                alert(
                    "Cards concluídos não podem ser movimentados."
                );

                return;
            }


            // ------------------------------------------------
            // A FAZER -> CONCLUÍDO
            // ------------------------------------------------

            if (
                card.status === "afazer" &&
                novoStatus === "concluido"
            ) {

                alert(
                    "Passe o card para 'Em Andamento' antes de concluí-lo."
                );

                return;
            }


            // ------------------------------------------------
            // EM ANDAMENTO -> A FAZER
            // ------------------------------------------------

            if (
                card.status === "andamento" &&
                novoStatus === "afazer"
            ) {

                alert(
                    "Um card em andamento não pode voltar para 'A Fazer'."
                );

                return;
            }


            // Não faz requisição se soltou na mesma coluna.
            if (
                card.status === novoStatus
            ) {

                return;
            }


            const resposta =
                await chamarAPI(
                    `/api/cards/${id}`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            status: novoStatus
                        })
                    }
                );


            if (resposta.ok) {

                await carregarCards();

                await carregarPerfil();

                await carregarDestaques();

            } else {

                alert(
                    resposta.dados.message ||
                    "Movimentação não permitida."
                );
            }
        }
    );
}


// ============================================================
// FEED
// ============================================================

async function carregarPosts({ mostrarLoading = false } = {}) {
    const container = document.getElementById("feedLista");

    if (!container) return;

    if (mostrarLoading && !posts.length) {
        container.innerHTML = `
            <div class="feed-vazio feed-loading">
                <i class="fas fa-circle-notch fa-spin"></i>
                <span>Carregando publicações...</span>
            </div>
        `;
    }

    const resposta = await chamarAPI("/api/posts");

    if (!resposta.ok) {
        if (!posts.length) {
            container.innerHTML = `
                <div class="feed-vazio">
                    <i class="fas fa-wifi"></i>
                    <span>Não foi possível carregar o feed.</span>
                    <button type="button" class="btn-tentar-novamente-feed">Tentar novamente</button>
                </div>
            `;
        } else {
            mostrarToast(
                resposta.dados?.message || "Não foi possível atualizar o feed.",
                "erro"
            );
        }
        return;
    }

    if (!Array.isArray(resposta.dados)) {
        console.error("Resposta inválida de /api/posts:", resposta.dados);
        return;
    }

    posts = resposta.dados;
    renderizarPosts(posts);
}


function iconeArquivo(nome = "") {
    const ext = nome.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "fa-file-pdf";
    if (["doc", "docx"].includes(ext)) return "fa-file-word";
    if (["xls", "xlsx", "csv"].includes(ext)) return "fa-file-excel";
    if (["zip", "rar", "7z"].includes(ext)) return "fa-file-zipper";
    if (["txt", "md", "json"].includes(ext)) return "fa-file-lines";
    return "fa-file";
}


function comentarioParaHTML(comentario) {
    const podeExcluir =
        usuarioAtual &&
        (
            String(comentario.autor?.id) === String(usuarioAtual.id) ||
            usuarioAtual.is_admin
        );

    return `
        <div class="comentario-item" data-comentario-id="${comentario.id}">
            <img
                src="${normalizarUrlImagem(comentario.autor?.foto)}"
                alt="${escapeHTML(comentario.autor?.nome || "Membro")}" 
            >

            <div class="comentario-corpo">
                <div class="comentario-balao">
                    <div class="comentario-topo">
                        <strong>${escapeHTML(comentario.autor?.nome || "Membro LSD")}</strong>

                        ${podeExcluir ? `
                            <button
                                type="button"
                                class="btn-excluir-comentario"
                                data-comentario-id="${comentario.id}"
                                title="Excluir comentário"
                                aria-label="Excluir comentário"
                            >
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ""}
                    </div>

                    <p>${escapeHTML(comentario.conteudo || "")}</p>
                </div>

                <span class="comentario-data">
                    ${escapeHTML(formatarData(comentario.data_criacao))}
                </span>
            </div>
        </div>
    `;
}


function renderizarComentarios(post) {
    const comentarios = Array.isArray(post.comentarios) ? post.comentarios : [];
    const itens = comentarios.map(comentarioParaHTML).join("");

    return `
        <div class="comentarios-area" data-post-id="${post.id}">
            <div class="comentarios-lista">
                ${itens}
            </div>

            <form class="form-comentario" data-post-id="${post.id}">
                <img
                    src="${normalizarUrlImagem(usuarioAtual?.foto)}"
                    alt="Você"
                >
                <input
                    type="text"
                    name="conteudo"
                    maxlength="1000"
                    autocomplete="off"
                    placeholder="Escreva um comentário..."
                    aria-label="Escreva um comentário"
                    required
                >
                <button type="submit" title="Comentar" aria-label="Enviar comentário">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </form>
        </div>
    `;
}


function postParaHTML(post) {
    const podeExcluir =
        usuarioAtual &&
        (
            String(post.autor?.id) === String(usuarioAtual.id) ||
            usuarioAtual.is_admin
        );

    const imagem = post.midia_url
        ? `
            <img
                class="post-imagem"
                src="${normalizarUrlImagem(post.midia_url)}"
                alt="Imagem da publicação"
                loading="lazy"
            >
        `
        : "";

    const arquivo = post.arquivo_url
        ? `
            <a
                class="post-arquivo"
                href="${normalizarUrlImagem(post.arquivo_url)}"
                target="_blank"
                rel="noopener noreferrer"
                download
            >
                <i class="fas ${iconeArquivo(post.arquivo_nome)}"></i>
                <span>
                    <strong>${escapeHTML(post.arquivo_nome || "Arquivo")}</strong>
                    <small>Abrir ou baixar anexo</small>
                </span>
                <i class="fas fa-arrow-up-right-from-square"></i>
            </a>
        `
        : "";

    const codigo = post.codigo_snippet
        ? `
            <div class="post-codigo">
                <div class="post-codigo-topo">
                    <span>${escapeHTML(post.codigo_linguagem || "texto")}</span>
                    <button
                        type="button"
                        class="btn-copiar-codigo"
                        data-post-id="${post.id}"
                    >
                        <i class="far fa-copy"></i> Copiar
                    </button>
                </div>
                <pre><code>${escapeHTML(post.codigo_snippet)}</code></pre>
            </div>
        `
        : "";

    return `
        <article class="post-card" data-post-id="${post.id}">
            <div class="post-card-topo">
                <img
                    src="${normalizarUrlImagem(post.autor?.foto)}"
                    alt="${escapeHTML(post.autor?.nome || "Membro")}" 
                >

                <div class="post-identidade">
                    <strong class="post-card-autor">
                        ${escapeHTML(post.autor?.nome || "Membro LSD")}
                    </strong>
                    <span class="post-card-meta">
                        ${escapeHTML(post.autor?.funcao || "Membro LSD")} ·
                        ${escapeHTML(formatarData(post.data_criacao))}
                    </span>
                </div>

                ${podeExcluir ? `
                    <button
                        type="button"
                        class="btn-excluir-post"
                        data-post-id="${post.id}"
                        title="Excluir publicação"
                        aria-label="Excluir publicação"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ""}
            </div>

            ${post.conteudo ? `
                <p class="post-card-texto">
                    ${escapeHTML(post.conteudo)}
                </p>
            ` : ""}

            ${imagem}
            ${arquivo}
            ${codigo}

            <div class="post-card-acoes">
                <button
                    type="button"
                    class="btn-curtir-post ${post.curtido_por_mim ? "curtido" : ""}"
                    data-post-id="${post.id}"
                    aria-pressed="${post.curtido_por_mim ? "true" : "false"}"
                >
                    <i class="${post.curtido_por_mim ? "fas" : "far"} fa-heart"></i>
                    <span class="contador-curtidas">${post.total_curtidas || 0}</span>
                    Curtir
                </button>

                <button
                    type="button"
                    class="btn-focar-comentario"
                    data-post-id="${post.id}"
                >
                    <i class="far fa-comment"></i>
                    <span class="contador-comentarios">${post.total_comentarios || 0}</span>
                    Comentar
                </button>
            </div>

            ${renderizarComentarios(post)}
        </article>
    `;
}


function renderizarPosts(listaPosts) {
    const container = document.getElementById("feedLista");

    if (!container) return;

    if (!listaPosts.length) {
        container.innerHTML = `
            <div class="feed-vazio">
                <i class="far fa-comments"></i>
                <span>Nenhuma publicação ainda. Seja o primeiro a publicar!</span>
            </div>
        `;
        return;
    }

    container.innerHTML = listaPosts.map(postParaHTML).join("");
}


function atualizarCurtidaNaTela(botao, curtido, total) {
    botao.classList.toggle("curtido", curtido);
    botao.setAttribute("aria-pressed", String(curtido));

    const icone = botao.querySelector("i");
    if (icone) {
        icone.classList.toggle("fas", curtido);
        icone.classList.toggle("far", !curtido);
    }

    const contador = botao.querySelector(".contador-curtidas");
    if (contador) contador.textContent = total;
}


function removerElementoComAnimacao(elemento, callback = null) {
    if (!elemento) {
        callback?.();
        return;
    }

    elemento.classList.add("removendo");
    setTimeout(() => {
        elemento.remove();
        callback?.();
    }, 190);
}


function inicializarEventosFeed() {
    const formPost = document.getElementById("formPost");
    const btnAnexarFoto = document.getElementById("btnAnexarFoto");
    const inputFotoPost = document.getElementById("inputFotoPost");
    const btnAdicionarCodigo = document.getElementById("btnAdicionarCodigo");
    const painelCodigoPost = document.getElementById("painelCodigoPost");
    const arquivoSelecionado = document.getElementById("arquivoSelecionadoPost");
    const feedLista = document.getElementById("feedLista");

    if (btnAnexarFoto && inputFotoPost) {
        btnAnexarFoto.addEventListener("click", () => inputFotoPost.click());

        inputFotoPost.addEventListener("change", () => {
            const arquivo = inputFotoPost.files?.[0];
            if (!arquivoSelecionado) return;

            if (!arquivo) {
                arquivoSelecionado.hidden = true;
                arquivoSelecionado.innerHTML = "";
                return;
            }

            arquivoSelecionado.hidden = false;
            arquivoSelecionado.innerHTML = `
                <i class="fas fa-paperclip"></i>
                <span>${escapeHTML(arquivo.name)}</span>
                <small>${(arquivo.size / 1024 / 1024).toFixed(2)} MB</small>
                <button type="button" id="removerArquivoPost" title="Remover" aria-label="Remover arquivo">
                    <i class="fas fa-xmark"></i>
                </button>
            `;

            document.getElementById("removerArquivoPost")?.addEventListener("click", () => {
                inputFotoPost.value = "";
                arquivoSelecionado.hidden = true;
                arquivoSelecionado.innerHTML = "";
            });
        });
    }

    if (btnAdicionarCodigo && painelCodigoPost) {
        btnAdicionarCodigo.addEventListener("click", () => {
            painelCodigoPost.hidden = !painelCodigoPost.hidden;
            btnAdicionarCodigo.classList.toggle("ativo", !painelCodigoPost.hidden);

            if (!painelCodigoPost.hidden) {
                document.getElementById("codigoSnippetPost")?.focus();
            }
        });
    }

    if (formPost) {
        formPost.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            const formData = new FormData(formPost);
            const conteudo = (formData.get("conteudo") || "").toString().trim();
            const codigo = (formData.get("codigo_snippet") || "").toString().trim();
            const arquivo = formData.get("arquivo");
            const possuiArquivo = arquivo instanceof File && arquivo.size > 0;

            if (!conteudo && !codigo && !possuiArquivo) {
                mostrarToast("Escreva algo, adicione um código ou selecione um arquivo.", "aviso");
                document.getElementById("novoPostTexto")?.focus();
                return;
            }

            if (possuiArquivo && arquivo.size > 16 * 1024 * 1024) {
                mostrarToast("O arquivo pode ter no máximo 16 MB.", "erro");
                return;
            }

            const botaoSubmit = formPost.querySelector("[type='submit']");
            const textoOriginal = botaoSubmit?.innerHTML || "Publicar";

            if (botaoSubmit) {
                botaoSubmit.disabled = true;
                botaoSubmit.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Publicando...`;
            }

            const resposta = await chamarAPI("/api/posts", {
                method: "POST",
                body: formData
            });

            if (botaoSubmit) {
                botaoSubmit.disabled = false;
                botaoSubmit.innerHTML = textoOriginal;
            }

            if (resposta.ok && resposta.dados.success) {
                const novoPost = resposta.dados.post;

                formPost.reset();
                btnAdicionarCodigo?.classList.remove("ativo");

                if (painelCodigoPost) painelCodigoPost.hidden = true;
                if (arquivoSelecionado) {
                    arquivoSelecionado.hidden = true;
                    arquivoSelecionado.innerHTML = "";
                }

                if (novoPost) {
                    posts.unshift(novoPost);

                    const container = document.getElementById("feedLista");
                    if (container) {
                        container.querySelector(".feed-vazio")?.remove();
                        container.insertAdjacentHTML("afterbegin", postParaHTML(novoPost));
                        container.querySelector(".post-card")?.classList.add("post-novo");
                    }
                } else {
                    await carregarPosts();
                }

                mostrarToast("Publicação criada com sucesso.", "sucesso");
            } else {
                mostrarToast(
                    resposta.dados.message || "Erro ao publicar no feed.",
                    "erro"
                );
            }
        });
    }

    if (!feedLista) return;

    feedLista.addEventListener("click", async (evento) => {
        const btnTentar = evento.target.closest(".btn-tentar-novamente-feed");
        const btnCurtir = evento.target.closest(".btn-curtir-post");
        const btnFocar = evento.target.closest(".btn-focar-comentario");
        const btnExcluir = evento.target.closest(".btn-excluir-post");
        const btnExcluirComentario = evento.target.closest(".btn-excluir-comentario");
        const btnCopiar = evento.target.closest(".btn-copiar-codigo");

        if (btnTentar) {
            await carregarPosts({ mostrarLoading: true });
            return;
        }

        if (btnCurtir) {
            const id = btnCurtir.dataset.postId;
            if (!id || btnCurtir.disabled) return;

            btnCurtir.disabled = true;
            const resposta = await chamarAPI(`/api/posts/${id}/curtir`, { method: "POST" });
            btnCurtir.disabled = false;

            if (!resposta.ok) {
                mostrarToast(resposta.dados.message || "Não foi possível atualizar a curtida.", "erro");
                return;
            }

            const curtido = Boolean(resposta.dados.curtido);
            const total = Number(resposta.dados.total_curtidas) || 0;
            atualizarCurtidaNaTela(btnCurtir, curtido, total);

            const postCache = posts.find((p) => String(p.id) === String(id));
            if (postCache) {
                postCache.curtido_por_mim = curtido;
                postCache.total_curtidas = total;
            }
            return;
        }

        if (btnFocar) {
            const post = btnFocar.closest(".post-card");
            const input = post?.querySelector(".form-comentario input");
            input?.focus({ preventScroll: true });
            input?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            return;
        }

        if (btnExcluir) {
            const id = btnExcluir.dataset.postId;
            const confirmado = await confirmarAcao(
                "Excluir publicação",
                "Tem certeza que deseja excluir esta publicação? Essa ação não pode ser desfeita.",
                true
            );

            if (!confirmado) return;

            const elemento = btnExcluir.closest(".post-card");
            btnExcluir.disabled = true;

            const resposta = await chamarAPI(`/api/posts/${id}`, { method: "DELETE" });

            if (!resposta.ok) {
                btnExcluir.disabled = false;
                mostrarToast(resposta.dados.message || "Não foi possível excluir a publicação.", "erro");
                return;
            }

            posts = posts.filter((post) => String(post.id) !== String(id));
            removerElementoComAnimacao(elemento, () => {
                if (!feedLista.querySelector(".post-card")) {
                    renderizarPosts([]);
                }
            });
            mostrarToast("Publicação excluída.", "sucesso");
            return;
        }

        if (btnExcluirComentario) {
            const id = btnExcluirComentario.dataset.comentarioId;
            const comentarioElemento = btnExcluirComentario.closest(".comentario-item");
            const postElemento = btnExcluirComentario.closest(".post-card");
            const postId = postElemento?.dataset.postId;

            btnExcluirComentario.disabled = true;
            const resposta = await chamarAPI(`/api/comentarios/${id}`, { method: "DELETE" });

            if (!resposta.ok) {
                btnExcluirComentario.disabled = false;
                mostrarToast(resposta.dados.message || "Não foi possível excluir o comentário.", "erro");
                return;
            }

            removerElementoComAnimacao(comentarioElemento);

            const contador = postElemento?.querySelector(".contador-comentarios");
            if (contador) {
                contador.textContent = Math.max(0, (Number(contador.textContent) || 0) - 1);
            }

            const postCache = posts.find((p) => String(p.id) === String(postId));
            if (postCache && Array.isArray(postCache.comentarios)) {
                postCache.comentarios = postCache.comentarios.filter(
                    (comentario) => String(comentario.id) !== String(id)
                );
                postCache.total_comentarios = postCache.comentarios.length;
            }
            return;
        }

        if (btnCopiar) {
            const post = btnCopiar.closest(".post-card");
            const codigo = post?.querySelector(".post-codigo code")?.textContent || "";

            try {
                await navigator.clipboard.writeText(codigo);
                const original = btnCopiar.innerHTML;
                btnCopiar.innerHTML = `<i class="fas fa-check"></i> Copiado`;
                btnCopiar.classList.add("copiado");
                setTimeout(() => {
                    btnCopiar.innerHTML = original;
                    btnCopiar.classList.remove("copiado");
                }, 1300);
            } catch {
                mostrarToast("Não foi possível copiar o código.", "erro");
            }
            return;
        }
    });

    feedLista.addEventListener("submit", async (evento) => {
        const form = evento.target.closest(".form-comentario");
        if (!form) return;

        evento.preventDefault();

        const input = form.querySelector("input[name='conteudo']");
        const conteudo = input?.value.trim() || "";
        const postId = form.dataset.postId;

        if (!conteudo) return;

        const botao = form.querySelector("[type='submit']");
        if (botao) botao.disabled = true;
        if (input) input.disabled = true;

        const resposta = await chamarAPI(`/api/posts/${postId}/comentarios`, {
            method: "POST",
            body: JSON.stringify({ conteudo })
        });

        if (botao) botao.disabled = false;
        if (input) input.disabled = false;

        if (!resposta.ok) {
            mostrarToast(resposta.dados.message || "Não foi possível comentar.", "erro");
            input?.focus();
            return;
        }

        const comentario = resposta.dados.comentario;
        if (!comentario) {
            await carregarPosts();
            return;
        }

        if (input) {
            input.value = "";
            input.focus({ preventScroll: true });
        }

        const postElemento = form.closest(".post-card");
        const lista = postElemento?.querySelector(".comentarios-lista");
        lista?.insertAdjacentHTML("beforeend", comentarioParaHTML(comentario));

        const novoComentario = lista?.lastElementChild;
        novoComentario?.classList.add("comentario-novo");

        const contador = postElemento?.querySelector(".contador-comentarios");
        if (contador) {
            contador.textContent = (Number(contador.textContent) || 0) + 1;
        }

        const postCache = posts.find((p) => String(p.id) === String(postId));
        if (postCache) {
            if (!Array.isArray(postCache.comentarios)) postCache.comentarios = [];
            postCache.comentarios.push(comentario);
            postCache.total_comentarios = postCache.comentarios.length;
        }

        // O 30º comentário pode liberar "Comentarista".
        carregarConquistasDashboard();
    });
}


// ============================================================
// DESTAQUES / TOP 5
// ============================================================

async function carregarDestaques() {

    const container =
        document.getElementById(
            "listaMembrosDestaque"
        );


    if (!container) {
        return;
    }


    const resposta =
        await chamarAPI(
            "/api/membros/destaque"
        );


    if (!resposta.ok) {
        return;
    }


    if (
        !Array.isArray(
            resposta.dados
        )
    ) {

        console.error(
            "Resposta inválida do ranking:",
            resposta.dados
        );

        return;
    }


    container.innerHTML =
        resposta.dados
            .map(
                (membro, indice) => `

                    <li
                        data-destaque-perfil="${membro.id}"
                        class="membro-destaque-clicavel"
                        style="
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            margin-bottom:10px;
                        "
                    >

                        <div
                            style="
                                display:flex;
                                align-items:center;
                                gap:8px;
                            "
                        >

                            <small>
                                #${indice + 1}
                            </small>


                            <img
                                src="${normalizarUrlImagem(
                                    membro.foto
                                )}"
                                style="
                                    width:30px;
                                    height:30px;
                                    border-radius:50%;
                                    object-fit:cover;
                                "
                                alt=""
                            >


                            <span>
                                ${escapeHTML(
                                    membro.nome
                                )}
                            </span>

                        </div>


                        <strong>
                            ${membro.pontos || 0} pts
                        </strong>

                    </li>
                `
            )
            .join("");
}


// ============================================================
// DIRETÓRIO E PERFIL PÚBLICO DOS MEMBROS
// ============================================================

const TECNOLOGIA_ICONS = {
    "JavaScript": "fab fa-js",
    "TypeScript": "fas fa-code",
    "HTML": "fab fa-html5",
    "CSS": "fab fa-css3-alt",
    "Python": "fab fa-python",
    "Java": "fab fa-java",
    "C": "fas fa-c",
    "C++": "fas fa-code",
    "C#": "fas fa-code",
    "PHP": "fab fa-php",
    "SQL": "fas fa-database",
    "MySQL": "fas fa-database",
    "Git": "fab fa-git-alt",
    "Docker": "fab fa-docker",
    "Godot": "fas fa-gamepad"
};


function tecnologiaParaHTML(nome) {
    const icone = TECNOLOGIA_ICONS[nome] || "fas fa-code";
    return `
        <span class="tecnologia-chip" title="${escapeHTML(nome)}">
            <i class="${icone}"></i>
            <span>${escapeHTML(nome)}</span>
        </span>
    `;
}


async function carregarDiretorioMembros({ silencioso = false } = {}) {
    const grid = document.getElementById("membrosGrid");
    if (!grid) return;

    if (!silencioso) {
        grid.innerHTML = `
            <div class="membros-loading">
                <i class="fas fa-circle-notch fa-spin"></i> Carregando membros...
            </div>
        `;
    }

    const resposta = await chamarAPI("/api/membros");

    if (!resposta.ok || !Array.isArray(resposta.dados)) {
        grid.innerHTML = `
            <div class="membros-estado-vazio">
                <i class="fas fa-triangle-exclamation"></i>
                Não foi possível carregar os membros.
            </div>
        `;
        return;
    }

    membrosDiretorio = resposta.dados;
    renderizarDiretorioMembros();
}


function renderizarDiretorioMembros(filtro = "") {
    const grid = document.getElementById("membrosGrid");
    if (!grid) return;

    const termo = String(filtro || "").trim().toLowerCase();
    const lista = membrosDiretorio.filter((membro) => {
        if (!termo) return true;
        const texto = [
            membro.nome,
            membro.funcao,
            ...(Array.isArray(membro.linguagens) ? membro.linguagens : [])
        ].join(" ").toLowerCase();
        return texto.includes(termo);
    });

    if (!lista.length) {
        grid.innerHTML = `
            <div class="membros-estado-vazio">
                <i class="fas fa-user-slash"></i>
                Nenhum membro encontrado.
            </div>
        `;
        return;
    }

    grid.innerHTML = lista.map((membro) => {
        const linguagens = Array.isArray(membro.linguagens)
            ? membro.linguagens.slice(0, 5)
            : [];

        return `
            <article class="membro-card-publico" data-membro-id="${membro.id}">
                <div class="membro-card-capa">
                    <img src="${normalizarUrlImagem(membro.capa, './src/images/lab/lsd_panorama.JPG')}" alt="">
                </div>
                <div class="membro-card-corpo">
                    <img class="membro-card-avatar" src="${normalizarUrlImagem(membro.foto)}" alt="Foto de ${escapeHTML(membro.nome || 'Membro')}">
                    <div class="membro-card-identidade">
                        <h3>
                            ${escapeHTML(membro.nome || "Membro LSD")}
                            ${membro.is_admin ? '<span class="selo-admin"><i class="fas fa-shield-halved"></i> Admin</span>' : ''}
                        </h3>
                        <p>${escapeHTML(membro.funcao || "Membro LSD")}</p>
                    </div>
                    <div class="membro-card-techs">
                        ${linguagens.length
                            ? linguagens.map(tecnologiaParaHTML).join("")
                            : '<span class="tecnologia-vazia">Tecnologias não informadas</span>'}
                    </div>
                    <button type="button" class="btn-ver-perfil" data-ver-perfil="${membro.id}">
                        Ver perfil <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </article>
        `;
    }).join("");
}


function statusCardLabel(status) {
    const mapa = {
        afazer: "A fazer",
        andamento: "Em andamento",
        concluido: "Concluído"
    };
    return mapa[status] || status || "Card";
}


async function abrirPerfilMembro(userId) {
    const diretorio = document.getElementById("membrosDiretorioView");
    const perfil = document.getElementById("membroPerfilView");
    const conteudo = document.getElementById("membroPerfilConteudo");

    if (!diretorio || !perfil || !conteudo) return;

    perfilMembroAbertoId = userId;
    diretorio.hidden = true;
    perfil.hidden = false;
    conteudo.innerHTML = `
        <div class="perfil-publico-loading">
            <i class="fas fa-circle-notch fa-spin"></i> Carregando perfil...
        </div>
    `;

    const resposta = await chamarAPI(`/api/membros/${userId}/perfil`);

    if (!resposta.ok || !resposta.dados?.success) {
        conteudo.innerHTML = `
            <div class="membros-estado-vazio">
                <i class="fas fa-triangle-exclamation"></i>
                ${escapeHTML(resposta.dados?.message || "Não foi possível carregar o perfil.")}
            </div>
        `;
        return;
    }

    renderizarPerfilPublico(resposta.dados);
    perfil.scrollIntoView({ behavior: "smooth", block: "start" });
}


function renderizarPerfilPublico(dados) {
    const conteudo = document.getElementById("membroPerfilConteudo");
    if (!conteudo) return;

    const membro = dados.membro || {};
    const cardsMembro = Array.isArray(dados.cards) ? dados.cards : [];
    const conquistas = Array.isArray(dados.conquistas) ? dados.conquistas : [];
    const projetos = Array.isArray(dados.projetos) ? dados.projetos : [];
    const linguagens = Array.isArray(membro.linguagens) ? membro.linguagens : [];

    const githubUrl = normalizarUrlExterna(membro.github);
    const instagramUrl = normalizarUrlExterna(membro.instagram);

    const informacoes = [];
    if (membro.email) {
        informacoes.push(`<li><i class="fas fa-envelope"></i><span>${escapeHTML(membro.email)}</span></li>`);
    }
    if (membro.localizacao) {
        informacoes.push(`<li><i class="fas fa-location-dot"></i><span>${escapeHTML(membro.localizacao)}</span></li>`);
    }
    if (githubUrl) {
        informacoes.push(`<li><i class="fab fa-github"></i><a href="${escapeHTML(githubUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(membro.github)}</a></li>`);
    }
    if (instagramUrl) {
        informacoes.push(`<li><i class="fab fa-instagram"></i><a href="${escapeHTML(instagramUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(membro.instagram)}</a></li>`);
    }
    if (membro.data_entrada) {
        informacoes.push(`<li><i class="fas fa-calendar-days"></i><span>Membro desde ${escapeHTML(String(membro.data_entrada))}</span></li>`);
    }

    const cardsHtml = cardsMembro.length
        ? cardsMembro.map((card) => `
            <article class="perfil-card-kanban cor-${escapeHTML(card.cor || 'amarelo')}">
                <div class="perfil-card-kanban-topo">
                    <span class="perfil-card-status status-${escapeHTML(card.status || 'afazer')}">
                        ${escapeHTML(statusCardLabel(card.status))}
                    </span>
                    <span class="perfil-card-prioridade">${escapeHTML(card.prioridade || 'média')}</span>
                </div>
                <h4>${escapeHTML(card.titulo || "Card")}</h4>
                ${card.descricao ? `<p>${escapeHTML(card.descricao)}</p>` : ''}
            </article>
        `).join("")
        : `<div class="perfil-secao-vazia"><i class="fas fa-table-columns"></i> Este membro ainda não assumiu nenhum card.</div>`;

    const conquistasHtml = conquistas.length
        ? conquistas.map((conquista) => `
            <article
                class="conquista-item"
                title="${escapeHTML(conquista.descricao || conquista.nome)}"
                aria-label="${escapeHTML(conquista.descricao || conquista.nome)}"
                tabindex="0"
            >
                <div class="conquista-icone">
                    ${conquista.icone
                        ? `<img src="${normalizarUrlImagem(conquista.icone, '')}" alt="Selo ${escapeHTML(conquista.nome || "Conquista")}">`
                        : '<i class="fas fa-trophy"></i>'}
                </div>
                <strong>${escapeHTML(conquista.nome || "Conquista")}</strong>
            </article>
        `).join("")
        : `
            <div class="perfil-secao-vazia conquista-placeholder">
                <i class="fas fa-medal"></i>
                <div>
                    <strong>Nenhuma conquista desbloqueada ainda</strong>
                    <span>Complete os requisitos do LSD para desbloquear seus primeiros selos.</span>
                </div>
            </div>
        `;

    const projetosHtml = projetos.length
        ? projetos.map((projeto) => `<div class="projeto-item">${escapeHTML(projeto.nome || "Projeto")}</div>`).join("")
        : `
            <div class="perfil-secao-vazia">
                <i class="fas fa-diagram-project"></i>
                A área de projetos está reservada para a próxima etapa.
            </div>
        `;

    conteudo.innerHTML = `
        <article class="perfil-publico">
            <div class="perfil-publico-capa">
                <img src="${normalizarUrlImagem(membro.capa, './src/images/lab/lsd_panorama.JPG')}" alt="Capa de ${escapeHTML(membro.nome || 'membro')}">
                <div class="perfil-publico-capa-sombra"></div>
            </div>

            <div class="perfil-publico-layout">
                <aside class="perfil-publico-sidebar">
                    <img class="perfil-publico-avatar" src="${normalizarUrlImagem(membro.foto)}" alt="Foto de ${escapeHTML(membro.nome || 'Membro')}">
                    <div class="perfil-publico-identidade">
                        <div class="perfil-publico-nome-linha">
                            <h2>${escapeHTML(membro.nome || "Membro LSD")}</h2>
                            ${membro.is_admin ? '<span class="selo-admin selo-admin-grande"><i class="fas fa-shield-halved"></i> Administrador</span>' : ''}
                        </div>
                        <p class="perfil-publico-funcao">${escapeHTML(membro.funcao || "Membro LSD")}</p>
                        ${membro.bio ? `<p class="perfil-publico-bio">${escapeHTML(membro.bio)}</p>` : '<p class="perfil-publico-bio perfil-sem-bio">Bio não informada.</p>'}
                    </div>

                    <ul class="perfil-publico-info">
                        ${informacoes.length ? informacoes.join("") : '<li><i class="fas fa-circle-info"></i><span>Informações não cadastradas.</span></li>'}
                    </ul>

                    <div class="perfil-publico-pontos">
                        <i class="fas fa-star"></i>
                        <strong>${Number(membro.pontos || 0)}</strong>
                        <span>pontos</span>
                    </div>
                </aside>

                <div class="perfil-publico-conteudo">
                    <section class="perfil-publico-secao">
                        <div class="perfil-secao-titulo">
                            <div>
                                <span>STACK</span>
                                <h3>Linguagens e tecnologias</h3>
                            </div>
                        </div>
                        <div class="perfil-tecnologias">
                            ${linguagens.length
                                ? linguagens.map(tecnologiaParaHTML).join("")
                                : '<div class="perfil-secao-vazia"><i class="fas fa-code"></i> Nenhuma tecnologia informada.</div>'}
                        </div>
                    </section>

                    <section class="perfil-publico-secao">
                        <div class="perfil-secao-titulo">
                            <div>
                                <span>KANBAN</span>
                                <h3>Cards assumidos</h3>
                            </div>
                            <strong>${cardsMembro.length}</strong>
                        </div>
                        <div class="perfil-cards-grid">${cardsHtml}</div>
                    </section>

                    <section class="perfil-publico-secao">
                        <div class="perfil-secao-titulo">
                            <div>
                                <span>ACHIEVEMENTS</span>
                                <h3>Conquistas</h3>
                            </div>
                            <strong>${conquistas.length}</strong>
                        </div>
                        <div class="conquistas-grid">${conquistasHtml}</div>
                    </section>

                    <section class="perfil-publico-secao">
                        <div class="perfil-secao-titulo">
                            <div>
                                <span>PROJETOS</span>
                                <h3>Projetos</h3>
                            </div>
                        </div>
                        <div class="projetos-grid">${projetosHtml}</div>
                    </section>
                </div>
            </div>
        </article>
    `;
}


function inicializarEventosMembros() {
    const grid = document.getElementById("membrosGrid");
    const busca = document.getElementById("buscaMembros");
    const voltar = document.getElementById("btnVoltarMembros");

    grid?.addEventListener("click", async (evento) => {
        const botao = evento.target.closest("[data-ver-perfil]");
        if (!botao) return;
        await abrirPerfilMembro(botao.dataset.verPerfil);
    });

    busca?.addEventListener("input", () => {
        renderizarDiretorioMembros(busca.value);
    });

    voltar?.addEventListener("click", () => {
        perfilMembroAbertoId = null;
        const diretorio = document.getElementById("membrosDiretorioView");
        const perfil = document.getElementById("membroPerfilView");
        if (diretorio) diretorio.hidden = false;
        if (perfil) perfil.hidden = true;
    });

    document.getElementById("listaMembrosDestaque")?.addEventListener("click", async (evento) => {
        const alvo = evento.target.closest("[data-destaque-perfil]");
        if (!alvo) return;
        await trocarAba("membros");
        await abrirPerfilMembro(alvo.dataset.destaquePerfil);
    });
}


// ============================================================
// ADVERTÊNCIAS DO MEMBRO
// ============================================================

async function carregarAdvertencias({ silencioso = false } = {}) {
    const card = document.getElementById("advertenciasCard");
    const lista = document.getElementById("advertenciasLista");

    if (!card || !lista) return;

    if (!silencioso && !advertencias.length) {
        lista.innerHTML = `
            <div class="advertencias-loading">
                <i class="fas fa-circle-notch fa-spin"></i>
                Verificando comunicados...
            </div>
        `;
    }

    const resposta = await chamarAPI("/api/advertencias");

    if (!resposta.ok) {
        if (!silencioso && !advertencias.length) {
            card.hidden = false;
            lista.innerHTML = `
                <div class="advertencias-erro">
                    Não foi possível carregar suas advertências agora.
                </div>
            `;
        }
        return;
    }

    const recebidas = Array.isArray(resposta.dados?.advertencias)
        ? resposta.dados.advertencias
        : [];

    const haviaNaoLidas = advertencias.filter((item) => !item.lida).length;
    const agoraNaoLidas = recebidas.filter((item) => !item.lida).length;

    advertencias = recebidas;
    renderizarAdvertencias();

    if (silencioso && agoraNaoLidas > haviaNaoLidas) {
        mostrarToast(
            "Você recebeu uma nova advertência da administração.",
            "aviso",
            5000
        );
    }
}


function advertenciaParaHTML(advertencia) {
    const naoLida = !advertencia.lida;
    const adminNome = advertencia.admin?.nome || "Administração LSD";

    return `
        <article
            class="advertencia-item ${naoLida ? "nao-lida" : "lida"}"
            data-advertencia-id="${advertencia.id}"
        >
            <div class="advertencia-item-topo">
                <div class="advertencia-status">
                    <span class="advertencia-icone">
                        <i class="fas fa-triangle-exclamation"></i>
                    </span>
                    <div>
                        <strong>${naoLida ? "Nova advertência" : "Advertência registrada"}</strong>
                        <span>${escapeHTML(formatarData(advertencia.data_criacao))}</span>
                    </div>
                </div>
                ${naoLida ? `<span class="advertencia-nova-badge">Nova</span>` : `<i class="fas fa-check advertencia-lida-check" title="Você já confirmou ciência"></i>`}
            </div>

            <p class="advertencia-motivo">${escapeHTML(advertencia.motivo || "Motivo não informado.")}</p>

            <div class="advertencia-rodape">
                <span>
                    <i class="fas fa-user-shield"></i>
                    Por ${escapeHTML(adminNome)}
                </span>

                ${naoLida ? `
                    <button
                        type="button"
                        class="btn-ciente-advertencia"
                        data-advertencia-id="${advertencia.id}"
                    >
                        <i class="fas fa-check"></i>
                        Estou ciente
                    </button>
                ` : `
                    <span class="advertencia-ciente-texto">
                        <i class="fas fa-check-double"></i>
                        Ciente
                    </span>
                `}
            </div>
        </article>
    `;
}


function renderizarAdvertencias() {
    const card = document.getElementById("advertenciasCard");
    const lista = document.getElementById("advertenciasLista");
    const contador = document.getElementById("advertenciasContador");

    if (!card || !lista) return;

    if (!advertencias.length) {
        card.hidden = true;
        lista.innerHTML = "";
        if (contador) contador.textContent = "0";
        return;
    }

    const naoLidas = advertencias.filter((item) => !item.lida).length;

    card.hidden = false;
    card.classList.toggle("tem-nao-lida", naoLidas > 0);

    if (contador) {
        contador.textContent = String(advertencias.length);
        contador.classList.toggle("tem-nao-lida", naoLidas > 0);
        contador.setAttribute(
            "aria-label",
            `${advertencias.length} advertência${advertencias.length === 1 ? "" : "s"}, ${naoLidas} não lida${naoLidas === 1 ? "" : "s"}`
        );
    }

    lista.innerHTML = advertencias.map(advertenciaParaHTML).join("");
}


function inicializarEventosAdvertencias() {
    const lista = document.getElementById("advertenciasLista");
    if (!lista) return;

    lista.addEventListener("click", async (evento) => {
        const botao = evento.target.closest(".btn-ciente-advertencia");
        if (!botao) return;

        const id = botao.dataset.advertenciaId;
        if (!id) return;

        botao.disabled = true;
        const textoOriginal = botao.innerHTML;
        botao.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Confirmando...`;

        const resposta = await chamarAPI(`/api/advertencias/${id}/ler`, {
            method: "POST"
        });

        if (!resposta.ok || !resposta.dados?.success) {
            botao.disabled = false;
            botao.innerHTML = textoOriginal;
            mostrarToast(
                resposta.dados?.message || "Não foi possível confirmar a leitura.",
                "erro"
            );
            return;
        }

        const atualizada = resposta.dados.advertencia;
        const indice = advertencias.findIndex(
            (item) => String(item.id) === String(id)
        );

        if (indice !== -1 && atualizada) {
            advertencias[indice] = atualizada;
        }

        renderizarAdvertencias();
        mostrarToast("Ciência da advertência registrada.", "sucesso");
    });
}



// ============================================================
// BACKUPS DO PAINEL ADMIN
// ============================================================

function formatarTamanhoArquivo(bytes) {
    const valor = Number(bytes) || 0;

    if (valor < 1024) {
        return `${valor} B`;
    }

    if (valor < 1024 * 1024) {
        return `${(valor / 1024).toFixed(1)} KB`;
    }

    return `${(valor / 1024 / 1024).toFixed(2)} MB`;
}


async function carregarBackups({ mostrarLoading = false } = {}) {
    if (!usuarioAtual?.is_admin) return;

    const resumo = document.getElementById("backupResumo");
    const lista = document.getElementById("backupLista");

    if (mostrarLoading && resumo) {
        resumo.innerHTML = `
            <i class="fas fa-circle-notch fa-spin"></i>
            Verificando backups...
        `;
    }

    const resposta = await chamarAPI("/api/admin/backups");

    if (!resposta.ok || !resposta.dados?.success) {
        if (resumo) {
            resumo.textContent = "Não foi possível consultar os backups.";
        }
        return;
    }

    backups = Array.isArray(resposta.dados.backups)
        ? resposta.dados.backups
        : [];

    if (resumo) {
        const ultimo = resposta.dados.ultimo_backup_diario || "ainda não criado";
        resumo.innerHTML = `
            <div class="backup-resumo-item">
                <i class="fas fa-clock-rotate-left"></i>
                <span>
                    <strong>Backup diário:</strong>
                    ${escapeHTML(ultimo)}
                </span>
            </div>

            <div class="backup-resumo-item">
                <i class="fas fa-box-archive"></i>
                <span>
                    <strong>Retenção:</strong>
                    ${Number(resposta.dados.retencao || 0)} arquivos
                </span>
            </div>

            <div class="backup-resumo-item">
                <i class="fas fa-earth-americas"></i>
                <span>
                    <strong>Fuso:</strong>
                    ${escapeHTML(resposta.dados.timezone || "")}
                </span>
            </div>
        `;
    }

    if (!lista) return;

    if (!backups.length) {
        lista.innerHTML = `
            <div class="backup-vazio">
                Nenhum backup disponível ainda.
            </div>
        `;
        return;
    }

    lista.innerHTML = backups.map((backup) => `
        <div class="backup-item" data-backup="${escapeHTML(backup.nome)}">
            <div class="backup-item-icone">
                <i class="fas fa-file-zipper"></i>
            </div>

            <div class="backup-item-info">
                <strong>${escapeHTML(backup.nome)}</strong>
                <small>
                    ${formatarTamanhoArquivo(backup.tamanho_bytes)}
                    ·
                    ${escapeHTML(formatarData(backup.modificado_em))}
                </small>
            </div>

            <button
                type="button"
                class="btn-backup-download"
                data-backup="${escapeHTML(backup.nome)}"
                title="Baixar backup"
            >
                <i class="fas fa-download"></i>
                Baixar
            </button>
        </div>
    `).join("");
}


async function baixarBackup(nome) {
    const token = obterToken();

    if (!token) {
        redirecionarLogin();
        return;
    }

    try {
        const resposta = await fetch(
            `${API_BASE}/api/admin/backups/${encodeURIComponent(nome)}`,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (resposta.status === 401) {
            redirecionarLogin();
            return;
        }

        if (!resposta.ok) {
            let mensagem = "Não foi possível baixar o backup.";

            try {
                const dados = await resposta.json();
                mensagem = dados.message || mensagem;
            } catch {}

            mostrarToast(mensagem, "erro");
            return;
        }

        const blob = await resposta.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = nome;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        mostrarToast("Download do backup iniciado.", "sucesso");

    } catch (erro) {
        console.error("Erro ao baixar backup:", erro);
        mostrarToast("Falha de conexão ao baixar o backup.", "erro");
    }
}


function inicializarEventosBackups() {
    const btnCriar = document.getElementById("btnCriarBackup");
    const lista = document.getElementById("backupLista");

    btnCriar?.addEventListener("click", async () => {
        const confirmar = await confirmarAcao(
            "Criar backup agora",
            "Será criado um snapshot do banco de dados e dos uploads atuais. Deseja continuar?"
        );

        if (!confirmar) return;

        const textoOriginal = btnCriar.innerHTML;
        btnCriar.disabled = true;
        btnCriar.innerHTML = `
            <i class="fas fa-circle-notch fa-spin"></i>
            Criando...
        `;

        const resposta = await chamarAPI(
            "/api/admin/backups",
            {
                method: "POST",
                body: JSON.stringify({})
            }
        );

        btnCriar.disabled = false;
        btnCriar.innerHTML = textoOriginal;

        if (!resposta.ok || !resposta.dados?.success) {
            mostrarToast(
                resposta.dados?.message || "Não foi possível criar o backup.",
                "erro"
            );
            return;
        }

        mostrarToast("Backup criado com sucesso.", "sucesso");
        await carregarBackups();
    });

    lista?.addEventListener("click", async (evento) => {
        const botao = evento.target.closest(".btn-backup-download");

        if (!botao) return;

        const nome = botao.dataset.backup;

        if (!nome) return;

        botao.disabled = true;

        try {
            await baixarBackup(nome);
        } finally {
            botao.disabled = false;
        }
    });
}


// ============================================================
// PAINEL ADMIN
// ============================================================

async function carregarMembros({ mostrarLoading = false } = {}) {
    if (!usuarioAtual?.is_admin) return;

    const corpo = document.getElementById("tabelaMembrosCorpo");

    if (mostrarLoading && corpo && !membros.length) {
        corpo.innerHTML = `
            <tr class="admin-loading-row">
                <td colspan="4">
                    <i class="fas fa-circle-notch fa-spin"></i>
                    Carregando membros...
                </td>
            </tr>
        `;
    }

    const resposta = await chamarAPI("/api/admin/membros");

    if (!resposta.ok) {
        if (corpo && !membros.length) {
            corpo.innerHTML = `
                <tr>
                    <td colspan="4" class="admin-estado-vazio">
                        Não foi possível carregar os membros.
                    </td>
                </tr>
            `;
        }
        return;
    }

    const listaMembros = Array.isArray(resposta.dados?.membros)
        ? resposta.dados.membros
        : [];

    if (!resposta.dados?.success || !Array.isArray(resposta.dados?.membros)) {
        console.error("Resposta inválida de /api/admin/membros:", resposta.dados);
        return;
    }

    membros = listaMembros;
    renderizarMembros();
}


function membroParaHTML(membro) {
    const souEu = usuarioAtual && String(membro.id) === String(usuarioAtual.id);

    return `
        <tr data-id="${membro.id}">
            <td class="membro-celula">
                <img src="${normalizarUrlImagem(membro.foto)}" alt="${escapeHTML(membro.nome || "Membro")}">
                <div>
                    <strong>${escapeHTML(membro.nome)}</strong>
                    <small>${escapeHTML(membro.funcao || "Membro LSD")}</small>
                    ${Number(membro.advertencias_total || 0) > 0 ? `
                        <span class="membro-advertencias-resumo ${Number(membro.advertencias_nao_lidas || 0) > 0 ? "tem-nao-lida" : ""}">
                            <i class="fas fa-triangle-exclamation"></i>
                            ${Number(membro.advertencias_total || 0)} advertência${Number(membro.advertencias_total || 0) === 1 ? "" : "s"}
                            ${Number(membro.advertencias_nao_lidas || 0) > 0 ? `· ${Number(membro.advertencias_nao_lidas || 0)} nova${Number(membro.advertencias_nao_lidas || 0) === 1 ? "" : "s"}` : ""}
                        </span>
                    ` : ""}
                </div>
            </td>

            <td class="membro-email">${escapeHTML(membro.email)}</td>

            <td>
                <span class="badge-cargo ${membro.is_admin ? "badge-admin" : "badge-membro"}">
                    ${membro.is_admin ? "Administrador" : "Membro"}
                </span>
            </td>

            <td class="acoes-admin-flex">
                <button
                    type="button"
                    class="btn-adm btn-adm-adv"
                    data-id="${membro.id}"
                    data-admin="${membro.is_admin ? "1" : "0"}"
                    ${souEu ? "disabled title='Você não pode alterar seu próprio nível de acesso'" : ""}
                >
                    <i class="fas fa-user-shield"></i>
                    ${membro.is_admin ? "Rebaixar" : "Promover"}
                </button>

                <button
                    type="button"
                    class="btn-adm btn-adm-cargo"
                    data-id="${membro.id}"
                >
                    <i class="fas fa-pen"></i>
                    Cargo
                </button>

                <button
                    type="button"
                    class="btn-adm btn-adm-advertencia"
                    data-id="${membro.id}"
                    ${souEu ? "disabled title='Você não pode advertir sua própria conta'" : ""}
                >
                    <i class="fas fa-triangle-exclamation"></i>
                    Advertir
                    ${Number(membro.advertencias_total || 0) > 0 ? `<span class="btn-advertencia-contador">${Number(membro.advertencias_total || 0)}</span>` : ""}
                </button>

                <button
                    type="button"
                    class="btn-adm btn-adm-del"
                    data-id="${membro.id}"
                    ${souEu ? "disabled title='Você não pode excluir sua própria conta'" : ""}
                >
                    <i class="fas fa-trash"></i>
                    Excluir
                </button>
            </td>
        </tr>
    `;
}


function renderizarMembros() {
    const corpo = document.getElementById("tabelaMembrosCorpo");
    if (!corpo) return;

    if (!membros.length) {
        corpo.innerHTML = `
            <tr>
                <td colspan="4" class="admin-estado-vazio">Nenhum membro encontrado.</td>
            </tr>
        `;
        return;
    }

    corpo.innerHTML = membros.map(membroParaHTML).join("");
}


function atualizarLinhaMembro(membro) {
    const corpo = document.getElementById("tabelaMembrosCorpo");
    if (!corpo) return;

    const linhaAtual = corpo.querySelector(`tr[data-id="${membro.id}"]`);
    if (!linhaAtual) return;

    const template = document.createElement("template");
    template.innerHTML = membroParaHTML(membro).trim();
    const novaLinha = template.content.firstElementChild;

    if (novaLinha) {
        novaLinha.classList.add("linha-atualizada");
        linhaAtual.replaceWith(novaLinha);
        setTimeout(() => novaLinha.classList.remove("linha-atualizada"), 900);
    }
}


function atualizarMembroLocal(membroAtualizado) {
    const indice = membros.findIndex(
        (membro) => String(membro.id) === String(membroAtualizado.id)
    );

    if (indice === -1) return;

    membros[indice] = {
        ...membros[indice],
        ...membroAtualizado
    };

    atualizarLinhaMembro(membros[indice]);
}


async function abrirGerenciadorAdvertencias(membro) {
    if (!membro) return;

    const overlay = document.createElement("div");
    overlay.className = "ux-dialog-overlay advertencia-admin-overlay";
    overlay.innerHTML = `
        <div class="ux-dialog advertencia-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="advertenciaAdminTitulo">
            <button type="button" class="ux-dialog-x" aria-label="Fechar">
                <i class="fas fa-xmark"></i>
            </button>

            <div class="advertencia-admin-cabecalho">
                <div class="ux-dialog-icone aviso">
                    <i class="fas fa-triangle-exclamation"></i>
                </div>
                <div>
                    <span class="advertencia-admin-eyebrow">GERENCIAMENTO DISCIPLINAR</span>
                    <h3 id="advertenciaAdminTitulo">Advertências de ${escapeHTML(membro.nome || "Membro")}</h3>
                    <p>Registre um motivo objetivo. O membro receberá o comunicado na lateral do próprio painel.</p>
                </div>
            </div>

            <div class="advertencia-admin-formulario">
                <label for="advertenciaMotivoInput">Motivo da nova advertência</label>
                <textarea
                    id="advertenciaMotivoInput"
                    class="advertencia-admin-textarea"
                    maxlength="1000"
                    rows="4"
                    placeholder="Ex.: Ausência não justificada na reunião da equipe..."
                ></textarea>
                <div class="advertencia-admin-form-footer">
                    <small><span id="advertenciaChars">0</span>/1000 caracteres</small>
                    <button type="button" class="btn-enviar-advertencia">
                        <i class="fas fa-paper-plane"></i>
                        Enviar advertência
                    </button>
                </div>
            </div>

            <div class="advertencia-admin-historico">
                <div class="advertencia-admin-historico-topo">
                    <h4><i class="fas fa-clock-rotate-left"></i> Histórico</h4>
                    <span class="advertencia-admin-total">Carregando...</span>
                </div>
                <div class="advertencia-admin-lista">
                    <div class="advertencias-loading">
                        <i class="fas fa-circle-notch fa-spin"></i>
                        Carregando histórico...
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add("dialog-aberto");

    const textarea = overlay.querySelector(".advertencia-admin-textarea");
    const chars = overlay.querySelector("#advertenciaChars");
    const btnEnviar = overlay.querySelector(".btn-enviar-advertencia");
    const lista = overlay.querySelector(".advertencia-admin-lista");
    const total = overlay.querySelector(".advertencia-admin-total");

    let historico = [];

    const fechar = () => {
        document.removeEventListener("keydown", teclaEsc);
        overlay.classList.remove("visivel");
        document.body.classList.remove("dialog-aberto");
        setTimeout(() => overlay.remove(), 180);
    };

    const teclaEsc = (evento) => {
        if (evento.key === "Escape") fechar();
    };

    const renderizarHistorico = () => {
        if (total) {
            total.textContent = `${historico.length} registro${historico.length === 1 ? "" : "s"}`;
        }

        if (!lista) return;

        if (!historico.length) {
            lista.innerHTML = `
                <div class="advertencia-admin-vazio">
                    <i class="far fa-circle-check"></i>
                    <strong>Nenhuma advertência registrada</strong>
                    <span>Este membro ainda não possui advertências.</span>
                </div>
            `;
            return;
        }

        lista.innerHTML = historico.map((item) => `
            <article class="advertencia-admin-item" data-advertencia-id="${item.id}">
                <div class="advertencia-admin-item-topo">
                    <div>
                        <strong>${item.lida ? "Membro ciente" : "Aguardando ciência"}</strong>
                        <span>${escapeHTML(formatarData(item.data_criacao))}</span>
                    </div>
                    <span class="advertencia-admin-status ${item.lida ? "lida" : "pendente"}">
                        <i class="fas ${item.lida ? "fa-check-double" : "fa-clock"}"></i>
                        ${item.lida ? "Ciente" : "Pendente"}
                    </span>
                </div>
                <p>${escapeHTML(item.motivo || "")}</p>
                <div class="advertencia-admin-item-rodape">
                    <span>
                        <i class="fas fa-user-shield"></i>
                        ${escapeHTML(item.admin?.nome || "Administração LSD")}
                    </span>
                    <button
                        type="button"
                        class="btn-remover-advertencia"
                        data-advertencia-id="${item.id}"
                        title="Remover advertência"
                    >
                        <i class="fas fa-trash"></i>
                        Remover
                    </button>
                </div>
            </article>
        `).join("");
    };

    const carregarHistorico = async () => {
        const resposta = await chamarAPI(`/api/admin/membros/${membro.id}/advertencias`);

        if (!resposta.ok || !resposta.dados?.success) {
            if (lista) {
                lista.innerHTML = `
                    <div class="advertencias-erro">
                        Não foi possível carregar o histórico.
                    </div>
                `;
            }
            return;
        }

        historico = Array.isArray(resposta.dados.advertencias)
            ? resposta.dados.advertencias
            : [];

        renderizarHistorico();
    };

    textarea?.addEventListener("input", () => {
        if (chars) chars.textContent = String(textarea.value.length);
        textarea.classList.remove("invalido");
    });

    btnEnviar?.addEventListener("click", async () => {
        const motivo = textarea?.value.trim() || "";

        if (motivo.length < 5) {
            textarea?.classList.add("invalido");
            textarea?.focus();
            mostrarToast("Informe um motivo com pelo menos 5 caracteres.", "aviso");
            return;
        }

        btnEnviar.disabled = true;
        const original = btnEnviar.innerHTML;
        btnEnviar.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Enviando...`;

        const resposta = await chamarAPI(`/api/admin/membros/${membro.id}/advertencias`, {
            method: "POST",
            body: JSON.stringify({ motivo })
        });

        btnEnviar.disabled = false;
        btnEnviar.innerHTML = original;

        if (!resposta.ok || !resposta.dados?.success) {
            mostrarToast(
                resposta.dados?.message || "Não foi possível enviar a advertência.",
                "erro"
            );
            return;
        }

        const nova = resposta.dados.advertencia;
        if (nova) historico.unshift(nova);

        if (textarea) textarea.value = "";
        if (chars) chars.textContent = "0";

        const membroLocal = membros.find(
            (item) => String(item.id) === String(membro.id)
        );

        if (membroLocal) {
            membroLocal.advertencias_total = Number(resposta.dados.advertencias_total || historico.length);
            membroLocal.advertencias_nao_lidas = Number(resposta.dados.advertencias_nao_lidas || 0);
            atualizarLinhaMembro(membroLocal);
        }

        renderizarHistorico();
        mostrarToast(`Advertência enviada para ${membro.nome}.`, "sucesso");
    });

    lista?.addEventListener("click", async (evento) => {
        const botao = evento.target.closest(".btn-remover-advertencia");
        if (!botao) return;

        const advertenciaId = botao.dataset.advertenciaId;
        const item = historico.find(
            (registro) => String(registro.id) === String(advertenciaId)
        );

        const confirmado = await confirmarAcao(
            "Remover advertência",
            `Deseja remover esta advertência${item?.motivo ? `: “${item.motivo.slice(0, 100)}${item.motivo.length > 100 ? "…" : ""}”` : ""}?`,
            true
        );

        if (!confirmado) return;

        botao.disabled = true;
        const resposta = await chamarAPI(`/api/admin/advertencias/${advertenciaId}`, {
            method: "DELETE"
        });

        if (!resposta.ok || !resposta.dados?.success) {
            botao.disabled = false;
            mostrarToast(
                resposta.dados?.message || "Não foi possível remover a advertência.",
                "erro"
            );
            return;
        }

        historico = historico.filter(
            (registro) => String(registro.id) !== String(advertenciaId)
        );

        const membroLocal = membros.find(
            (itemMembro) => String(itemMembro.id) === String(membro.id)
        );

        if (membroLocal) {
            membroLocal.advertencias_total = Number(resposta.dados.advertencias_total || 0);
            membroLocal.advertencias_nao_lidas = Number(resposta.dados.advertencias_nao_lidas || 0);
            atualizarLinhaMembro(membroLocal);
        }

        renderizarHistorico();
        mostrarToast("Advertência removida.", "sucesso");
    });

    overlay.querySelector(".ux-dialog-x")?.addEventListener("click", fechar);
    overlay.addEventListener("click", (evento) => {
        if (evento.target === overlay) fechar();
    });
    document.addEventListener("keydown", teclaEsc);

    requestAnimationFrame(() => {
        overlay.classList.add("visivel");
        textarea?.focus();
    });

    await carregarHistorico();
}


function inicializarEventosAdmin() {
    const corpo = document.getElementById("tabelaMembrosCorpo");
    if (!corpo) return;

    corpo.addEventListener("click", async (evento) => {
        const btnAdv = evento.target.closest(".btn-adm-adv");
        const btnCargo = evento.target.closest(".btn-adm-cargo");
        const btnAdvertencia = evento.target.closest(".btn-adm-advertencia");
        const btnDel = evento.target.closest(".btn-adm-del");

        if (btnAdv) {
            const id = btnAdv.dataset.id;
            const eraAdmin = btnAdv.dataset.admin === "1";

            const confirmado = await confirmarAcao(
                eraAdmin ? "Rebaixar administrador" : "Promover administrador",
                eraAdmin
                    ? "Este membro deixará de ter acesso ao Painel Admin. Deseja continuar?"
                    : "Este membro passará a ter acesso às funções administrativas. Deseja continuar?",
                false
            );

            if (!confirmado) return;

            btnAdv.disabled = true;
            const resposta = await chamarAPI(`/api/membros/${id}`, {
                method: "PUT",
                body: JSON.stringify({ is_admin: !eraAdmin })
            });

            if (!resposta.ok || !resposta.dados.success) {
                btnAdv.disabled = false;
                mostrarToast(resposta.dados.message || "Não foi possível atualizar o membro.", "erro");
                return;
            }

            const atualizado = resposta.dados.usuario || resposta.dados.membro;

            if (atualizado) {
                atualizarMembroLocal(atualizado);
            } else {
                const membro = membros.find((m) => String(m.id) === String(id));
                if (membro) {
                    membro.is_admin = !eraAdmin;
                    atualizarLinhaMembro(membro);
                }
            }

            mostrarToast(
                eraAdmin ? "Administrador rebaixado." : "Membro promovido a administrador.",
                "sucesso"
            );
            return;
        }

        if (btnCargo) {
            const id = btnCargo.dataset.id;
            const membro = membros.find((m) => String(m.id) === String(id));

            const novaFuncao = await solicitarTexto(
                "Editar cargo/função",
                `Defina o cargo de ${membro?.nome || "este membro"}.`,
                membro?.funcao || ""
            );

            if (novaFuncao === null) return;

            btnCargo.disabled = true;
            const resposta = await chamarAPI(`/api/membros/${id}`, {
                method: "PUT",
                body: JSON.stringify({ funcao: novaFuncao.trim() })
            });
            btnCargo.disabled = false;

            if (!resposta.ok || !resposta.dados.success) {
                mostrarToast(resposta.dados.message || "Não foi possível atualizar o cargo.", "erro");
                return;
            }

            const atualizado = resposta.dados.usuario || resposta.dados.membro;

            if (atualizado) {
                atualizarMembroLocal(atualizado);
            } else if (membro) {
                membro.funcao = novaFuncao.trim();
                atualizarLinhaMembro(membro);
            }

            mostrarToast("Cargo atualizado.", "sucesso");
            return;
        }

        if (btnAdvertencia) {
            const id = btnAdvertencia.dataset.id;
            const membro = membros.find((item) => String(item.id) === String(id));

            if (!membro) {
                mostrarToast("Membro não encontrado na lista atual.", "erro");
                return;
            }

            await abrirGerenciadorAdvertencias(membro);
            return;
        }

        if (btnDel) {
            const id = btnDel.dataset.id;
            const membro = membros.find((m) => String(m.id) === String(id));

            const confirmado = await confirmarAcao(
                "Excluir membro",
                `Tem certeza que deseja excluir ${membro?.nome || "este membro"}? Essa ação não pode ser desfeita.`,
                true
            );

            if (!confirmado) return;

            const linha = btnDel.closest("tr");
            btnDel.disabled = true;

            const resposta = await chamarAPI(`/api/membros/${id}`, {
                method: "DELETE"
            });

            if (!resposta.ok || !resposta.dados.success) {
                btnDel.disabled = false;
                mostrarToast(resposta.dados.message || "Não foi possível excluir o membro.", "erro");
                return;
            }

            membros = membros.filter((m) => String(m.id) !== String(id));
            removerElementoComAnimacao(linha, () => {
                if (!corpo.querySelector("tr[data-id]")) {
                    renderizarMembros();
                }
            });

            mostrarToast("Membro excluído com sucesso.", "sucesso");

            // Sincroniza áreas relacionadas em segundo plano, sem trocar a aba atual.
            Promise.allSettled([
                carregarDestaques(),
                carregarCards()
            ]);
            return;
        }
    });
}


function inicializarComunicadoAdmin() {
    const formulario = document.getElementById("formComunicadoAdmin");
    if (!formulario) return;

    const botao = document.getElementById("btnEnviarComunicado");
    const status = document.getElementById("comunicadoStatus");

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const assunto = document.getElementById("comunicadoAssunto")?.value.trim() || "";
        const mensagem = document.getElementById("comunicadoMensagem")?.value.trim() || "";

        if (assunto.length < 3 || mensagem.length < 10) {
            if (status) status.textContent = "Informe um assunto e uma mensagem válidos.";
            return;
        }

        const original = botao.innerHTML;
        botao.disabled = true;
        botao.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Enviando...`;
        if (status) status.textContent = "";

        const resposta = await chamarAPI("/api/admin/comunicados", {
            method: "POST",
            body: JSON.stringify({ assunto, mensagem })
        });

        botao.disabled = false;
        botao.innerHTML = original;

        if (!resposta.ok || !resposta.dados?.success) {
            if (status) status.textContent = resposta.dados?.message || "Não foi possível enviar o comunicado.";
            return;
        }

        formulario.reset();
        if (status) status.textContent = `${resposta.dados.destinatarios} destinatário(s) processado(s).`;
        mostrarToast("Comunicado enviado com sucesso.", "sucesso");
    });
}


// ============================================================
// LOGOUT
// ============================================================

function inicializarLogout() {

    const logoutLink =
        document.getElementById(
            "logoutLink"
        );


    if (!logoutLink) {
        return;
    }


    logoutLink.addEventListener(
        "click",
        (evento) => {

            evento.preventDefault();

            localStorage.removeItem(
                TOKEN_KEY
            );

            window.location.href =
                "entrar-login.html";
        }
    );
}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    if (!obterToken()) {
        redirecionarLogin();
        return;
    }

    inicializarLayoutDashboard();
    inicializarTemaDashboard();
    inicializarLogout();
    inicializarModaisEAbas();
    inicializarEventosPerfil();
    inicializarEventosKanban();
    inicializarEventosFeed();
    inicializarEventosMembros();
    inicializarEventosAdmin();
    inicializarComunicadoAdmin();
    inicializarEventosAdvertencias();
    inicializarEventosBackups();

    try {
        // Perfil primeiro: define permissões e informações do usuário.
        await carregarPerfil();

        let abaInicial = sessionStorage.getItem(ABA_STORAGE_KEY) || "kanban";

        if (!ABAS_VALIDAS.has(abaInicial)) {
            abaInicial = "kanban";
        }

        if (abaInicial === "admin" && !usuarioAtual?.is_admin) {
            abaInicial = "kanban";
        }

        // Mostra a aba antes das requisições; respostas tardias não mudam a navegação.
        await trocarAba(abaInicial, { salvar: false, carregar: false });
        document.documentElement.classList.remove("dashboard-inicializando");

        // Dados globais que aparecem nas laterais e em formulários.
        await Promise.allSettled([
            carregarDestaques(),
            carregarResponsaveisCards(),
            carregarAdvertencias(),
            carregarConquistasDashboard()
        ]);

        // Carrega somente a aba que o usuário realmente vai ver.
        if (abaInicial === "kanban") {
            await carregarCards();
        } else if (abaInicial === "comunidade") {
            await carregarPosts({ mostrarLoading: true });
            feedCarregado = true;
        } else if (abaInicial === "membros") {
            await carregarDiretorioMembros();
            membrosCarregados = true;
        } else if (abaInicial === "admin") {
            await Promise.allSettled([
                carregarMembros({ mostrarLoading: true }),
                carregarBackups({ mostrarLoading: true })
            ]);
            adminCarregado = true;
        }

        // Ao voltar para a aba do navegador, verifica se a administração
        // enviou uma nova advertência enquanto o membro estava ausente.
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                carregarAdvertencias({ silencioso: true });
            }
        });

    } catch (erro) {
        console.error("Falha ao iniciar o dashboard", erro);
        mostrarToast("Não foi possível carregar o painel. Tente atualizar a página.", "erro");
    } finally {
        document.documentElement.classList.remove("dashboard-inicializando");
    }
});


// Altura real da navegação e ciclo de foco do modal de perfil.
function inicializarLayoutDashboard() {
    const nav = document.querySelector(".dash-nav");
    const medirNav = () => document.documentElement.style.setProperty(
        "--dash-nav-height", nav.getBoundingClientRect().height + "px"
    );
    if (nav) {
        medirNav();
        new ResizeObserver(medirNav).observe(nav);
    }

    const overlay = document.getElementById("modalEditarPerfil");
    const dialog = overlay?.querySelector('[role="dialog"]');
    if (!dialog) return;
    let focoAnterior = null;
    let aberto = false;
    const sincronizar = () => {
        if (aberto === !overlay.hidden) return;
        aberto = !overlay.hidden;
        document.body.classList.toggle("perfil-modal-aberto", aberto);
        for (const filho of document.body.children) {
            if (filho === overlay || filho.tagName === "SCRIPT") continue;
            if (aberto) {
                filho.dataset.perfilInertAnterior = String(filho.inert);
                filho.inert = true;
            } else if ("perfilInertAnterior" in filho.dataset) {
                filho.inert = filho.dataset.perfilInertAnterior === "true";
                delete filho.dataset.perfilInertAnterior;
            }
        }
        if (aberto) {
            focoAnterior = document.activeElement;
            dialog.querySelector(".perfil-form-corpo").scrollTop = 0;
            dialog.focus({ preventScroll: true });
        } else {
            focoAnterior?.focus({ preventScroll: true });
        }
    };
    new MutationObserver(sincronizar).observe(overlay, {
        attributes: true, attributeFilter: ["hidden"]
    });
    document.addEventListener("keydown", (evento) => {
        if (overlay.hidden) return;
        if (evento.key === "Escape") {
            evento.preventDefault();
            overlay.hidden = true;
        } else if (evento.key === "Tab") {
            const elementos = [...dialog.querySelectorAll(
                'button, input, textarea, select, a[href], [tabindex="0"]'
            )].filter((el) => !el.disabled && el.getClientRects().length);
            const primeiro = elementos[0], ultimo = elementos[elementos.length - 1];
            if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === dialog)) {
                evento.preventDefault(); ultimo?.focus();
            } else if (!evento.shiftKey && document.activeElement === ultimo) {
                evento.preventDefault(); primeiro?.focus();
            }
        }
    });
    const ajustarViewport = () => {
        const viewport = window.visualViewport;
        overlay.style.setProperty("--perfil-viewport-height", (viewport?.height || window.innerHeight) + "px");
        overlay.style.setProperty("--perfil-viewport-top", (viewport?.offsetTop || 0) + "px");
    };
    ajustarViewport();
    window.visualViewport?.addEventListener("resize", ajustarViewport);
    window.visualViewport?.addEventListener("scroll", ajustarViewport);
    window.addEventListener("resize", ajustarViewport);
}
