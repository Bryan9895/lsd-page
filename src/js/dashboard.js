/**
 * Painel do Membro — LSD (Integração Completa Flask + SQLite)
 */

const API_BASE = "http://127.0.0.1:5000"; 
const TOKEN_KEY = "token_lsd";

function normalizarUrlImagem(path, fallback = "./src/images/equipe/avatar/bryan.jpg") {
    if (!path) return fallback;
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("./")) {
        return path;
    }
    return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

function obterToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function getHeaders(isFormData = false) {
    const token = obterToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (!isFormData) headers["Content-Type"] = "application/json";
    return headers;
}

function escapeHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto || "";
    return div.innerHTML;
}

// Estado local
let usuarioAtual = null;
let cards = [];
let posts = [];
let editandoId = null;
let excluindoId = null;

// Validação de permissão de Administrador
function usuarioEhAdmin() {
    return usuarioAtual && (usuarioAtual.is_admin === true || usuarioAtual.cargo === "admin");
}

/* =========================================================
   1. TROCA DE ABAS E SISTEMA DE ADMINISTRADOR
   ========================================================= */

function inicializarTrocaDeAbas() {
    const btnsAba = document.querySelectorAll(".aba-btn, [data-aba]");
    const abasConteudo = document.querySelectorAll(".aba-conteudo");

    btnsAba.forEach((btn) => {
        btn.addEventListener("click", () => {
            btnsAba.forEach((b) => b.classList.remove("ativa", "active"));
            btn.classList.add("ativa", "active");

            const alvo = btn.dataset.aba;

            abasConteudo.forEach((aba) => {
                if (aba.id === `aba-${alvo}`) {
                    aba.classList.add("ativa");
                    aba.hidden = false;
                    aba.style.display = "block";
                } else {
                    aba.classList.remove("ativa");
                    aba.hidden = true;
                    aba.style.display = "none";
                }
            });

            if (alvo === "admin") {
                carregarMembrosAdmin();
            }
        });
    });
}

// Buscar e renderizar membros
async function carregarMembrosAdmin() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/membros`, { headers: getHeaders() });
        if (res.ok) {
            const membros = await res.json();
            renderizarTabelaMembros(membros);
        } else {
            console.error("Erro ao carregar membros.");
        }
    } catch (err) {
        console.error("Erro na requisição de membros:", err);
    }
}

function renderizarTabelaMembros(membros) {
    const tbody = document.getElementById("tabelaMembrosCorpo");
    if (!tbody) return;

    const eAdmin = usuarioEhAdmin();

    tbody.innerHTML = membros.map((m) => {
        const itemIsAdmin = m.is_admin || m.cargo === "admin";
        
        return `
            <tr>
                <td>
                    <div class="membro-celula">
                        <img src="${normalizarUrlImagem(m.foto)}" alt="${escapeHTML(m.nome)}">
                        <div>
                            <strong>${escapeHTML(m.nome)}</strong>
                            <small>${escapeHTML(m.funcao || 'Membro')}</small>
                        </div>
                    </div>
                </td>
                <td>${escapeHTML(m.email)}</td>
                <td>
                    <span class="badge-cargo ${itemIsAdmin ? 'badge-admin' : 'badge-membro'}">
                        ${itemIsAdmin ? 'Admin' : 'Membro'}
                    </span>
                </td>
                <td><strong>${m.advertencias || 0}</strong> adv.</td>
                <td>
                    <div class="acoes-admin-flex">
                        <button type="button" class="btn-adm btn-adm-adv" data-id="${m.id}" data-nome="${escapeHTML(m.nome)}" ${!eAdmin ? 'disabled title="Apenas administradores podem adverter"' : 'title="Adverter"'}>
                            <i class="fas fa-exclamation-triangle"></i> Adverter
                        </button>
                        
                        <button type="button" class="btn-adm btn-adm-cargo" data-id="${m.id}" data-admin="${itemIsAdmin}" ${!eAdmin ? 'disabled title="Apenas administradores podem alterar cargos"' : 'title="Alterar Cargo"'}>
                            <i class="fas ${itemIsAdmin ? 'fa-arrow-down' : 'fa-arrow-up'}"></i> ${itemIsAdmin ? 'Rebaixar' : 'Promover'}
                        </button>

                        <button type="button" class="btn-adm btn-adm-del" data-id="${m.id}" data-nome="${escapeHTML(m.nome)}" ${!eAdmin ? 'disabled title="Apenas administradores podem expulsar"' : 'title="Expulsar"'}>
                            <i class="fas fa-user-xmark"></i> Expulsar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// Listeners com trava de segurança para ações de Admin
