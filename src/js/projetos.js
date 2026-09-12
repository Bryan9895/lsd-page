const API_BASE = ["127.0.0.1", "localhost"].includes(window.location.hostname)
    ? "http://127.0.0.1:5000"
    : window.location.origin;

const TOKEN_KEY = "token_lsd";
const STATUS_PROJETO = {
    em_desenvolvimento: { nome: "Em desenvolvimento", icone: "fa-code" },
    em_producao: { nome: "Em produção", icone: "fa-rocket" },
    concluido: { nome: "Concluído", icone: "fa-circle-check" }
};

let projetos = [];
let filtroStatus = "todos";
let usuarioAtual = null;
let projetoAberto = null;

function escapeHTML(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function urlInternaOuHttp(valor, fallback = "") {
    const url = String(valor || "").trim();
    if (url.startsWith("/src/") || url.startsWith("/uploads/")) {
        return `${API_BASE}${url}`;
    }
    if (url.startsWith("./src/")) return url;

    try {
        const completa = new URL(url);
        return ["http:", "https:"].includes(completa.protocol) ? completa.href : fallback;
    } catch (_) {
        return fallback;
    }
}

function statusProjetoHTML(status) {
    const dados = STATUS_PROJETO[status] || STATUS_PROJETO.em_desenvolvimento;
    return `
        <span class="status-badge status-${escapeHTML(status)}">
            <i class="fas ${dados.icone}" aria-hidden="true"></i>
            ${dados.nome}
        </span>
    `;
}

function mostrarToast(mensagem, tipo = "") {
    const toast = document.getElementById("portfolioToast");
    if (!toast) return;
    toast.textContent = mensagem;
    toast.className = `portfolio-toast ${tipo} visivel`;
    clearTimeout(mostrarToast.timeout);
    mostrarToast.timeout = setTimeout(() => {
        toast.classList.remove("visivel");
    }, 3500);
}

async function requisitar(endpoint, opcoes = {}) {
    const headers = { ...(opcoes.headers || {}) };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
        const resposta = await fetch(`${API_BASE}${endpoint}`, { ...opcoes, headers });
        const dados = await resposta.json().catch(() => ({}));
        return { ok: resposta.ok, status: resposta.status, dados };
    } catch (erro) {
        console.error("Falha ao consultar projetos:", erro);
        return { ok: false, status: 0, dados: { message: "Não foi possível conectar ao servidor." } };
    }
}

async function carregarUsuarioOpcional() {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    const resposta = await requisitar("/api/perfil");
    if (resposta.ok && resposta.dados?.id) usuarioAtual = resposta.dados;
}

function atualizarEstatisticas() {
    const membros = new Set();
    projetos.forEach((projeto) => {
        (projeto.membros || []).forEach((membro) => membros.add(String(membro.id)));
    });
    document.getElementById("statTotal").textContent = String(projetos.length);
    document.getElementById("statAtivos").textContent = String(
        projetos.filter((projeto) => projeto.status !== "concluido").length
    );
    document.getElementById("statMembros").textContent = String(membros.size);
}

function projetoCardHTML(projeto) {
    const membros = Array.isArray(projeto.membros) ? projeto.membros : [];
    const tecnologias = Array.isArray(projeto.tecnologias) ? projeto.tecnologias.slice(0, 3) : [];
    const avatares = membros.slice(0, 3).map((membro) => `
        <img src="${escapeHTML(urlInternaOuHttp(membro.foto, "./src/images/equipe/avatar/default-avatar.png"))}"
             alt="" loading="lazy">
    `).join("");

    return `
        <article class="projeto-card" data-projeto-slug="${escapeHTML(projeto.slug)}">
            <div class="projeto-card-imagem">
                <img src="${escapeHTML(urlInternaOuHttp(projeto.logo_url, "./src/images/LOGO_LSD.svg"))}"
                     alt="Logo do projeto ${escapeHTML(projeto.nome)}" loading="lazy">
                ${statusProjetoHTML(projeto.status)}
            </div>
            <div class="projeto-card-corpo">
                <h3>${escapeHTML(projeto.nome)}</h3>
                <p class="projeto-card-descricao">${escapeHTML(projeto.descricao)}</p>
                <div class="tags-lista">
                    ${tecnologias.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}
                    ${projeto.tecnologias?.length > 3 ? `<span class="tag">+${projeto.tecnologias.length - 3}</span>` : ""}
                </div>
                <div class="projeto-card-rodape">
                    <div class="membros-mini" aria-label="${membros.length} participantes">
                        ${avatares}
                        <span>${membros.length ? `${membros.length} membro${membros.length === 1 ? "" : "s"}` : "Equipe a definir"}</span>
                    </div>
                    <button class="btn-ver-projeto" type="button" data-abrir-projeto="${escapeHTML(projeto.slug)}">
                        Ver projeto <i class="fas fa-arrow-right" aria-hidden="true"></i>
                    </button>
                </div>
            </div>
        </article>
    `;
}

