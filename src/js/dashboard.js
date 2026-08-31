/**
 * Painel do Membro — LSD
 * Kanban (CRUD + drag-and-drop + localStorage), troca de abas e
 * Feed da Comunidade (criação de posts + localStorage).
 *
 * Nada aqui depende de backend: a camada de dados fica isolada em
 * funções de carregar/salvar, prontas pra trocar por chamadas fetch
 * quando a API existir. Contrato sugerido:
 *
 *   GET    /api/cards            -> [{ id, titulo, descricao, status, cor }]
 *   POST   /api/cards            { titulo, descricao, status, cor } -> card criado
 *   PUT    /api/cards/:id        { titulo, descricao, status, cor } -> card atualizado
 *   DELETE /api/cards/:id        -> 204
 *
 *   GET    /api/posts            -> [{ id, autor, foto, meta, texto, curtidas, comentarios }]
 *   POST   /api/posts            { texto } -> post criado
 */

function escapeHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto || "";
    return div.innerHTML;
}

function gerarId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

/* =========================================================
   KANBAN
   ========================================================= */

const KANBAN_STORAGE_KEY = "lsd_kanban_cards";

// Cards iniciais, baseados nos projetos reais do site (usados só na
// primeira visita, quando ainda não existe nada salvo no navegador).
const cardsIniciais = [
    { id: gerarId(), titulo: "FioCruz", descricao: "Monitorar mosquitos modificados para impedir a transmissão de dengue.", status: "andamento", cor: "amarelo" },
    { id: gerarId(), titulo: "Racismo Algorítmico", descricao: "Análise do impacto do racismo em algoritmos de IA.", status: "andamento", cor: "rosa" },
    { id: gerarId(), titulo: "Lupa Digital", descricao: "Ferramenta de apoio visual com OpenCV.", status: "andamento", cor: "azul" },
    { id: gerarId(), titulo: "Corrige AI", descricao: "Corrige redação com inteligência artificial treinada.", status: "andamento", cor: "verde" },
    { id: gerarId(), titulo: "TTNet", descricao: "Análise de partidas de Ping Pong com visão computacional.", status: "concluido", cor: "lilas" },
    { id: gerarId(), titulo: "Simulados Enem", descricao: "Inscrição, notas e premiações dos simulados.", status: "concluido", cor: "amarelo" },
    { id: gerarId(), titulo: "Card de exemplo", descricao: "Este é um card de exemplo — edite ou exclua e crie os seus.", status: "afazer", cor: "azul" }
];

function carregarCards() {
    const salvo = localStorage.getItem(KANBAN_STORAGE_KEY);
    if (salvo) {
        try {
            const dados = JSON.parse(salvo);
            if (Array.isArray(dados)) return dados;
        } catch (erro) {
            console.warn("Não foi possível ler os cards salvos, recomeçando do zero.", erro);
        }
    }
    salvarCards(cardsIniciais);
    return cardsIniciais;
}

function salvarCards(lista) {
    localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(lista));
    // TODO BACKEND: substituir pela sincronização real com a API (ver contrato no topo do arquivo).
}

let cards = carregarCards();
let editandoId = null;
let excluindoId = null;

const listas = {
    afazer: document.getElementById("lista-afazer"),
    andamento: document.getElementById("lista-andamento"),
    concluido: document.getElementById("lista-concluido")
};

const contadores = {
    afazer: document.getElementById("contador-afazer"),
    andamento: document.getElementById("contador-andamento"),
    concluido: document.getElementById("contador-concluido")
};

const kanbanBoard = document.querySelector(".kanban-board");

// Elementos do mini-resumo de progresso (coluna esquerda)
const miniTotal = document.getElementById("miniTotal");
const miniAndamento = document.getElementById("miniAndamento");
const miniConcluido = document.getElementById("miniConcluido");
const miniBarra = document.getElementById("miniBarra");
const miniPct = document.getElementById("miniPct");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitulo = document.getElementById("modalTitulo");
const formCard = document.getElementById("formCard");
const campoTitulo = document.getElementById("cardTitulo");
const campoDescricao = document.getElementById("cardDescricao");
const campoStatus = document.getElementById("cardStatus");
const campoCor = document.getElementById("cardCor");

const confirmOverlay = document.getElementById("confirmOverlay");

