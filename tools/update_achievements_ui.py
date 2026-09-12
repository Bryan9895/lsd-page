from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "images" / "conquistas"
OUT.mkdir(parents=True, exist_ok=True)


def badge(title, accent_a, accent_b, icon):
    safe_title = escape(title)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-labelledby="title">
<title id="title">{safe_title}</title>
<defs>
  <radialGradient id="face" cx="36%" cy="28%" r="78%">
    <stop offset="0" stop-color="#26374a"/>
    <stop offset="0.58" stop-color="#111b27"/>
    <stop offset="1" stop-color="#090f17"/>
  </radialGradient>
  <linearGradient id="ring" x1="22" y1="18" x2="108" y2="112">
    <stop offset="0" stop-color="{accent_a}"/>
    <stop offset="1" stop-color="{accent_b}"/>
  </linearGradient>
  <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%">
    <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".38"/>
  </filter>
</defs>
<g filter="url(#shadow)">
  <circle cx="64" cy="64" r="57" fill="#070c12" opacity=".5"/>
  <circle cx="64" cy="64" r="54" fill="url(#face)" stroke="url(#ring)" stroke-width="5"/>
  <circle cx="64" cy="64" r="46.5" fill="none" stroke="#ffffff" stroke-opacity=".09" stroke-width="1.5"/>
  <path d="M29 42c10-17 27-27 47-27" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3" stroke-linecap="round"/>
  <g fill="none" stroke="#f8fbff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">{icon}</g>
