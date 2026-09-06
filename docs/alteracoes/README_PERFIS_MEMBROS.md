# Alteração — Perfis públicos dos membros

![Frontend](https://img.shields.io/badge/Frontend-HTML%20%2B%20CSS%20%2B%20JavaScript-F7DF1E)
![Backend](https://img.shields.io/badge/Backend-Flask-000000)
![API](https://img.shields.io/badge/API-REST-009688)
![Status](https://img.shields.io/badge/status-implementado-brightgreen)

Esta documentação descreve a nova área de membros e o perfil público individual integrado ao Dashboard LSD.

O objetivo foi permitir que qualquer usuário autenticado conheça os demais integrantes da equipe e visualize as informações públicas relacionadas ao trabalho de cada membro dentro da plataforma.

---

# Diretório de membros

O Dashboard possui uma área dedicada aos membros cadastrados.

Ela permite visualizar dados resumidos de cada integrante e abrir seu perfil completo.

O frontend mantém uma lista própria para o diretório:

```text
membrosDiretorio
```

Também existe controle para identificar qual perfil está aberto:

```text
perfilMembroAbertoId
```

---

# Perfil público

O perfil público pode apresentar:

- foto de perfil;
- capa;
- nome;
- função;
- selo de administrador quando `is_admin == true`;
- bio;
- localização;
- e-mail;
- GitHub;
- Instagram;
- pontuação;
- linguagens e tecnologias;
- cards assumidos no Kanban;
- conquistas desbloqueadas;
- espaço reservado para projetos.

A área de projetos ainda retorna uma lista vazia, pois o modelo de projetos será criado futuramente.

---

# Endpoint do perfil público

```http
GET /api/membros/<user_id>/perfil
```

A rota exige autenticação por JWT.

Exemplo de resposta:

```json
{
  "success": true,
  "membro": {},
  "cards": [],
  "conquistas": [],
  "projetos": []
}
```

Caso o membro não exista:

```http
404 Not Found
```

---

# Cards exibidos no perfil

O perfil não mostra todos os cards existentes no quadro.

São retornados somente os cards em que o membro é o responsável atual:

```python
Card.query.filter(
    Card.responsavel_id == membro.id
)
```

Isso significa que a área representa os cards realmente assumidos pelo integrante.

---

# Linguagens e tecnologias

O modelo `User` possui o campo:

```python
linguagens
```

O conteúdo é armazenado como uma lista JSON serializada no SQLite.

Ao enviar o perfil, o backend normaliza os valores e limita a lista a até 20 itens.

O frontend transforma essas tecnologias em elementos visuais no perfil e no diretório de membros.

---

# Conquistas no perfil

O endpoint também chama o verificador de conquistas antes de montar a resposta:

```python
conquistas = verificar_conquistas(membro)
```

Isso é importante para conquistas baseadas apenas na passagem do tempo, como `Preguiçoso`.

O perfil mostra somente as conquistas que já pertencem ao usuário.

---

# Projetos

A API já reserva o campo:

```json
"projetos": []
```

Essa decisão mantém o contrato do endpoint pronto para receber um sistema de projetos futuramente sem precisar reconstruir a página pública.

---

# Principais arquivos envolvidos

```text
dashboard.html
backend/app.py
src/js/dashboard.js
src/css/dashboard.css
```

---

# Segurança

O perfil público continua sendo uma área privada da comunidade LSD.

Para acessar:

```text
Token JWT válido
        ↓
Usuário autenticado
        ↓
Perfil do membro liberado
```

A rota não utiliza `admin_required`, portanto todos os membros autenticados podem visualizar outros perfis.

---

# Estado

```text
[OK] Diretório de membros
[OK] Perfil individual
[OK] Cards assumidos
[OK] Linguagens/tecnologias
[OK] Selo de administrador
[OK] Conquistas integradas
[OK] Contrato reservado para projetos
```
