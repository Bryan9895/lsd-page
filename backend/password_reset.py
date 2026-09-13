"""Recuperação de senha e entrega de e-mails do LSD-PAGE.

O transporte é configurado por ambiente. Em desenvolvimento pode usar ``console``;
em produção use ``smtp`` com um provedor real (Gmail com senha de app, servidor
institucional ou outro SMTP compatível).
"""
from __future__ import annotations

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


_EMAIL_RE = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
_ALLOWED_SECURITY = {"ssl", "starttls"}


def password_stamp(user, secret):
    return hmac.new(secret.encode(), user.senha_hash.encode(), hashlib.sha256).hexdigest()


def _valid_public_base_url(raw_url: str) -> bool:
    try:
        url = urlsplit(raw_url)
        return bool(
            url.scheme in ("http", "https")
            and url.hostname
            and url.port != 0
            and not url.username
            and not url.password
            and url.path in ("", "/")
            and not url.query
            and not url.fragment
            and not re.search(r"[\s\\]", raw_url)
        )
    except ValueError:
        return False


def email_configuration_status(config) -> dict:
    """Retorna diagnóstico seguro da configuração, sem expor credenciais."""
    backend = str(config.get("MAIL_BACKEND") or "").strip().lower()
    security = str(config.get("MAIL_SECURITY") or "").strip().lower()
    public_base_url = str(config.get("PUBLIC_BASE_URL") or "").strip()
    missing = []

    if not _valid_public_base_url(public_base_url):
        missing.append("PUBLIC_BASE_URL")

    if backend == "console":
        configured = config.get("APP_ENV") == "development" and not missing
        if config.get("APP_ENV") != "development":
            missing.append("MAIL_BACKEND=smtp em produção")
    elif backend == "smtp":
        for name in ("MAIL_HOST", "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_FROM"):
            if not str(config.get(name) or "").strip():
                missing.append(name)
        try:
            port = int(config.get("MAIL_PORT") or 0)
        except (TypeError, ValueError):
            port = 0
        if not 1 <= port <= 65535:
            missing.append("MAIL_PORT")
        if security not in _ALLOWED_SECURITY:
            missing.append("MAIL_SECURITY")
        from_address = str(config.get("MAIL_FROM") or "").strip()
        if from_address and not _EMAIL_RE.fullmatch(from_address):
            missing.append("MAIL_FROM válido")
        configured = not missing
    else:
        configured = False
        missing.append("MAIL_BACKEND")

    return {
        "configured": configured,
        "backend": backend or "não configurado",
        "provider": str(config.get("MAIL_PROVIDER") or "smtp").strip() or "smtp",
        "host": str(config.get("MAIL_HOST") or "").strip(),
        "port": config.get("MAIL_PORT"),
        "security": security,
        "from": str(config.get("MAIL_FROM") or "").strip(),
        "public_base_url": public_base_url,
        "missing": sorted(set(missing)),
    }


def _prepare_message(config, subject, *, to=None, bcc=None, body=""):
    subject = str(subject or "").strip()
    if not subject or "\r" in subject or "\n" in subject:
        raise ValueError("Assunto de e-mail inválido.")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = config["MAIL_FROM"]
    if to:
        message["To"] = to
    if bcc:
        message["Bcc"] = ", ".join(bcc)
    reply_to = str(config.get("MAIL_REPLY_TO") or "").strip()
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(str(body or ""))
    return message


def _deliver_message(config, message):
    backend = config["MAIL_BACKEND"]
    if backend == "console":
        if config["APP_ENV"] != "development":
            raise ValueError("Console de e-mail disponível apenas em desenvolvimento.")
        print("\n[EMAIL LOCAL — NÃO ENVIADO]\n" + message.get_content(), flush=True)
        return

    if backend != "smtp":
        raise ValueError("Backend de e-mail não suportado.")

    context = ssl.create_default_context()
    timeout = int(config.get("MAIL_TIMEOUT") or 10)
    transport = smtplib.SMTP_SSL if config["MAIL_SECURITY"] == "ssl" else smtplib.SMTP
    options = {"timeout": timeout}
    if config["MAIL_SECURITY"] == "ssl":
        options["context"] = context

    with transport(config["MAIL_HOST"], config["MAIL_PORT"], **options) as smtp:
        if config["MAIL_SECURITY"] == "starttls":
            smtp.starttls(context=context)
        smtp.login(config["MAIL_USERNAME"], config["MAIL_PASSWORD"])
        smtp.send_message(message)


def send_reset_email(config, recipient, link):
    message = _prepare_message(
        config,
        "Redefina sua senha — Perfil LSD",
        to=recipient,
        body=(
            "Recebemos uma solicitação para redefinir sua senha no Perfil LSD.\n\n"
            f"Acesse o link abaixo (válido por 30 minutos e para um único uso):\n{link}\n\n"
            "Se você não solicitou a alteração, ignore este e-mail. Sua senha não mudou."
        ),
    )
    _deliver_message(config, message)


def send_announcement_email(config, recipients, subject, body):
    recipients = list(dict.fromkeys(
        str(item or "").strip() for item in recipients if str(item or "").strip()
    ))
    if not recipients:
        return

    batch_size = max(1, min(int(config.get("MAIL_BATCH_SIZE") or 40), 100))
    for start in range(0, len(recipients), batch_size):
        batch = recipients[start:start + batch_size]
        message = _prepare_message(
            config,
            subject,
            to=config["MAIL_FROM"],
            bcc=batch,
            body=body,
        )
        _deliver_message(config, message)