function renderizarKanban() {
    Object.keys(listas).forEach((status) => {
        const lista = listas[status];
        const itens = cards.filter((c) => c.status === status);

        contadores[status].textContent = itens.length;

        lista.innerHTML = itens.length
            ? itens.map(cardParaHTML).join("")
            : `<div class="kanban-vazio">Arraste um card pra cá<br>ou crie um novo.</div>`;
    });

    renderizarProgresso();
    ativarDragDosCards();
}

function cardParaHTML(card) {
    return `
        <article class="post-it cor-${card.cor}" draggable="true" data-id="${card.id}">
            <div class="post-it-acoes">
                <button type="button" class="post-it-editar" data-id="${card.id}" title="Editar" aria-label="Editar card">
                    <i class="fas fa-pen"></i>
                </button>
                <button type="button" class="post-it-excluir" data-id="${card.id}" title="Excluir" aria-label="Excluir card">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <h3>${escapeHTML(card.titulo)}</h3>
            <p>${escapeHTML(card.descricao)}</p>
        </article>
    `;
}

function renderizarProgresso() {
    const total = cards.length;
    const emAndamento = cards.filter((c) => c.status === "andamento").length;
    const concluidos = cards.filter((c) => c.status === "concluido").length;
    const progresso = total ? Math.round((concluidos / total) * 100) : 0;

    miniTotal.textContent = total;
    miniAndamento.textContent = emAndamento;
    miniConcluido.textContent = concluidos;
    miniBarra.style.width = progresso + "%";
    miniPct.textContent = progresso;
}

// ---------- CRUD: criar / editar ----------

function abrirModalNovo(statusInicial) {
    editandoId = null;
    modalTitulo.textContent = "Novo card";
    formCard.reset();
    campoStatus.value = statusInicial || "afazer";
    campoCor.value = "amarelo";
    abrirModal(modalOverlay);
    campoTitulo.focus();
}

function abrirModalEditar(id) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;

    editandoId = id;
    modalTitulo.textContent = "Editar card";
    campoTitulo.value = card.titulo;
    campoDescricao.value = card.descricao;
    campoStatus.value = card.status;
    campoCor.value = card.cor;
    abrirModal(modalOverlay);
    campoTitulo.focus();
}

function abrirModal(el) { el.hidden = false; }
function fecharModal(el) { el.hidden = true; }

formCard.addEventListener("submit", (e) => {
    e.preventDefault();

    const titulo = campoTitulo.value.trim();
    if (!titulo) return;

    const dados = {
        titulo,
        descricao: campoDescricao.value.trim(),
        status: campoStatus.value,
        cor: campoCor.value
    };

    if (editandoId) {
        cards = cards.map((c) => (c.id === editandoId ? { ...c, ...dados } : c));
    } else {
        cards.push({ id: gerarId(), ...dados });
    }

    salvarCards(cards);
    renderizarKanban();
    fecharModal(modalOverlay);
});

document.getElementById("btnNovoCard").addEventListener("click", () => abrirModalNovo());
document.getElementById("btnNovoCardHeader").addEventListener("click", () => {
    ativarAba("kanban");
    abrirModalNovo();
});
document.getElementById("modalFechar").addEventListener("click", () => fecharModal(modalOverlay));
document.getElementById("modalCancelar").addEventListener("click", () => fecharModal(modalOverlay));
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) fecharModal(modalOverlay);
});

// ---------- CRUD: excluir ----------

function pedirConfirmacaoExclusao(id) {
    excluindoId = id;
    abrirModal(confirmOverlay);
}

document.getElementById("confirmCancelar").addEventListener("click", () => {
    excluindoId = null;
    fecharModal(confirmOverlay);
});

document.getElementById("confirmExcluir").addEventListener("click", () => {
    cards = cards.filter((c) => c.id !== excluindoId);
    salvarCards(cards);
    renderizarKanban();
    excluindoId = null;
    fecharModal(confirmOverlay);
});

confirmOverlay.addEventListener("click", (e) => {
    if (e.target === confirmOverlay) fecharModal(confirmOverlay);
});

