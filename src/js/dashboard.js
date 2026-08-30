/**
 * Quadro Kanban — Painel do membro
 */

// ---------- SEGURANÇA E AUTENTICAÇÃO ----------
// Verifica se o usuário tem o "crachá" (Token)
// ---------- SEGURANÇA E AUTENTICAÇÃO ----------
const token = localStorage.getItem("token_lsd");
if (!token) {
    window.location.href = "login.html";
}
//Pega o nome real de quem está logado no computador atual
const usuarioAtual = localStorage.getItem("nome_usuario_lsd") || "Membro Logado";
const usuarioFoto = localStorage.getItem("foto_usuario_lsd") || null; // Pega a foto se existir

// ---------- CONFIGURAÇÕES DO KANBAN ----------
const STORAGE_KEY = "lsd_kanban_cards";
const TEMPO_LIMITE_DIAS = 7; 
const LIMITE_TAREFAS_POR_PESSOA = 2;

function gerarId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

// Cards iniciais atualizados com os novos campos (responsavel e dataInicio)
const cardsIniciais = [
    { id: gerarId(), titulo: "FioCruz", descricao: "Monitorar mosquitos modificados...", status: "andamento", cor: "amarelo", responsavel: "Bryan", dataInicio: Date.now() - 200000000 },
    { id: gerarId(), titulo: "Racismo Algorítmico", descricao: "Análise do impacto do racismo...", status: "afazer", cor: "rosa", responsavel: null, dataInicio: null },
    { id: gerarId(), titulo: "Card Livre", descricao: "Este card está livre, tente assumi-lo!", status: "afazer", cor: "azul", responsavel: null, dataInicio: null }
];

function carregarCards() {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
        try {
            const dados = JSON.parse(salvo);
            if (Array.isArray(dados)) return dados;
        } catch (erro) {
            console.warn("Não foi possível ler os cards, recomeçando do zero.");
        }
    }
    salvarCards(cardsIniciais);
    return cardsIniciais;
}

function salvarCards(lista) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

let cards = carregarCards();
let editandoId = null;
let excluindoId = null;

// ---------- Referências do DOM ----------
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
const dashStats = document.getElementById("dashStats");
const kanbanBoard = document.querySelector(".kanban-board");
const modalOverlay = document.getElementById("modalOverlay");
const modalTitulo = document.getElementById("modalTitulo");
const formCard = document.getElementById("formCard");
const campoTitulo = document.getElementById("cardTitulo");
const campoDescricao = document.getElementById("cardDescricao");
const campoStatus = document.getElementById("cardStatus");
const campoCor = document.getElementById("cardCor");
const confirmOverlay = document.getElementById("confirmOverlay");

function escapeHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto || "";
    return div.innerHTML;
}

// ---------- Regras de Negócio e Tempo ----------

function calcularTempoRestante(dataInicio) {
    const umDia = 1000 * 60 * 60 * 24;
    const limiteMs = TEMPO_LIMITE_DIAS * umDia;
    const fim = dataInicio + limiteMs;
    const faltam = fim - Date.now();

    if (faltam <= 0) return { texto: "Prazo esgotado!", classe: "prazo-esgotado" };
    
    const dias = Math.floor(faltam / umDia);
    if (dias > 0) return { texto: `${dias} dias restantes`, classe: "prazo-ok" };
    
    const horas = Math.floor(faltam / (1000 * 60 * 60));
    return { texto: `Menos de ${horas}h restantes!`, classe: "prazo-alerta" };
}

function assumirTarefa(id) {
    const minhasTarefas = cards.filter(c => c.responsavel === usuarioAtual && c.status !== "concluido");
    
    if (minhasTarefas.length >= LIMITE_TAREFAS_POR_PESSOA) {
        alert(`Você já atingiu o limite de ${LIMITE_TAREFAS_POR_PESSOA} tarefas! Conclua uma para pegar outra.`);
        return;
    }

    cards = cards.map(c => {
        if (c.id === id) {
            // NOVIDADE: Adicionando responsavelFoto
            return { ...c, responsavel: usuarioAtual, responsavelFoto: usuarioFoto, dataInicio: Date.now() };
        }
        return c;
    });

    salvarCards(cards);
    renderizar();
}

// ---------- Renderização ----------

function renderizar() {
    Object.keys(listas).forEach((status) => {
        const lista = listas[status];
        const itens = cards.filter((c) => c.status === status);

        contadores[status].textContent = itens.length;

        lista.innerHTML = itens.length
            ? itens.map(cardParaHTML).join("")
            : `<div class="kanban-vazio">Arraste um card pra cá<br>ou crie um novo.</div>`;
    });

    renderizarStats();
    ativarDragDosCards();
}

