const token = localStorage.getItem("token_lsd");
if (!token) window.location.href = "entrar-login.html";

const listaUsuarios = document.getElementById('listaUsuarios');
const mensagemDiv = document.getElementById('mensagemAdmin');

async function carregarMembros() {
    try {
        const resposta = await fetch('http://127.0.0.1:5000/api/admin/usuarios', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const dados = await resposta.json();

        // Se o usuário tentar acessar mas não for admin, chuta ele de volta pro perfil
        if (resposta.status === 403) {
            alert("Você não tem permissão para acessar esta página.");
            window.location.href = "perfil.html";
            return;
        }

        renderizarTabela(dados);
    } catch (err) {
        listaUsuarios.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">Erro de conexão com o servidor.</td></tr>`;
    }
}

function renderizarTabela(usuarios) {
    listaUsuarios.innerHTML = '';
    
    usuarios.forEach(u => {
        const fotoSrc = u.foto ? u.foto : './src/images/default-avatar.png';
        const badgeNivel = u.is_admin ? `<span class="badge-admin">Admin</span>` : `<span class="badge-membro">Membro</span>`;
        
        // Lógica de cores das advertências
        const advs = u.advertencias || 0;
        let badgeAdv = `<span class="badge-ok">0</span>`;
        if (advs > 0 && advs < 3) badgeAdv = `<span class="badge-alerta">${advs} <i class="fas fa-exclamation-triangle"></i></span>`;
        if (advs >= 3) badgeAdv = `<span class="badge-perigo">${advs} <i class="fas fa-skull-crossbones"></i></span>`;

        const iconePromover = u.is_admin ? 'fa-arrow-down' : 'fa-arrow-up';
        const titlePromover = u.is_admin ? 'Rebaixar a Membro' : 'Promover a Admin';

        listaUsuarios.innerHTML += `
            <tr>
                <td>
                    <div class="user-info">
                        <img src="${fotoSrc}" alt="Avatar">
                        <div class="user-details">
                            <strong>${u.nome}</strong>
                            <span>${u.email}</span>
                        </div>
                    </div>
                </td>
                <td>${u.funcao || 'Não definida'}</td>
                <td>${badgeNivel}</td>
                <td>${badgeAdv}</td>
                <td>
                    <button class="btn-acao advertir" title="Aplicar Advertência" onclick="advertirUsuario(${u.id}, '${u.nome}')">
                        <i class="fas fa-exclamation-circle"></i>
                    </button>
                    <button class="btn-acao promover" title="${titlePromover}" onclick="toggleAdmin(${u.id})">
                        <i class="fas ${iconePromover}"></i>
                    </button>
                    <button class="btn-acao excluir" title="Expulsar Membro" onclick="excluirUsuario(${u.id}, '${u.nome}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}
async function advertirUsuario(id, nome) {
    const motivo = prompt(`Você está prestes a advertir ${nome}.\nDigite o motivo (opcional) ou clique em OK para confirmar:`);
    
    if (motivo === null) return;

    try {
        const resposta = await fetch(`http://127.0.0.1:5000/api/admin/usuarios/${id}/advertir`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ motivo: motivo })
        });
        
        const resultado = await resposta.json();
        
        if (resposta.ok) {
            mostrarMensagem('msg-sucesso', resultado.mensagem);
            carregarMembros(); // Recarrega a tabela para atualizar o número
        } else {
            mostrarMensagem('msg-erro', resultado.erro);
        }
    } catch(err) {
        mostrarMensagem('msg-erro', "Erro de rede ao aplicar advertência.");
    }
}

async function toggleAdmin(id) {
    if(!confirm("Tem certeza que deseja alterar o nível de acesso deste usuário?")) return;
    
    try {
        const resposta = await fetch(`http://127.0.0.1:5000/api/admin/usuarios/${id}/toggle-admin`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resultado = await resposta.json();
        
        if (resposta.ok) {
            mostrarMensagem('msg-sucesso', resultado.mensagem);
            carregarMembros(); // Recarrega a tabela atualizada
        } else {
            mostrarMensagem('msg-erro', resultado.erro);
        }
    } catch(err) {
        mostrarMensagem('msg-erro', "Erro de rede.");
    }
}

async function excluirUsuario(id, nome) {
    const certeza = confirm(`ATENÇÃO: Você está prestes a expulsar ${nome} da equipe.\nEsta ação não pode ser desfeita. Deseja continuar?`);
    if(!certeza) return;

    try {
        const resposta = await fetch(`http://127.0.0.1:5000/api/admin/usuarios/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resultado = await resposta.json();
        
        if (resposta.ok) {
            mostrarMensagem('msg-sucesso', resultado.mensagem);
            carregarMembros();
        } else {
            mostrarMensagem('msg-erro', resultado.erro);
        }
    } catch(err) {
        mostrarMensagem('msg-erro', "Erro de rede.");
    }
}

function mostrarMensagem(classe, texto) {
    mensagemDiv.className = `mensagem-admin ${classe}`;
    mensagemDiv.textContent = texto;
    setTimeout(() => { mensagemDiv.className = ''; mensagemDiv.textContent = ''; }, 4000);
}

document.getElementById('logoutLink').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = "entrar-login.html";
});

carregarMembros();