function filtrarProjetos() {
    const busca = document.getElementById("buscaProjetos")?.value.trim().toLocaleLowerCase("pt-BR") || "";
    return projetos.filter((projeto) => {
        if (filtroStatus !== "todos" && projeto.status !== filtroStatus) return false;
        if (!busca) return true;
        const conteudo = [
            projeto.nome,
            projeto.descricao,
            projeto.professor_orientador,
            ...(projeto.tecnologias || [])
        ].join(" ").toLocaleLowerCase("pt-BR");
        return conteudo.includes(busca);
    });
}

function renderizarProjetos() {
    const grid = document.getElementById("projetosGrid");
    const contador = document.getElementById("resultadoContador");
    if (!grid) return;

    const lista = filtrarProjetos();
    grid.setAttribute("aria-busy", "false");
    if (contador) contador.textContent = `${lista.length} projeto${lista.length === 1 ? " encontrado" : "s encontrados"}`;

    grid.innerHTML = lista.length
        ? lista.map(projetoCardHTML).join("")
        : `
            <div class="portfolio-vazio">
                <i class="fas fa-folder-open" aria-hidden="true"></i>
                <strong>Nenhum projeto encontrado</strong>
                <span>Tente retirar um filtro ou buscar outro termo.</span>
            </div>
        `;
}

