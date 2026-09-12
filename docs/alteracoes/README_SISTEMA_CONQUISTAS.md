# Alteração — Sistema de Conquistas

![Backend](https://img.shields.io/badge/Backend-Flask-000000)
![Database](https://img.shields.io/badge/Database-SQLite-003B57)
![Achievements](https://img.shields.io/badge/Conquistas-28-F2B134)
![Status](https://img.shields.io/badge/status-implementado-brightgreen)

Esta documentação descreve o sistema de conquistas do Dashboard LSD, inspirado na ideia de achievements exibidos no perfil do GitHub.

As conquistas são verificadas pelo backend, armazenadas no banco de dados e exibidas tanto no Dashboard principal quanto no perfil público do membro. O dashboard também exibe nível, sequência de logins, atividades recentes e notificações quando uma conquista é desbloqueada.

---

# Conquistas disponíveis

O catálogo atual possui 28 conquistas:

| Conquista | Requisito |
|---|---|
| Cheguei, e agora? | Fazer parte da comunidade e possuir uma conta válida |
| Primeiras Faíscas | Alcançar pelo menos 100 pontos |
| Pegando Ritmo | Alcançar pelo menos 300 pontos |
| Sem Freio! | Alcançar pelo menos 500 pontos |
| Isso Já É Poder | Alcançar pelo menos 1000 pontos |
| Só Mais Um Comentário... | Publicar pelo menos 30 comentários |
| A Fábrica Não Para | Criar pelo menos 30 cards |
| Volto Já... | Passar 14 dias completos sem criar um novo card |
| Era Só Um Aviso... | Receber pelo menos 3 advertências |
| Quem é Você? | Completar foto e biografia do perfil |
| Bate-Papo | Publicar pelo menos 30 comentários |
| Primeiro Registro | Fazer a primeira publicação |
| Construindo Juntos | Receber 10 curtidas |
| Frequente | Fazer login por 7 dias seguidos |
| Organizado | Concluir 10 cards |
| Mão na Massa | Publicar 3 materiais, arquivos ou códigos |
| Espírito Comunitário | Receber 50 curtidas |

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
    "nome": "Primeiras Faíscas",
    "descricao": "Alcançou 100 pontos no quadro Kanban.",
    "icone": "/src/images/conquistas/100_pontos.svg",
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

Também são considerados os registros diários de login, publicações, materiais,
reações e atividades do membro.
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
Primeiras Faíscas → 100 pontos
Pegando Ritmo → 100 + 300 pontos
Sem Freio! → 100 + 300 + 500 pontos
Isso Já É Poder → todas as conquistas de pontuação
```

A pontuação continua sendo originada pelo sistema do Kanban.

---

# Só Mais Um Comentário...

É desbloqueada quando o total de comentários criados pelo usuário chega a:

```text
30
```

A contagem utiliza os registros de `post_comments` associados ao membro.

---

# A Fábrica Não Para

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

# Volto Já...

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

# Era Só Um Aviso...

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
├── bem_vindo.svg
├── 100_pontos.svg
├── 300_pontos.svg
├── 500_pontos.svg
├── 1000_pontos.svg
├── comentarista.svg
├── criador_cards.svg
├── preguicoso.svg
└── sempre_confusao.svg
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


## Identidade visual V2

Os selos foram redesenhados em SVG com medalhões próprios, símbolos mais expressivos e nomes em tom de achievement de jogo. Os códigos internos das conquistas foram preservados para não quebrar desbloqueios existentes no banco de dados.
