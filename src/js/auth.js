/**
 * Lógica compartilhada das páginas de autenticação (login, cadastro, recuperar senha).
 *
 * Este arquivo só cuida de validação no front-end e feedback visual.
 * Nenhuma chamada real de rede é feita — os pontos exatos onde conectar
 * o backend estão marcados com "TODO BACKEND" abaixo.
 *
 * Sugestão de contrato de API (ajuste conforme o backend real):
 *   POST /api/auth/login          { email, senha }              -> { token }
 *   POST /api/auth/cadastro       { nome, email, senha, ... }    -> { token }
 *   POST /api/auth/recuperar-senha { email }                     -> { ok: true }
 *
 * Regras de segurança que o backend deve garantir (não fazer no front):
 *   - Hash da senha (bcrypt/argon2), nunca armazenar em texto puro.
 *   - Rate limiting nas rotas de login e recuperação de senha.
 *   - Resposta genérica em "recuperar senha" mesmo se o e-mail não existir,
 *     pra não revelar quais e-mails estão cadastrados.
 *   - Token de redefinição de senha com expiração curta (ex: 30 min).
 */

// ---------- Utilitários ----------

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

// ---------- Toggle de visibilidade de senha ----------

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

// ---------- Preview de foto (cadastro) ----------

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

const formLogin = document.getElementById("form-login");

if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparTodosErros(formLogin);
        esconderMensagem("login-mensagem");

        const email = document.getElementById("email").value.trim();
        const senha = document.getElementById("senha").value;
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
        alternarCarregando(botao, true);

        // TODO BACKEND: substituir pelo login real.
        // try {
        //     const resposta = await fetch('/api/auth/login', {
        //         method: 'POST',
        //         headers: { 'Content-Type': 'application/json' },
        //         body: JSON.stringify({ email, senha })
        //     });
        //     if (!resposta.ok) throw new Error('Credenciais inválidas.');
        //     const dados = await resposta.json();
        //     // salvar token (ex: cookie httpOnly definido pelo backend, ou localStorage se for SPA)
        //     window.location.href = 'index.html';
        //     return;
        // } catch (err) {
        //     mostrarMensagem('login-mensagem', 'erro', err.message);
        // } finally {
        //     alternarCarregando(botao, false);
        // }

        setTimeout(() => {
            alternarCarregando(botao, false);
            mostrarMensagem(
                "login-mensagem",
                "erro",
                '<i class="fas fa-circle-info"></i>&nbsp; Esta página ainda não está conectada a um backend — este é apenas o front-end pronto pra integração.'
            );
        }, 700);
    });
}

// ---------- Formulário: Cadastro ----------

const formCadastro = document.getElementById("form-cadastro");

if (formCadastro) {
    formCadastro.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparTodosErros(formCadastro);
        esconderMensagem("cadastro-mensagem");

        const nome = document.getElementById("nome").value.trim();
        const email = document.getElementById("email").value.trim();
        const senha = document.getElementById("senha").value;
        const confirmarSenha = document.getElementById("confirmar-senha").value;
        const termos = document.getElementById("termos").checked;
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
        if (!termos) {
            mostrarErro("termos", "Você precisa aceitar os termos para continuar.");
            valido = false;
        }
        if (!valido) return;

        const botao = formCadastro.querySelector(".btn-auth");
        alternarCarregando(botao, true);

        const dadosPerfil = {
            nome,
            email,
            senha,
            funcao: document.getElementById("funcao").value.trim(),
            bio: document.getElementById("bio").value.trim(),
            instagram: document.getElementById("instagram").value.trim(),
            github: document.getElementById("github").value.trim(),
            foto: inputFoto?.files?.[0] || null
        };

        // TODO BACKEND: substituir pelo cadastro real (multipart/form-data por causa da foto).
        // try {
        //     const formData = new FormData();
        //     Object.entries(dadosPerfil).forEach(([chave, valor]) => {
        //         if (valor) formData.append(chave, valor);
        //     });
        //     const resposta = await fetch('/api/auth/cadastro', {
        //         method: 'POST',
        //         body: formData
        //     });
        //     if (!resposta.ok) throw new Error('Não foi possível concluir o cadastro.');
        //     window.location.href = 'equipe-completa.html';
        //     return;
        // } catch (err) {
        //     mostrarMensagem('cadastro-mensagem', 'erro', err.message);
        // } finally {
        //     alternarCarregando(botao, false);
        // }

        setTimeout(() => {
            alternarCarregando(botao, false);
            mostrarMensagem(
                "cadastro-mensagem",
                "sucesso",
                '<i class="fas fa-circle-check"></i>&nbsp; Formulário validado! Falta só conectar este front-end a um backend real para criar a conta.'
            );
        }, 700);
    });
}

// ---------- Formulário: Recuperar senha ----------

const formRecuperar = document.getElementById("form-recuperar");

if (formRecuperar) {
    formRecuperar.addEventListener("submit", async (e) => {
        e.preventDefault();
        limparTodosErros(formRecuperar);
        esconderMensagem("recuperar-mensagem");

        const email = document.getElementById("email").value.trim();

        if (!emailValido(email)) {
            mostrarErro("email", "Informe um e-mail válido.");
            return;
        }

        const botao = formRecuperar.querySelector(".btn-auth");
        alternarCarregando(botao, true);

        // TODO BACKEND: substituir pelo envio real do e-mail de recuperação.
        // Importante: responder sempre com a mesma mensagem genérica,
        // exista ou não o e-mail na base, por segurança.
        // try {
        //     await fetch('/api/auth/recuperar-senha', {
        //         method: 'POST',
        //         headers: { 'Content-Type': 'application/json' },
        //         body: JSON.stringify({ email })
        //     });
        // } finally {
        //     alternarCarregando(botao, false);
        // }

        setTimeout(() => {
            alternarCarregando(botao, false);
            formRecuperar.querySelector(".btn-auth-texto").textContent = "Link enviado";
            mostrarMensagem(
                "recuperar-mensagem",
                "sucesso",
                '<i class="fas fa-circle-check"></i>&nbsp; Se este e-mail estiver cadastrado, um link de redefinição foi enviado. (Simulado — falta conectar ao backend.)'
            );
        }, 700);
    });
}