function formatarData(data) {
    if (!data) return "";
    const valor = new Date(data);
    if (Number.isNaN(valor.getTime())) return "";
    return valor.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function iconeDocumento(mime = "") {
    if (mime.includes("pdf")) return "fa-file-pdf";
    if (mime.includes("image")) return "fa-file-image";
    if (mime.includes("zip") || mime.includes("compressed")) return "fa-file-zipper";
    return "fa-file-lines";
}

function podeGerenciarDocumentos(projeto) {
    return Boolean(
        usuarioAtual &&
        (usuarioAtual.is_admin || String(projeto.lider_id) === String(usuarioAtual.id))
    );
}

function membroProjetoHTML(membro) {
    const funcao = membro.is_lider ? "Líder do projeto" : (membro.funcao || "Membro LSD");
    return `
        <a class="membro-projeto" href="dashboard.html?aba=membros&membro=${encodeURIComponent(membro.id)}">
            <img src="${escapeHTML(urlInternaOuHttp(membro.foto, "./src/images/equipe/avatar/default-avatar.png"))}"
                 alt="Foto de ${escapeHTML(membro.nome)}" loading="lazy">
            <div>
                <strong>${escapeHTML(membro.nome)}</strong>
                <span class="${membro.is_lider ? "lider-selo" : ""}">${escapeHTML(funcao)}</span>
            </div>
        </a>
    `;
}

function documentoHTML(documento, podeGerenciar) {
    return `
        <article class="documento-item">
            <i class="fas ${iconeDocumento(documento.arquivo_mime)}" aria-hidden="true"></i>
            <div>
                <a href="${escapeHTML(urlInternaOuHttp(documento.arquivo_url, "#"))}" target="_blank" rel="noopener noreferrer">
                    ${escapeHTML(documento.titulo || documento.arquivo_nome)}
                </a>
                <small>${escapeHTML(documento.arquivo_nome)}${documento.data_criacao ? ` · ${escapeHTML(formatarData(documento.data_criacao))}` : ""}</small>
            </div>
            ${podeGerenciar ? `
                <button type="button" class="documento-remover" data-remover-documento="${documento.id}" aria-label="Remover ${escapeHTML(documento.titulo)}">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
            ` : ""}
        </article>
    `;
}

function renderizarDetalhe(projeto, { atualizarUrl = true } = {}) {
    const catalogo = document.getElementById("catalogo");
    const hero = document.getElementById("portfolioHero");
    const detalhe = document.getElementById("projetoDetalhe");
    const conteudo = document.getElementById("projetoDetalheConteudo");
    if (!detalhe || !conteudo) return;

    projetoAberto = projeto;
    const membros = Array.isArray(projeto.membros) ? projeto.membros : [];
    const documentos = Array.isArray(projeto.documentos) ? projeto.documentos : [];
    const gerenciaDocs = podeGerenciarDocumentos(projeto);
    const repositorio = urlInternaOuHttp(projeto.repositorio_url);
    const site = urlInternaOuHttp(projeto.site_url);

    conteudo.innerHTML = `
        <article>
            <section class="detalhe-hero">
                <div class="detalhe-hero-imagem">
                    <img src="${escapeHTML(urlInternaOuHttp(projeto.logo_url, "./src/images/LOGO_LSD.svg"))}" alt="Logo do projeto ${escapeHTML(projeto.nome)}">
                </div>
                <div class="detalhe-hero-copy">
                    ${statusProjetoHTML(projeto.status)}
                    <h1>${escapeHTML(projeto.nome)}</h1>
                    <p>${escapeHTML(projeto.descricao)}</p>
                    <div class="detalhe-acoes">
                        ${repositorio ? `<a class="detalhe-link principal" href="${escapeHTML(repositorio)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> Repositório</a>` : ""}
                        ${site ? `<a class="detalhe-link" href="${escapeHTML(site)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i> Acessar projeto</a>` : ""}
                    </div>
                </div>
            </section>

            <div class="detalhe-grid">
                <div>
                    <section class="detalhe-card">
                        <h2><i class="fas fa-user-group" aria-hidden="true"></i> Equipe do projeto</h2>
                        <div class="equipe-projeto-grid">
                            ${membros.length
                                ? membros.map(membroProjetoHTML).join("")
                                : '<div class="portfolio-vazio"><i class="fas fa-users"></i><strong>Equipe ainda não vinculada</strong><span>Um administrador poderá selecionar os participantes.</span></div>'}
                        </div>
                    </section>

                    <section class="detalhe-card">
                        <h2><i class="fas fa-file-lines" aria-hidden="true"></i> Documentação</h2>
                        <div class="documentos-lista">
                            ${documentos.length
                                ? documentos.map((item) => documentoHTML(item, gerenciaDocs)).join("")
                                : '<div class="portfolio-vazio"><i class="fas fa-folder"></i><strong>Nenhum documento publicado</strong><span>A documentação poderá ser adicionada pelo líder do projeto.</span></div>'}
                        </div>
                        ${gerenciaDocs ? `
                            <form class="documento-form" id="formDocumentoProjeto">
                                <input type="text" id="documentoTitulo" maxlength="160" placeholder="Título do documento (opcional)">
                                <div class="documento-form-linha">
                                    <input type="file" id="documentoArquivo" required accept=".pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,image/*">
                                    <button type="submit"><i class="fas fa-cloud-arrow-up"></i> Anexar</button>
                                </div>
                            </form>
                        ` : ""}
                    </section>
                </div>

                <aside>
                    <section class="detalhe-card">
                        <h2><i class="fas fa-circle-info" aria-hidden="true"></i> Informações</h2>
                        <dl class="detalhe-meta">
                            <div><dt>Status atual</dt><dd>${escapeHTML(STATUS_PROJETO[projeto.status]?.nome || "Em desenvolvimento")}</dd></div>
                            <div><dt>Professor orientador</dt><dd>${escapeHTML(projeto.professor_orientador || "A definir")}</dd></div>
                            <div><dt>Líder do projeto</dt><dd>${escapeHTML(projeto.lider?.nome || "A definir")}</dd></div>
                            <div><dt>Última atualização</dt><dd>${escapeHTML(formatarData(projeto.data_atualizacao) || "Não informada")}</dd></div>
                        </dl>
                    </section>

                    <section class="detalhe-card">
                        <h2><i class="fas fa-code" aria-hidden="true"></i> Tecnologias e tags</h2>
                        <div class="tags-lista">
                            ${(projeto.tecnologias || []).length
                                ? projeto.tecnologias.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")
                                : '<span class="tag">Não informadas</span>'}
                        </div>
                    </section>
                </aside>
            </div>
        </article>
    `;

    if (hero) hero.hidden = true;
    if (catalogo) catalogo.hidden = true;
    detalhe.hidden = false;

    if (atualizarUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set("projeto", projeto.slug);
        history.pushState({ projeto: projeto.slug }, "", url);
    }

    document.title = `${projeto.nome} — Projetos LSD`;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function fecharDetalhe({ atualizarUrl = true } = {}) {
    projetoAberto = null;
    document.getElementById("portfolioHero").hidden = false;
    document.getElementById("catalogo").hidden = false;
    document.getElementById("projetoDetalhe").hidden = true;
    document.title = "Projetos — LSD";

    if (atualizarUrl) {
        const url = new URL(window.location.href);
        url.searchParams.delete("projeto");
        history.pushState({}, "", url);
    }
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function anexarDocumento(evento) {
    evento.preventDefault();
    if (!projetoAberto) return;
    const form = evento.currentTarget;
    const arquivo = document.getElementById("documentoArquivo")?.files?.[0];
    const titulo = document.getElementById("documentoTitulo")?.value.trim() || "";
    const botao = form.querySelector("button[type='submit']");
    if (!arquivo) return mostrarToast("Selecione um documento.", "erro");

    const dados = new FormData();
    dados.append("documento", arquivo);
    dados.append("titulo", titulo);
    botao.disabled = true;
    const original = botao.innerHTML;
    botao.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Enviando';

    const resposta = await requisitar(`/api/projetos/${projetoAberto.id}/documentos`, {
        method: "POST",
        body: dados
    });
    botao.disabled = false;
    botao.innerHTML = original;

    if (!resposta.ok) return mostrarToast(resposta.dados?.message || "Não foi possível anexar.", "erro");
    projetoAberto.documentos.unshift(resposta.dados.documento);
    const indice = projetos.findIndex((item) => item.id === projetoAberto.id);
    if (indice >= 0) projetos[indice] = projetoAberto;
    renderizarDetalhe(projetoAberto, { atualizarUrl: false });
    mostrarToast("Documento anexado com sucesso.");
}

async function removerDocumento(documentoId) {
    if (!projetoAberto || !window.confirm("Remover este documento do projeto?")) return;
    const resposta = await requisitar(`/api/projetos/${projetoAberto.id}/documentos/${documentoId}`, {
        method: "DELETE"
    });
    if (!resposta.ok) return mostrarToast(resposta.dados?.message || "Não foi possível remover.", "erro");
    projetoAberto.documentos = projetoAberto.documentos.filter((item) => String(item.id) !== String(documentoId));
    renderizarDetalhe(projetoAberto, { atualizarUrl: false });
    mostrarToast("Documento removido.");
}

function abrirProjetoPorSlug(slug, opcoes = {}) {
    const projeto = projetos.find((item) => item.slug === slug || String(item.id) === String(slug));
    if (projeto) renderizarDetalhe(projeto, opcoes);
}

function inicializarEventos() {
    document.getElementById("buscaProjetos")?.addEventListener("input", renderizarProjetos);
    document.querySelector(".projeto-filtros")?.addEventListener("click", (evento) => {
        const botao = evento.target.closest("[data-filtro-status]");
        if (!botao) return;
        filtroStatus = botao.dataset.filtroStatus;
        document.querySelectorAll("[data-filtro-status]").forEach((item) => {
            const ativo = item === botao;
            item.classList.toggle("ativo", ativo);
            item.setAttribute("aria-pressed", String(ativo));
        });
        renderizarProjetos();
    });

    document.getElementById("projetosGrid")?.addEventListener("click", (evento) => {
        const botao = evento.target.closest("[data-abrir-projeto]");
        if (botao) abrirProjetoPorSlug(botao.dataset.abrirProjeto);
    });
    document.getElementById("btnVoltarProjetos")?.addEventListener("click", () => fecharDetalhe());

    document.getElementById("projetoDetalheConteudo")?.addEventListener("submit", (evento) => {
        if (evento.target.matches("#formDocumentoProjeto")) anexarDocumento(evento);
    });
    document.getElementById("projetoDetalheConteudo")?.addEventListener("click", (evento) => {
        const botao = evento.target.closest("[data-remover-documento]");
        if (botao) removerDocumento(botao.dataset.removerDocumento);
    });

    window.addEventListener("popstate", () => {
        const slug = new URLSearchParams(window.location.search).get("projeto");
        if (slug) abrirProjetoPorSlug(slug, { atualizarUrl: false });
        else fecharDetalhe({ atualizarUrl: false });
    });
}

async function iniciar() {
    inicializarEventos();
    const [resposta] = await Promise.all([
        requisitar("/api/projetos"),
        carregarUsuarioOpcional()
    ]);

    if (!resposta.ok || !Array.isArray(resposta.dados?.projetos)) {
        document.getElementById("projetosGrid").innerHTML = `
            <div class="portfolio-vazio">
                <i class="fas fa-triangle-exclamation"></i>
                <strong>Não foi possível carregar o portfólio</strong>
                <span>${escapeHTML(resposta.dados?.message || "Verifique se o servidor está em execução.")}</span>
            </div>
        `;
        return;
    }

    projetos = resposta.dados.projetos;
    atualizarEstatisticas();
    renderizarProjetos();

    const slugInicial = new URLSearchParams(window.location.search).get("projeto");
    if (slugInicial) {
        const existe = projetos.some((item) => item.slug === slugInicial || String(item.id) === String(slugInicial));
        if (existe) abrirProjetoPorSlug(slugInicial, { atualizarUrl: false });
        else mostrarToast("O projeto informado não foi encontrado.", "erro");
    }
}

document.addEventListener("DOMContentLoaded", iniciar);
