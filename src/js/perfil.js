const token = localStorage.getItem("token_lsd");

// 1. Redireciona se não tiver token no topo do arquivo
if (!token) {
    window.location.href = "entrar-login.html"; 
}

// Elementos da tela
const form = document.getElementById('formPerfil');
const btnSalvar = document.getElementById('btnSalvar');
const mensagemDiv = document.getElementById('mensagemPerfil');
const inputFoto = document.getElementById('foto');
const perfilAvatar = document.getElementById('perfilAvatar');

// Carregar dados assim que a página abre
async function carregarPerfil() {
    try {
        const resposta = await fetch('http://127.0.0.1:5000/api/perfil', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!resposta.ok) throw new Error("Sessão expirada. Faça login novamente.");
        
        const dados = await resposta.json();

        // Preenche as informações na tela
        document.getElementById('perfilNome').textContent = dados.nome;
        document.getElementById('perfilFuncao').textContent = dados.funcao || "Membro";
        document.getElementById('email').value = dados.email;
        document.getElementById('bio').value = dados.bio || "";
        document.getElementById('instagram').value = dados.instagram || "";
        document.getElementById('github').value = dados.github || "";

        if (dados.foto) {
            perfilAvatar.src = dados.foto;
            // Atualiza a foto também no localStorage para o Kanban ler
            localStorage.setItem("foto_usuario_lsd", dados.foto);
        }

        if (dados.is_admin) {
            document.getElementById('adminBadge').hidden = false;
            document.getElementById('adminMenu').hidden = false;
        }

    } catch (err) {
        alert(err.message);
        localStorage.clear();
        // 2. Redireciona se o token for inválido ou expirar
        window.location.href = "entrar-login.html"; 
    }
}

// Preview da imagem ao escolher um arquivo novo
inputFoto.addEventListener('change', (e) => {
    const arquivo = e.target.files[0];
    if (arquivo) {
        const urlTemporaria = URL.createObjectURL(arquivo);
        perfilAvatar.src = urlTemporaria;
    }
});

// Enviar dados atualizados para o servidor
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    btnSalvar.textContent = "Salvando...";
    btnSalvar.disabled = true;

    const formData = new FormData();
    formData.append('email', document.getElementById('email').value);
    formData.append('bio', document.getElementById('bio').value);
    formData.append('instagram', document.getElementById('instagram').value);
    formData.append('github', document.getElementById('github').value);

    if (inputFoto.files[0]) {
        formData.append('foto', inputFoto.files[0]);
    }

    try {
        const resposta = await fetch('http://127.0.0.1:5000/api/perfil', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }, // Token de segurança
            body: formData
        });

        const resultado = await resposta.json();

        if (!resposta.ok) throw new Error(resultado.erro);

        // Se o backend devolver uma nova URL de foto, atualizamos no navegador
        if (resultado.foto_nova) {
            localStorage.setItem("foto_usuario_lsd", resultado.foto_nova);
        }

        mostrarMensagem('sucesso', '<i class="fas fa-check"></i> ' + resultado.mensagem);
    } catch (err) {
        mostrarMensagem('erro', '<i class="fas fa-exclamation-triangle"></i> ' + err.message);
    } finally {
        btnSalvar.textContent = "Salvar Alterações";
        btnSalvar.disabled = false;
    }
});

function mostrarMensagem(tipo, texto) {
    mensagemDiv.className = `mensagem-alerta ${tipo}`;
    mensagemDiv.innerHTML = texto;
    setTimeout(() => { mensagemDiv.className = ''; mensagemDiv.innerHTML = ''; }, 4000);
}

// Deslogar
document.getElementById('logoutLink').addEventListener('click', () => {
    localStorage.clear();
    // 3. Redireciona ao clicar no botão de Sair
    window.location.href = "entrar-login.html"; 
});

// Inicia
carregarPerfil();