// Delegação: os cards são recriados a cada renderizarKanban(), então os
// listeners de editar/excluir ficam no board (que é fixo), não nos cards.
kanbanBoard.addEventListener("click", (e) => {
    const botaoEditar = e.target.closest(".post-it-editar");
    const botaoExcluir = e.target.closest(".post-it-excluir");

    if (botaoEditar) abrirModalEditar(botaoEditar.dataset.id);
    if (botaoExcluir) pedirConfirmacaoExclusao(botaoExcluir.dataset.id);
});

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!modalOverlay.hidden) fecharModal(modalOverlay);
    if (!confirmOverlay.hidden) fecharModal(confirmOverlay);
});

// ---------- Arrastar e soltar entre colunas ----------

function ativarDragDosCards() {
    document.querySelectorAll(".post-it").forEach((el) => {
        el.addEventListener("dragstart", () => el.classList.add("dragging"));
        el.addEventListener("dragend", () => el.classList.remove("dragging"));
    });
}

Object.values(listas).forEach((lista) => {
    lista.addEventListener("dragover", (e) => {
        e.preventDefault();
        lista.classList.add("drag-over");
    });

    lista.addEventListener("dragleave", () => lista.classList.remove("drag-over"));

    lista.addEventListener("drop", (e) => {
        e.preventDefault();
        lista.classList.remove("drag-over");

        const cardArrastado = document.querySelector(".post-it.dragging");
        if (!cardArrastado) return;

        const id = cardArrastado.dataset.id;
        const novoStatus = lista.dataset.status;

        cards = cards.map((c) => (c.id === id ? { ...c, status: novoStatus } : c));
        salvarCards(cards);
        renderizarKanban();
    });
});

/* =========================================================
   TROCA DE ABAS (Kanban / Feed)
   ========================================================= */

const botoesAba = document.querySelectorAll(".aba-btn");
const paineisAba = {
    kanban: document.getElementById("aba-kanban"),
    comunidade: document.getElementById("aba-comunidade")
};

function ativarAba(nome) {
    botoesAba.forEach((btn) => {
        const ativa = btn.dataset.aba === nome;
        btn.classList.toggle("ativa", ativa);
        btn.classList.toggle("active", ativa);
        btn.setAttribute("aria-selected", ativa ? "true" : "false");
    });

    Object.keys(paineisAba).forEach((chave) => {
        const painel = paineisAba[chave];
        const ativa = chave === nome;
        painel.classList.toggle("ativa", ativa);
        painel.classList.toggle("active", ativa);
        painel.hidden = !ativa;
    });
}

botoesAba.forEach((btn) => {
    btn.addEventListener("click", () => ativarAba(btn.dataset.aba));
});

/* =========================================================
   FEED DA COMUNIDADE
   ========================================================= */

const FEED_STORAGE_KEY = "lsd_feed_posts";
const AVATAR_USUARIO = "./src/images/equipe/avatar/bryan.jpg";

const postsIniciais = [
    {
        id: gerarId(),
        autor: "Paula Giovanna",
        foto: "./src/images/equipe/avatar/giovanna.jpg",
        meta: "há 2 horas · Corrige AI",
        texto: "Rodada de testes do Corrige AI com as primeiras redações reais terminou! O modelo já está pegando bem os critérios de coesão. Bora ajustar a rubrica de repertório sociocultural essa semana.",
        midia: { icone: "fa-chart-line", texto: "Gráfico de acurácia do modelo" },
        curtidas: 12,
        comentarios: 4
    },
    {
        id: gerarId(),
        autor: "John Keyrrison",
        foto: "./src/images/equipe/avatar/john.jpg",
        meta: "há 5 horas · TTNet",
        texto: "Subimos a análise de trajetória da bola pra 60fps no TTNet. Ainda preciso lapidar a detecção quando a mesa reflete luz, mas já dá pra ver a diferença no vídeo de teste.",
        midia: { icone: "fa-video", texto: "Vídeo de demonstração — TTNet" },
        curtidas: 9,
        comentarios: 2
    },
    {
        id: gerarId(),
        autor: "Isabelly Gomes",
        foto: "./src/images/equipe/avatar/isabelly.jpg",
        meta: "ontem · Lupa Digital",
        texto: "Primeiro protótipo de tela do Lupa Digital pronto pra revisão. Feedback de vocês é muito bem-vindo antes de eu partir pra versão com OpenCV integrado.",
        midia: { icone: "fa-image", texto: "Print do protótipo — Lupa Digital" },
        curtidas: 17,
        comentarios: 6
    }
];

