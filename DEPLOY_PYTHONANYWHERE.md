# Implantação do LSD-PAGE no PythonAnywhere

Este guia usa o banco SQLite existente. **Não apague nem substitua o banco em produção.**
O caminho atual padrão no projeto é `backend/instance/lsd_database.db`.

## Conferir os arquivos antes do Reload

Na Bash Console, ajuste o caminho real da instalação (por exemplo,
`/home/Bryan9895/site_lsd/lsd-page`) e execute:

```bash
cd /home/SEU_USUARIO/site_lsd/lsd-page
python tools/check_deployment.py \
  --database /home/SEU_USUARIO/site_lsd/lsd-page/backend/instance/lsd_database.db \
  --uploads /home/SEU_USUARIO/site_lsd/lsd-page/backend/uploads
```

O comando abre o SQLite **somente para leitura**, verifica sua integridade e informa
o caminho absoluto e a quantidade de membros. Confira se essa quantidade coincide
com os dados que você espera ver no painel. Se der erro, corrija o caminho antes
de recarregar a Web App.

## Configurar a Web App

1. Selecione **Manual configuration**, com a mesma versão de Python usada pelo
   virtualenv. Instale as dependências nele com `pip install -r requirements.txt`.
2. Em **Source code** e **Working directory**, indique o diretório que contém
   `backend/` e `dashboard.html`.
3. No arquivo WSGI da aba **Web**, use `pythonanywhere_wsgi.py.example` como
   base e altere `PROJECT_HOME` para esse mesmo diretório. O exemplo define
   `DATABASE_PATH` para `backend/instance/lsd_database.db` e importa `backend.app`.
   Se o arquivo real estiver em outro local, altere o caminho no WSGI e repita
   a verificação acima para **esse mesmo arquivo**.
4. Configure `SECRET_KEY`, `LSD_ACCESS_CODE`, `ADMIN_EMAIL`, `PUBLIC_BASE_URL`
   e `MAIL_*` no `.env` local à raiz do projeto, usando `.env.example` como base.
   O `.env` é ignorado pelo Git. Uma chave pode ser gerada com
   `python -c "import secrets; print(secrets.token_hex(32))"`.
5. Em **Static files**, configure `/src/` para `PROJECT_HOME/src` e `/uploads/`
   para o mesmo `UPLOAD_FOLDER` que o WSGI utiliza.
6. Clique em **Reload**. Se houver erro, consulte os logs **Error log** e
   **Server log** na aba Web; não coloque chaves ou senhas no repositório.

Em produção, o app exige `DATABASE_PATH` absoluto apontando para um SQLite já
existente com a tabela `users`. Isso impede a criação acidental de um banco novo
quando um caminho estiver incorreto. Para uma instalação nova, crie e valide o
banco em um ambiente de desenvolvimento antes de configurá-lo na Web App.

## Conferência funcional após o Reload

1. Abra a página inicial e confirme CSS, imagens e navegação.
2. Faça login com uma conta já presente no banco e confirme membros, cards e posts.
3. Crie um card de teste, mova-o de A Fazer para Em Andamento e Concluído e
   confirme que os 5 pontos são concedidos uma única vez e o card fica bloqueado.
4. Publique e comente no feed; atualize foto e capa com imagens pequenas.
5. Abra o painel Admin: confira os indicadores e teste o backup manual. Baixe
   o ZIP e confirme que contém `database/lsd_database.db` e os uploads esperados.
6. Teste em um celular o menu, Kanban, feed, projetos e o modal de edição do
   perfil, inclusive a rolagem até **Salvar**.

O sistema ainda usa ajustes de esquema na inicialização. A revisão das migrations
e uma migração ensaiada sobre **uma cópia do banco real** são necessárias antes
de atualizar o servidor institucional; não execute `flask db upgrade` diretamente
no banco atual, pois a revisão Alembic existente é antiga.