</g>
</svg>'''


ICONS = {
    "bem_vindo.svg": ("Cheguei, e agora?", "#58A6FF", "#4AC7EC", '<rect x="38" y="34" width="34" height="58" rx="4" fill="#17304a"/><path d="M42 39l22-7v62l-22-7z" fill="#4ac7ec" stroke="#d9f6ff"/><circle cx="57" cy="64" r="2.4" fill="#0b2135" stroke="none"/><path d="M78 64h20m-7-8 8 8-8 8"/>'),
    "100_pontos.svg": ("Primeiras Faíscas", "#D29922", "#F0883E", '<path d="M68 29 50 60h13l-6 31 23-38H66z" fill="#f2cc60" stroke="#fff0ae"/><path d="M38 40v8M34 44h8M91 36v7M87.5 39.5h7" stroke="#ffd866"/>'),
    "300_pontos.svg": ("Pegando Ritmo", "#8C959F", "#C9D1D9", '<path d="M64 30c7 13-5 18 0 28 5-8 12-10 16-20 15 14 20 29 13 43-5 11-16 18-29 18-14 0-25-8-29-20-4-14 5-25 16-36 0 9 3 14 8 17-1-12 8-18 5-30z" fill="#d8dee4" stroke="#fff"/><path d="M63 66c8 8 9 14 6 20-2 5-6 8-11 8-6 0-10-4-11-9-2-7 3-12 8-17 0 5 2 8 6 10 2-4 2-8 2-12z" fill="#8c959f" stroke="none"/>'),
    "500_pontos.svg": ("Sem Freio!", "#D29922", "#F2CC60", '<path d="M38 76c12-26 28-40 52-41l-8 14c10 2 17 8 23 16-9 0-16 3-22 7l7 13c-20 5-37 2-52-9z" fill="#f2cc60" stroke="#fff2b3"/><circle cx="66" cy="56" r="4" fill="#111b27" stroke="none"/><path d="M42 78 28 83M47 88l-11 9M36 68H24" stroke="#ffdf79"/>'),
    "1000_pontos.svg": ("Isso Já É Poder", "#A371F7", "#58A6FF", '<path d="M37 49 48 68 64 45 80 68 92 49 86 88H42z" fill="#a371f7" stroke="#eee2ff"/><path d="M47 88h34"/><path d="M68 28 58 52h11l-7 23 20-30H70z" fill="#58a6ff" stroke="#d9ecff"/>'),
    "comentarista.svg": ("Só Mais Um Comentário...", "#A371F7", "#7D5FFF", '<path d="M34 40h60a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H63L48 98l4-12H34a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8z" fill="#6f52c7" stroke="#eadfff"/><circle cx="48" cy="63" r="4" fill="#fff" stroke="none"/><circle cx="64" cy="63" r="4" fill="#fff" stroke="none"/><circle cx="80" cy="63" r="4" fill="#fff" stroke="none"/>'),
    "criador_cards.svg": ("A Fábrica Não Para", "#3FB950", "#2EA043", '<rect x="35" y="34" width="54" height="62" rx="7" fill="#153a29" stroke="#b7f4ca"/><rect x="45" y="27" width="34" height="14" rx="5" fill="#3fb950" stroke="#d8ffe4"/><path d="M46 56h9l5 5 10-12M46 77h9l5 5 10-12M76 56h6M76 77h6"/><path d="M94 39v14M87 46h14" stroke="#69e68c"/>'),
    "preguicoso.svg": ("Volto Já...", "#58A6FF", "#A371F7", '<path d="M78 31a34 34 0 1 0 18 60A29 29 0 0 1 78 31z" fill="#6f82d8" stroke="#dce4ff"/><path d="M79 45h14l-14 14h14M91 30h10L91 40h10" stroke="#fff"/>'),
    "sempre_confusao.svg": ("Era Só Um Aviso...", "#F85149", "#FF7B72", '<path d="M64 29 103 96H25z" fill="#da3633" stroke="#ffd6d2"/><path d="M64 50v24" stroke-width="7"/><circle cx="64" cy="85" r="4" fill="#fff" stroke="none"/><circle cx="98" cy="91" r="13" fill="#f85149" stroke="#fff"/><text x="98" y="97" fill="#fff" stroke="none" font-family="system-ui,sans-serif" font-size="17" font-weight="800" text-anchor="middle">3</text>'),
    "perfil.svg": ("Quem é Você?", "#8B949E", "#58A6FF", '<rect x="30" y="38" width="68" height="51" rx="7" fill="#172334" stroke="#dbe7f4"/><circle cx="50" cy="57" r="9" fill="#58a6ff" stroke="none"/><path d="M38 79c2-10 8-15 12-15s10 5 12 15" fill="#58a6ff" stroke="none"/><path d="M70 52h18M70 63h18M70 74h12"/>'),
    "bate_papo.svg": ("Bate-Papo", "#8B949E", "#58A6FF", '<path d="M30 42h48a7 7 0 0 1 7 7v22a7 7 0 0 1-7 7H53L40 88l3-10H30a7 7 0 0 1-7-7V49a7 7 0 0 1 7-7z" fill="#356da3" stroke="#d8ecff"/><path d="M67 56h28a7 7 0 0 1 7 7v17a7 7 0 0 1-7 7H83l-10 8 2-8" fill="#263f63" stroke="#9fd2ff"/><circle cx="42" cy="60" r="3" fill="#fff" stroke="none"/><circle cx="54" cy="60" r="3" fill="#fff" stroke="none"/><circle cx="66" cy="60" r="3" fill="#fff" stroke="none"/>'),
    "primeiro_registro.svg": ("Primeiro Registro", "#8B949E", "#58A6FF", '<rect x="34" y="29" width="52" height="68" rx="5" fill="#1d2a3d" stroke="#d9e6f2"/><path d="M46 47h27M46 60h21M46 73h15"/><path d="m72 84 21-21 8 8-21 21-11 3z" fill="#f2cc60" stroke="#fff3b0"/>'),
    "construindo_juntos.svg": ("Construindo Juntos", "#3FB950", "#2EA043", '<circle cx="64" cy="42" r="9" fill="#3fb950" stroke="none"/><circle cx="42" cy="66" r="8" fill="#58a6ff" stroke="none"/><circle cx="86" cy="66" r="8" fill="#f2cc60" stroke="none"/><path d="M64 51v14M51 63l9-8M77 63l-9-8M31 91c3-12 8-17 14-17s11 5 14 17M69 91c3-12 8-17 14-17s11 5 14 17M49 84c3-14 9-20 15-20s12 6 15 20"/>'),
    "frequente.svg": ("Frequente", "#3FB950", "#2EA043", '<rect x="32" y="35" width="64" height="59" rx="7" fill="#163624" stroke="#c9f7d5"/><path d="M45 28v15M83 28v15M32 51h64"/><text x="64" y="80" fill="#eaffef" stroke="none" font-family="system-ui,sans-serif" font-size="30" font-weight="800" text-anchor="middle">7</text>'),
    "organizado.svg": ("Organizado", "#3FB950", "#2EA043", '<rect x="33" y="35" width="62" height="58" rx="10" fill="#163724" stroke="#d6ffe0"/><path d="m48 64 10 10 23-25" stroke-width="7"/>'),
    "em_evidencia.svg": ("Em Evidência", "#3FB950", "#2EA043", '<path d="m64 27 11 23 25 4-18 18 4 25-22-12-22 12 4-25-18-18 25-4z" fill="#f2cc60" stroke="#fff3b5"/><circle cx="64" cy="63" r="10" fill="#3fb950" stroke="none"/>'),
    "mao_na_massa.svg": ("Mão na Massa", "#58A6FF", "#1F6FEB", '<path d="M48 46 32 64l16 18M80 46l16 18-16 18M70 39 58 89"/><circle cx="95" cy="40" r="7" fill="#f2cc60" stroke="#fff1a8"/>'),
    "parceiro_jornada.svg": ("Parceiro de Jornada", "#58A6FF", "#1F6FEB", '<path d="M35 55h17l10 9-13 13-17-2-7-12z" fill="#2f72b5" stroke="#d5ebff"/><path d="M93 55H76l-10 9 13 13 17-2 7-12z" fill="#8f6be8" stroke="#eee3ff"/><path d="m49 77 10 9c4 4 8 4 12 0l8-9M52 61l9-8c4-4 9-4 13 0l8 7"/>'),
    "explorador.svg": ("Explorador", "#A371F7", "#8957E5", '<circle cx="64" cy="64" r="31" fill="#251b42" stroke="#e5d8ff"/><path d="m75 48-8 21-21 8 8-21z" fill="#a371f7" stroke="#fff"/><circle cx="64" cy="64" r="4" fill="#fff" stroke="none"/>'),
    "mestre_lsd.svg": ("Mestre do LSD", "#F2CC60", "#D29922", '<path d="M44 35h40v25c0 16-9 27-20 27S44 76 44 60z" fill="#d29922" stroke="#fff0a3"/><path d="M44 44H31v8c0 10 6 17 16 18M84 44h13v8c0 10-6 17-16 18M64 87v11M49 100h30"/><path d="m64 45 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="#fff2a6" stroke="none"/>'),
    "madrugadora.svg": ("Madrugadora(o)", "#58A6FF", "#A371F7", '<path d="M75 29a29 29 0 1 0 18 51A24 24 0 0 1 75 29z" fill="#6e78d8" stroke="#e5e8ff"/><rect x="34" y="74" width="56" height="23" rx="4" fill="#152b46" stroke="#cfe6ff"/><path d="M29 101h66"/><circle cx="83" cy="39" r="3" fill="#fff" stroke="none"/>'),
    "movido_cafe.svg": ("Movido a Café", "#A371F7", "#8957E5", '<path d="M37 50h46v34a13 13 0 0 1-13 13H50a13 13 0 0 1-13-13z" fill="#563d78" stroke="#eadfff"/><path d="M83 59h7c9 0 14 5 14 12s-5 12-14 12h-7M50 42c-7-7 7-9 0-17M64 42c-7-7 7-9 0-17M78 42c-7-7 7-9 0-17"/>'),
    "sede_conhecimento.svg": ("Sede de Conhecimento", "#3FB950", "#2EA043", '<path d="M35 78h57v15H35z" fill="#58a6ff" stroke="#d7ecff"/><path d="M31 61h55v15H31z" fill="#f2cc60" stroke="#fff0a6"/><path d="M39 44h54v15H39z" fill="#3fb950" stroke="#d9ffe3"/><path d="M47 44v15M72 61v15M55 78v15"/>'),
    "ritmo_forte.svg": ("Ritmo Forte", "#A371F7", "#8957E5", '<path d="M69 26 43 65h18l-5 37 29-48H67z" fill="#f2cc60" stroke="#fff0a8"/><path d="M34 39h10M30 52h12M86 84h9" stroke="#a371f7"/>'),
    "espirito_comunitario.svg": ("Espírito Comunitário", "#A371F7", "#8957E5", '<path d="M64 94S31 75 31 52c0-11 8-19 19-19 7 0 12 4 14 10 3-6 8-10 15-10 11 0 19 8 19 19 0 23-34 42-34 42z" fill="#da4f72" stroke="#ffd8e2"/><circle cx="34" cy="31" r="4" fill="#58a6ff" stroke="none"/><circle cx="97" cy="34" r="4" fill="#3fb950" stroke="none"/><circle cx="101" cy="79" r="3" fill="#f2cc60" stroke="none"/>'),
    "desbloqueador.svg": ("Desbravador", "#58A6FF", "#1F6FEB", '<path d="M34 38 54 31l20 7 20-7v59l-20 7-20-7-20 7z" fill="#173654" stroke="#d6ecff"/><path d="M54 31v59M74 38v59"/><path d="M70 52h17l-5 7 5 7H70z" fill="#f2cc60" stroke="#fff1a9"/><path d="M70 48v31"/>'),
    "construtor.svg": ("Construtor(a)", "#A371F7", "#8957E5", '<path d="M31 62h29v17H31zM62 62h35v17H62zM42 43h34v17H42zM78 43h20v17H78zM31 81h40v17H31zM73 81h24v17H73z" fill="#b7793b" stroke="#f4d0a5"/><path d="M31 62h66M42 43h56M31 81h66"/>'),
    "fim_jornada.svg": ("Fim da Jornada?", "#8B5CF6", "#312E81", '<circle cx="64" cy="64" r="31" fill="#17122a" stroke="#c4b5fd"/><path d="M38 64c8-12 17-18 26-18s18 6 26 18c-8 12-17 18-26 18S46 76 38 64z" fill="#6d4aff" stroke="#e8e1ff"/><circle cx="64" cy="64" r="9" fill="#111827" stroke="#f5f3ff"/><circle cx="64" cy="64" r="3" fill="#c4b5fd" stroke="none"/><path d="M64 28v7M64 93v7M28 64h7M93 64h7" stroke="#8b5cf6"/>'),
}

for filename, (title, a, b, icon) in ICONS.items():
    (OUT / filename).write_text(badge(title, a, b, icon), encoding="utf-8")

js_path = ROOT / "src" / "js" / "dashboard.js"
js = js_path.read_text(encoding="utf-8")
old_picker = '''                <div class="post-reacoes" role="group" aria-label="Reagir à publicação">
                    ${["❤️", "😂", "😮", "😢", "😡", "👏", "🔥", "🎉"].map((emoji) => `
                        <button type="button" class="btn-reacao ${post.reacao_por_mim === emoji ? "ativa" : ""}" data-post-id="${post.id}" data-emoji="${emoji}" aria-label="Reagir com ${emoji}">
                            <span>${emoji}</span><small>${Number(post.reacoes?.[emoji] || 0) || ""}</small>
                        </button>
                    `).join("")}
                </div>'''
new_picker = '''                <div class="post-reacoes-wrap">
                    <button type="button" class="btn-abrir-reacoes ${post.reacao_por_mim ? "ativa" : ""}" data-post-id="${post.id}" aria-expanded="false" aria-controls="reacoes-${post.id}" title="Reagir à publicação">
                        <span class="reacao-botao-icone" aria-hidden="true">${post.reacao_por_mim ? `<span class="reacao-escolhida">${escapeHTML(post.reacao_por_mim)}</span>` : `<i class="far fa-face-smile"></i>`}</span>
                        <span class="reacao-botao-texto">Reagir</span>
                    </button>
                    <div class="post-reacoes" id="reacoes-${post.id}" role="menu" aria-label="Escolher reação" hidden>
                        ${["❤️", "😂", "😮", "😢", "😡", "👏", "🔥", "🎉"].map((emoji) => `
                            <button type="button" class="btn-reacao ${post.reacao_por_mim === emoji ? "ativa" : ""}" data-post-id="${post.id}" data-emoji="${emoji}" aria-label="Reagir com ${emoji}" role="menuitem"><span>${emoji}</span><small>${Number(post.reacoes?.[emoji] || 0) || ""}</small></button>
                        `).join("")}
                    </div>
                </div>'''
if old_picker in js:
    js = js.replace(old_picker, new_picker, 1)

helper_marker = "\n\nfunction inicializarEventosFeed() {"
helper = '''\n\nfunction fecharMenusReacao(excecao = null) {
    document.querySelectorAll(".post-reacoes:not([hidden])").forEach((menu) => {
        if (menu === excecao) return;
        menu.hidden = true;
        menu.closest(".post-reacoes-wrap")?.querySelector(".btn-abrir-reacoes")?.setAttribute("aria-expanded", "false");
    });
}\n'''
if "function fecharMenusReacao(" not in js and helper_marker in js:
    js = js.replace(helper_marker, helper + helper_marker, 1)

vars_old = '''        const btnCurtir = evento.target.closest(".btn-curtir-post");
        const btnReacao = evento.target.closest(".btn-reacao");'''
vars_new = '''        const btnCurtir = evento.target.closest(".btn-curtir-post");
        const btnAbrirReacoes = evento.target.closest(".btn-abrir-reacoes");
        const btnReacao = evento.target.closest(".btn-reacao");'''
if vars_old in js:
    js = js.replace(vars_old, vars_new, 1)

anchor = '''        if (btnReacao) {
            const id = btnReacao.dataset.postId;'''
open_handler = '''        if (btnAbrirReacoes) {
            const menu = btnAbrirReacoes.closest(".post-reacoes-wrap")?.querySelector(".post-reacoes");
            if (!menu) return;
            const abrir = menu.hidden;
            fecharMenusReacao(menu);
            menu.hidden = !abrir;
            btnAbrirReacoes.setAttribute("aria-expanded", String(abrir));
            if (abrir) menu.querySelector(".btn-reacao")?.focus({ preventScroll: true });
            return;
        }

'''
if open_handler.strip() not in js and anchor in js:
    js = js.replace(anchor, open_handler + anchor, 1)

old_tail = '''                card?.querySelectorAll(".btn-reacao").forEach((botao) => {
                    const emote = botao.dataset.emoji;
                    botao.classList.toggle("ativa", emote === postCache.reacao_por_mim);
                    const contador = botao.querySelector("small");
                    if (contador) contador.textContent = Number(postCache.reacoes[emote] || 0) || "";
                });
            }
            return;'''
new_tail = '''                card?.querySelectorAll(".btn-reacao").forEach((botao) => {
                    const emote = botao.dataset.emoji;
                    botao.classList.toggle("ativa", emote === postCache.reacao_por_mim);
                    const contador = botao.querySelector("small");
                    if (contador) contador.textContent = Number(postCache.reacoes[emote] || 0) || "";
                });
                const abrirReacoes = card?.querySelector(".btn-abrir-reacoes");
                const iconeReacao = abrirReacoes?.querySelector(".reacao-botao-icone");
                abrirReacoes?.classList.toggle("ativa", Boolean(postCache.reacao_por_mim));
                abrirReacoes?.setAttribute("aria-expanded", "false");
                if (iconeReacao) iconeReacao.innerHTML = postCache.reacao_por_mim ? `<span class="reacao-escolhida">${escapeHTML(postCache.reacao_por_mim)}</span>` : `<i class="far fa-face-smile"></i>`;
                const menu = card?.querySelector(".post-reacoes");
                if (menu) menu.hidden = true;
            }
            return;'''
if old_tail in js:
    js = js.replace(old_tail, new_tail, 1)

submit_marker = '''    feedLista.addEventListener("submit", async (evento) => {'''
closers = '''    document.addEventListener("click", (evento) => {
        if (!evento.target.closest(".post-reacoes-wrap")) fecharMenusReacao();
    });
    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") fecharMenusReacao();
    });

