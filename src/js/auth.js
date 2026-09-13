/**
 * Autenticação LSD-PAGE.
 * Mantém login/cadastro/recuperação resilientes a falhas de storage,
 * respostas inesperadas da API e cliques duplicados.
 */

const API_BASE = (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
    ? "http://127.0.0.1:5000"
    : window.location.origin;

const TOKEN_KEY = "token_lsd";
const AUTH_REQUEST_TIMEOUT_MS = 20000;
const SIGNUP_REDIRECT_DELAY_MS = 2200;

function lerTokenSeguro() {
    try {
        const tokenLocal = localStorage.getItem(TOKEN_KEY);
        if (tokenLocal && tokenLocal !== "null" && tokenLocal !== "undefined") return tokenLocal;
    } catch (erro) {
        console.warn("localStorage indisponível; tentando sessionStorage.", erro);
    }

    try {
        const tokenSessao = sessionStorage.getItem(TOKEN_KEY);
        if (tokenSessao && tokenSessao !== "null" && tokenSessao !== "undefined") return tokenSessao;
    } catch (erro) {
        console.warn("sessionStorage indisponível.", erro);
    }

    return null;
}

function salvarTokenSeguro(token) {
    if (!token || typeof token !== "string") return false;

    try {
        localStorage.setItem(TOKEN_KEY, token);
        if (localStorage.getItem(TOKEN_KEY) === token) {
            try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) {}
            return true;
        }
    } catch (erro) {
        console.warn("Não foi possível gravar no localStorage; tentando sessionStorage.", erro);
    }

    try {
        sessionStorage.setItem(TOKEN_KEY, token);
        return sessionStorage.getItem(TOKEN_KEY) === token;
    } catch (erro) {
        console.error("O navegador bloqueou o armazenamento da sessão.", erro);
        return false;
    }
}

function removerTokenSeguro() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) {}
}

function destinoAbsoluto(destino) {
    try {
        return new URL(destino, window.location.href).href;
    } catch (_) {
        return destino;
    }
}

function redirecionarSeguro(destino, substituir = false) {
    const url = destinoAbsoluto(destino);

    try {
        if (substituir) {
            window.location.replace(url);
        } else {
            window.location.assign(url);
        }
    } catch (erro) {
        console.warn("Falha ao redirecionar pelo método principal; usando href.", erro);
        window.location.href = url;
    }

    window.setTimeout(() => {
        try {
            if (window.location.href !== url) window.location.href = url;
        } catch (_) {}
    }, 900);
}

function mostrarErro(campoId, mensagem) {
    const input = document.getElementById(campoId);
    const erro = document.getElementById(campoId + "-erro")
        || (campoId === "codigo_acesso" ? document.getElementById("codigo-erro") : null);
    if (input) input.classList.add("campo-invalido");
    if (erro) {
        erro.textContent = mensagem;
        erro.classList.add("ativo");
    }
}

function limparErro(campoId) {
    const input = document.getElementById(campoId);
    const erro = document.getElementById(campoId + "-erro")
        || (campoId === "codigo_acesso" ? document.getElementById("codigo-erro") : null);
    if (input) input.classList.remove("campo-invalido");
    if (erro) erro.classList.remove("ativo");
}

function limparTodosErros(form) {
    form.querySelectorAll(".campo-invalido").forEach((el) => el.classList.remove("campo-invalido"));
    form.querySelectorAll(".campo-erro.ativo").forEach((el) => el.classList.remove("ativo"));
}

