# Portfólio de Projetos — LSD-PAGE 2.6.0

Esta atualização cria uma área pública para apresentar os projetos do Laboratório de Sistemas e Dados e conecta cada portfólio aos perfis dos membros responsáveis.

## Entregas

- página responsiva `projetos.html`, com busca, filtros por status e visão detalhada;
- importação automática dos seis projetos que já existiam no `index.html`;
- cards da página inicial direcionando ao respectivo portfólio;
- vínculos bidirecionais: perfil do membro → projeto e projeto → perfil do membro;
- exibição de descrição, logo, status, professor orientador, líder, equipe, tecnologias, repositório, site e documentação;
- criação, edição e exclusão de projetos no Painel Admin;
- seleção de líder e de vários membros no formulário administrativo;
- upload e remoção de documentos pelo líder do projeto ou por administradores;
- atualização automática de `users.projetos_ativos` conforme os vínculos e o status;
- preservação do portfólio quando um membro é removido do sistema.

## Novas tabelas

| Tabela | Finalidade |
|---|---|
| `projetos` | Dados principais e estado atual do portfólio. |
| `projeto_membros` | Relação muitos-para-muitos entre projetos e usuários. |
| `projeto_documentos` | Arquivos publicados pelo líder ou pela administração. |
| `app_settings` | Marcador interno para não recriar projetos iniciais que tenham sido excluídos. |

As tabelas são criadas pela inicialização compatível já usada pelo projeto (`db.create_all()`), sem exigir `flask db upgrade` no banco atual.

## API

### Leitura pública

| Método | Rota | Uso |
|---|---|---|
| `GET` | `/api/projetos` | Lista o portfólio e aceita o filtro `status`. |
| `GET` | `/api/projetos/<id>` | Retorna um projeto. |
| `GET` | `/api/projetos/slug/<slug>` | Retorna um projeto por URL amigável. |

### Administração

| Método | Rota | Permissão |
|---|---|---|
| `GET` | `/api/admin/projetos` | Administrador. |
| `POST` | `/api/admin/projetos` | Administrador. |
| `PUT` | `/api/admin/projetos/<id>` | Administrador. |
| `DELETE` | `/api/admin/projetos/<id>` | Administrador. |

### Documentação

| Método | Rota | Permissão |
|---|---|---|
| `POST` | `/api/projetos/<id>/documentos` | Líder do projeto ou administrador. |
| `DELETE` | `/api/projetos/<id>/documentos/<documento_id>` | Líder do projeto ou administrador. |

Todas as rotas de escrita exigem JWT em `Authorization: Bearer <token>`.

## Status aceitos

- `em_desenvolvimento` — projeto em implementação ou pesquisa;
- `em_producao` — solução disponível para uso;
- `concluido` — projeto finalizado.

Projetos concluídos continuam no portfólio, mas deixam de contar em `projetos_ativos`.

## Segurança e validação

- rotas administrativas usam `admin_required`;
- documentos só podem ser gerenciados pelo líder vinculado ou por um administrador;
- links aceitam apenas HTTP ou HTTPS, incluindo o servidor institucional em HTTP;
- logos usam a whitelist de imagens existente;
- documentos usam a whitelist de anexos e o limite global de 16 MB;
- nomes de arquivo passam por `secure_filename` e recebem identificador único;
- a API pública não expõe o e-mail dos participantes;
- nomes, descrições, tags, membros e URLs possuem limites e validações no backend.

## Validação automatizada

A suíte cobre:

- bloqueio de criação por membro comum;
- criação por administrador;
- inclusão automática do líder na equipe;
- retorno do projeto no perfil público do membro;
- ausência de e-mail na resposta pública;
- permissão de upload para o líder e bloqueio para outro membro;
- rejeição de URL com protocolo inseguro;
- atualização da contagem ao concluir um projeto;
- filtro público de status e exclusão administrativa.

Execute:

```bash
python -m unittest discover -s tests -v
```
