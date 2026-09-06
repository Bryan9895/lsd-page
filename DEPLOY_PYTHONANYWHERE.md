# Deploy temporário gratuito — PythonAnywhere

Guia preparado para o **LSD v2.3.2**.

## Por que PythonAnywhere

Para o período temporário de duas semanas, a versão gratuita é adequada porque oferece um web app Python com filesystem persistente. O projeto continua usando SQLite e `backend/uploads/`, então os dados podem ser copiados depois para o servidor definitivo da empresa.

> Observação importante: contas gratuitas novas do PythonAnywhere não possuem Scheduled Tasks. Por isso a v2.3.2 implementa backup diário dentro da própria aplicação: a primeira visita de cada dia cria um snapshot, sem depender de cron.

## 1. Criar a conta

Crie uma conta gratuita em PythonAnywhere. O endereço final será parecido com:

```text
https://SEU_USUARIO.pythonanywhere.com
```

## 2. Enviar o projeto

No menu **Files**, envie o ZIP da v2.3.2 para sua home.

Abra uma **Bash Console** e execute, ajustando o nome do ZIP se necessário:

```bash
cd ~
unzip Site_LSD_v2.3.2_pythonanywhere.zip
mv Site_LSD_v2.3.2 Site_LSD
cd ~/Site_LSD
```

Se o ZIP já extrair uma pasta `Site_LSD`, não execute o `mv`.

## 3. Criar o virtualenv

```bash
mkvirtualenv lsd-v232 --python=python3.13
cd ~/Site_LSD
pip install -r requirements.txt
```

Para ativar novamente depois:

```bash
workon lsd-v232
```

## 4. Criar a Web App

No menu **Web**:

1. Clique em **Add a new web app**.
2. Escolha **Manual configuration**.
3. Escolha a mesma versão do Python usada no virtualenv, preferencialmente Python 3.13.
4. Em **Virtualenv**, informe:

```text
/home/SEU_USUARIO/.virtualenvs/lsd-v232
```

5. Em **Source code** e **Working directory**, use:

```text
/home/SEU_USUARIO/Site_LSD
```

## 5. Configurar o WSGI

No menu **Web**, clique no link do arquivo WSGI, normalmente semelhante a:

```text
/var/www/SEU_USUARIO_pythonanywhere_com_wsgi.py
```

Apague o conteúdo dele e use como base o arquivo:

```text
pythonanywhere_wsgi.py.example
```

Troque obrigatoriamente:

```python
USERNAME = "SEU_USUARIO_PYTHONANYWHERE"
```

Gere uma SECRET_KEY forte na Bash Console:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copie o resultado para:

```python
os.environ["SECRET_KEY"] = "SUA_CHAVE_GERADA"
```

Não publique essa chave em GitHub.

## 6. Static Files

Ainda na aba **Web**, em **Static files**, adicione:

```text
URL:  /src/
Path: /home/SEU_USUARIO/Site_LSD/src
```

E:

```text
URL:  /uploads/
Path: /home/SEU_USUARIO/Site_LSD/backend/uploads
```

Isso faz o PythonAnywhere servir CSS, JavaScript, imagens e uploads diretamente, economizando o único worker da conta gratuita.

## 7. Recarregar

Clique em **Reload** na aba Web.

Abra:

```text
https://SEU_USUARIO.pythonanywhere.com
```

O frontend e a API usam o mesmo domínio, então a configuração de produção não libera CORS globalmente.

## 8. Teste mínimo antes de enviar aos membros

Faça os testes nesta ordem:

```text
1. Abrir a página inicial
2. Criar uma conta de teste com código 00001
3. Fazer login
4. Abrir o dashboard
5. Criar um card
6. Publicar no feed
7. Atualizar o perfil
8. Fazer upload de uma imagem pequena
9. Entrar com a conta admin
10. Abrir Painel Admin > Backups temporários
11. Criar um backup manual
12. Baixar o ZIP do backup
```

## Backup diário da v2.3.2

A aplicação armazena backups em:

```text
backend/backups/
```

Cada ZIP possui:

```text
database/lsd_database.db
uploads/
backup.json
```

Por padrão são mantidos os **5 backups mais recentes**.

O fuso padrão é:

```text
America/Fortaleza
```

O backup diário é criado na primeira visita do dia. Isso é intencional para funcionar no plano gratuito atual do PythonAnywhere, que não oferece Scheduled Tasks para novas contas.

No Painel Admin existe também:

```text
Backups temporários
```

Nessa área o administrador pode:

- consultar o último backup diário;
- criar um backup manual;
- baixar os backups existentes;
- verificar tamanho e data dos arquivos.

## Antes de migrar para o servidor da empresa

No último dia:

1. Avise os membros para não alterarem dados por alguns minutos.
2. Entre como administrador.
3. Abra **Painel Admin > Backups temporários**.
4. Clique em **Criar backup agora**.
5. Baixe o ZIP criado.
6. Descompacte-o no servidor definitivo.
7. Substitua o banco pelo arquivo:

```text
database/lsd_database.db
```

8. Copie o conteúdo de:

```text
uploads/
```

para:

```text
backend/uploads/
```

Assim contas, cards, posts, curtidas, comentários, advertências, perfis e arquivos enviados durante as duas semanas são preservados.

## Limites do plano gratuito

A hospedagem é temporária. Evite uploads grandes e monitore o espaço disponível. O projeto foi configurado com retenção curta de backups justamente para reduzir consumo de disco.

Para essas duas semanas, mantenha somente os backups automáticos e faça download local de backups importantes.