function cardParaHTML(card) {
    let rodapeCard = '';

    if (card.responsavel) {
        let infoTempo = '';
        if (card.status !== 'concluido' && card.dataInicio) {
            const tempo = calcularTempoRestante(card.dataInicio);
            infoTempo = `<small class="${tempo.classe}"><i class="fas fa-clock"></i> ${tempo.texto}</small>`;
        } else if (card.status === 'concluido') {
            infoTempo = `<small class="prazo-ok"><i class="fas fa-check-double"></i> Finalizado</small>`;
        }
        
        const nomeExibicao = (card.responsavel === usuarioAtual) ? "Você" : card.responsavel;

        let iconeExibicao = '';
        if (card.responsavelFoto) {
            iconeExibicao = `<img src="${escapeHTML(card.responsavelFoto)}" alt="Foto" class="mini-foto-perfil">`;
        }

        rodapeCard = `
            <div class="post-it-responsavel">
                <span class="responsavel-info">
                    ${iconeExibicao} ${escapeHTML(nomeExibicao)}
                </span>
                ${infoTempo}
            </div>
        `;
    } else {
        rodapeCard = `
            <button type="button" class="btn-assumir" data-id="${card.id}">
                <i class="fas fa-hand-paper"></i> Assumir Tarefa
            </button>
        `;
    }

    return `
        <article class="post-it cor-${card.cor}" draggable="true" data-id="${card.id}">
            <div class="post-it-acoes">
                <button type="button" class="post-it-editar" data-id="${card.id}" title="Editar" aria-label="Editar card"><i class="fas fa-pen"></i></button>
                <button type="button" class="post-it-excluir" data-id="${card.id}" title="Excluir" aria-label="Excluir card"><i class="fas fa-trash"></i></button>
            </div>
            <h3>${escapeHTML(card.titulo)}</h3>
            <p>${escapeHTML(card.descricao)}</p>
            ${rodapeCard}
        </article>
    `;
}

// (Mantenha todo o resto do seu código dashboard.js exatamente como estava a partir daqui)
// (renderizarStats, CRUD criar/editar, excluir, drag and drop...)

function renderizarStats() {
    const total = cards.length;
    const emAndamento = cards.filter((c) => c.status === "andamento").length;
    const concluidos = cards.filter((c) => c.status === "concluido").length;
    const progresso = total ? Math.round((concluidos / total) * 100) : 0;

    dashStats.innerHTML = `
        <div class="stat-card"><strong>${total}</strong><span>Total</span></div>
        <div class="stat-card"><strong>${emAndamento}</strong><span>Em andamento</span></div>
        <div class="stat-card"><strong>${concluidos}</strong><span>Concluídos</span></div>
        <div class="stat-progresso">
            <div class="stat-progresso-topo"><span>Progresso</span><span>${progresso}%</span></div>
            <div class="barra-progresso"><div class="barra-progresso-fill" style="width:${progresso}%"></div></div>
        </div>
    `;
}

// Formulários
function abrirModalNovo(status) { editandoId = null; modalTitulo.textContent = "Novo card"; formCard.reset(); campoStatus.value = status || "afazer"; campoCor.value = "amarelo"; modalOverlay.hidden = false; campoTitulo.focus(); }
function abrirModalEditar(id) { const c = cards.find(x => x.id === id); if(!c) return; editandoId = id; modalTitulo.textContent = "Editar card"; campoTitulo.value = c.titulo; campoDescricao.value = c.descricao; campoStatus.value = c.status; campoCor.value = c.cor; modalOverlay.hidden = false; campoTitulo.focus(); }

formCard.addEventListener("submit", (e) => {
    e.preventDefault();
    const titulo = campoTitulo.value.trim();
    if (!titulo) return;
    const dados = { titulo, descricao: campoDescricao.value.trim(), status: campoStatus.value, cor: campoCor.value };
    if (editandoId) cards = cards.map(c => c.id === editandoId ? { ...c, ...dados } : c);
    else cards.push({ id: gerarId(), responsavel: null, dataInicio: null, ...dados });
    salvarCards(cards); renderizar(); modalOverlay.hidden = true;
});

document.getElementById("btnNovoCard").addEventListener("click", () => abrirModalNovo());
document.getElementById("modalFechar").addEventListener("click", () => modalOverlay.hidden = true);
document.getElementById("modalCancelar").addEventListener("click", () => modalOverlay.hidden = true);
document.getElementById("confirmCancelar").addEventListener("click", () => confirmOverlay.hidden = true);
document.getElementById("confirmExcluir").addEventListener("click", () => { cards = cards.filter(c => c.id !== excluindoId); salvarCards(cards); renderizar(); confirmOverlay.hidden = true; });

// Delegação de eventos
kanbanBoard.addEventListener("click", (e) => {
    const btnAssumir = e.target.closest(".btn-assumir");
    const btnEditar = e.target.closest(".post-it-editar");
    const btnExcluir = e.target.closest(".post-it-excluir");

    if (btnAssumir) assumirTarefa(btnAssumir.dataset.id);
    if (btnEditar) abrirModalEditar(btnEditar.dataset.id);
    if (btnExcluir) { excluindoId = btnExcluir.dataset.id; confirmOverlay.hidden = false; }
});

// Drag and drop
function ativarDragDosCards() { document.querySelectorAll(".post-it").forEach(el => { el.addEventListener("dragstart", () => el.classList.add("dragging")); el.addEventListener("dragend", () => el.classList.remove("dragging")); }); }
Object.values(listas).forEach(l => {
    l.addEventListener("dragover", e => { e.preventDefault(); l.classList.add("drag-over"); });
    l.addEventListener("dragleave", () => l.classList.remove("drag-over"));
    l.addEventListener("drop", e => {
        e.preventDefault(); l.classList.remove("drag-over");
        const card = document.querySelector(".post-it.dragging");
        if(card) { cards = cards.map(c => c.id === card.dataset.id ? { ...c, status: l.dataset.status } : c); salvarCards(cards); renderizar(); }
    });
});

renderizar();