"""Recuperação de senha via SMTP, com estado persistente no SQLite."""
import hashlib
import hmac
import os
import re
import secrets
import smtplib
import ssl
import time
from email.message import EmailMessage
from urllib.parse import urlsplit

from flask import jsonify, request
from sqlalchemy.dialects.sqlite import insert
from werkzeug.security import generate_password_hash


def password_stamp(user, secret):
    return hmac.new(secret.encode(), user.senha_hash.encode(), hashlib.sha256).hexdigest()


def send_reset_email(config, recipient, link):
    message = EmailMessage()
    message['Subject'] = 'Redefina sua senha — Perfil LSD'
    message['From'] = config['MAIL_FROM']
    message['To'] = recipient
    message.set_content(
        'Recebemos uma solicitação para redefinir sua senha no Perfil LSD.\n\n'
        f'Acesse o link abaixo (válido por 30 minutos e para um único uso):\n{link}\n\n'
        'Se você não solicitou a alteração, ignore este e-mail. Sua senha não mudou.'
    )
    if config['MAIL_BACKEND'] == 'console':
        if config['APP_ENV'] != 'development':
            raise ValueError('Console de e-mail disponível apenas em desenvolvimento.')
        # Saída local intencional para testar sem conta SMTP. Não é entrega real.
        print('\n[EMAIL LOCAL — NÃO ENVIADO]\n' + message.get_content(), flush=True)
        return
    context = ssl.create_default_context()
    transport = smtplib.SMTP_SSL if config['MAIL_SECURITY'] == 'ssl' else smtplib.SMTP
    options = {'timeout': 10}
    if config['MAIL_SECURITY'] == 'ssl':
        options['context'] = context
    with transport(config['MAIL_HOST'], config['MAIL_PORT'], **options) as smtp:
        if config['MAIL_SECURITY'] == 'starttls':
            smtp.starttls(context=context)
        smtp.login(config['MAIL_USERNAME'], config['MAIL_PASSWORD'])
        smtp.send_message(message)


