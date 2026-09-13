# Banco local e backups — fluxo seguro V3

Este documento descreve como diagnosticar, reparar e validar o banco SQLite do LSD-PAGE **antes** de enviá-lo ao PythonAnywhere.

> Nunca envie o banco real (`*.db`, `*.sqlite3`) nem os uploads dos membros ao GitHub. Esses arquivos podem conter dados pessoais e permanecem no histórico do Git mesmo após remoção posterior.

## 1. Validar o backup ZIP antes de restaurar

```bash
python tools/validate_backup.py /caminho/para/backup.zip --json relatorio_backup.json
```

A ferramenta verifica:

- `PRAGMA quick_check` do SQLite;
- chaves estrangeiras órfãs (`PRAGMA foreign_key_check`);
- conquistas duplicadas por usuário;
- referências `/uploads/...` que não existem dentro do ZIP;
- uploads que existem no ZIP mas não são mais referenciados pelo banco.

Código de saída `0` significa backup consistente. Código `1` significa que o backup precisa de atenção.

## 2. Reparar uma cópia do banco local

A forma recomendada é preservar o original e gerar uma cópia reparada:

```bash
python tools/repair_database.py \
  --database backend/instance/lsd_database.db \
  --uploads backend/uploads \
  --output backend/instance/lsd_database_repaired.db \
  --report relatorio_reparo.json
```

O reparo automático é propositalmente conservador:

- remove registros filhos que apontam para registros-pai inexistentes;
- remove duplicatas de `user_achievements`, mantendo a primeira ocorrência;
- troca foto/capa de perfil inexistente pelos arquivos padrão;
- limpa mídia/anexo de post quando o arquivo físico sumiu;
- limpa logo de projeto ausente;
- remove somente o registro de documento de projeto quando o arquivo físico correspondente não existe.

O arquivo original não é alterado.

### Reparar o próprio arquivo

Somente depois de ter um backup externo confirmado:

```bash
python tools/repair_database.py \
  --database backend/instance/lsd_database.db \
  --uploads backend/uploads \
  --in-place \
  --report relatorio_reparo.json
```

Mesmo nesse modo, a ferramenta cria automaticamente um arquivo `*.before_repair_DATA_HORA.db` antes de modificar o banco.

## 3. Conferir o banco reparado

```bash
python tools/check_deployment.py \
  --database "$(pwd)/backend/instance/lsd_database_repaired.db" \
  --uploads "$(pwd)/backend/uploads"
```

O comando só aprova o banco quando:

- o SQLite está íntegro;
- a tabela `users` existe;
- não há chaves estrangeiras órfãs;
- não há conquistas duplicadas;
- todos os uploads referenciados existem.

Use `--schema` para listar as tabelas/colunas sem imprimir dados pessoais:

```bash
python tools/check_deployment.py \
  --database "$(pwd)/backend/instance/lsd_database_repaired.db" \
  --uploads "$(pwd)/backend/uploads" \
  --schema
```

## 4. Testar localmente antes do PythonAnywhere

1. Pare o Flask.
2. Preserve o banco atual.
3. Coloque a cópia reparada no caminho usado por `DATABASE_PATH`.
4. Confirme que `UPLOAD_FOLDER` aponta para a pasta de uploads correspondente.
5. Reinicie o Flask.
6. Teste login, perfis, feed, conquistas, Kanban, projetos, notificações e recuperação de senha.
7. Só depois faça novo backup e valide o ZIP com `validate_backup.py`.

## 5. Produção

No PythonAnywhere, use caminhos absolutos, por exemplo:

```env
DATABASE_PATH=/home/SEU_USUARIO/site_lsd/lsd-page/backend/instance/lsd_database.db
UPLOAD_FOLDER=/home/SEU_USUARIO/site_lsd/lsd-page/backend/uploads
```

Antes de recarregar a aplicação em produção, rode `tools/check_deployment.py` apontando exatamente para esses mesmos caminhos.
