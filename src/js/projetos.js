const API_BASE = ["127.0.0.1", "localhost"].includes(window.location.hostname)
    ? "http://127.0.0.1:5000"
    : window.location.origin;
const TOKEN_KEY = "token_lsd";
const STATUS_PROJETO = {
    em_desenvolvimento: "Em desenvolvimento",
    em_producao: "Em produção",
    concluido: "Concluído"
};

let projetos = [];
let membrosDisponiveis = [];
let usuarioAtual = null;
let projetoAberto = null;
let elementoFocoModal = null;

function escapeHTML(valor) {
    return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function urlInternaOuHttp(valor, fallback = "") {
    const url = String(valor || "").trim();
    if (url.startsWith("/src/") || url.startsWith("/uploads/")) return `${API_BASE}${url}`;
    if (url.startsWith("./src/")) return url;
    try {
        const completa = new URL(url);
        return ["http:", "https:"].includes(completa.protocol) ? completa.href : fallback;
    } catch (_) { return fallback; }
}

function statusTagHTML(status) {
    return `<span class="tag tag-status status-${escapeHTML(status)}">${escapeHTML(STATUS_PROJETO[status] || STATUS_PROJETO.em_desenvolvimento)}</span>`;
}

function mostrarToast(mensagem, tipo = "") {
    const toast = document.getElementById("portfolioToast");
    if (!toast) return;
    toast.textContent = mensagem;
    toast.className = `portfolio-toast ${tipo} visivel`;
    clearTimeout(mostrarToast.timeout);
    mostrarToast.timeout = setTimeout(() => toast.classList.remove("visivel"), 3500);
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
        console.error("Falha ao consultar o portfólio:", erro);
        return { ok: false, status: 0, dados: { message: "Não foi possível conectar ao servidor." } };
    }
}

async function carregarUsuarioOpcional() {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    const resposta = await requisitar("/api/perfil");
    if (!resposta.ok || !resposta.dados?.id) return;
    usuarioAtual = resposta.dados;
    const area = document.getElementById("area-usuario");
    if (area) area.innerHTML = `<a href="dashboard.html" class="btn-entrar">Meu perfil</a>`;
    if (usuarioAtual.is_admin) document.getElementById("btnNovoProjetoAdmin").hidden = false;
}

function atualizarEstatisticas() {
    const membros = new Set();
    let documentos = 0;
    projetos.forEach((projeto) => {
        (projeto.membros || []).forEach((membro) => membros.add(String(membro.id)));
        documentos += (projeto.documentos || []).length;
    });
    document.getElementById("statTotal").textContent = String(projetos.length);
    document.getElementById("statMembros").textContent = String(membros.size);
    document.getElementById("statDocumentos").textContent = String(documentos);
}

function acoesAdminHTML(projeto, local = "card") {
    if (!usuarioAtual?.is_admin) return "";
    return `<div class="projeto-admin-acoes ${local === "detalhe" ? "no-detalhe" : ""}" aria-label="Administrar ${escapeHTML(projeto.nome)}">
        <button type="button" data-editar-projeto="${projeto.id}"><i class="fas fa-pen" aria-hidden="true"></i><span>Editar</span></button>
        <button type="button" class="acao-excluir" data-excluir-projeto="${projeto.id}"><i class="fas fa-trash" aria-hidden="true"></i><span>Excluir</span></button>
    </div>`;
}

function projetoCardHTML(projeto) {
    const membros = Array.isArray(projeto.membros) ? projeto.membros : [];
    const tecnologias = Array.isArray(projeto.tecnologias) ? projeto.tecnologias.slice(0, 3) : [];
    const avatares = membros.slice(0, 3).map((membro) => `<img src="${escapeHTML(urlInternaOuHttp(membro.foto, "./src/images/equipe/avatar/default-avatar.png"))}" alt="" loading="lazy">`).join("");
    return `<article class="projeto-card" data-projeto-slug="${escapeHTML(projeto.slug)}">
        ${acoesAdminHTML(projeto)}
        <button class="projeto-card-abertura" type="button" data-abrir-projeto="${escapeHTML(projeto.slug)}" aria-label="Abrir projeto ${escapeHTML(projeto.nome)}">
            <span class="projeto-card-imagem"><img src="${escapeHTML(urlInternaOuHttp(projeto.logo_url, "./src/images/LOGO_LSD.svg"))}" alt="Logo do projeto ${escapeHTML(projeto.nome)}" loading="lazy"></span>
            <span class="projeto-card-corpo"><span class="tags-lista">${statusTagHTML(projeto.status)}${tecnologias.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}</span><strong class="projeto-card-titulo">${escapeHTML(projeto.nome)}</strong><span class="projeto-card-descricao">${escapeHTML(projeto.descricao)}</span></span>
        </button>
        <div class="projeto-card-rodape"><div class="membros-mini">${avatares}<span>${membros.length ? `${membros.length} membro${membros.length === 1 ? "" : "s"}` : "Equipe a definir"}</span></div><button class="btn-ver-projeto" type="button" data-abrir-projeto="${escapeHTML(projeto.slug)}">Ver projeto <i class="fas fa-arrow-right" aria-hidden="true"></i></button></div>
    </article>`;
}

