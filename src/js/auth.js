/**
 * Lógica compartilhada das páginas de autenticação (login, cadastro, recuperar senha).
 *
 * Este arquivo cuida da validação no front-end, feedback visual e comunicação 
 * com a API real do servidor.
 *
 * Sugestão de contrato de API (ajustado para o backend real):
 *   POST /api/auth/login          { email, senha }                    -> { token }
 *   POST /api/auth/cadastro       { nome, email, senha, codigo... }    -> { token }
 *   POST /api/auth/recuperar-senha { email }                           -> { ok: true }
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

        try {
            const resposta = await fetch('http://127.0.0.1:5000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });
            
            const dados = await resposta.json();
            
            if (!resposta.ok) throw new Error(dados.erro || 'E-mail ou senha incorretos.');
            
            // Salva o "crachá" (Token) de acesso no navegador do usuário
            localStorage.setItem('token_lsd', dados.token);
            
            // Redireciona para a página principal ou área restrita
            window.location.href = 'index.html'; 
            
        } catch (err) {
            mostrarMensagem('login-mensagem', 'erro', err.message);
        } finally {
            alternarCarregando(botao, false);
        }
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
        const codigoAcesso = document.getElementById("codigo_acesso").value.trim();
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
        
        // Declarando a variável dadosPerfil corretamente
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

        try {
            const formData = new FormData();
            
            // Adiciona os textos ao FormData
            formData.append('nome', dadosPerfil.nome);
            formData.append('email', dadosPerfil.email);
            formData.append('senha', dadosPerfil.senha);
            formData.append('funcao', dadosPerfil.funcao);
            formData.append('bio', dadosPerfil.bio);
            formData.append('instagram', dadosPerfil.instagram);
            formData.append('github', dadosPerfil.github);
            formData.append('codigo_acesso', codigoAcesso);
            
            if (dadosPerfil.foto) {
                formData.append('foto', dadosPerfil.foto);
            }

            // 1. Envia os dados para cadastrar
            const resposta = await fetch('http://127.0.0.1:5000/api/auth/cadastro', {
                method: 'POST',
                body: formData
            });

            const dados = await resposta.json();

            if (!resposta.ok) throw new Error(dados.erro || 'Erro ao criar conta.');
            
            // 2. Mostra a mensagem de sucesso
            mostrarMensagem("cadastro-mensagem", "sucesso", '<i class="fas fa-circle-check"></i> Cadastro concluído! Entrando...');
            
            // 3. Faz o LOGIN AUTOMÁTICO com os mesmos dados
            const respostaLogin = await fetch('http://127.0.0.1:5000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: dadosPerfil.email, senha: dadosPerfil.senha })
            });
            
            const dadosLogin = await respostaLogin.json();
            
            if (resposta.ok) {
                localStorage.setItem('token_lsd', dadosLogin.token);
                localStorage.setItem('nome_usuario_lsd', dadosLogin.nome || "Membro Logado");

                if (dadosLogin.foto) {
                    localStorage.setItem('foto_usuario_lsd', dadosLogin.foto);
                } else {
                    localStorage.removeItem('foto_usuario_lsd');
                }
                
                setTimeout(() => { window.location.href = 'index.html'; }, 1500);
            }
        } catch (err) {
            mostrarMensagem('cadastro-mensagem', 'erro', err.message);
        } finally {
            alternarCarregando(botao, false);
        }
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