function carregarPosts() {
    const salvo = localStorage.getItem(FEED_STORAGE_KEY);
    if (salvo) {
        try {
            const dados = JSON.parse(salvo);
            if (Array.isArray(dados)) return dados;
        } catch (erro) {
            console.warn("Não foi possível ler os posts salvos, recomeçando do zero.", erro);
        }
    }
    salvarPosts(postsIniciais);
    return postsIniciais;
}

function salvarPosts(lista) {
    localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(lista));
    // TODO BACKEND: GET/POST /api/posts (ver contrato no topo do arquivo).
}

let posts = carregarPosts();
const curtidos = new Set();

const feedLista = document.getElementById("feedLista");
const novoPostTexto = document.getElementById("novoPostTexto");
const btnPublicarPost = document.getElementById("btnPublicarPost");

function renderizarFeed() {
    feedLista.innerHTML = posts.map(postParaHTML).join("");
}

function postParaHTML(post) {
    const curtido = curtidos.has(post.id);
    const midiaHTML = post.midia
        ? `<div class="post-card-midia"><i class="fas ${post.midia.icone}"></i><span>${escapeHTML(post.midia.texto)}</span></div>`
        : "";

    return `
        <article class="post-card" data-id="${post.id}">
            <div class="post-card-topo">
                <img src="${post.foto}" alt="${escapeHTML(post.autor)}">
                <div>
                    <div class="post-card-autor">${escapeHTML(post.autor)}</div>
                    <div class="post-card-meta">${escapeHTML(post.meta)}</div>
                </div>
            </div>

            <p class="post-card-texto">${escapeHTML(post.texto)}</p>

            ${midiaHTML}

            <div class="post-card-acoes">
                <button type="button" class="post-curtir ${curtido ? "curtido" : ""}" data-id="${post.id}">
                    <i class="fa-solid fa-thumbs-up"></i> Curtir (${post.curtidas})
                </button>
                <button type="button">
                    <i class="fa-regular fa-comment"></i> Comentar (${post.comentarios})
                </button>
                <button type="button">
                    <i class="fa-solid fa-share"></i> Compartilhar
                </button>
            </div>
        </article>
    `;
}

btnPublicarPost.addEventListener("click", () => {
    const texto = novoPostTexto.value.trim();
    if (!texto) {
        novoPostTexto.focus();
        return;
    }

    posts.unshift({
        id: gerarId(),
        autor: "Bryan William",
        foto: AVATAR_USUARIO,
        meta: "agora mesmo",
        texto,
        midia: null,
        curtidas: 0,
        comentarios: 0
    });

    salvarPosts(posts);
    renderizarFeed();
    novoPostTexto.value = "";
});

feedLista.addEventListener("click", (e) => {
    const botaoCurtir = e.target.closest(".post-curtir");
    if (!botaoCurtir) return;

    const id = botaoCurtir.dataset.id;
    const post = posts.find((p) => p.id === id);
    if (!post) return;

    if (curtidos.has(id)) {
        curtidos.delete(id);
        post.curtidas = Math.max(0, post.curtidas - 1);
    } else {
        curtidos.add(id);
        post.curtidas += 1;
    }

    salvarPosts(posts);
    renderizarFeed();
});

/* =========================================================
   MEMBROS EM DESTAQUE (reaproveita os dados da Equipe)
   ========================================================= */

function renderizarMembrosDestaque() {
    const container = document.getElementById("listaMembrosDestaque");
    if (!container || typeof equipeMembros === "undefined") return;

    const destaque = equipeMembros.slice(1, 6); // pula o próprio usuário logado (índice 0)

    container.innerHTML = destaque.map((m) => `
        <li>
            <img src="${m.foto}" alt="${escapeHTML(m.nome)}">
            <div>
                <div class="membro-destaque-nome">${escapeHTML(m.nome)}</div>
                <div class="membro-destaque-funcao">${escapeHTML(m.funcao)}</div>
            </div>
        </li>
    `).join("");
}

/* =========================================================
   INÍCIO
   ========================================================= */

renderizarKanban();
renderizarFeed();
renderizarMembrosDestaque();