document.getElementById("tabelaMembrosCorpo")?.addEventListener("click", async (e) => {
    const btnAdv = e.target.closest(".btn-adm-adv");
    const btnCargo = e.target.closest(".btn-adm-cargo");
    const btnDel = e.target.closest(".btn-adm-del");

    if (btnAdv || btnCargo || btnDel) {
        if (!usuarioEhAdmin()) {
            alert("Acesso Negado: Apenas administradores têm permissão para executar esta ação.");
            return;
        }
    }

    // Adverter
    if (btnAdv) {
        document.getElementById("adverterMembroId").value = btnAdv.dataset.id;
        document.getElementById("adverterMembroNome").textContent = btnAdv.dataset.nome;
        document.getElementById("modalAdverter").hidden = false;
    }

    // Promover / Rebaixar
    if (btnCargo) {
        const id = btnCargo.dataset.id;
        const itemIsAdmin = btnCargo.dataset.admin === "true";
        const novoCargo = itemIsAdmin ? "membro" : "admin";

        if (confirm(`Deseja alterar o cargo deste membro para "${novoCargo}"?`)) {
            try {
                const res = await fetch(`${API_BASE}/api/admin/membros/${id}/cargo`, {
                    method: "PATCH",
                    headers: getHeaders(),
                    body: JSON.stringify({ cargo: novoCargo, is_admin: !itemIsAdmin })
                });
                if (res.ok) await carregarMembrosAdmin();
                else alert("Erro ao alterar cargo do membro.");
            } catch (err) {
                console.error(err);
            }
        }
    }

    // Expulsar
    if (btnDel) {
        const id = btnDel.dataset.id;
        const nome = btnDel.dataset.nome;

        if (confirm(`ATENÇÃO: Tem certeza que deseja expulsar ${nome} da plataforma?`)) {
            try {
                const res = await fetch(`${API_BASE}/api/admin/membros/${id}`, {
                    method: "DELETE",
                    headers: getHeaders()
                });
                if (res.ok) await carregarMembrosAdmin();
                else alert("Erro ao expulsar membro.");
            } catch (err) {
                console.error(err);
            }
        }
    }
});

