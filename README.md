# LSD — Laboratório de Sistemas e Dados

![Version](https://img.shields.io/badge/version-2.6.0-blue)
![Python](https://img.shields.io/badge/Python-Flask-3776AB)
![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E)
![Database](https://img.shields.io/badge/Database-SQLite-003B57)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-orange)

Plataforma web interna do **LSD — Laboratório de Sistemas e Dados**, desenvolvida para centralizar atividades da equipe em um único ambiente.

A versão **2.6.0** adiciona um portfólio completo de projetos, conectando projetos, membros, líderes, documentação e administração em uma experiência responsiva.

---

# Versão atual — 2.6.0

## Novidades da 2.6.0

| Área | Atualização |
|---|---|
| Portfólio | Página pública alinhada ao visual do site principal, com busca, cards, detalhes e fases exibidas como tags. |
| Projeto ↔ membro | Projetos aparecem no perfil público; participantes do projeto levam ao perfil correspondente. |
| Administração | A gestão fica no próprio portfólio; somente administradores veem os controles para cadastrar, editar e excluir projetos. |
| Documentação | Líderes e administradores podem anexar e remover documentos do projeto. |
| Banco | Novas tabelas relacionais criadas de forma compatível, sem apagar dados existentes. |
| Qualidade | API validada com permissões, URLs seguras, limites de entrada e testes automatizados. |

Detalhes: [Portfólio de projetos](docs/alteracoes/README_PORTFOLIO_PROJETOS.md).

## Atualizações da 2.5.7

| Área | Atualização |
|---|---|
| Conquistas no perfil | O nome de cada conquista fica sempre visível abaixo do selo no perfil público. |
| Detalhes da conquista | Clique ou teclado abre um modal inspirado nos achievements do GitHub, com selo ampliado, nome, descrição, raridade, data de desbloqueio, percentual global e histórico. |
| Estatísticas | A API do perfil passa a informar quantos membros desbloquearam cada conquista e o percentual correspondente. |
| Acessibilidade | Selos podem ser abertos com `Enter`/`Espaço`, o modal fecha com `Esc` ou clique fora e devolve o foco ao selo. |
| Visual | Modal responsivo, compatível com tema escuro e adaptado para bottom sheet em celulares. |
| Reações e selos | Mantidos os selos SVG circulares e o seletor de emotes sob demanda da linha 2.5.x. |

Atualizações recentes integradas pelos [PRs #6](https://github.com/Bryan9895/lsd-page/pull/6) e [#7](https://github.com/Bryan9895/lsd-page/pull/7):

| Área | Atualização |
|---|---|
| Edição de perfil | Modal com corpo rolável, botão Salvar fora da rolagem, controle de foco e fechamento por Escape. |
| Navegação | Aba inicial aplicada antes das requisições, evitando retorno ao Kanban durante o carregamento. |
| Mobile e navbar | Pontuação e destaques visíveis em telas menores; abas acompanham a altura real da navbar; busca sem funcionamento removida. |
| Modo escuro | Tema aplicado no início da página e cores da pontuação adaptadas ao tema. |
| Avatar e capa | Áreas de arrastar e soltar isoladas, evitando alterar os dois campos com o mesmo arquivo. |
| Recuperação de senha | Solicitação pela API, envio SMTP com TLS e página para cadastrar nova senha. Links de uso único expiram em 30 minutos. |
| Proteção da recuperação | Limites persistentes por IP/e-mail e invalidação dos links e sessões anteriores após a troca de senha. |

**Para ativar os e-mails:** configure `PUBLIC_BASE_URL` e as variáveis `MAIL_*` no servidor e recarregue a aplicação. O arquivo `.env` da raiz é carregado automaticamente; variáveis do servidor têm prioridade. Siga o [guia de recuperação de senha](docs/alteracoes/README_RECUPERACAO_SENHA.md).

**Validação:** seis testes automatizados de recuperação passaram com banco temporário e SMTP simulado. O envio real depende da configuração do servidor; a validação visual mobile permanece pendente. Usuários com tokens anteriores à atualização precisarão fazer login novamente.

## Configuração local e migração — atualização da linha 2.5.4

- Login e recuperação aceitam o site em HTTP, incluindo `http://lsd.maranguape.ifce.edu.br`.
- `.env` local é carregado automaticamente, sem sobrescrever variáveis do servidor.
- `MAIL_BACKEND=console` permite testar o link no terminal, sem enviar e-mails, somente em desenvolvimento.
- `MAIL_BACKEND=smtp` usa as credenciais de envio reais. Na migração, ajuste endereço público, ambiente, credenciais e caminhos persistentes; o código permanece o mesmo.
- HTTP não criptografa senhas e tokens entre navegador e site. A conexão SMTP continua usando TLS.

Passo a passo: [testar no notebook e migrar para o servidor](docs/alteracoes/README_RECUPERACAO_SENHA.md).

## Documentação complementar

- [Recuperação de senha e configuração SMTP](docs/alteracoes/README_RECUPERACAO_SENHA.md)
- [Responsividade e UI/UX](docs/alteracoes/README_RESPONSIVIDADE_UIUX.md)
- [Tema claro e escuro](docs/alteracoes/README_TEMA_CLARO_ESCURO.md)
- [Perfis de membros](docs/alteracoes/README_PERFIS_MEMBROS.md)
- [Sistema de conquistas](docs/alteracoes/README_SISTEMA_CONQUISTAS.md)
- [Portfólio de projetos](docs/alteracoes/README_PORTFOLIO_PROJETOS.md)
- [Banco de dados](docs/alteracoes/README_BANCO_INSTANCE.md)
- [Implantação no PythonAnywhere](DEPLOY_PYTHONANYWHERE.md)

---

# Hospedagem temporária — v2.3.2

A versão `2.3.2` foi preparada para funcionar temporariamente no **PythonAnywhere Beginner (gratuito)**.

Principais mudanças de implantação:

- frontend e backend são servidos pelo mesmo domínio;
- `/` passa a servir `index.html`;
- páginas HTML do projeto são servidas pelo Flask;
- `/src/` e `/uploads/` podem ser mapeados como Static Files no PythonAnywhere;
- `APP_ENV=production` desativa o `debug`;
- `SECRET_KEY`, código de cadastro, administrador, caminhos persistentes e retenção de backup podem ser configurados por variáveis de ambiente;
- CORS global `*` deixa de ser utilizado em produção;
- inicialização do banco também funciona quando a aplicação é carregada por WSGI;
- foi incluído `pythonanywhere_wsgi.py.example`;
- foi incluído `DEPLOY_PYTHONANYWHERE.md`.

A implantação detalhada está documentada em:

```text
DEPLOY_PYTHONANYWHERE.md
```

---

# Backup automático diário

A v2.3.2 inclui um sistema de backup persistente de:

```text
backend/lsd_database.db
backend/uploads/
```

Os backups são armazenados em:

```text
backend/backups/
```

Cada backup é um ZIP com:

```text
database/lsd_database.db
uploads/
backup.json
```

O snapshot do SQLite é produzido pela API de backup do próprio SQLite, evitando simplesmente copiar um banco que pode estar sendo escrito.

Por padrão:

```text
BACKUP_RETENTION=5
BACKUP_TIMEZONE=America/Fortaleza
```

Como contas gratuitas novas do PythonAnywhere não possuem Scheduled Tasks, o backup diário funciona de forma **lazy**: a primeira visita de cada dia verifica se o snapshot daquele dia já existe e, caso não exista, cria um.

Também foi adicionada ao **Painel Admin** a área:

```text
Backups temporários
```

O administrador pode:

- visualizar backups existentes;
- verificar o último backup diário;
- criar um backup manual;
- baixar um backup em ZIP;
- consultar tamanho/data;
- manter uma cópia local antes da migração final.

Rotas administrativas:

```http
GET  /api/admin/backups
POST /api/admin/backups
GET  /api/admin/backups/<arquivo.zip>
```

Todas exigem permissão administrativa.

---

# Principais funcionalidades

## Equipe da página inicial

A versão `2.3.0` padroniza os dados utilizados pelo carrossel de membros em `src/js/equipe-data.js`.

Principais regras:

- todos os integrantes utilizam imagens localizadas em `src/images/equipe/avatar/`;
- nenhuma foto existente na pasta de avatares fica sem um card correspondente;
- os textos de função e bio que já estavam configurados foram preservados;
- conteúdos marcados como **Em desenvolvimento** foram mantidos;
- Instagram, GitHub e e-mail só são exibidos quando existe um valor realmente configurado;
- links genéricos ou placeholders foram removidos;
- todos os selos utilizados pelos membros passam por um catálogo oficial;
- os selos atribuídos a cada membro passam a ser exibidos visualmente no card.

O catálogo atual de selos é:

```text
Laboratório de Sistemas e Dados
Student teach Student
Líder
Robótica Educacional
Lupa Digital
Equipe de Mídia
Simulados Enem
Corrige AI
FioCruz
```

Foram adicionados cards para membros que já possuíam foto na pasta de avatares, mas ainda não estavam registrados em `equipe-data.js`:

```text
Miguel Angelo
Deyvisson
Esther Tiburcio
Miguel Freitas
Miguel Rogisson
Wesley Ryan
```

Também foram padronizadas as fotos de Hanna Sophia, Valentina Maciel e Yasmin Erbenes para o mesmo diretório de avatares utilizado pelo restante da equipe.

---


## Autenticação e contas

O sistema possui autenticação baseada em token JWT.

Funcionalidades:

- criação de conta;
- login;
- sessão autenticada;
- logout;
- validação de token;
- expiração de sessão;
- proteção de rotas privadas;
- bloqueio de acesso ao dashboard sem autenticação;
- recuperação de senha por e-mail, com configuração SMTP;
- invalidação de sessões após redefinir a senha.

O token é enviado ao backend no formato:

```http
Authorization: Bearer <token>
```

---

## Código de acesso para cadastro

A criação de novas contas exige um código de acesso da equipe.

Código configurado na versão `2.1.0`:

```text
00001
```

Qualquer outro código é rejeitado pelo backend.

Exemplo:

```text
00001   → cadastro permitido
00002   → cadastro negado
teste   → cadastro negado
12345   → cadastro negado
```

A validação é feita no backend para impedir que a restrição seja ignorada através do DevTools ou de uma requisição manual.

---

# Sistema de administradores

A versão `2.1.0` introduz um sistema administrativo protegido no backend.

Administrador principal configurado:

```text
bryan.william10@aluno.ifce.edu.br
```

Ao iniciar o servidor, o backend procura automaticamente essa conta no banco de dados.

Caso ela exista e ainda não seja administradora:

```text
is_admin = False
```

o sistema a promove automaticamente para:

```text
is_admin = True
```

Isso elimina a necessidade de alterar manualmente o banco SQLite.

---

## Proteção administrativa

Rotas administrativas utilizam uma camada adicional de autorização.

Fluxo:

```text
Requisição
    ↓
Token JWT válido?
    ↓
Usuário existe?
    ↓
is_admin == True?
    ↓
Acesso administrativo permitido
```

Usuários comuns recebem:

```http
403 Forbidden
```

ao tentar acessar operações exclusivas de administradores.

---

## Proteção do administrador principal

O administrador principal possui proteções extras:

- não pode perder sua permissão administrativa;
- não pode ser removido por outro administrador;
- seu e-mail administrativo não pode ser alterado pelas rotas protegidas;
- não depende de edição manual do banco para continuar administrador.

---

# Painel administrativo

Administradores possuem acesso à aba:

```text
Painel Admin
```

Funcionalidades:

- listar membros;
- visualizar nome;
- visualizar e-mail;
- visualizar função/cargo;
- identificar administradores;
- promover membros;
- rebaixar administradores;
- alterar cargo/função;
- excluir membros.

A própria conta logada é protegida contra determinadas ações perigosas, como exclusão acidental.

---

# Sistema de advertências

A versão `2.2.0` adiciona um sistema disciplinar completo integrado ao Painel Admin e à conta de cada membro.

## Fluxo

```text
Administrador
    ↓
Gerenciamento de Membros
    ↓
Advertir
    ↓
Informa o motivo
    ↓
Backend registra no SQLite
    ↓
Membro recebe o comunicado abaixo de "Progresso no Quadro"
```

## Recursos administrativos

Administradores podem:

- emitir uma advertência para outro membro;
- informar um motivo entre 5 e 1000 caracteres;
- consultar o histórico completo de advertências do membro;
- verificar se o membro já confirmou ciência;
- remover uma advertência registrada;
- visualizar o total de advertências diretamente na tabela de membros;
- visualizar quantas advertências ainda não foram lidas.

O administrador não pode advertir a própria conta.

## Notificação para o membro

Quando uma advertência é registrada, ela aparece em um card próprio localizado imediatamente abaixo de:

```text
Progresso no Quadro
```

O card apresenta:

- status de nova advertência;
- motivo;
- data e horário;
- administrador responsável;
- botão **Estou ciente**;
- histórico das advertências que continuam registradas.

Uma advertência não desaparece apenas porque o membro confirmou ciência. Ela permanece registrada até que um administrador a remova.

## Ciência da advertência

Ao clicar em:

```text
Estou ciente
```

o backend registra:

```text
lida = true
data_leitura = <data/hora>
```

Isso permite que o administrador diferencie:

```text
Pendente
Ciente
```

## Persistência

As advertências ficam armazenadas na tabela:

```text
advertencias
```

Campos principais:

```text
id
membro_id
admin_id
motivo
data_criacao
lida
data_leitura
```

O histórico é preservado no banco de dados. Caso um administrador que emitiu uma advertência seja removido, a advertência continua existindo e passa a ser identificada como emitida pela administração.

## Atualização da interface

O dashboard verifica as advertências:

- ao entrar no painel;
- ao retornar para a aba/janela do navegador.

Se uma nova advertência for encontrada durante a sessão, o usuário recebe também um toast de aviso.

---

# Perfil de usuário

Cada membro possui um perfil próprio.

Campos disponíveis:

- nome;
- e-mail;
- função;
- biografia;
- localização;
- GitHub;
- Instagram;
- avatar;
- imagem de capa;
- pontos;
- projetos ativos;
- data de entrada;
- permissão administrativa.

---

## Edição de perfil

Foram corrigidas inconsistências entre IDs utilizados pelo HTML e pelo JavaScript.

Campos de edição atualizados:

```text
Nome
Função
Biografia
Localização
GitHub
Instagram
Avatar
Capa
```

Após salvar, os dados são atualizados no banco e refletidos no frontend.

---

# Sistema de uploads

Arquivos enviados são armazenados em:

```text
backend/uploads/
```

O banco armazena apenas as informações e URLs relacionadas aos arquivos.

Arquivos padrão adicionados:

```text
default-avatar.png
default-capa.jpg
```

Isso corrige erros anteriores em que o backend apontava para imagens padrão inexistentes.

---

# Quadro Kanban

O dashboard possui um sistema Kanban compartilhado entre os membros.

Estados:

```text
A Fazer
Em Andamento
Concluído
```

---

## Cards

Cada card pode possuir:

- título;
- descrição;
- status;
- cor;
- prioridade;
- responsável;
- pontuação concedida.

---

## Responsáveis

Foi corrigido o sistema de seleção de responsáveis.

Valores tratados:

```text
null / vazio → sem responsável
"logado"     → usuário atual
ID numérico  → outro membro
```

O backend também valida se o usuário informado realmente existe.

A lista de responsáveis é reconstruída com dados atuais da API para impedir IDs antigos ou inválidos.

---

## Fluxo de movimentação

Foram adicionadas regras para evitar movimentações incorretas.

Fluxo esperado:

```text
A Fazer
   ↓
Em Andamento
   ↓
Concluído
```

Restrições:

- card concluído não volta;
- `A Fazer` não pula diretamente para `Concluído`;
- `Em Andamento` não volta para `A Fazer`;
- somente o responsável pode movimentar determinados cards.

---

## Pontuação

Ao concluir um card, o responsável pode receber pontos.

O backend utiliza:

```text
pontuacao_concedida
```

para impedir que os pontos sejam aplicados repetidamente ao mesmo card.

---

# Feed da Comunidade

A versão `2.1.0` adiciona um feed comunitário completo.

Todos os membros autenticados podem visualizar as publicações compartilhadas.

---

## Publicações

Posts podem conter:

- texto;
- imagem;
- arquivo;
- trecho de código;
- linguagem do código;
- comentários;
- curtidas;
- autor;
- data de publicação.

Os posts são armazenados no banco de dados e permanecem disponíveis depois que o servidor é reiniciado.

---

# Anexos do feed

Tipos suportados incluem:

## Imagens

```text
PNG
JPG
JPEG
WEBP
GIF
```

## Documentos e arquivos

```text
PDF
TXT
MD
CSV
JSON
DOC
DOCX
XLS
XLSX
PPT
PPTX
ZIP
RAR
7Z
```

Limite atual:

```text
16 MB por requisição
```

---

# Publicação de código

O feed possui suporte para publicação de código.

Linguagens disponíveis na interface incluem:

```text
Texto
Python
JavaScript
HTML
CSS
Java
C
C++
SQL
Bash
```

O banco armazena:

```text
codigo_snippet
codigo_linguagem
```

Também foi adicionado um botão para copiar o conteúdo do código.

---

# Comentários

Foi criada uma estrutura própria para comentários.

Tabela:

```text
post_comments
```

Cada comentário possui:

- ID;
- post relacionado;
- autor;
- conteúdo;
- data de criação.

Usuários podem excluir seus próprios comentários.

Administradores podem remover comentários quando necessário.

---

# Curtidas

Foi criada uma tabela específica:

```text
post_likes
```

Existe uma restrição de unicidade entre:

```text
post_id
user_id
```

Isso impede que o mesmo usuário curta o mesmo post várias vezes simultaneamente.

O botão funciona como alternância:

```text
Curtir ↔ Descurtir
```

---

# Exclusão de publicações

Uma publicação pode ser excluída por:

- seu próprio autor;
- um administrador.

Usuários comuns não podem excluir publicações de outros membros.

---

# Experiência de uso — UI/UX

A versão `2.1.0` também reorganizou o comportamento do frontend para diminuir recarregamentos visuais.

Anteriormente, operações pequenas podiam reconstruir áreas completas da interface.

Exemplo antigo:

```text
Curtir
    ↓
buscar feed inteiro
    ↓
apagar interface
    ↓
mostrar "Carregando..."
    ↓
renderizar tudo novamente
```

Agora:

```text
Curtir
    ↓
API
    ↓
atualizar somente botão e contador
```

---

## Atualizações granulares

O frontend passou a atualizar somente o componente afetado.

### Curtir

Atualiza:

```text
ícone + contador
```

### Comentar

Adiciona apenas:

```text
novo comentário
```

### Excluir comentário

Remove apenas:

```text
comentário selecionado
```

### Criar post

Insere:

```text
novo post no topo
```

### Excluir post

Remove somente:

```text
post correspondente
```

### Painel Admin

Operações administrativas atualizam somente a linha do membro alterado.

---

# Persistência de aba

Foi implementado controle de estado da aba utilizando:

```javascript
sessionStorage
```

Abas disponíveis:

```text
kanban
comunidade
admin
```

Isso impede que uma atualização parcial faça a interface voltar automaticamente para:

```text
Quadro Kanban
```

Se o usuário estiver no Feed da Comunidade ou no Painel Admin, sua navegação é preservada durante a sessão.

---

# Lazy loading das abas

O dashboard não precisa mais carregar todas as áreas imediatamente.

Fluxo otimizado:

```text
Dashboard
    ↓
carrega perfil
    ↓
descobre aba atual
    ↓
carrega apenas os dados necessários
```

Exemplos:

```text
Kanban     → cards
Comunidade → posts
Admin      → membros
```

Isso reduz requisições desnecessárias e melhora a velocidade percebida.

---

# Toasts e mensagens

Diversos `alert()` foram substituídos por notificações visuais não bloqueantes.

Tipos:

```text
Sucesso
Erro
Aviso
Informação
```

Exemplo:

```text
✓ Publicação criada com sucesso.
```

Isso melhora a experiência porque o usuário não precisa interromper seu fluxo para fechar caixas nativas do navegador.

---

# Animações de interface

Foram adicionadas animações leves para:

- criação de post;
- remoção de post;
- criação de comentário;
- remoção de comentário;
- atualização de membro;
- exclusão de membro;
- curtidas;
- toasts;
- troca de abas;
- diálogos.

Também existe suporte para:

```css
@media (prefers-reduced-motion: reduce)
```

respeitando as preferências de acessibilidade do sistema operacional.

---

# Acessibilidade

Foram adicionados ou melhorados estados e atributos como:

```text
aria-selected
aria-pressed
aria-live
aria-label
focus-visible
```

Isso melhora a utilização da aplicação através de teclado e tecnologias assistivas.

---

# Banco de dados

Banco utilizado:

```text
SQLite
```

Arquivo principal:

```text
backend/lsd_database.db
```

---

## Estrutura principal

### users

Responsável pelas contas e perfis.

### cards

Responsável pelo Kanban.

### posts

Responsável pelas publicações.

### post_comments

Responsável pelos comentários.

### post_likes

Responsável pelas curtidas.

### advertencias

Responsável pelo histórico disciplinar, motivo, administrador emissor e confirmação de ciência do membro.

---

# Compatibilidade com banco antigo

Foi criada uma rotina de compatibilidade para atualizar bancos existentes sem apagar os dados.

A função verifica se determinadas colunas existem em:

```text
posts
```

e adiciona campos necessários como:

```text
arquivo_url
arquivo_nome
arquivo_mime
codigo_snippet
codigo_linguagem
```

Também verifica suporte ao campo:

```text
users.is_admin
```

quando necessário.

> Recomenda-se sempre fazer backup do banco antes de mudanças estruturais.

---

# Membros em destaque

A plataforma possui ranking baseado em pontos.

Endpoint:

```text
/api/membros/destaque
```

Os usuários são ordenados por:

```text
pontos DESC
```

e os melhores resultados aparecem na interface.

---

# Segurança

A versão `2.1.0` inclui melhorias importantes.

## Implementado

- autenticação JWT;
- proteção por token;
- autorização administrativa;
- código obrigatório para cadastro;
- validação de responsável de cards;
- validação de extensões de upload;
- limite de 16 MB;
- sanitização de nomes de arquivo;
- geração de nomes únicos;
- proteção contra cadastro arbitrário como admin;
- proteção do administrador principal;
- escape de conteúdo no frontend;
- controle de exclusão de posts e comentários.

---

## Recomendações para produção

A configuração atual ainda possui características adequadas principalmente para desenvolvimento local.

Antes de publicar em produção, recomenda-se:

- remover `debug=True`;
- utilizar `SECRET_KEY` forte por variável de ambiente;
- não armazenar segredos diretamente no código;
- trocar o código `00001` por configuração segura;
- restringir CORS;
- utilizar HTTPS;
- avaliar cookies `HttpOnly` para autenticação;
- migrar SQLite para PostgreSQL ou outro SGBD apropriado;
- implementar rate limiting;
- validar MIME type dos uploads;
- utilizar armazenamento externo para arquivos;
- configurar backup automatizado.

---

# Estrutura sugerida do projeto

```text
Site_LSD/
│
├── backend/
│   ├── app.py
│   ├── lsd_database.db
│   ├── uploads/
│   │   ├── default-avatar.png
│   │   └── default-capa.jpg
│   │
│   └── migrations/
│
├── src/
│   ├── css/
│   │   ├── styles.css
│   │   └── dashboard.css
│   │
│   ├── js/
│   │   ├── auth.js
│   │   └── dashboard.js
│   │
│   └── images/
│
├── dashboard.html
├── entrar-login.html
├── index.html
├── requirements.txt
├── .gitignore
└── README.md
```

---

# Instalação

## 1. Clonar o repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd Site_LSD
```

---

## 2. Criar ambiente virtual

Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Windows:

```powershell
python -m venv .venv
.venv\Scripts\activate
```

---

## 3. Instalar dependências

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

---

## 4. Executar backend

```bash
cd backend
python app.py
```

Servidor:

```text
http://127.0.0.1:5000
```

---

# Frontend

O frontend pode ser aberto através de um servidor local.

Exemplo com VS Code + Live Server:

```text
http://127.0.0.1:5500/
```

O JavaScript utiliza automaticamente:

```text
http://127.0.0.1:5000
```

como backend durante desenvolvimento local.

---

# Dependências principais

O projeto utiliza principalmente:

```text
Flask
Flask-SQLAlchemy
Flask-CORS
Flask-Migrate
PyJWT
Werkzeug
```

Instale sempre utilizando:

```bash
python -m pip install -r requirements.txt
```

Não utilize:

```bash
sudo apt install requirements.txt
```

porque `requirements.txt` contém pacotes Python, não pacotes do sistema operacional.

---

# Ambiente virtual

Estrutura recomendada:

```text
Site_LSD/
└── .venv/
```

Evite manter múltiplos ambientes como:

```text
.venv/
backend/venv/
```

para não executar o projeto com o interpretador errado.

Para verificar:

```bash
which python
```

Resultado esperado no Linux:

```text
/home/usuario/Site_LSD/.venv/bin/python
```

---

# Endpoints principais

## Autenticação

```http
POST /api/register
POST /api/cadastro
POST /api/login
POST /api/recuperar-senha
POST /api/redefinir-senha
GET  /api/me
```

## Perfil

```http
GET /api/perfil
PUT /api/perfil
```

## Kanban

```http
GET    /api/cards
POST   /api/cards
PUT    /api/cards/<id>
DELETE /api/cards/<id>
POST   /api/cards/<id>/assumir
```

## Feed

```http
GET    /api/posts
POST   /api/posts
DELETE /api/posts/<id>
```

## Comentários

```http
POST   /api/posts/<id>/comentarios
DELETE /api/comentarios/<id>
```

## Curtidas

```http
POST /api/posts/<id>/curtir
```

## Membros

```http
GET /api/membros
GET /api/membros/destaque
```

## Administração

```http
GET    /api/admin/membros
PUT    /api/admin/membros/<id>
DELETE /api/admin/membros/<id>
```

## Advertências

```http
GET    /api/advertencias
POST   /api/advertencias/<id>/ler
GET    /api/admin/membros/<id>/advertencias
POST   /api/admin/membros/<id>/advertencias
DELETE /api/admin/advertencias/<id>
```

Também podem existir rotas de compatibilidade para versões anteriores do frontend.

---

# Versionamento

O projeto adota o formato **MAJOR.MINOR.PATCH**; a política para as próximas versões está descrita abaixo.

Formato:

```text
MAJOR.MINOR.PATCH
```

Exemplos:

```text
2.1.0 → novas funcionalidades
2.1.1 → correção pequena
2.2.0 → novo conjunto de funcionalidades
3.0.0 → mudança incompatível na API pública
```

---

# Changelog

Todas as mudanças relevantes do projeto devem ser registradas nesta seção.

A organização segue o estilo do **Keep a Changelog**, utilizando categorias como:

```text
Added
Changed
Fixed
Security
Deprecated
Removed
```

---

## [2.5.4] — 2026-09-12

### Added

- recuperação de senha por SMTP e página de redefinição;
- links de uso único com validade de 30 minutos;
- guia de configuração do envio e seis testes automatizados.

### Fixed

- rolagem e acessibilidade do modal de perfil;
- restauração tardia da aba durante o carregamento;
- conteúdo lateral oculto no mobile e posicionamento das abas;
- aplicação inicial do tema e cores da pontuação;
- interferência entre uploads de avatar e capa.

### Security

- limites persistentes de tentativas por IP/e-mail;
- invalidação de links e sessões anteriores após a troca de senha;
- credenciais SMTP por ambiente e transporte com TLS.

### Notes

- envio real e validação visual mobile pendentes;
- envio SMTP síncrono, sem fila ou reenvio automático; diferenças de tempo ainda podem permitir inferências sobre contas;
- implantação exige configuração SMTP no servidor e novo login para sessões antigas.

---

## [2.3.2] — 2026-09-06

### Added

- suporte de implantação temporária no PythonAnywhere;
- template `pythonanywhere_wsgi.py.example`;
- guia completo `DEPLOY_PYTHONANYWHERE.md`;
- configuração por variáveis de ambiente para produção;
- sistema de backup automático diário;
- snapshot consistente do SQLite com `sqlite3.Connection.backup()`;
- inclusão de `backend/uploads/` nos backups;
- retenção automática dos backups mais recentes;
- metadados `backup.json` dentro de cada ZIP;
- painel administrativo para consultar backups;
- criação manual de backup pelo navegador;
- download protegido de backups pelo Painel Admin;
- rota para servir o frontend no mesmo domínio do backend;
- suporte a mapeamento de `/src/` e `/uploads/` como Static Files.

### Changed

- `SECRET_KEY` passa a ser configurável por ambiente;
- `LSD_ACCESS_CODE` passa a ser configurável por ambiente;
- `ADMIN_EMAIL` passa a ser configurável por ambiente;
- caminhos de banco, uploads e backups passam a aceitar variáveis de ambiente;
- `debug` passa a depender de `APP_ENV`;
- CORS `*` deixa de ser aplicado em produção;
- preparação do banco passa a ocorrer também em import WSGI, não apenas com `python app.py`;
- frontend e API podem operar sob o mesmo domínio temporário.

### Security

- backups só podem ser listados, criados e baixados por administradores;
- nomes de backup são validados antes do download;
- falha no backup automático não derruba a aplicação;
- configuração de produção não exige segredos dentro do repositório;
- `.env` e `backend/backups/` foram adicionados ao `.gitignore`.

### Notes

- no plano gratuito atual do PythonAnywhere, novas contas não possuem Scheduled Tasks;
- por isso o backup diário é disparado na primeira visita do dia;
- a retenção padrão é de 5 backups para respeitar o limite de armazenamento da hospedagem temporária.

---

## [2.3.1] — 2026-09-06

### Changed

- removidos arquivos de imagem rasterizados sem referência em arquivos do projeto ou registros textuais do banco;
- mantidos todos os assets efetivamente utilizados pela interface, pelos dados da equipe e pelo backend;
- arquivos SVG não utilizados foram preservados por segurança, pois representam recursos vetoriais/ícones e não fotos;
- reduzido o tamanho do pacote do projeto sem alterar comportamento funcional.

### Fixed

- removidas fotos antigas duplicadas da equipe que haviam sido substituídas pelos avatares padronizados de `src/images/equipe/avatar/`;
- removidas fotos antigas do laboratório e assets rasterizados que não possuíam qualquer referência ativa;
- removido um upload órfão sem referência no banco de dados.
- corrigido o fallback de avatar em `src/js/auth.js`, que apontava para `bryan.jpg` inexistente, passando a utilizar `default-avatar.png`.

---

## [2.3.0] — 2026-09-05

### Added

- cards para todos os membros que possuíam foto em `src/images/equipe/avatar/`;
- catálogo central `SELOS_DISPONIVEIS`;
- renderização visual dos selos nos cards do carrossel;
- fallback automático para `default-avatar.png` caso uma imagem não possa ser carregada;
- novos registros para Miguel Angelo, Deyvisson, Esther Tiburcio, Miguel Freitas, Miguel Rogisson e Wesley Ryan.

### Changed

- `equipe-data.js` foi padronizado para utilizar apenas o diretório `src/images/equipe/avatar/`;
- fotos de Hanna Sophia, Valentina Maciel e Yasmin Erbenes foram copiadas para o diretório padronizado de avatares;
- links genéricos de Instagram e GitHub foram substituídos por campos vazios;
- e-mails que aparentavam ser placeholders de outro membro foram removidos;
- cards da equipe ganharam área responsiva para exibição de selos;
- altura do carrossel foi ajustada para acomodar os novos elementos sem cortes.

### Fixed

- referências para avatares inexistentes de Hanna Sophia, Valentina Maciel e Yasmin Erbenes;
- fotos existentes sem representação no carrossel;
- redes sociais falsas ou genéricas aparecendo como se estivessem configuradas;
- inconsistência entre os selos cadastrados em `equipe-data.js` e os elementos exibidos na interface.

---

## [2.2.0] — 2026-09-05

### Added

- sistema completo de advertências para membros;
- modelo e tabela `advertencias` no SQLite;
- emissão de advertência pelo Painel Admin;
- campo obrigatório de motivo da advertência;
- histórico de advertências por membro;
- status de ciência da advertência;
- data de leitura/ciência;
- card de advertências abaixo de **Progresso no Quadro**;
- destaque visual para advertências ainda não lidas;
- botão **Estou ciente** para o membro;
- contador de advertências na tabela administrativa;
- indicador de advertências novas no gerenciamento de membros;
- modal próprio para gerenciar advertências;
- remoção administrativa de advertências;
- toast quando uma nova advertência é detectada durante a sessão;
- atualização das advertências quando o usuário retorna à aba do navegador.

### Changed

- tabela de membros passou a exibir resumo disciplinar;
- área de ações administrativas ganhou a opção **Advertir**;
- dashboard passou a carregar as advertências junto aos dados laterais;
- exclusão de usuário agora trata também registros de advertência;
- histórico emitido por um administrador removido é preservado com `admin_id = NULL`.

### Security

- somente usuários autenticados podem consultar as próprias advertências;
- um membro só pode marcar como lida uma advertência pertencente à própria conta;
- criação, consulta administrativa e remoção de advertências exigem `@admin_required`;
- administrador não pode emitir advertência contra a própria conta;
- motivo é validado no backend e limitado a 1000 caracteres;
- conteúdo do motivo é escapado no frontend antes da renderização.

---

## [2.1.0] — 2026-09-05

### Added

- feed comunitário completo;
- comentários persistentes;
- curtidas persistentes;
- anexos em publicações;
- publicação de trechos de código;
- identificação de linguagem de código;
- botão para copiar código;
- tabela `post_comments`;
- tabela `post_likes`;
- campos adicionais na tabela `posts`;
- painel administrativo funcional;
- promoção e rebaixamento de administradores;
- alteração de função/cargo de membros;
- exclusão administrativa de membros;
- administrador principal automático;
- código obrigatório de cadastro;
- sistema de toasts;
- persistência da aba atual;
- carregamento sob demanda das abas;
- atualização granular do feed;
- atualização granular do painel administrativo;
- animações leves de interface;
- suporte a `prefers-reduced-motion`;
- melhorias de acessibilidade.

### Changed

- navegação do dashboard reorganizada como uma SPA leve;
- feed deixa de ser completamente reconstruído após cada interação;
- painel Admin deixa de ser completamente reconstruído após cada alteração;
- posts novos passam a ser adicionados diretamente no topo;
- comentários novos passam a ser adicionados diretamente ao post;
- curtidas passam a atualizar somente botão e contador;
- exclusões passam a remover somente o elemento afetado;
- carregamento inicial passa a priorizar a aba visível;
- seleção de responsáveis do Kanban passa a utilizar dados atuais da API;
- edição de perfil foi ampliada;
- senha mínima do cadastro alinhada com o frontend;
- dependências do projeto atualizadas.

### Fixed

- aba Feed da Comunidade não aparecendo corretamente;
- dashboard retornando visualmente ao Kanban durante operações;
- responsável vazio sendo enviado como string inválida;
- responsável inexistente em cards;
- IDs inconsistentes nos campos de edição de perfil;
- imagens padrão de avatar e capa inexistentes no backend;
- prioridade de cards ausente na interface;
- inconsistência entre cadastro frontend e backend;
- GitHub e Instagram não sendo persistidos no cadastro;
- código de acesso sendo ignorado;
- conta principal não sendo reconhecida como administradora;
- carregamentos excessivos no feed;
- carregamentos excessivos no painel Admin;
- risco de múltiplos listeners no Kanban;
- comportamento inconsistente durante drag and drop;
- feedback visual excessivamente dependente de `alert()`.

### Security

- cadastro exige código `00001`;
- frontend não pode escolher arbitrariamente `is_admin`;
- administrador principal é definido pelo backend;
- administrador principal não pode ser rebaixado;
- rotas administrativas exigem JWT + permissão administrativa;
- exclusão de posts é limitada ao autor ou administrador;
- exclusão de comentários é limitada ao autor ou administrador;
- upload possui whitelist de extensões;
- limite global de upload configurado para 16 MB;
- nomes de arquivos são sanitizados com `secure_filename`;
- arquivos recebem identificadores únicos;
- conteúdo dinâmico do feed é escapado no frontend.

---

# Política de versionamento

Versão atual: **2.6.0**. As entradas anteriores do changelog preservam o histórico já documentado.

Para as próximas versões:

| Tipo de alteração | Exemplo |
|---|---|
| Correção compatível | `2.5.4 → 2.5.5` |
| Nova funcionalidade compatível | `2.5.4 → 2.6.0` |
| Mudança incompatível na API pública | `2.x.x → 3.0.0` |

Novas funcionalidades devem incrementar MINOR; PATCH é reservado a correções compatíveis. Quantidade de commits e tamanho de uma refatoração não determinam a versão por si só.

---

# Backup

Antes de alterações importantes, faça backup de:

```text
backend/lsd_database.db
backend/uploads/
```

Esses dois locais contêm os dados persistentes principais do projeto.

---

# Desenvolvimento

Durante o desenvolvimento:

```bash
cd backend
source ../.venv/bin/activate
python app.py
```

Caso o navegador continue carregando arquivos JavaScript ou CSS antigos:

```text
Ctrl + Shift + R
```

---

# Licença

Defina aqui a licença adotada pelo projeto.

Exemplos:

```text
MIT
Apache-2.0
Proprietária / uso interno
```

Caso o sistema seja destinado exclusivamente ao laboratório, esta seção pode ser adaptada para indicar uso interno.

---

# LSD — Laboratório de Sistemas e Dados

**Versão atual:** `2.6.0`

**Status:** Em desenvolvimento

**Administrador principal configurado:** `bryan.william10@aluno.ifce.edu.br`


---

## Responsividade e UI/UX

A revisão mobile-first do Dashboard, melhorias da navbar, refinamento do modo escuro e correção dos modais em telas pequenas estão documentados em:

```text
docs/alteracoes/README_RESPONSIVIDADE_UIUX.md
```

## Recuperação de senha por e-mail

Para ativar envio SMTP, configurar o WSGI e testar a redefinição, consulte [o guia de recuperação de senha](docs/alteracoes/README_RECUPERACAO_SENHA.md).