/* =========================================================
   MODAIS: Editar Capa / Editar Perfil
   ========================================================= */

const modalEditarCapa = document.getElementById('modalEditarCapa');
const modalEditarPerfil = document.getElementById('modalEditarPerfil');
const btnEditarCapa = document.getElementById('btnEditarCapa');
const btnEditarPerfil = document.getElementById('btnEditarPerfil');

if (btnEditarCapa && modalEditarCapa) {
    btnEditarCapa.addEventListener('click', () => { modalEditarCapa.hidden = false; });
    modalEditarCapa.addEventListener('click', (e) => { if (e.target === modalEditarCapa) modalEditarCapa.hidden = true; });
    modalEditarCapa.querySelectorAll('[data-modal-close], [data-modal-cancel]').forEach((b) => b && b.addEventListener('click', () => modalEditarCapa.hidden = true));

    const formCapa = document.getElementById('formEditarCapa');
    const inputCapa = document.getElementById('inputCapa');
    if (formCapa) formCapa.addEventListener('submit', (e) => {
        e.preventDefault();
        const file = inputCapa && inputCapa.files && inputCapa.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const img = document.querySelector('.perfil-capa img');
                if (img) img.src = reader.result;
            };
            reader.readAsDataURL(file);
        }
        modalEditarCapa.hidden = true;
    });
}

if (btnEditarPerfil && modalEditarPerfil) {
    btnEditarPerfil.addEventListener('click', () => {
        const nomeEl = document.getElementById('perfilNome');
        const funcEl = document.getElementById('perfilFuncao');
        const nomeInput = document.getElementById('perfilNomeInput');
        const funcInput = document.getElementById('perfilFuncaoInput');
        if (nomeEl && nomeInput) nomeInput.value = nomeEl.textContent.trim();
        if (funcEl && funcInput) funcInput.value = funcEl.textContent.trim();
        modalEditarPerfil.hidden = false;
    });
    modalEditarPerfil.addEventListener('click', (e) => { if (e.target === modalEditarPerfil) modalEditarPerfil.hidden = true; });
    modalEditarPerfil.querySelectorAll('[data-modal-close], [data-modal-cancel]').forEach((b) => b && b.addEventListener('click', () => modalEditarPerfil.hidden = true));

    const formPerfil = document.getElementById('formEditarPerfil');
    const inputAvatar = document.getElementById('inputAvatar');
    if (formPerfil) formPerfil.addEventListener('submit', (e) => {
        e.preventDefault();
        const nomeInput = document.getElementById('perfilNomeInput');
        const funcInput = document.getElementById('perfilFuncaoInput');
        const avatarFile = inputAvatar && inputAvatar.files && inputAvatar.files[0];
        if (nomeInput) document.getElementById('perfilNome').textContent = nomeInput.value.trim() || 'Sem nome';
        if (funcInput) document.getElementById('perfilFuncao').textContent = funcInput.value.trim() || '';
        if (avatarFile) {
            const reader = new FileReader();
            reader.onload = () => {
                const avatarImg = document.querySelector('.perfil-avatar');
                if (avatarImg) avatarImg.src = reader.result;
            };
            reader.readAsDataURL(avatarFile);
        }
        modalEditarPerfil.hidden = true;
    });
}

const API_URL = "http://127.0.0.1:5000/api";
const token = localStorage.getItem("token_lsd") || "seu_token_mock";

// Função para headers autenticados
function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// Substitua a função carregarCards por:
async function carregarCardsAPI() {
    try {
        const res = await fetch(`${API_URL}/cards`, { headers: getHeaders() });
        cards = await res.json();
        renderizarKanban();
    } catch (err) {
        console.error("Erro ao carregar cards da API:", err);
    }
}

// Substitua a função salvar/criar card por:
async function salvarCardAPI(dadosCard, id = null) {
    const url = id ? `${API_URL}/cards/${id}` : `${API_URL}/cards`;
    const method = id ? 'PUT' : 'POST';

    await fetch(url, {
        method: method,
        headers: getHeaders(),
        body: JSON.stringify(dadosCard)
    });
    await carregarCardsAPI();
}

// Substitua a publicação de Post do Feed por:
async function publicarPostAPI(texto) {
    await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ texto })
    });
    await carregarFeedAPI();
}