function emailValido(valor) {
    return typeof valor === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

function mostrarMensagem(id, tipo, texto, { focar = true } = {}) {
    const el = document.getElementById(id);
    if (!el) return false;
    el.className = "auth-mensagem ativa " + tipo;
    el.innerHTML = texto;
    el.setAttribute("role", tipo === "erro" ? "alert" : "status");
    el.setAttribute("aria-live", tipo === "erro" ? "assertive" : "polite");
    if (focar) {
        window.requestAnimationFrame(() => {
            try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {}
        });
    }
    return true;
}

function esconderMensagem(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("ativa");
}

function alternarCarregando(botao, carregando) {
    if (!botao) return;
    botao.disabled = carregando;
    botao.classList.toggle("carregando", carregando);
}

function travarFormulario(form, botao, texto = "Concluído") {
    if (form) {
        form.dataset.concluido = "true";
        form.querySelectorAll("input, textarea, select, button").forEach((campo) => {
            campo.disabled = true;
        });
    }
    if (botao) {
        botao.disabled = true;
        botao.classList.remove("carregando");
        const label = botao.querySelector(".btn-auth-texto");
        if (label) label.textContent = texto;
    }
}

function normalizarUrlImagem(path, fallback = "./src/images/equipe/avatar/default-avatar.png") {
    if (!path) return fallback;
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("./")) return path;
    return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function requisitarAPI(endpoint, opcoes = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

    try {
        const resposta = await fetch(`${API_BASE}${endpoint}`, {
            ...opcoes,
            signal: opcoes.signal || controller.signal,
        });
        const contentType = resposta.headers.get("content-type") || "";
        let dados = {};

        if (contentType.includes("application/json")) {
            dados = await resposta.json().catch(() => ({}));
        } else {
            dados = {
                success: false,
                message: `Erro no servidor (${resposta.status}). Tente novamente mais tarde.`,
            };
        }

        return { ok: resposta.ok, status: resposta.status, dados };
    } catch (erro) {
        const timeout = erro?.name === "AbortError";
        console.error(timeout ? "Tempo limite da API excedido." : "Erro na comunicação com a API:", erro);
        return {
            ok: false,
            status: 0,
            dados: {
                success: false,
                message: timeout
                    ? "O servidor demorou para responder. Tente novamente."
                    : "Não foi possível conectar ao servidor backend.",
            },
        };
    } finally {
        window.clearTimeout(timer);
    }
}

document.querySelectorAll(".campo-senha-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
        const alvo = document.getElementById(btn.dataset.alvo);
        if (!alvo) return;
        const visivel = alvo.type === "text";
        alvo.type = visivel ? "password" : "text";
        btn.innerHTML = visivel
            ? '<i class="fas fa-eye"></i>'
            : '<i class="fas fa-eye-slash"></i>';
    });
});

const inputFoto = document.getElementById("foto");
const previewFoto = document.getElementById("foto-preview");

if (inputFoto && previewFoto) {
    inputFoto.addEventListener("change", () => {
        const arquivo = inputFoto.files && inputFoto.files[0];
        if (!arquivo) return;

        if (!arquivo.type.startsWith("image/")) {
            inputFoto.value = "";
            mostrarErro("foto", "Escolha um arquivo de imagem.");
            return;
        }
        limparErro("foto");

        const leitor = new FileReader();
        leitor.onload = (e) => {
            previewFoto.innerHTML = `<img src="${e.target.result}" alt="Prévia da foto de perfil">`;
        };
        leitor.readAsDataURL(arquivo);
    });
}

const formLogin = document.getElementById("form-login") || document.getElementById("formLogin");

if (formLogin) {
    let loginEmAndamento = false;

    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (loginEmAndamento) return;

        limparTodosErros(formLogin);
        esconderMensagem("login-mensagem");

        const email = document.getElementById("email")?.value.trim() || "";
        const senha = document.getElementById("senha")?.value || "";
        let valido = true;

        if (!emailValido(email)) {
            mostrarErro("email", "Informe um e-mail válido.");
            valido = false;
        }
        if (!senha) {
            mostrarErro("senha", "Informe sua senha.");
            valido = false;
        }
        if (!valido) return;

        const botao = formLogin.querySelector(".btn-auth");
        loginEmAndamento = true;
        alternarCarregando(botao, true);

        try {
            const { ok, dados } = await requisitarAPI("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha }),
            });

            if (ok && dados.token) {
                if (!salvarTokenSeguro(dados.token)) {
                    mostrarMensagem(
                        "login-mensagem",
                        "erro",
                        "Login confirmado, mas o navegador bloqueou o armazenamento da sessão. Verifique as permissões de dados do site e tente novamente."
                    );
                    return;
                }
                travarFormulario(formLogin, botao, "Entrando...");
                redirecionarSeguro("dashboard.html", true);
                return;
            }

            mostrarMensagem(
                "login-mensagem",
                "erro",
                dados.message || dados.erro || "E-mail ou senha incorretos."
            );
        } finally {
            if (formLogin.dataset.concluido !== "true") {
                loginEmAndamento = false;
                alternarCarregando(botao, false);
            }
        }
    });
}

