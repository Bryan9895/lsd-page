# Estabilização antes da versão 3.0

Este arquivo registra o que já foi verificado no repositório e o que ainda
precisa de evidência no ambiente real. Não publique a tag `v3.0.0` antes de
resolver os itens pendentes.

| Área | Estado | Verificação necessária |
|---|---|---|
| Caminho SQLite | Proteção e diagnóstico implementados | Executar `tools/check_deployment.py` no PythonAnywhere com o caminho do WSGI e conferir a quantidade de membros. |
| Autenticação e recuperação | Testes de API locais | Verificar entrega SMTP e redefinição no domínio final com uma conta de teste. |
| Kanban e pontuação | Testes de permissão, bloqueio e +5 | Confirmar as interações de arrastar e soltar no celular. |
| Feed, projetos e uploads | Parte das APIs coberta pelos testes existentes | Validar no PythonAnywhere com a pasta `/uploads/` real e os tipos de anexo necessários. |
| Notificações e histórico | Implementados; endpoints autenticados com cobertura parcial | Conferir avisos e atividade em conta de membro após ações reais. |
| Estatísticas admin | API com teste de acesso e interface responsiva | Conferir os cinco contadores no servidor e em celular. |
| CI | Workflow de unittest e sintaxe JS | Confirmar a primeira execução verde no PR. |
| Migrations | Revisão Alembic antiga; ajustes SQL em inicialização | Inventariar tabelas/colunas do banco real, gerar uma migração compatível e ensaiá-la sobre cópia antes do deploy. |
| Layout mobile | CSS responsivo existente | Testar em aparelhos reais: navbar, modal de perfil com botão Salvar, Kanban, feed, projetos e contraste do tema escuro. |
| Arquitetura e README | `app.py` e README ainda extensos | Extrair módulos sem mudar contratos de API; mover notas de versão antigas para `CHANGELOG.md`. |

Para reproduzir as verificações automatizadas:

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -q
for file in src/js/*.js; do node --check "$file"; done
```

Em produção, usar `APP_ENV=production`, uma `SECRET_KEY` exclusiva com ao menos
32 caracteres e `LSD_ACCESS_CODE` explícito. Os exemplos do repositório têm
valores públicos e não devem ser tratados como credenciais privadas. As chaves
que já tenham sido compartilhadas devem ser substituídas no servidor; depois
disso, sessões antigas precisarão de novo login.
