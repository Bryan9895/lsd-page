# Alteração — Sistema de Conquistas

![Backend](https://img.shields.io/badge/Backend-Flask-000000)
![Database](https://img.shields.io/badge/Database-SQLite-003B57)
![Achievements](https://img.shields.io/badge/Conquistas-9-F2B134)
![Status](https://img.shields.io/badge/status-implementado-brightgreen)

Esta documentação descreve o sistema de conquistas do Dashboard LSD, inspirado na ideia de achievements exibidos no perfil do GitHub.

As conquistas são verificadas pelo backend, armazenadas no banco de dados e exibidas tanto no Dashboard principal quanto no perfil público do membro.

---

# Conquistas disponíveis

O catálogo atual possui 9 conquistas:

| Conquista | Requisito |
|---|---|
| Bem Vindo! | Fazer parte da comunidade e possuir uma conta válida |
| 100 pontos | Alcançar pelo menos 100 pontos |
| 300 pontos | Alcançar pelo menos 300 pontos |
| 500 pontos | Alcançar pelo menos 500 pontos |
| 1000 pontos | Alcançar pelo menos 1000 pontos |
| Comentarista | Publicar pelo menos 30 comentários |
| Criador de Cards | Criar pelo menos 30 cards |
| Preguiçoso | Passar 14 dias completos sem criar um novo card |
| Sempre em confusão | Receber pelo menos 3 advertências |

---

# Catálogo

As definições ficam centralizadas em:

```python
CONQUISTAS_PADRAO
```

Cada conquista possui:

```text
codigo
nome
descricao
icone
raridade
```

Exemplo:

```python
{
    "codigo": "100_pontos",
    "nome": "100 pontos",
    "descricao": "Alcançou 100 pontos no quadro Kanban.",
    "icone": "/src/images/conquistas/100_pontos.png",
    "raridade": "bronze"
}
```

---

# Modelos do banco

O sistema utiliza duas tabelas principais.

## `achievements`

Armazena o catálogo das conquistas.

## `user_achievements`

Relaciona um usuário a uma conquista já desbloqueada.

Existe uma restrição de unicidade para impedir o mesmo selo de ser atribuído duas vezes ao mesmo membro.

A data de desbloqueio é registrada em:

```python
data_conquista
```

---

# Verificação automática

A função central é:

```python
verificar_conquistas(usuario)
```

Ela pode ser executada várias vezes com segurança.

O backend primeiro consulta as conquistas que o membro já possui e depois calcula os requisitos atuais.

Os dados avaliados incluem:

```text
usuario.pontos
quantidade de comentários
quantidade de cards criados
quantidade de advertências
ultimo_card_criado_em
```

Somente conquistas ainda não registradas são inseridas no banco.

---

# Regras implementadas

O backend utiliza as seguintes condições:

```python
"bem_vindo": True
"100_pontos": pontos >= 100
"300_pontos": pontos >= 300
"500_pontos": pontos >= 500
"1000_pontos": pontos >= 1000
"comentarista": total_comentarios >= 30
"criador_cards": total_cards_criados >= 30
"preguicoso": passou_duas_semanas
"sempre_confusao": total_advertencias >= 3
```

---

# Conquista Bem Vindo!

A conquista é verificada imediatamente após a criação da conta e também durante o login.

Como o requisito é sempre verdadeiro para um usuário válido, todo membro recebe esse selo.

---

# Conquistas de pontuação

As conquistas são cumulativas.

Exemplo:

```text
100 pontos   → 100 pontos
300 pontos   → 100 + 300 pontos
500 pontos   → 100 + 300 + 500 pontos
1000 pontos  → todas as conquistas de pontuação
```

A pontuação continua sendo originada pelo sistema do Kanban.

---

# Comentarista

É desbloqueada quando o total de comentários criados pelo usuário chega a:

```text
30
```

A contagem utiliza os registros de `post_comments` associados ao membro.

---

# Criador de Cards

É desbloqueada quando o usuário cria pelo menos:

```text
30 cards
```

Para permitir essa contagem, os cards passaram a possuir:

```python
criador_id
```

Esse campo é diferente de:

```python
responsavel_id
```

`criador_id` representa quem criou a tarefa.

`responsavel_id` representa quem assumiu a tarefa.

---

# Preguiçoso

É desbloqueada após:

```text
14 dias completos sem criar um novo card
```

O usuário possui o campo:

```python
ultimo_card_criado_em
```

A condição é calculada comparando esse valor com o horário atual do servidor.

A conquista pode ser detectada quando o usuário volta ao sistema ou quando seu perfil é consultado, pois a verificação não depende de um processo executando continuamente em segundo plano.

---

# Sempre em confusão

É desbloqueada quando o membro acumula pelo menos:

```text
3 advertências
```

A contagem utiliza a tabela `advertencias`.

---

# Endpoints

## Conquistas do usuário logado

```http
GET /api/conquistas/minhas
```

Resposta:

```json
{
  "success": true,
  "total": 3,
  "conquistas": []
}
```

## Perfil público

```http
GET /api/membros/<user_id>/perfil
```

Também retorna:

```json
"conquistas": []
```

---

# Dashboard principal

As conquistas do usuário aparecem abaixo da área de progresso do quadro.

O contador utiliza o formato:

```text
3/9
```

Cada item mostra:

```text
imagem do selo
nome da conquista
```

A descrição é disponibilizada pelo atributo `title`, permitindo visualizar o requisito ao posicionar o cursor sobre o selo.

---

# Perfil público

No perfil de um membro, as conquistas aparecem em uma grade própria.

O visual prioriza:

```text
selo
nome
```

Ao passar o mouse ou focar o item, a interface utiliza a descrição da conquista como informação contextual.

---

# Imagens dos selos

Os arquivos estão localizados em:

```text
src/images/conquistas/
├── bem_vindo.png
├── 100_pontos.png
├── 300_pontos.png
├── 500_pontos.png
├── 1000_pontos.png
├── comentarista.png
├── criador_cards.png
├── preguicoso.png
└── sempre_confusao.png
```

---

# Compatibilidade com bancos antigos

A inicialização do backend verifica a estrutura existente e adiciona campos necessários quando eles ainda não existem.

Entre os campos utilizados pelo sistema estão:

```text
users.ultimo_card_criado_em
cards.criador_id
```

As tabelas de conquistas são criadas pelo SQLAlchemy quando estiverem ausentes.

---

# Principais arquivos envolvidos

```text
backend/app.py
src/js/dashboard.js
src/css/dashboard.css
src/images/conquistas/
```

---

# Estado

```text
[OK] 9 conquistas cadastradas
[OK] Desbloqueio automático
[OK] Persistência no SQLite
[OK] Selos próprios
[OK] Exibição no Dashboard
[OK] Exibição no perfil público
[OK] Tooltip por descrição
[OK] Compatibilidade com banco existente
```
