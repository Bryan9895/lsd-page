"""Ajustes de estabilização da V3 sem duplicar os fluxos já existentes.

Este módulo concentra regras transversais que precisam funcionar tanto no
PythonAnywhere quanto no futuro servidor institucional.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta

import jwt
from flask import g, jsonify, request
from sqlalchemy import text


ISO_NAIVE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$")
PROJECT_ADMIN_RE = re.compile(r"^/api/admin/projetos(?:/(\d+))?$")
MEMBER_PROFILE_RE = re.compile(r"^/api/membros/(\d+)/perfil$")
COMMENT_RE = re.compile(r"^/api/posts/(\d+)/comentarios$")
REACTION_RE = re.compile(r"^/api/posts/(\d+)/reacoes$")


def register_v3_features(app, db, namespace):
    """Registra as correções da V3 depois que modelos, rotas e banco existem."""
    if app.extensions.get("lsd_v3_features_registered"):
        return
    app.extensions["lsd_v3_features_registered"] = True

    User = namespace["User"]
    Notification = namespace.get("Notification")
    Post = namespace.get("Post")
    PostReaction = namespace.get("PostReaction")
    Project = namespace.get("Project")
    UserAchievement = namespace.get("UserAchievement")
    nivel_usuario = namespace.get("nivel_usuario")

    def current_user():
        auth = request.headers.get("Authorization", "").strip()
        if not auth.lower().startswith("bearer "):
            return None
        token = auth.split(None, 1)[1].strip()
        try:
            payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
        except (jwt.InvalidTokenError, IndexError, TypeError):
            return None

        candidate = payload.get("user_id") or payload.get("usuario_id") or payload.get("id") or payload.get("sub")
        try:
            if candidate is not None:
                user = db.session.get(User, int(candidate))
                if user:
                    return user
        except (TypeError, ValueError):
            pass
        email = str(payload.get("email") or "").strip().lower()
        return User.query.filter_by(email=email).first() if email else None

    def add_notification(user_id, tipo, titulo, mensagem, *, dedupe_minutes=2):
        if not Notification or not user_id:
            return False
        cutoff = datetime.utcnow() - timedelta(minutes=dedupe_minutes)
        query = Notification.query.filter_by(user_id=user_id, tipo=tipo, titulo=titulo, mensagem=mensagem)
        if hasattr(Notification, "data_criacao"):
            query = query.filter(Notification.data_criacao >= cutoff)
        if query.first():
            return False
        db.session.add(Notification(user_id=user_id, tipo=tipo, titulo=titulo, mensagem=mensagem))
        return True

    def normalize_utc(value):
        if isinstance(value, dict):
            return {key: normalize_utc(item) for key, item in value.items()}
        if isinstance(value, list):
            return [normalize_utc(item) for item in value]
        if isinstance(value, str) and ISO_NAIVE_RE.match(value):
            return value + "Z"
        return value

    if UserAchievement is not None:
        table = UserAchievement.__tablename__
        with app.app_context():
            try:
                db.session.execute(text(
                    f"DELETE FROM {table} WHERE id NOT IN (SELECT MIN(id) FROM {table} GROUP BY user_id, achievement_id)"
                ))
                db.session.execute(text(
                    f"CREATE UNIQUE INDEX IF NOT EXISTS uq_{table}_user_achievement ON {table}(user_id, achievement_id)"
                ))
                db.session.commit()
            except Exception:
                db.session.rollback()
                app.logger.exception("Não foi possível consolidar conquistas duplicadas.")

    @app.before_request
    def v3_before_request():
        g.v3_user = current_user()
        if request.method == "POST" and request.path == "/api/cards" and g.v3_user:
            if not bool(getattr(g.v3_user, "is_admin", False)):
                data = request.get_json(silent=True) or {}
                responsavel = data.get("responsavel_id")
                allowed = {None, "", "logado", g.v3_user.id, str(g.v3_user.id)}
                if responsavel not in allowed:
                    return jsonify({
                        "success": False,
                        "message": "Membros podem atribuir o card apenas a si mesmos ou deixá-lo sem responsável."
                    }), 403

        match = PROJECT_ADMIN_RE.match(request.path)
        if request.method == "PUT" and match and match.group(1) and Project is not None:
            projeto = db.session.get(Project, int(match.group(1)))
            g.v3_project_member_ids = {int(member.id) for member in (getattr(projeto, "membros", []) or [])} if projeto else set()

    def notify_project_members(response_payload):
        if Project is None or Notification is None:
            return
        projeto_data = (response_payload or {}).get("projeto") or {}
        projeto_id = projeto_data.get("id")
        if not projeto_id:
            return
        projeto = db.session.get(Project, int(projeto_id))
        if not projeto:
            return

        before_ids = getattr(g, "v3_project_member_ids", set())
        current_members = list(getattr(projeto, "membros", []) or [])
        current_ids = {member.id for member in current_members}
        new_members = [member for member in current_members if member.id not in before_ids]
        if request.method == "POST":
            new_members = current_members

        for newcomer in new_members:
            add_notification(newcomer.id, "projeto", "Você entrou em um projeto",
                             f"Você agora participa do projeto {getattr(projeto, 'nome', 'LSD')}.")
            for teammate in current_members:
                if teammate.id == newcomer.id or teammate.id not in before_ids:
                    continue
                add_notification(teammate.id, "projeto", "Novo membro no projeto",
                                 f"{newcomer.nome} entrou no projeto {getattr(projeto, 'nome', 'LSD')}.")
            leader = getattr(projeto, "lider", None)
            if leader and leader.id != newcomer.id and leader.id not in current_ids:
                add_notification(leader.id, "projeto", "Novo membro no projeto",
                                 f"{newcomer.nome} entrou no projeto {getattr(projeto, 'nome', 'LSD')}.")

    def notify_social_event():
        actor = getattr(g, "v3_user", None)
        if not actor or Notification is None or Post is None:
            return
        match = COMMENT_RE.match(request.path)
        if request.method == "POST" and match:
            post = db.session.get(Post, int(match.group(1)))
            if post and post.user_id != actor.id:
                add_notification(post.user_id, "comentario", "Nova resposta no feed",
                                 f"{actor.nome} comentou na sua publicação.")
            return

        match = REACTION_RE.match(request.path)
        if request.method == "POST" and match and PostReaction is not None:
            post_id = int(match.group(1))
            post = db.session.get(Post, post_id)
            if not post or post.user_id == actor.id:
                return
            reaction = PostReaction.query.filter_by(post_id=post_id, user_id=actor.id).first()
            if reaction:
                emoji = getattr(reaction, "emoji", "") or "curtiu"
                add_notification(post.user_id, "reacao", "Nova reação no feed",
                                 f"{actor.nome} reagiu {emoji} à sua publicação.")

    def notify_new_member():
        if request.method != "POST" or request.path not in {"/api/register", "/api/cadastro"}:
            return
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            data = request.form.to_dict(flat=True)
        email = str(data.get("email") or "").strip().lower()
        newcomer = User.query.filter_by(email=email).first() if email else None
        if not newcomer:
            return
        changed = False
        for member in User.query.filter(User.id != newcomer.id).all():
            changed |= add_notification(member.id, "comunidade", "Novo membro na comunidade",
                                        f"{newcomer.nome} entrou para a comunidade LSD.", dedupe_minutes=10)
        if changed:
            db.session.commit()

    @app.after_request
    def v3_after_request(response):
        if response.status_code >= 400:
            return response
        payload = response.get_json(silent=True) if response.is_json else None

        profile_match = MEMBER_PROFILE_RE.match(request.path)
        if profile_match and isinstance(payload, dict) and nivel_usuario is not None:
            member = db.session.get(User, int(profile_match.group(1)))
            if member:
                level = nivel_usuario(member)
                payload["nivel"] = level
                if isinstance(payload.get("membro"), dict):
                    payload["membro"]["nivel"] = level

        if isinstance(payload, dict) and UserAchievement is not None:
            achievements = payload.get("conquistas")
            if isinstance(achievements, list):
                total_users = max(User.query.count(), 1)
                for item in achievements:
                    if not isinstance(item, dict):
                        continue
                    achievement_id = item.get("achievement_id") or item.get("id")
                    if not achievement_id:
                        continue
                    unique_count = (db.session.query(UserAchievement.user_id)
                                    .filter(UserAchievement.achievement_id == int(achievement_id))
                                    .distinct().count())
                    item["total_desbloqueios"] = unique_count
                    item["percentual_desbloqueio"] = round((unique_count / total_users) * 100, 1)

        changed = False
        if request.method in {"POST", "PUT"} and PROJECT_ADMIN_RE.match(request.path):
            before = set(db.session.new)
            notify_project_members(payload or {})
            changed = changed or bool(set(db.session.new) - before)
        if COMMENT_RE.match(request.path) or REACTION_RE.match(request.path):
            before = set(db.session.new)
            notify_social_event()
            changed = changed or bool(set(db.session.new) - before)
        if changed:
            db.session.commit()

        notify_new_member()

        if isinstance(payload, (dict, list)):
            payload = normalize_utc(payload)
            response.set_data(app.json.dumps(payload, ensure_ascii=False))
            response.content_type = "application/json; charset=utf-8"
        return response

    def internal_announcement():
        actor = current_user()
        if not actor:
            return jsonify({"success": False, "message": "Não autenticado."}), 401
        if not bool(getattr(actor, "is_admin", False)):
            return jsonify({"success": False, "message": "Acesso restrito ao administrador."}), 403
        data = request.get_json(silent=True) or {}
        subject = str(data.get("assunto") or "").strip()
        message = str(data.get("mensagem") or "").strip()
        if len(subject) < 3 or len(message) < 10:
            return jsonify({"success": False, "message": "Informe um assunto e uma mensagem válidos."}), 400

        users = User.query.order_by(User.id.asc()).all()
        for member in users:
            db.session.add(Notification(user_id=member.id, tipo="comunicado", titulo=subject, mensagem=message))
        db.session.commit()

        recipients = []
        seen = set()
        for member in users:
            email = str(getattr(member, "email", "") or "").strip()
            key = email.lower()
            if email and key not in seen:
                seen.add(key)
                recipients.append(email)

        email_configurado = (
            app.config.get("MAIL_BACKEND") == "smtp"
            and all(app.config.get(name) for name in ("MAIL_HOST", "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_FROM"))
            and app.config.get("MAIL_SECURITY") in {"ssl", "starttls"}
            and bool(recipients)
            and callable(namespace.get("send_announcement_email"))
        )
        email_enviado = False
        if email_configurado:
            try:
                namespace["send_announcement_email"](app.config, recipients, subject, message)
                email_enviado = True
            except Exception:
                app.logger.error("Comunicado salvo nas notificações, mas o transporte SMTP falhou.")

        return jsonify({
            "success": True,
            "message": (
                "Comunicado publicado e enviado por e-mail."
                if email_enviado
                else "Comunicado publicado nas notificações dos membros."
            ),
            "destinatarios": len(users),
            "destinatarios_email": len(recipients),
            "email_configurado": email_configurado,
            "email_enviado": email_enviado,
            "canal": "notificacao_interna_e_email" if email_enviado else "notificacao_interna",
        }), 200

    for rule in app.url_map.iter_rules():
        if rule.rule == "/api/admin/comunicados" and "POST" in rule.methods:
            app.view_functions[rule.endpoint] = internal_announcement
            break