function filtrarProjetos() {
    const busca = document.getElementById("buscaProjetos")?.value.trim().toLocaleLowerCase("pt-BR") || "";
    if (!busca) return projetos;
    return projetos.filter((projeto) => [projeto.nome, projeto.descricao, projeto.professor_orientador,
        STATUS_PROJETO[projeto.status], ...(projeto.tecnologias || [])].join(" ").toLocaleLowerCase("pt-BR").includes(busca));
}

function renderizarProjetos() {
    const grid = document.getElementById("projetosGrid");
    const lista = filtrarProjetos();
    grid.setAttribute("aria-busy", "false");
    document.getElementById("resultadoContador").textContent = `${lista.length} projeto${lista.length === 1 ? "" : "s"}`;
    grid.innerHTML = lista.length ? lista.map(projetoCardHTML).join("") : `<div class="portfolio-vazio"><i class="fas fa-folder-open" aria-hidden="true"></i><strong>Nenhum projeto encontrado</strong><span>Tente buscar por outro nome ou tecnologia.</span></div>`;
}

function formatarData(data) {
    const valor = data ? new Date(data) : null;
    return valor && !Number.isNaN(valor.getTime()) ? valor.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

function podeGerenciarDocumentos(projeto) {
    return Boolean(usuarioAtual && (usuarioAtual.is_admin || String(projeto.lider_id) === String(usuarioAtual.id)));
}

function membroProjetoHTML(membro) {
    const funcao = membro.is_lider ? "Líder do projeto" : (membro.funcao || "Membro LSD");
    return `<a class="membro-projeto" href="dashboard.html?aba=membros&membro=${encodeURIComponent(membro.id)}"><img src="${escapeHTML(urlInternaOuHttp(membro.foto, "./src/images/equipe/avatar/default-avatar.png"))}" alt="Foto de ${escapeHTML(membro.nome)}" loading="lazy"><span><strong>${escapeHTML(membro.nome)}</strong><small class="${membro.is_lider ? "lider-selo" : ""}">${escapeHTML(funcao)}</small></span><i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a>`;
}

function documentoHTML(documento, podeGerenciar) {
    const mime = documento.arquivo_mime || "";
    const icone = mime.includes("pdf") ? "fa-file-pdf" : mime.includes("image") ? "fa-file-image" : "fa-file-lines";
    return `<article class="documento-item"><i class="fas ${icone}" aria-hidden="true"></i><div><a href="${escapeHTML(urlInternaOuHttp(documento.arquivo_url, "#"))}" target="_blank" rel="noopener noreferrer">${escapeHTML(documento.titulo || documento.arquivo_nome)}</a><small>${escapeHTML(documento.arquivo_nome)}${documento.data_criacao ? ` · ${escapeHTML(formatarData(documento.data_criacao))}` : ""}</small></div>${podeGerenciar ? `<button type="button" class="documento-remover" data-remover-documento="${documento.id}" aria-label="Remover documento"><i class="fas fa-trash" aria-hidden="true"></i></button>` : ""}</article>`;
}

function renderizarDetalhe(projeto, { atualizarUrl = true } = {}) {
    projetoAberto = projeto;
    const membros = projeto.membros || [];
    const documentos = projeto.documentos || [];
    const gerenciaDocs = podeGerenciarDocumentos(projeto);
    const repositorio = urlInternaOuHttp(projeto.repositorio_url);
    const site = urlInternaOuHttp(projeto.site_url);
    document.getElementById("projetoDetalheConteudo").innerHTML = `<article>
        <section class="detalhe-hero"><div class="detalhe-hero-imagem"><img src="${escapeHTML(urlInternaOuHttp(projeto.logo_url, "./src/images/LOGO_LSD.svg"))}" alt="Logo do projeto ${escapeHTML(projeto.nome)}"></div><div class="detalhe-hero-copy"><div class="tags-lista">${statusTagHTML(projeto.status)}${(projeto.tecnologias || []).slice(0, 4).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("")}</div><h1>${escapeHTML(projeto.nome)}</h1><p>${escapeHTML(projeto.descricao)}</p><div class="detalhe-acoes">${repositorio ? `<a class="detalhe-link principal" href="${escapeHTML(repositorio)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i> Repositório</a>` : ""}${site ? `<a class="detalhe-link" href="${escapeHTML(site)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i> Acessar projeto</a>` : ""}</div>${acoesAdminHTML(projeto, "detalhe")}</div></section>
        <div class="detalhe-grid"><div><section class="detalhe-card"><h2>Equipe do projeto</h2><div class="equipe-projeto-grid">${membros.length ? membros.map(membroProjetoHTML).join("") : `<div class="portfolio-vazio"><strong>Equipe ainda não vinculada</strong></div>`}</div></section><section class="detalhe-card"><h2>Documentação</h2><div class="documentos-lista">${documentos.length ? documentos.map((item) => documentoHTML(item, gerenciaDocs)).join("") : `<div class="portfolio-vazio"><strong>Nenhum documento publicado</strong><span>O líder do projeto pode anexar a documentação.</span></div>`}</div>${gerenciaDocs ? `<form class="documento-form" id="formDocumentoProjeto"><input type="text" id="documentoTitulo" maxlength="160" placeholder="Título do documento (opcional)"><div class="documento-form-linha"><input type="file" id="documentoArquivo" required><button type="submit"><i class="fas fa-cloud-arrow-up"></i> Anexar</button></div></form>` : ""}</section></div>
        <aside><section class="detalhe-card"><h2>Ficha do projeto</h2><dl class="detalhe-meta"><div><dt>Professor orientador</dt><dd>${escapeHTML(projeto.professor_orientador || "A definir")}</dd></div><div><dt>Líder do projeto</dt><dd>${escapeHTML(projeto.lider?.nome || "A definir")}</dd></div><div><dt>Última atualização</dt><dd>${escapeHTML(formatarData(projeto.data_atualizacao) || "Não informada")}</dd></div></dl></section><section class="detalhe-card"><h2>Tecnologias e tags</h2><div class="tags-lista">${statusTagHTML(projeto.status)}${(projeto.tecnologias || []).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("") || `<span class="tag">Não informadas</span>`}</div></section></aside></div>
    </article>`;
    document.getElementById("portfolioHero").hidden = true;
    document.getElementById("catalogo").hidden = true;
    document.getElementById("projetoDetalhe").hidden = false;
    if (atualizarUrl) { const url = new URL(location.href); url.searchParams.set("projeto", projeto.slug); history.pushState({ projeto: projeto.slug }, "", url); }
    document.title = `${projeto.nome} — Projetos LSD`;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function fecharDetalhe({ atualizarUrl = true } = {}) {
    projetoAberto = null;
    document.getElementById("portfolioHero").hidden = false;
    document.getElementById("catalogo").hidden = false;
    document.getElementById("projetoDetalhe").hidden = true;
    document.title = "Projetos — LSD";
    if (atualizarUrl) { const url = new URL(location.href); url.searchParams.delete("projeto"); history.pushState({}, "", url); }
}

async function carregarMembrosAdmin() {
    if (membrosDisponiveis.length) return;
    const resposta = await requisitar("/api/membros");
    if (resposta.ok && Array.isArray(resposta.dados)) membrosDisponiveis = resposta.dados;
}

function preencherMembros(selecionados = []) {
    const ids = new Set(selecionados.map(String));
    const lista = [...membrosDisponiveis].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    document.getElementById("projetoLider").innerHTML = `<option value="">A definir</option>${lista.map((m) => `<option value="${m.id}">${escapeHTML(m.nome)}</option>`).join("")}`;
    document.getElementById("projetoMembrosOpcoes").innerHTML = lista.length ? lista.map((m) => `<label class="projeto-membro-opcao"><input type="checkbox" value="${m.id}" ${ids.has(String(m.id)) ? "checked" : ""}><img src="${escapeHTML(urlInternaOuHttp(m.foto, "./src/images/equipe/avatar/default-avatar.png"))}" alt=""><span><strong>${escapeHTML(m.nome)}</strong><small>${escapeHTML(m.funcao || "Membro LSD")}</small></span></label>`).join("") : `<p>Nenhum membro cadastrado.</p>`;
}

async function abrirModalProjeto(projeto = null) {
    if (!usuarioAtual?.is_admin) return;
    await carregarMembrosAdmin();
    elementoFocoModal = document.activeElement;
    const form = document.getElementById("formProjetoAdmin");
    form.reset();
    document.getElementById("modalProjetoTitulo").textContent = projeto ? "Editar projeto" : "Novo projeto";
    document.getElementById("projetoAdminId").value = projeto?.id || "";
    document.getElementById("projetoNome").value = projeto?.nome || "";
    document.getElementById("projetoStatus").value = projeto?.status || "em_desenvolvimento";
    document.getElementById("projetoDescricao").value = projeto?.descricao || "";
    document.getElementById("projetoOrientador").value = projeto?.professor_orientador || "";
    document.getElementById("projetoTecnologias").value = (projeto?.tecnologias || []).join(", ");
    document.getElementById("projetoRepositorio").value = projeto?.repositorio_url || "";
    document.getElementById("projetoSite").value = projeto?.site_url || "";
    document.getElementById("projetoLogo").required = !projeto;
    document.getElementById("projetoLogoAtual").textContent = projeto ? "Deixe vazio para manter a imagem atual." : "Obrigatória ao criar um novo projeto.";
    preencherMembros((projeto?.membros || []).map((m) => m.id));
    document.getElementById("projetoLider").value = projeto?.lider_id || "";
    const modal = document.getElementById("modalProjetoAdmin");
    modal.hidden = false;
    document.body.classList.add("modal-aberto");
    requestAnimationFrame(() => { modal.classList.add("visivel"); document.getElementById("projetoNome").focus(); });
}

function fecharModalProjeto() {
    const modal = document.getElementById("modalProjetoAdmin");
    modal.classList.remove("visivel");
    document.body.classList.remove("modal-aberto");
    setTimeout(() => { modal.hidden = true; elementoFocoModal?.focus(); }, 180);
}

async function salvarProjeto(evento) {
    evento.preventDefault();
    if (!usuarioAtual?.is_admin) return;
    const id = document.getElementById("projetoAdminId").value;
    const membroIds = [...document.querySelectorAll("#projetoMembrosOpcoes input:checked")].map((input) => Number(input.value));
    const liderId = document.getElementById("projetoLider").value;
    if (liderId && !membroIds.includes(Number(liderId))) membroIds.push(Number(liderId));
    const dados = new FormData();
    [["nome", "projetoNome"], ["status", "projetoStatus"], ["descricao", "projetoDescricao"], ["professor_orientador", "projetoOrientador"], ["lider_id", "projetoLider"], ["repositorio_url", "projetoRepositorio"], ["site_url", "projetoSite"]].forEach(([chave, campo]) => dados.append(chave, document.getElementById(campo).value.trim()));
    dados.append("tecnologias", JSON.stringify(document.getElementById("projetoTecnologias").value.split(",").map((v) => v.trim()).filter(Boolean)));
    dados.append("membro_ids", JSON.stringify(membroIds));
    const logo = document.getElementById("projetoLogo").files?.[0];
    if (logo) dados.append("logo", logo);
    const botao = document.getElementById("btnSalvarProjeto");
    botao.disabled = true;
    const resposta = await requisitar(id ? `/api/admin/projetos/${id}` : "/api/admin/projetos", { method: id ? "PUT" : "POST", body: dados });
    botao.disabled = false;
    if (!resposta.ok) return mostrarToast(resposta.dados?.message || "Não foi possível salvar o projeto.", "erro");
    const salvo = resposta.dados.projeto;
    const indice = projetos.findIndex((p) => String(p.id) === String(salvo.id));
    if (indice >= 0) projetos[indice] = salvo; else projetos.push(salvo);
    projetos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    fecharModalProjeto(); atualizarEstatisticas(); renderizarProjetos();
    if (projetoAberto?.id === salvo.id) renderizarDetalhe(salvo, { atualizarUrl: false });
    mostrarToast(id ? "Projeto atualizado." : "Projeto adicionado.");
}

async function excluirProjeto(id) {
    if (!usuarioAtual?.is_admin) return;
    const projeto = projetos.find((p) => String(p.id) === String(id));
    if (!projeto || !window.confirm(`Excluir o projeto “${projeto.nome}”?`)) return;
    const resposta = await requisitar(`/api/admin/projetos/${id}`, { method: "DELETE" });
    if (!resposta.ok) return mostrarToast(resposta.dados?.message || "Não foi possível excluir.", "erro");
    projetos = projetos.filter((p) => String(p.id) !== String(id));
    if (projetoAberto?.id === projeto.id) fecharDetalhe();
    atualizarEstatisticas(); renderizarProjetos(); mostrarToast("Projeto excluído.");
}

async function anexarDocumento(evento) {
    evento.preventDefault();
    const arquivo = document.getElementById("documentoArquivo")?.files?.[0];
    if (!arquivo || !projetoAberto) return;
    const dados = new FormData(); dados.append("documento", arquivo); dados.append("titulo", document.getElementById("documentoTitulo").value.trim());
    const resposta = await requisitar(`/api/projetos/${projetoAberto.id}/documentos`, { method: "POST", body: dados });
    if (!resposta.ok) return mostrarToast(resposta.dados?.message || "Não foi possível anexar.", "erro");
    projetoAberto.documentos.unshift(resposta.dados.documento); renderizarDetalhe(projetoAberto, { atualizarUrl: false }); atualizarEstatisticas(); mostrarToast("Documento anexado.");
}

async function removerDocumento(id) {
    if (!projetoAberto || !window.confirm("Remover este documento?")) return;
    const resposta = await requisitar(`/api/projetos/${projetoAberto.id}/documentos/${id}`, { method: "DELETE" });
    if (!resposta.ok) return mostrarToast(resposta.dados?.message || "Não foi possível remover.", "erro");
    projetoAberto.documentos = projetoAberto.documentos.filter((d) => String(d.id) !== String(id)); renderizarDetalhe(projetoAberto, { atualizarUrl: false }); atualizarEstatisticas();
}

function abrirProjetoPorSlug(slug, opcoes = {}) {
    const projeto = projetos.find((p) => p.slug === slug || String(p.id) === String(slug));
    if (projeto) renderizarDetalhe(projeto, opcoes);
}

function inicializarEventos() {
    document.getElementById("buscaProjetos").addEventListener("input", renderizarProjetos);
    document.getElementById("btnNovoProjetoAdmin").addEventListener("click", () => abrirModalProjeto());
    document.getElementById("modalProjetoFechar").addEventListener("click", fecharModalProjeto);
    document.getElementById("modalProjetoCancelar").addEventListener("click", fecharModalProjeto);
    document.getElementById("formProjetoAdmin").addEventListener("submit", salvarProjeto);
    document.getElementById("modalProjetoAdmin").addEventListener("click", (e) => { if (e.target.id === "modalProjetoAdmin") fecharModalProjeto(); });
    document.getElementById("btnVoltarProjetos").addEventListener("click", () => fecharDetalhe());
    document.addEventListener("click", (e) => {
        const abrir = e.target.closest("[data-abrir-projeto]"); if (abrir) abrirProjetoPorSlug(abrir.dataset.abrirProjeto);
        const editar = e.target.closest("[data-editar-projeto]"); if (editar) abrirModalProjeto(projetos.find((p) => String(p.id) === editar.dataset.editarProjeto));
        const excluir = e.target.closest("[data-excluir-projeto]"); if (excluir) excluirProjeto(excluir.dataset.excluirProjeto);
        const remover = e.target.closest("[data-remover-documento]"); if (remover) removerDocumento(remover.dataset.removerDocumento);
    });
    document.addEventListener("submit", (e) => { if (e.target.matches("#formDocumentoProjeto")) anexarDocumento(e); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.getElementById("modalProjetoAdmin").hidden) fecharModalProjeto(); });
    window.addEventListener("popstate", () => { const slug = new URLSearchParams(location.search).get("projeto"); if (slug) abrirProjetoPorSlug(slug, { atualizarUrl: false }); else fecharDetalhe({ atualizarUrl: false }); });
}

async function iniciar() {
    inicializarEventos();
    const [resposta] = await Promise.all([requisitar("/api/projetos"), carregarUsuarioOpcional()]);
    if (!resposta.ok || !Array.isArray(resposta.dados?.projetos)) {
        document.getElementById("projetosGrid").innerHTML = `<div class="portfolio-vazio"><i class="fas fa-triangle-exclamation"></i><strong>Não foi possível carregar o portfólio</strong><span>${escapeHTML(resposta.dados?.message || "Verifique se o servidor está em execução.")}</span></div>`; return;
    }
    projetos = resposta.dados.projetos; atualizarEstatisticas(); renderizarProjetos();
    const slug = new URLSearchParams(location.search).get("projeto");
    if (slug) abrirProjetoPorSlug(slug, { atualizarUrl: false });
}

document.addEventListener("DOMContentLoaded", iniciar);