'''
if closers.strip() not in js and submit_marker in js:
    js = js.replace(submit_marker, closers + submit_marker, 1)

js_path.write_text(js, encoding="utf-8")

css_path = ROOT / "src" / "css" / "dashboard.css"
css = css_path.read_text(encoding="utf-8")
start = css.find(".post-reacoes {\n    display: flex;")
end_marker = ".conquistas-dashboard-topo {"
end = css.find(end_marker, start)
reaction_css = '''.post-reacoes-wrap { position: relative; display: inline-flex; align-items: center; }
.btn-abrir-reacoes { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; background: transparent; color: #5f6b7c; cursor: pointer; font: inherit; font-weight: 700; border-radius: 9px; transition: background .16s ease, color .16s ease, transform .16s ease; }
.btn-abrir-reacoes:hover, .btn-abrir-reacoes:focus-visible, .btn-abrir-reacoes.ativa { background: #EEF4FA; color: #14284F; outline: none; }
.reacao-botao-icone { display: inline-grid; place-items: center; min-width: 20px; font-size: 17px; line-height: 1; }
.reacao-escolhida { display: block; transform: translateY(-1px); }
.post-reacoes { position: absolute; left: 0; bottom: calc(100% + 9px); z-index: 85; display: flex; align-items: center; gap: 3px; width: max-content; max-width: min(82vw, 390px); padding: 6px; overflow-x: auto; overscroll-behavior: contain; border: 1px solid #D0D7DE; border-radius: 999px; background: #FFFFFF; box-shadow: 0 12px 30px rgba(20, 40, 79, .16); scrollbar-width: none; }
.post-reacoes::-webkit-scrollbar { display: none; }
.post-reacoes[hidden] { display: none !important; }
.btn-reacao { display: inline-flex; align-items: center; justify-content: center; gap: 3px; min-width: 38px; min-height: 38px; padding: 5px 7px; border: 1px solid transparent; border-radius: 999px; background: transparent; cursor: pointer; font: inherit; transition: background .14s ease, border-color .14s ease, transform .14s ease; }
.btn-reacao:hover, .btn-reacao:focus-visible, .btn-reacao.ativa { border-color: #BFD9DD; background: #EEF8F8; outline: none; transform: translateY(-1px); }
.btn-reacao span { font-size: 18px; line-height: 1; }
.btn-reacao small { min-width: 7px; color: #6F7C8E; font-size: 9px; font-weight: 800; }
html.tema-escuro .btn-abrir-reacoes { color: var(--dash-text-soft, #A7B2C1); }
html.tema-escuro .btn-abrir-reacoes:hover, html.tema-escuro .btn-abrir-reacoes:focus-visible, html.tema-escuro .btn-abrir-reacoes.ativa { background: #202832; color: var(--dash-text, #EAF0F6); }
html.tema-escuro .post-reacoes { background: var(--dash-surface-raised, #171E27); border-color: var(--dash-border, #27313D); box-shadow: 0 14px 34px rgba(0,0,0,.42); }
html.tema-escuro .btn-reacao:hover, html.tema-escuro .btn-reacao:focus-visible, html.tema-escuro .btn-reacao.ativa { background: #212C36; border-color: #35556A; }

'''
if start != -1 and end != -1:
    css = css[:start] + reaction_css + css[end:]

css = css.replace("    object-fit: contain;\n    filter: drop-shadow(0 5px 8px rgba(20, 40, 79, .12));", "    object-fit: contain;\n    border-radius: 50%;\n    filter: drop-shadow(0 5px 8px rgba(20, 40, 79, .12));", 1)
css = css.replace("    object-fit: contain;\n    filter: drop-shadow(0 7px 12px rgba(0, 0, 0, .28));", "    object-fit: contain;\n    border-radius: 50%;\n    filter: drop-shadow(0 7px 12px rgba(0, 0, 0, .28));", 1)
css = css.replace("    .post-card-acoes button { min-height: 42px; padding-inline: 6px; }", "    .post-card-acoes button { min-height: 42px; padding-inline: 6px; }\n    .post-reacoes { left: -8px; max-width: min(88vw, 360px); }\n    .reacao-botao-texto { display: none; }", 1)
css_path.write_text(css, encoding="utf-8")

for file in OUT.glob("*.svg"):
    text = file.read_text(encoding="utf-8")
    if "<image" in text or "base64," in text:
        raise SystemExit(f"{file} contém raster incorporado")
    if file.stat().st_size > 20000:
        raise SystemExit(f"{file} ficou grande demais")

print(f"Atualizados {len(ICONS)} SVGs vetoriais e o seletor de reações.")