// Submit do formulário de advertência
document.getElementById("formAdverter")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!usuarioEhAdmin()) {
        alert("Acesso Negado: Você não possui permissão para aplicar advertências.");
        return;
    }

    const id = document.getElementById("adverterMembroId").value;
    const motivo = document.getElementById("adverterMotivo").value.trim();

    if (!motivo) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/membros/${id}/adverter`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ motivo })
        });

        if (res.ok) {
            document.getElementById("modalAdverter").hidden = true;
            document.getElementById("formAdverter").reset();
            alert("Advertência registrada com sucesso!");
            await carregarMembrosAdmin();
        } else {
            alert("Erro ao aplicar advertência.");
        }
    } catch (err) {
        console.error(err);
    }
});

/* =========================================================
   2. PERFIL DO MEMBRO
   ========================================================= */

async function carregarPerfil() {
    try {
        const res = await fetch(`${API_BASE}/api/perfil`, { headers: getHeaders() });
        if (res.status === 401) {
            console.warn("Usuário não autenticado no banco de dados.");
            return;
        }
        if (!res.ok) throw new Error("Erro ao carregar perfil");

        usuarioAtual = await res.json();
        renderizarPerfil();
    } catch (err) {
        console.error("Erro na requisição de perfil:", err);
    }
}

function renderizarPerfil() {
    if (!usuarioAtual) return;

    const nomeEl = document.getElementById("perfilNome");
    const funcaoEl = document.getElementById("perfilFuncao");
    const avatarEl = document.querySelector(".perfil-avatar");
    const capaEl = document.querySelector(".perfil-capa img");

    if (nomeEl) nomeEl.textContent = usuarioAtual.nome;
    if (funcaoEl) funcaoEl.textContent = usuarioAtual.funcao;
    if (avatarEl) avatarEl.src = normalizarUrlImagem(usuarioAtual.foto);
    if (capaEl) capaEl.src = normalizarUrlImagem(usuarioAtual.capa, "./src/images/lab/lsd_panorama.JPG");

    const postAvatar = document.querySelector(".post-criador-avatar");
    if (postAvatar) postAvatar.src = normalizarUrlImagem(usuarioAtual.foto);

    const listaInfo = document.querySelector(".lista-info");
    if (listaInfo) {
        listaInfo.innerHTML = `
            <li><i class="fas fa-envelope"></i> ${escapeHTML(usuarioAtual.email)}</li>
            <li><i class="fas fa-diagram-project"></i> <span>${usuarioAtual.projetos_ativos || 0}</span> projetos ativos</li>
            <li><i class="fas fa-calendar-days"></i> Entrou em ${escapeHTML(usuarioAtual.data_entrada || 'Mar 2024')}</li>
            <li><i class="fas fa-location-dot"></i> ${escapeHTML(usuarioAtual.localizacao || 'Maranguape, CE')}</li>
        `;
    }
    const btnAbaAdmin = document.getElementById("btnAbaAdmin");
    if (btnAbaAdmin) {
        // Usamos "flex" porque no seu CSS a classe .aba-btn usa display: flex
        btnAbaAdmin.style.display = usuarioEhAdmin() ? "flex" : "none";}
}

/* =========================================================
   3. QUADRO KANBAN
   ========================================================= */

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
const modalOverlay = document.getElementById("modalOverlay");
const modalTitulo = document.getElementById("modalTitulo");
const formCard = document.getElementById("formCard");
const confirmOverlay = document.getElementById("confirmOverlay");

async function carregarCards() {
    try {
        const res = await fetch(`${API_BASE}/api/cards`, { headers: getHeaders() });
        if (res.ok) {
            cards = await res.json();
            renderizarKanban();
        }
    } catch (err) {
        console.error("Erro ao buscar cards:", err);
    }
}

function renderizarKanban() {
    Object.keys(listas).forEach((status) => {
        const lista = listas[status];
        if (!lista) return;

        const itens = cards.filter((c) => c.status === status);
        if (contadores[status]) contadores[status].textContent = itens.length;

        lista.innerHTML = itens.length
            ? itens.map(cardParaHTML).join("")
            : `<div class="kanban-vazio">Arraste um card pra cá<br>ou crie um novo.</div>`;
    });

    renderizarProgresso();
    ativarDragDosCards();
}

function cardParaHTML(card) {
    let responsavelHTML = "";

    if (card.responsavel && card.responsavel.nome) {
        responsavelHTML = `
            <div class="post-it-user" title="Atribuído a ${escapeHTML(card.responsavel.nome)}">
                <img src="${normalizarUrlImagem(card.responsavel.foto)}" alt="${escapeHTML(card.responsavel.nome)}">
                <span>${escapeHTML(card.responsavel.nome)}</span>
            </div>
        `;
    } else {
        responsavelHTML = `
            <button type="button" class="btn-assumir" data-id="${card.id}">
                <i class="fas fa-user-plus"></i> Assumir
            </button>
        `;
    }

    return `
        <article class="post-it cor-${card.cor || 'amarelo'}" draggable="true" data-id="${card.id}">
            <div class="post-it-topo">
                <span class="tag-prioridade prio-media">Média</span>
                <div class="post-it-acoes">
                    <button type="button" class="post-it-editar" data-id="${card.id}" title="Editar">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button type="button" class="post-it-excluir" data-id="${card.id}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <h3>${escapeHTML(card.titulo)}</h3>
            <p>${escapeHTML(card.descricao)}</p>
            <div class="post-it-rodape">
                <span></span>
                ${responsavelHTML}
            </div>
        </article>
    `;
}

function renderizarProgresso() {
    const miniTotal = document.getElementById("miniTotal");
    const miniAndamento = document.getElementById("miniAndamento");
    const miniConcluido = document.getElementById("miniConcluido");
    const miniBarra = document.getElementById("miniBarra");
    const miniPct = document.getElementById("miniPct");

    if (!miniTotal) return;

    const total = cards.length;
    const emAndamento = cards.filter((c) => c.status === "andamento").length;
    const concluidos = cards.filter((c) => c.status === "concluido").length;
    const progresso = total ? Math.round((concluidos / total) * 100) : 0;

    miniTotal.textContent = total;
    miniAndamento.textContent = emAndamento;
    miniConcluido.textContent = concluidos;
    if (miniBarra) miniBarra.style.width = progresso + "%";
    if (miniPct) miniPct.textContent = progresso;
}

if (formCard) {
    formCard.addEventListener("submit", async (e) => {
        e.preventDefault();

        const elTitulo = document.getElementById("cardTitulo") || formCard.querySelector("input[type='text']");
        const elDesc = document.getElementById("cardDescricao") || formCard.querySelector("textarea");
        const elStatus = document.getElementById("cardStatus") || formCard.querySelector("select");
        const elCor = document.getElementById("cardCor");

        const titulo = elTitulo ? elTitulo.value.trim() : "";
        const descricao = elDesc ? elDesc.value.trim() : "";
        let status = elStatus ? elStatus.value.toLowerCase() : "afazer";
        const cor = elCor ? elCor.value.toLowerCase() : "amarelo";

        if (status.includes("andamento")) status = "andamento";
        else if (status.includes("conclui")) status = "concluido";
        else if (status.includes("fazer")) status = "afazer";

        if (editandoId && (!elStatus || !elStatus.value)) {
            const cardOriginal = cards.find(c => c.id == editandoId);
            if (cardOriginal) status = cardOriginal.status;
        }

        if (!titulo) {
            alert("Preencha o título do card!");
            return;
        }

        const payload = { titulo, descricao, status, cor };
        const method = editandoId ? "PUT" : "POST";
        const url = editandoId ? `${API_BASE}/api/cards/${editandoId}` : `${API_BASE}/api/cards`;

        try {
            const res = await fetch(url, {
                method: method,
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                if (modalOverlay) modalOverlay.hidden = true;
                formCard.reset();
                editandoId = null;
                await carregarCards();
            } else {
                alert(`Erro ao salvar no banco: ${data.message || 'Verifique se realizou o login.'}`);
            }
        } catch (err) {
            console.error("Erro ao salvar card:", err);
            alert(`Não foi possível conectar com o servidor Flask (${API_BASE}).`);
        }
    });
}

if (kanbanBoard) {
    kanbanBoard.addEventListener("click", async (e) => {
        const btnEditar = e.target.closest(".post-it-editar");
        const btnExcluir = e.target.closest(".post-it-excluir");
        const btnAssumir = e.target.closest(".btn-assumir");

        if (btnEditar) {
            const card = cards.find(c => c.id == btnEditar.dataset.id);
            if (card) {
                editandoId = card.id;
                if (modalTitulo) modalTitulo.textContent = "Editar Card";
                
                const elTitulo = document.getElementById("cardTitulo") || formCard.querySelector("input[type='text']");
                const elDesc = document.getElementById("cardDescricao") || formCard.querySelector("textarea");
                const elStatus = document.getElementById("cardStatus") || formCard.querySelector("select");
                const elCor = document.getElementById("cardCor");

                if (elTitulo) elTitulo.value = card.titulo;
                if (elDesc) elDesc.value = card.descricao || "";
                if (elStatus && card.status) elStatus.value = card.status;
                if (elCor && card.cor) elCor.value = card.cor;

                if (modalOverlay) modalOverlay.hidden = false;
            }
        }

        if (btnExcluir) {
            excluindoId = btnExcluir.dataset.id;
            if (confirmOverlay) confirmOverlay.hidden = false;
        }

        if (btnAssumir) {
            const id = btnAssumir.dataset.id;
            try {
                const res = await fetch(`${API_BASE}/api/cards/${id}/assumir`, {
                    method: "POST",
                    headers: getHeaders()
                });
                
                let data = {};
                try { data = await res.json(); } catch(e) {}

                if (res.ok) {
                    await carregarCards();
                } else {
                    alert(data.message || "Erro ao assumir tarefa.");
                }
            } catch (err) {
                console.error("Erro ao assumir tarefa:", err);
            }
        }
    });
}

document.getElementById("confirmExcluir")?.addEventListener("click", async () => {
    if (!excluindoId) return;
    try {
        const res = await fetch(`${API_BASE}/api/cards/${excluindoId}`, {
            method: "DELETE",
            headers: getHeaders()
        });
        if (res.ok) {
            if (confirmOverlay) confirmOverlay.hidden = true;
            excluindoId = null;
            await carregarCards();
        }
    } catch (err) {
        console.error("Erro ao excluir card:", err);
    }
});

function ativarDragDosCards() {
    document.querySelectorAll(".post-it").forEach((el) => {
        el.addEventListener("dragstart", () => el.classList.add("dragging"));
        el.addEventListener("dragend", () => el.classList.remove("dragging"));
    });
}

Object.values(listas).forEach((lista) => {
    if (!lista) return;
    lista.addEventListener("dragover", (e) => e.preventDefault());
    lista.addEventListener("drop", async (e) => {
        e.preventDefault();
        const cardArrastado = document.querySelector(".post-it.dragging");
        if (!cardArrastado) return;

        const id = cardArrastado.dataset.id;
        const novoStatus = lista.dataset.status;
        const card = cards.find(c => c.id == id);

        if (card && card.status !== novoStatus) {
            card.status = novoStatus;
            renderizarKanban();

            await fetch(`${API_BASE}/api/cards/${id}`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify({ status: novoStatus })
            });
            await carregarCards();
        }
    });
});

/* =========================================================
   4. FEED DA COMUNIDADE
   ========================================================= */

const feedLista = document.getElementById("feedLista");
const btnPublicarPost = document.getElementById("btnPublicarPost");
const novoPostTexto = document.getElementById("novoPostTexto");

async function carregarPosts() {
    try {
        const res = await fetch(`${API_BASE}/api/posts`, { headers: getHeaders() });
        if (res.ok) {
            posts = await res.json();
            renderizarFeed();
        }
    } catch (err) {
        console.error("Erro ao carregar posts:", err);
    }
}

function renderizarFeed() {
    if (!feedLista) return;
    feedLista.innerHTML = posts.map((p) => `
        <article class="post-card" data-id="${p.id}">
            <div class="post-card-topo">
                <img src="${normalizarUrlImagem(p.foto)}" alt="${escapeHTML(p.autor)}">
                <div>
                    <div class="post-card-autor">${escapeHTML(p.autor)}</div>
                    <div class="post-card-meta">${escapeHTML(p.meta)}</div>
                </div>
            </div>
            <p class="post-card-texto">${escapeHTML(p.texto)}</p>
            <div class="post-card-acoes">
                <button type="button" class="post-curtir ${p.curtido ? 'curtido' : ''}" data-id="${p.id}">
                    <i class="fa-solid fa-thumbs-up"></i> Curtir (${p.curtidas})
                </button>
            </div>
        </article>
    `).join("");
}

if (btnPublicarPost) {
    btnPublicarPost.addEventListener("click", async () => {
        const texto = novoPostTexto ? novoPostTexto.value.trim() : "";
        if (!texto) return;

        try {
            const res = await fetch(`${API_BASE}/api/posts`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({ texto })
            });

            if (res.ok) {
                if (novoPostTexto) novoPostTexto.value = "";
                await carregarPosts();
            } else {
                alert("Erro ao publicar post. Verifique sua autenticação.");
            }
        } catch (err) {
            console.error("Erro ao publicar post:", err);
        }
    });
}

if (feedLista) {
    feedLista.addEventListener("click", async (e) => {
        const btnCurtir = e.target.closest(".post-curtir");
        if (!btnCurtir) return;

        const id = btnCurtir.dataset.id;
        try {
            const res = await fetch(`${API_BASE}/api/posts/${id}/curtir`, {
                method: "POST",
                headers: getHeaders()
            });
            if (res.ok) await carregarPosts();
        } catch (err) {
            console.error("Erro ao curtir post:", err);
        }
    });
}

/* =========================================================
   5. INICIALIZAÇÃO DA APLICAÇÃO
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    inicializarTrocaDeAbas();

    await carregarPerfil();
    await carregarCards();
    await carregarPosts();
});

const abrirModal = () => {
    editandoId = null;
    if (modalTitulo) modalTitulo.textContent = "Novo Card";
    if (formCard) formCard.reset();
    if (modalOverlay) modalOverlay.hidden = false;
};

document.getElementById("btnNovoCard")?.addEventListener("click", abrirModal);
document.getElementById("btnNovoCardHeader")?.addEventListener("click", abrirModal);

document.querySelectorAll(".modal-fechar, .btn-cancelar, [data-modal-cancel]").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".modal-overlay").forEach((m) => m.hidden = true);
    });
})