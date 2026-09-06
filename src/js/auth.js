/**
 * Lógica compartilhada das páginas de autenticação (login, cadastro, recuperar senha).
 * Unifica a validação visual do front-end com o tratamento seguro da API backend.
 */

// ---------- Configurações Globais ----------

const API_BASE = (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost")
    ? "http://127.0.0.1:5000"
    : window.location.origin; 

const TOKEN_KEY = "token_lsd";

// ---------- Utilitários de Interface ----------

function mostrarErro(campoId, mensagem) {
    const input = document.getElementById(campoId);
    const erro = document.getElementById(campoId + "-erro");
    if (input) input.classList.add("campo-invalido");
    if (erro) {
        erro.textContent = mensagem;
        erro.classList.add("ativo");
    }
}

function limparErro(campoId) {
    const input = document.getElementById(campoId);
    const erro = document.getElementById(campoId + "-erro");
    if (input) input.classList.remove("campo-invalido");
    if (erro) erro.classList.remove("ativo");
}

function limparTodosErros(form) {
    form.querySelectorAll(".campo-invalido").forEach((el) => el.classList.remove("campo-invalido"));
    form.querySelectorAll(".campo-erro.ativo").forEach((el) => el.classList.remove("ativo"));
}

function emailValido(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

function mostrarMensagem(id, tipo, texto) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = "auth-mensagem ativa " + tipo;
    el.innerHTML = texto;
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

function normalizarUrlImagem(path, fallback = "./src/images/equipe/avatar/default-avatar.png") {
    if (!path) return fallback;
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("./")) {
        return path;
    }
    return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Função utilitária para requisições com proteção contra retornos em HTML
 */
async function requisitarAPI(endpoint, opcoes = {}) {
    try {
        const resposta = await fetch(`${API_BASE}${endpoint}`, opcoes);
        const contentType = resposta.headers.get("content-type") || "";

        let dados = {};
        if (contentType.includes("application/json")) {
            dados = await resposta.json();
        } else {
            dados = {
                success: false,
                message: `Erro no servidor (${resposta.status}). Tente novamente mais tarde.`
            };
        }

        return { ok: resposta.ok, status: resposta.status, dados };
    } catch (erro) {
        console.error("Erro na comunicação com a API:", erro);
        return {
            ok: false,
            status: 0,
            dados: { success: false, message: "Não foi possível conectar ao servidor backend." }
        };
    }
}

// ---------- Toggle de Visibilidade de Senha ----------

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

// ---------- Preview de Foto (Cadastro) ----------

const inputFoto = document.getElementById("foto");
const previewFoto = document.getElementById("foto-preview");

if (inputFoto && previewFoto) {
    inputFoto.addEventListener("change", () => {
        const arquivo = inputFoto.files && inputFoto.files[0];
        if (!arquivo) return;

        if (!arquivo.type.startsWith("image/")) {
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

// ---------- Formulário: Login ----------

const formLogin = document.getElementById("form-login") || document.getElementById("formLogin");

if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparTodosErros(formLogin);
        esconderMensagem("login-mensagem");

        const email = document.getElementById("email")?.value.trim();
        const senha = document.getElementById("senha")?.value;
        let valido = true;

        if (!email || !emailValido(email)) {
            mostrarErro("email", "Informe um e-mail válido.");
            valido = false;
        }
        if (!senha) {
            mostrarErro("senha", "Informe sua senha.");
            valido = false;
        }
        if (!valido) return;

        const botao = formLogin.querySelector(".btn-auth");
        alternarCarregando(botao, true);

        const { ok, dados } = await requisitarAPI("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, senha })
        });

        alternarCarregando(botao, false);

        if (ok && dados.token) {
            localStorage.setItem(TOKEN_KEY, dados.token);
            window.location.href = "dashboard.html";
        } else {
            const mensagemErro = dados.message || dados.erro || "E-mail ou senha incorretos.";
            mostrarMensagem("login-mensagem", "erro", mensagemErro);
        }
    });
}

// ---------- Formulário: Cadastro ----------

const formCadastro = document.getElementById("form-cadastro") || document.getElementById("formCadastro");

if (formCadastro) {
    formCadastro.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparTodosErros(formCadastro);
        esconderMensagem("cadastro-mensagem");

        const nome = document.getElementById("nome")?.value.trim() || "";
        const email = document.getElementById("email")?.value.trim() || "";
        const senha = document.getElementById("senha")?.value || "";
        const confirmarSenha = document.getElementById("confirmar-senha")?.value || "";
        const termos = document.getElementById("termos")?.checked;
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
        if (document.getElementById("termos") && !termos) {
            mostrarErro("termos", "Você precisa aceitar os termos para continuar.");
            valido = false;
        }
        if (!valido) return;

        const botao = formCadastro.querySelector(".btn-auth");
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

        if (inputFoto?.files?.[0]) {
            formData.append("foto", inputFoto.files[0]);
        }

        const { ok, dados } = await requisitarAPI("/api/register", {
            method: "POST",
            body: formData
        });

        alternarCarregando(botao, false);

        if (ok && (dados.success || dados.token)) {
            if (dados.token) {
                localStorage.setItem(TOKEN_KEY, dados.token);
            }
            
            mostrarMensagem(
                "cadastro-mensagem",
                "sucesso",
                '<i class="fas fa-circle-check"></i> Conta criada com sucesso! Redirecionando...'
            );

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1500);
        } else {
            const mensagemErro = dados.message || dados.erro || "Erro ao criar conta.";
            mostrarMensagem("cadastro-mensagem", "erro", mensagemErro);
        }
    });
}

// ---------- Formulário: Recuperar Senha ----------

const formRecuperar = document.getElementById("form-recuperar");

if (formRecuperar) {
    formRecuperar.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparTodosErros(formRecuperar);
        esconderMensagem("recuperar-mensagem");

        const email = document.getElementById("email")?.value.trim() || "";

        if (!emailValido(email)) {
            mostrarErro("email", "Informe um e-mail válido.");
            return;
        }

        const botao = formRecuperar.querySelector(".btn-auth");
        alternarCarregando(botao, true);

        // Simulando resposta de envio do link de recuperação
        setTimeout(() => {
            alternarCarregando(botao, false);
            const btnTexto = formRecuperar.querySelector(".btn-auth-texto");
            if (btnTexto) btnTexto.textContent = "Link enviado";

            mostrarMensagem(
                "recuperar-mensagem",
                "sucesso",
                '<i class="fas fa-circle-check"></i>&nbsp; Se este e-mail estiver cadastrado, um link de redefinição foi enviado.'
            );
        }, 700);
    });
}