def send_test_email(config, recipient):
    message = _prepare_message(
        config,
        "Teste de e-mail — LSD-PAGE",
        to=recipient,
        body=(
            "Este é um teste de entrega do LSD-PAGE.\n\n"
            "Se você recebeu esta mensagem, o transporte de e-mail está configurado corretamente "
            "para recuperação de senha e comunicados."
        ),
    )
    _deliver_message(config, message)


def register_password_reset(app, db, User):
    for name in (
        "MAIL_HOST", "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_FROM",
        "MAIL_REPLY_TO", "MAIL_PROVIDER", "PUBLIC_BASE_URL",
    ):
        app.config[name] = os.getenv(name, "").strip()

    app.config["MAIL_BACKEND"] = os.getenv("MAIL_BACKEND", "smtp").strip().lower()
    app.config["MAIL_SECURITY"] = os.getenv("MAIL_SECURITY", "starttls").strip().lower()

    try:
        app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", "587"))
    except ValueError:
        app.config["MAIL_PORT"] = 0
    try:
        app.config["MAIL_TIMEOUT"] = max(3, min(int(os.getenv("MAIL_TIMEOUT", "10")), 60))
    except ValueError:
        app.config["MAIL_TIMEOUT"] = 10
    try:
        app.config["MAIL_BATCH_SIZE"] = max(1, min(int(os.getenv("MAIL_BATCH_SIZE", "40")), 100))
    except ValueError:
        app.config["MAIL_BATCH_SIZE"] = 40

    class PasswordReset(db.Model):
        __tablename__ = "password_resets"
        token_hash = db.Column(db.String(64), primary_key=True)
        user_id = db.Column(db.Integer, nullable=False, index=True)
        password_hash = db.Column(db.String(255), nullable=False)
        expires_at = db.Column(db.Integer, nullable=False, index=True)

    class ResetLimit(db.Model):
        __tablename__ = "password_reset_limits"
        key = db.Column(db.String(64), primary_key=True)
        count = db.Column(db.Integer, nullable=False)
        expires_at = db.Column(db.Integer, nullable=False, index=True)

    def limited(scope, value, maximum):
        now = int(time.time())
        key = hmac.new(
            app.config["SECRET_KEY"].encode(),
            f"{scope}:{value}:{now // 3600}".encode(),
            hashlib.sha256,
        ).hexdigest()
        statement = insert(ResetLimit).values(key=key, count=1, expires_at=now + 3600)
        db.session.execute(statement.on_conflict_do_update(
            index_elements=["key"], set_={"count": ResetLimit.count + 1}
        ))
        count = db.session.get(ResetLimit, key).count
        ResetLimit.query.filter(ResetLimit.expires_at < now).delete()
        PasswordReset.query.filter(PasswordReset.expires_at < now).delete()
        db.session.commit()
        return count > maximum

    def configured():
        return bool(email_configuration_status(app.config)["configured"])

    @app.post("/api/recuperar-senha")
    def request_reset():
        if limited("request-ip", request.remote_addr or "unknown", 20):
            return jsonify(success=False, message="Muitas tentativas. Tente novamente em uma hora."), 429

        data = request.get_json(silent=True)
        email = data.get("email") if isinstance(data, dict) else None
        if not isinstance(email, str) or len(email) > 120 or not _EMAIL_RE.fullmatch(email.strip()):
            return jsonify(success=False, message="Informe um e-mail válido."), 400
        email = email.strip().lower()

        if not configured():
            return jsonify(
                success=False,
                message="Recuperação por e-mail ainda não está configurada. Tente novamente mais tarde."
            ), 503

        response = dict(
            success=True,
            message="Solicitação recebida. Se este e-mail estiver cadastrado, você receberá as instruções."
        )
        if limited("email", email, 3):
            return jsonify(response), 202

        user = User.query.filter(db.func.lower(User.email) == email).first()
        if user:
            token = secrets.token_urlsafe(32)
            digest = hashlib.sha256(token.encode()).hexdigest()
            db.session.add(PasswordReset(
                token_hash=digest,
                user_id=user.id,
                password_hash=user.senha_hash,
                expires_at=int(time.time()) + 1800,
            ))
            db.session.commit()
            link = app.config["PUBLIC_BASE_URL"].rstrip("/") + "/redefinir-senha.html#token=" + token
            try:
                send_reset_email(app.config, user.email, link)
            except Exception:
                app.logger.error("Falha no transporte de recuperação de senha; verifique a configuração de e-mail.")
                PasswordReset.query.filter_by(token_hash=digest).delete()
                db.session.commit()

        return jsonify(response), 202

    @app.post("/api/redefinir-senha")
    def reset_password():
        if limited("reset-ip", request.remote_addr or "unknown", 30):
            return jsonify(success=False, message="Muitas tentativas. Tente novamente em uma hora."), 429

        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(success=False, message="Dados inválidos."), 400

        token, password = data.get("token"), data.get("senha")
        if not isinstance(password, str) or not 8 <= len(password) <= 128:
            return jsonify(success=False, message="A senha deve ter entre 8 e 128 caracteres."), 400
        if not isinstance(token, str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
            return jsonify(success=False, message="Link inválido ou expirado. Solicite outro link."), 400

        digest = hashlib.sha256(token.encode()).hexdigest()
        reset = db.session.get(PasswordReset, digest)
        if reset and reset.expires_at > int(time.time()):
            updated = User.query.filter_by(
                id=reset.user_id,
                senha_hash=reset.password_hash,
            ).update({"senha_hash": generate_password_hash(password)}, synchronize_session=False)
            if updated:
                PasswordReset.query.filter_by(user_id=reset.user_id).delete(synchronize_session=False)
                db.session.commit()
                return jsonify(success=True, message="Senha alterada. Faça login com sua nova senha.")

        db.session.rollback()
        return jsonify(success=False, message="Link inválido ou expirado. Solicite outro link."), 400