def register_password_reset(app, db, User):
    for name in ('MAIL_HOST', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_FROM', 'PUBLIC_BASE_URL'):
        app.config[name] = os.getenv(name, '').strip()
    app.config['MAIL_BACKEND'] = os.getenv('MAIL_BACKEND', 'smtp').strip().lower()
    app.config['MAIL_SECURITY'] = os.getenv('MAIL_SECURITY', 'starttls').strip().lower()
    app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', '587'))

    class PasswordReset(db.Model):
        __tablename__ = 'password_resets'
        token_hash = db.Column(db.String(64), primary_key=True)
        user_id = db.Column(db.Integer, nullable=False, index=True)
        password_hash = db.Column(db.String(255), nullable=False)
        expires_at = db.Column(db.Integer, nullable=False, index=True)

    class ResetLimit(db.Model):
        __tablename__ = 'password_reset_limits'
        key = db.Column(db.String(64), primary_key=True)
        count = db.Column(db.Integer, nullable=False)
        expires_at = db.Column(db.Integer, nullable=False, index=True)

    def limited(scope, value, maximum):
        now = int(time.time())
        key = hmac.new(app.config['SECRET_KEY'].encode(),
                       f'{scope}:{value}:{now // 3600}'.encode(), hashlib.sha256).hexdigest()
        # Atomic UPSERT: limits survive restarts and apply across WSGI workers.
        statement = insert(ResetLimit).values(key=key, count=1, expires_at=now + 3600)
        db.session.execute(statement.on_conflict_do_update(
            index_elements=['key'], set_={'count': ResetLimit.count + 1}))
        count = db.session.get(ResetLimit, key).count
        ResetLimit.query.filter(ResetLimit.expires_at < now).delete()
        PasswordReset.query.filter(PasswordReset.expires_at < now).delete()
        db.session.commit()
        return count > maximum

    def configured():
        config = app.config
        raw_url = config['PUBLIC_BASE_URL']
        try:
            url = urlsplit(raw_url)
            # Somente uma origem configurada pelo operador, nunca o Host da requisição.
            valid_url = (url.scheme in ('http', 'https') and url.hostname
                         and url.port != 0 and not url.username and not url.password
                         and url.path in ('', '/') and not url.query and not url.fragment
                         and not re.search(r'[\s\\]', raw_url))
        except ValueError:
            return False
        if not valid_url:
            return False
        if config['MAIL_BACKEND'] == 'console':
            return config['APP_ENV'] == 'development'
        return (config['MAIL_BACKEND'] == 'smtp'
                and all(config[n] for n in ('MAIL_HOST', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_FROM'))
                and config['MAIL_SECURITY'] in ('ssl', 'starttls')
                and 1 <= config['MAIL_PORT'] <= 65535)

    @app.post('/api/recuperar-senha')
    def request_reset():
        if limited('request-ip', request.remote_addr or 'unknown', 20):
            return jsonify(success=False, message='Muitas tentativas. Tente novamente em uma hora.'), 429
        data = request.get_json(silent=True)
        email = data.get('email') if isinstance(data, dict) else None
        if not isinstance(email, str) or len(email) > 120 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email.strip()):
            return jsonify(success=False, message='Informe um e-mail válido.'), 400
        email = email.strip().lower()
        if not configured():
            return jsonify(success=False, message='Recuperação indisponível. Tente novamente mais tarde.'), 503
        response = dict(success=True, message='Solicitação recebida. Se este e-mail estiver cadastrado, você receberá as instruções.')
        if limited('email', email, 3):
            return jsonify(response), 202
        user = User.query.filter(db.func.lower(User.email) == email).first()
        if user:
            token = secrets.token_urlsafe(32)
            digest = hashlib.sha256(token.encode()).hexdigest()
            db.session.add(PasswordReset(token_hash=digest, user_id=user.id,
                                         password_hash=user.senha_hash, expires_at=int(time.time()) + 1800))
            db.session.commit()
            link = app.config['PUBLIC_BASE_URL'].rstrip('/') + '/redefinir-senha.html#token=' + token
            try:
                send_reset_email(app.config, user.email, link)
            except Exception:
                # Never log credentials, recipient, SMTP response or reset token.
                app.logger.error('Falha no transporte de recuperação de senha; verifique SMTP no servidor.')
                PasswordReset.query.filter_by(token_hash=digest).delete()
                db.session.commit()
        return jsonify(response), 202

    @app.post('/api/redefinir-senha')
    def reset_password():
        if limited('reset-ip', request.remote_addr or 'unknown', 30):
            return jsonify(success=False, message='Muitas tentativas. Tente novamente em uma hora.'), 429
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(success=False, message='Dados inválidos.'), 400
        token, password = data.get('token'), data.get('senha')
        if not isinstance(password, str) or not 8 <= len(password) <= 128:
            return jsonify(success=False, message='A senha deve ter entre 8 e 128 caracteres.'), 400
        if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
            return jsonify(success=False, message='Link inválido ou expirado. Solicite outro link.'), 400
        digest = hashlib.sha256(token.encode()).hexdigest()
        reset = db.session.get(PasswordReset, digest)
        if reset and reset.expires_at > int(time.time()):
            # Compare-and-swap ensures concurrent requests cannot reuse this or sibling links.
            updated = User.query.filter_by(id=reset.user_id, senha_hash=reset.password_hash).update(
                {'senha_hash': generate_password_hash(password)}, synchronize_session=False)
            if updated:
                PasswordReset.query.filter_by(user_id=reset.user_id).delete(synchronize_session=False)
                db.session.commit()
                return jsonify(success=True, message='Senha alterada. Faça login com sua nova senha.')
        db.session.rollback()
        return jsonify(success=False, message='Link inválido ou expirado. Solicite outro link.'), 400