const formCadastro = document.getElementById("form-cadastro") || document.getElementById("formCadastro");

if (formCadastro) {
    let cadastroEmAndamento = false;

    formCadastro.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (cadastroEmAndamento || formCadastro.dataset.concluido === "true") return;

        limparTodosErros(formCadastro);
        esconderMensagem("cadastro-mensagem");

        const nome = document.getElementById("nome")?.value.trim() || "";
        const email = document.getElementById("email")?.value.trim() || "";
        const senha = document.getElementById("senha")?.value || "";
        const confirmarSenha = document.getElementById("confirmar-senha")?.value || "";
        const termosInput = document.getElementById("termos");
        const termos = termosInput?.checked;
        const codigoAcesso = document.getElementById("codigo_acesso")?.value.trim() || "";
        let valido = true;

        if (nome.length < 3) {
            mostrarErro("nome", "Informe seu nome completo.");
            valido = false;
        }
        if (!emailValido(email)) {
            mostrarErro("email", "Informe um e-mail válido.");
            valido = false;
        }
        if (senha.length < 8) {
            mostrarErro("senha", "A senha precisa ter pelo menos 8 caracteres.");
            valido = false;
        }
        if (confirmarSenha !== senha || !confirmarSenha) {
            mostrarErro("confirmar-senha", "As senhas não coincidem.");
            valido = false;
        }
        if (termosInput && !termos) {
            mostrarErro("termos", "Você precisa aceitar os termos para continuar.");
            valido = false;
        }
        if (!codigoAcesso) {
            mostrarErro("codigo_acesso", "Informe o código de acesso da equipe.");
            valido = false;
        }
        if (!valido) return;

        const botao = formCadastro.querySelector(".btn-auth");
        cadastroEmAndamento = true;
        alternarCarregando(botao, true);

        const formData = new FormData();
        formData.append("nome", nome);
        formData.append("email", email);
        formData.append("senha", senha);
        formData.append("codigo_acesso", codigoAcesso);
        formData.append("funcao", document.getElementById("funcao")?.value.trim() || "Membro LSD");
        formData.append("bio", document.getElementById("bio")?.value.trim() || "");
        formData.append("instagram", document.getElementById("instagram")?.value.trim() || "");
        formData.append("github", document.getElementById("github")?.value.trim() || "");
        if (inputFoto?.files?.[0]) formData.append("foto", inputFoto.files[0]);

        try {
            const { ok, dados } = await requisitarAPI("/api/register", {
                method: "POST",
                body: formData,
            });

            if (!ok || !(dados.success || dados.token)) {
                mostrarMensagem(
                    "cadastro-mensagem",
                    "erro",
                    dados.message || dados.erro || "Erro ao criar conta."
                );
                return;
            }

            const sessaoSalva = dados.token ? salvarTokenSeguro(dados.token) : false;
            const mensagem = sessaoSalva
                ? '<i class="fas fa-circle-check"></i> Conta criada com sucesso! Redirecionando para o seu perfil...'
                : '<i class="fas fa-circle-check"></i> Conta criada com sucesso! O navegador não manteve a sessão; abrindo a tela de login...';

            mostrarMensagem("cadastro-mensagem", "sucesso", mensagem);
            travarFormulario(formCadastro, botao, "Conta criada");

            const destino = sessaoSalva ? "dashboard.html" : "entrar-login.html?cadastro=sucesso";
            window.setTimeout(() => redirecionarSeguro(destino, true), SIGNUP_REDIRECT_DELAY_MS);
        } catch (erro) {
            console.error("Falha inesperada no cadastro:", erro);
            mostrarMensagem(
                "cadastro-mensagem",
                "erro",
                "Ocorreu um erro inesperado após enviar o cadastro. Atualize a página e tente entrar; sua conta pode já ter sido criada."
            );
        } finally {
            if (formCadastro.dataset.concluido !== "true") {
                cadastroEmAndamento = false;
                alternarCarregando(botao, false);
            }
        }
    });
}

