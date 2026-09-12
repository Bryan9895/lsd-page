# Recuperação de senha por e-mail

O formulário agora chama a API Flask. O link abre `redefinir-senha.html`, permite cadastrar uma senha de 8 a 128 caracteres e expira após 30 minutos. A troca invalida todos os links daquela senha e as sessões anteriores. A implantação desta versão também pede novo login aos usuários com JWTs antigos.

## Configurar no PythonAnywhere

1. Integre este PR e atualize os arquivos do servidor, incluindo `backend/password_reset.py`, `redefinir-senha.html` e `src/js/auth.js`. Faça backup do banco antes da implantação.
2. Escolha a conta que enviará as mensagens. Para Gmail, ative a verificação em duas etapas e gere uma **senha de app** em https://myaccount.google.com/apppasswords. Não use a senha normal. Contas institucionais podem não permitir senhas de app: nesse caso, consulte o administrador ou use uma conta de envio autorizada.
3. No painel **Web > WSGI configuration file**, antes de `from backend.app import app as application`, insira e ajuste:

```python
os.environ['PUBLIC_BASE_URL'] = 'https://SEU_USUARIO.pythonanywhere.com'
os.environ['MAIL_HOST'] = 'smtp.gmail.com'
os.environ['MAIL_PORT'] = '587'
os.environ['MAIL_SECURITY'] = 'starttls'
os.environ['MAIL_USERNAME'] = 'seu-remetente@gmail.com'
os.environ['MAIL_PASSWORD'] = 'SUA_SENHA_DE_APP'
os.environ['MAIL_FROM'] = 'seu-remetente@gmail.com'
```

Mantenha esses valores apenas no arquivo WSGI privado do servidor. Não copie o arquivo com credenciais para o repositório. A `SECRET_KEY` existente deve continuar forte e estável. O `.env.example` é referência: o app **não carrega `.env` automaticamente**. Em outros servidores, exporte as mesmas variáveis no processo que inicia o Flask/WSGI.

4. Clique em **Reload**. As duas tabelas auxiliares são criadas automaticamente pelo `db.create_all()` já usado na inicialização; não é necessário editar a tabela de usuários nem apagar o banco.
5. Abra `/recuperar-senha.html` e solicite recuperação para uma conta sua cadastrada. Confira entrada e spam; abra o link, salve a nova senha e faça login. Tente usar o mesmo link novamente: deve ser rejeitado. A senha antiga e sessões antigas também devem ser rejeitadas.

O domínio deve ser HTTPS e corresponder ao endereço público do site (não localhost). Ele é configurado no servidor, sem confiar no cabeçalho Host enviado pelo cliente. Para SMTP de outro provedor, use host/porta autorizados e `MAIL_SECURITY=starttls` ou `ssl` (normalmente porta 465). Confirme se sua hospedagem permite conexão ao provedor escolhido; restrições do plano podem impedir SMTP.

## Limites e operação

- Até 3 solicitações por e-mail e 20 por IP por janela de hora; até 30 tentativas de redefinição por IP. Estado persistido no SQLite e atualizado atomicamente entre workers. Dados antigos são removidos nas solicitações seguintes.
- E-mail e IP são representados por HMAC nos limites. Tokens aleatórios de 256 bits são guardados somente como SHA-256. Uma atualização condicional da senha impede reutilização concorrente.
- O token fica no fragmento do link, não no caminho/query enviado ao servidor. O JavaScript retira o fragmento do histórico e o envia apenas no POST. Recarregar a página exige reabrir o link recebido.
- Não há login automático após redefinir a senha.
- A resposta 202 é genérica para contas existentes, inexistentes, limite por e-mail e falhas de entrega. Ela confirma a solicitação, não a entrega. Sem configuração, a API retorna 503 para todos.
- O envio é síncrono, com timeout de 10 segundos nas operações SMTP, sem fila/reenvio automático. Falhas registram uma mensagem sanitizada no error log e invalidam o link gerado. Solicitações válidas podem demorar mais que contas inexistentes; a resposta genérica não elimina inferências por tempo. Para maior escala ou proteção contra esse canal, migrar para fila persistente com worker antes de ampliar o uso.
- O limite usa `request.remote_addr` e não confia em X-Forwarded-For. Confirme o endereço recebido atrás do proxy da hospedagem; se for compartilhado, o limite poderá atingir vários usuários. Não habilite confiança irrestrita em cabeçalhos de proxy.

## Diagnóstico de envio

- **503:** confira todas as variáveis, HTTPS e o Reload do WSGI.
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
