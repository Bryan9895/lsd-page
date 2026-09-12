# Recuperação de senha por e-mail

O formulário agora chama a API Flask. O link abre `redefinir-senha.html`, permite cadastrar uma senha de 8 a 128 caracteres e expira após 30 minutos. A troca invalida todos os links daquela senha e as sessões anteriores. A implantação desta versão também pede novo login aos usuários com JWTs antigos.

## Testar agora no notebook

Na raiz do projeto, com seu ambiente virtual ativado:

```bash
python -m pip install -r requirements.txt
cp .env.example .env
python backend/app.py
```

Se já existe um `.env`, edite-o em vez de sobrescrever. A aplicação carrega esse arquivo da raiz do projeto, inclusive quando iniciada de outra pasta ou via WSGI. Variáveis já definidas no processo têm prioridade.

O exemplo utiliza:

```dotenv
APP_ENV=development
PUBLIC_BASE_URL=http://127.0.0.1:5000
MAIL_BACKEND=console
```

Abra `http://127.0.0.1:5000/recuperar-senha.html` e informe o e-mail de uma conta cadastrada no banco local. A mensagem e o link aparecem no terminal do Flask com o aviso **EMAIL LOCAL — NÃO ENVIADO**. Abra o link no mesmo notebook, altere a senha e teste o login. Esse modo não envia mensagem para a caixa de entrada e é desabilitado fora de desenvolvimento. Não compartilhe a saída do terminal contendo o link.

O link local aponta para o próprio dispositivo: abri-lo em um celular não acessará o notebook. Para o teste descrito, use o navegador do notebook.

## Enviar e-mail de verdade

No mesmo `.env`, selecione `MAIL_BACKEND=smtp` e preencha os dados fornecidos pelo serviço de envio:

```dotenv
MAIL_BACKEND=smtp
MAIL_HOST=host-do-provedor
MAIL_PORT=587
MAIL_SECURITY=starttls
MAIL_USERNAME=usuario-autorizado
MAIL_PASSWORD=credencial-do-servico
MAIL_FROM=remetente-autorizado@example.com
```

Reinicie o Flask após editar. O endereço do site e o host SMTP são serviços diferentes: `lsd.maranguape.ifce.edu.br` não deve ser usado como host SMTP sem confirmação da infraestrutura.

Para Gmail, o host é `smtp.gmail.com`. Use uma senha de app de uma conta que permita esse recurso, não a senha normal. A criação de senha de app exige verificação em duas etapas; contas institucionais podem restringir essa opção. Outros provedores devem fornecer os próprios dados. SMTP mantém TLS (`starttls` ou `ssl`, normalmente porta 465), independentemente de o site usar HTTP.

## Migrar para o servidor institucional

Use o mesmo código e dependências. No `.env` privado do servidor ou nas variáveis do processo WSGI, defina:

```dotenv
APP_ENV=production
PUBLIC_BASE_URL=http://lsd.maranguape.ifce.edu.br
MAIL_BACKEND=smtp
```

Preencha `MAIL_*` com as credenciais autorizadas para o servidor. Defina uma `SECRET_KEY` longa e estável e configure `DATABASE_PATH`, `UPLOAD_FOLDER` e `BACKUP_FOLDER` para os diretórios persistentes quando necessário. Para preservar contas e conteúdo, migre também o banco e os uploads. Não copie o ambiente virtual do notebook: instale `requirements.txt` no servidor. Reinicie o processo de aplicação após a configuração.

Em PythonAnywhere, as variáveis podem ser definidas no WSGI antes de `from backend.app import app as application`; elas prevalecem sobre o `.env`. O exemplo WSGI existente usa caminhos próprios daquela hospedagem: adapte-os ao servidor institucional. As tabelas auxiliares continuam sendo criadas na inicialização; faça backup antes da atualização.

`PUBLIC_BASE_URL` aceita HTTP ou HTTPS e deve conter somente a origem (protocolo, domínio e porta opcional), sem caminho, usuário, query ou fragmento. O frontend e a API devem ser publicados na raiz desse mesmo domínio. A URL dos links nunca é obtida do cabeçalho Host da requisição.

**Limitação do HTTP:** login e recuperação funcionam, mas senhas e tokens trafegam sem criptografia entre navegador e site. TLS no SMTP não protege esse trecho.

## Limites e operação

- Até 3 solicitações por e-mail e 20 por IP por janela de hora; até 30 tentativas de redefinição por IP. Estado persistido no SQLite e atualizado atomicamente entre workers. Dados antigos são removidos nas solicitações seguintes.
- E-mail e IP são representados por HMAC nos limites. Tokens aleatórios de 256 bits são guardados somente como SHA-256. Uma atualização condicional da senha impede reutilização concorrente.
- O token fica no fragmento do link, não no caminho/query enviado ao servidor. O JavaScript retira o fragmento do histórico e o envia apenas no POST. Recarregar a página exige reabrir o link recebido.
- Não há login automático após redefinir a senha.
- A resposta 202 é genérica para contas existentes, inexistentes, limite por e-mail e falhas de entrega. Ela confirma a solicitação, não a entrega. Sem configuração, a API retorna 503 para todos.
- No modo SMTP, o envio é síncrono, com timeout de 10 segundos nas operações SMTP, sem fila/reenvio automático. Falhas registram uma mensagem sanitizada no error log e invalidam o link gerado. Solicitações válidas podem demorar mais que contas inexistentes; a resposta genérica não elimina inferências por tempo. Para maior escala ou proteção contra esse canal, migrar para fila persistente com worker antes de ampliar o uso.
- O limite usa `request.remote_addr` e não confia em X-Forwarded-For. Confirme o endereço recebido atrás do proxy da hospedagem; se for compartilhado, o limite poderá atingir vários usuários. Não habilite confiança irrestrita em cabeçalhos de proxy.

## Diagnóstico de envio

- **503:** confira a URL HTTP/HTTPS, as variáveis de envio e reinicie o Flask/WSGI; console é aceito somente com APP_ENV=development.
- **202 sem e-mail:** confira spam, credenciais, remetente, restrições de rede e error log. O frontend não expõe se uma conta existe. Após 3 solicitações para o mesmo e-mail, aguarde a próxima janela de hora.
- **429:** limite por IP excedido; aguarde até uma hora.
- **Link expirado/inválido:** solicite outro link; links anteriores à troca de senha deixam de funcionar.

## Verificação automatizada

```bash
python -m unittest discover -s tests -v
node --check src/js/auth.js
```

Os testes usam banco temporário e transporte SMTP simulado, sem enviar e-mails. A entrega real depende das credenciais e rede do servidor. Verifique a página em celular antes de divulgar.

Referências oficiais:
- https://support.google.com/accounts/answer/185833?hl=pt-BR
- https://docs.python.org/3/library/smtplib.html
