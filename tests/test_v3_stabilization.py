"""Regressões críticas encontradas na preparação da V3."""
import unittest
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from werkzeug.security import generate_password_hash

from backend.app import app, db, User, Notification, Post


class V3StabilizationTests(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        self.admin = User(
            nome="Admin V3",
            email="admin-v3@example.com",
            senha_hash=generate_password_hash("admin-password"),
            is_admin=True,
        )
        self.member = User(
            nome="Membro V3",
            email="member-v3@example.com",
            senha_hash=generate_password_hash("member-password"),
            pontos=250,
        )
        self.other = User(
            nome="Outro V3",
            email="other-v3@example.com",
            senha_hash=generate_password_hash("other-password"),
        )
        db.session.add_all([self.admin, self.member, self.other])
        db.session.commit()
        self.client = app.test_client()

    def tearDown(self):
        db.session.remove()
        self.context.pop()

    def auth(self, email, password):
        response = self.client.post("/api/login", json={"email": email, "senha": password})
        self.assertEqual(response.status_code, 200, response.json)
        return {"Authorization": "Bearer " + response.json["token"]}

    def test_member_cannot_assign_new_card_to_someone_else(self):
        headers = self.auth("member-v3@example.com", "member-password")
        denied = self.client.post("/api/cards", headers=headers, json={
            "titulo": "Tarefa indevida",
            "responsavel_id": self.other.id,
        })
        self.assertEqual(denied.status_code, 403, denied.json)

        own = self.client.post("/api/cards", headers=headers, json={
            "titulo": "Minha tarefa",
            "responsavel_id": "logado",
        })
        self.assertEqual(own.status_code, 201, own.json)

        free = self.client.post("/api/cards", headers=headers, json={
            "titulo": "Tarefa aberta",
            "responsavel_id": "",
        })
        self.assertEqual(free.status_code, 201, free.json)

    def test_admin_can_assign_new_card_to_any_member(self):
        headers = self.auth("admin-v3@example.com", "admin-password")
        response = self.client.post("/api/cards", headers=headers, json={
            "titulo": "Tarefa delegada",
            "responsavel_id": self.other.id,
        })
        self.assertEqual(response.status_code, 201, response.json)
        self.assertEqual(response.json["card"]["responsavel_id"], self.other.id)

    def test_member_public_profile_includes_level(self):
        headers = self.auth("other-v3@example.com", "other-password")
        response = self.client.get(f"/api/membros/{self.member.id}/perfil", headers=headers)
        self.assertEqual(response.status_code, 200, response.json)
        self.assertIn("nivel", response.json)
        self.assertGreaterEqual(response.json["nivel"]["nivel"], 1)

    def test_feed_timestamps_are_explicit_utc(self):
        db.session.add(Post(user_id=self.member.id, conteudo="Teste de horário V3"))
        db.session.commit()
        headers = self.auth("other-v3@example.com", "other-password")
        response = self.client.get("/api/posts", headers=headers)
        self.assertEqual(response.status_code, 200, response.json)
        posts = response.json if isinstance(response.json, list) else response.json.get("posts", [])
        self.assertTrue(posts)
        self.assertTrue(posts[0]["data_criacao"].endswith("Z"), posts[0]["data_criacao"])

    def test_registration_stores_exact_fortaleza_timestamp(self):
        before = datetime.now(ZoneInfo("America/Fortaleza"))
        response = self.client.post("/api/register", data={
            "nome": "Novo Membro Horário",
            "email": "novo-horario@example.com",
            "senha": "senha-segura-123",
            "codigo_acesso": app.config["ACCESS_CODE"],
            "funcao": "Membro LSD",
        })
        after = datetime.now(ZoneInfo("America/Fortaleza"))
        self.assertIn(response.status_code, (200, 201), response.json)

        created = User.query.filter_by(email="novo-horario@example.com").first()
        self.assertIsNotNone(created)
        joined_at = datetime.fromisoformat(created.data_entrada)
        self.assertIsNotNone(joined_at.tzinfo)
        self.assertEqual(joined_at.utcoffset().total_seconds(), -3 * 60 * 60)
        self.assertLessEqual(before.replace(microsecond=0), joined_at)
        self.assertLessEqual(joined_at, after)

        payload_user = (response.json or {}).get("usuario") or (response.json or {}).get("user") or {}
        if payload_user:
            self.assertEqual(payload_user.get("data_entrada"), created.data_entrada)

    def test_admin_announcement_notifies_and_sends_email(self):
        headers = self.auth("admin-v3@example.com", "admin-password")
        with patch("backend.app.send_announcement_email") as send:
            response = self.client.post("/api/admin/comunicados", headers=headers, json={
                "assunto": "Reunião geral",
                "mensagem": "Hoje teremos uma reunião geral do laboratório às 17h.",
            })
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json["canal"], "notificacao_interna_e_email")
        self.assertTrue(response.json["email_enviado"])
        self.assertEqual(response.json["destinatarios"], 3)
        self.assertEqual(response.json["destinatarios_email"], 3)
        send.assert_called_once()
        self.assertEqual(Notification.query.filter_by(tipo="comunicado").count(), 3)

    def test_feed_interaction_generates_notification(self):
        post = Post(user_id=self.member.id, conteudo="Publicação do membro")
        db.session.add(post)
        db.session.commit()
        headers = self.auth("other-v3@example.com", "other-password")
        response = self.client.post(
            f"/api/posts/{post.id}/comentarios",
            headers=headers,
            json={"conteudo": "Resposta do outro membro"},
        )
        self.assertIn(response.status_code, (200, 201), response.json)
        notification = Notification.query.filter_by(
            user_id=self.member.id,
            tipo="comentario",
        ).first()
        self.assertIsNotNone(notification)


if __name__ == "__main__":
    unittest.main()