const formRecuperar = document.getElementById("form-recuperar");

if (formRecuperar) {
    let recuperacaoEmAndamento = false;

    formRecuperar.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (recuperacaoEmAndamento) return;

        limparTodosErros(formRecuperar);
        esconderMensagem("recuperar-mensagem");
        const email = document.getElementById("email")?.value.trim() || "";

        if (!emailValido(email)) {
            mostrarErro("email", "Informe um e-mail válido.");
            return;
        }

        const botao = formRecuperar.querySelector(".btn-auth");
        recuperacaoEmAndamento = true;
        alternarCarregando(botao, true);

        try {
            const { ok, dados } = await requisitarAPI("/api/recuperar-senha", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            mostrarMensagem(
                "recuperar-mensagem",
                ok ? "sucesso" : "erro",
                dados.message || "Não foi possível solicitar o link."
            );
        } finally {
            recuperacaoEmAndamento = false;
            alternarCarregando(botao, false);
        }
    });
}

const formRedefinir = document.getElementById("form-redefinir");

if (formRedefinir) {
    let resetToken = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    history.replaceState(null, "", window.location.pathname);
    const mensagem = document.getElementById("redefinir-mensagem");
    const botao = formRedefinir.querySelector(".btn-auth");

    const informar = (texto, sucesso = false) => {
        if (!mensagem) return;
        mensagem.className = "auth-mensagem ativa " + (sucesso ? "sucesso" : "erro");
        mensagem.textContent = texto;
        mensagem.setAttribute("role", sucesso ? "status" : "alert");
    };

    if (!/^[A-Za-z0-9_-]{43}$/.test(resetToken)) {
        informar("Link inválido ou ausente. Solicite um novo link de recuperação.");
        if (botao) botao.disabled = true;
    }

    formRedefinir.addEventListener("submit", async (event) => {
        event.preventDefault();
        const senha = document.getElementById("senha")?.value || "";
        const confirmar = document.getElementById("confirmar-senha")?.value || "";

        if (senha.length < 8 || senha.length > 128) {
            informar("A senha deve ter entre 8 e 128 caracteres.");
            return;
        }
        if (senha !== confirmar) {
            informar("As senhas não coincidem.");
            return;
        }

        alternarCarregando(botao, true);
        try {
            const { ok, dados } = await requisitarAPI("/api/redefinir-senha", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: resetToken, senha }),
            });
            informar(dados.message || "Não foi possível alterar a senha.", ok);
            if (ok) {
                resetToken = "";
                removerTokenSeguro();
                formRedefinir.reset();
                travarFormulario(formRedefinir, botao, "Senha alterada");
                window.setTimeout(() => redirecionarSeguro("entrar-login.html", true), 2200);
            }
        } finally {
            if (formRedefinir.dataset.concluido !== "true") alternarCarregando(botao, false);
        }
    });
}

if (new URLSearchParams(window.location.search).get("cadastro") === "sucesso") {
    mostrarMensagem(
        "login-mensagem",
        "sucesso",
        '<i class="fas fa-circle-check"></i> Conta criada com sucesso! Entre com o e-mail e a senha cadastrados.',
        { focar: false }
    );
}
