"""Cobertura da API de portfólio e dos vínculos projeto ↔ membro."""
from io import BytesIO
import unittest

from werkzeug.security import generate_password_hash

from backend.app import app, db, Project, User


class ProjectPortfolioTests(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()

        self.admin = User(
            nome="Admin",
            email="admin-projects@example.com",
            senha_hash=generate_password_hash("admin-password"),
            is_admin=True
        )
        self.lider = User(
            nome="Líder",
            email="leader@example.com",
            senha_hash=generate_password_hash("leader-password")
        )
        self.membro = User(
            nome="Membro",
            email="member-projects@example.com",
            senha_hash=generate_password_hash("member-password")
        )
        db.session.add_all([self.admin, self.lider, self.membro])
        db.session.commit()
        self.ids = {
            "admin": self.admin.id,
            "lider": self.lider.id,
            "membro": self.membro.id
        }
        self.client = app.test_client()

    def tearDown(self):
        db.session.remove()
        self.context.pop()

    def token(self, email, senha):
        response = self.client.post("/api/login", json={"email": email, "senha": senha})
        self.assertEqual(response.status_code, 200)
        return response.json["token"]

    @staticmethod
    def auth(token):
        return {"Authorization": "Bearer " + token}

    def projeto_payload(self):
        return {
            "nome": "Visão Inclusiva",
            "descricao": "Projeto de visão computacional voltado para acessibilidade no campus.",
            "logo_url": "/src/images/lupadigital.jpeg",
            "status": "em_desenvolvimento",
            "professor_orientador": "Prof. Orientador",
            "lider_id": self.ids["lider"],
            "membro_ids": [self.ids["membro"]],
            "tecnologias": ["Python", "OpenCV"],
            "repositorio_url": "https://github.com/LSD-IFCE/visao-inclusiva",
            "site_url": "http://lsd.maranguape.ifce.edu.br:8000/"
        }

    def criar_projeto(self):
        token = self.token("admin-projects@example.com", "admin-password")
        response = self.client.post(
            "/api/admin/projetos",
            headers=self.auth(token),
            json=self.projeto_payload()
        )
        self.assertEqual(response.status_code, 201, response.json)
        return response.json["projeto"]

    def test_admin_cria_e_perfil_publico_recebe_vinculo(self):
        token_membro = self.token("member-projects@example.com", "member-password")
        negado = self.client.post(
            "/api/admin/projetos",
            headers=self.auth(token_membro),
            json=self.projeto_payload()
        )
        self.assertEqual(negado.status_code, 403)

        projeto = self.criar_projeto()
        token_admin = self.token("admin-projects@example.com", "admin-password")
        lista_admin = self.client.get(
            "/api/admin/projetos",
            headers=self.auth(token_admin)
        )
        self.assertEqual(lista_admin.status_code, 200, lista_admin.json)
        self.assertEqual(len(lista_admin.json["projetos"]), 1)
        self.assertEqual(projeto["slug"], "visao-inclusiva")
        self.assertEqual(projeto["lider"]["id"], self.ids["lider"])
        self.assertEqual(
            {item["id"] for item in projeto["membros"]},
            {self.ids["lider"], self.ids["membro"]}
        )

        perfil = self.client.get(
            f"/api/membros/{self.ids['membro']}/perfil",
            headers=self.auth(token_membro)
        )
        self.assertEqual(perfil.status_code, 200)
        self.assertEqual(perfil.json["projetos"][0]["id"], projeto["id"])
        self.assertEqual(db.session.get(User, self.ids["membro"]).projetos_ativos, 1)
        self.assertEqual(db.session.get(User, self.ids["lider"]).projetos_ativos, 1)

        publico = self.client.get("/api/projetos/slug/visao-inclusiva")
        self.assertEqual(publico.status_code, 200)
        self.assertNotIn("email", publico.json["projeto"]["membros"][0])

    def test_lider_anexa_documento_e_membro_comum_nao(self):
        projeto = self.criar_projeto()
        token_membro = self.token("member-projects@example.com", "member-password")
        negado = self.client.post(
            f"/api/projetos/{projeto['id']}/documentos",
            headers=self.auth(token_membro),
            data={"documento": (BytesIO(b"pdf"), "documentacao.pdf")},
            content_type="multipart/form-data"
        )
        self.assertEqual(negado.status_code, 403)

        token_lider = self.token("leader@example.com", "leader-password")
        enviado = self.client.post(
            f"/api/projetos/{projeto['id']}/documentos",
            headers=self.auth(token_lider),
            data={
                "titulo": "Documentação técnica",
                "documento": (BytesIO(b"%PDF-1.4 teste"), "documentacao.pdf")
            },
            content_type="multipart/form-data"
        )
        self.assertEqual(enviado.status_code, 201, enviado.json)
        self.assertEqual(enviado.json["documento"]["titulo"], "Documentação técnica")

    def test_concluir_projeto_atualiza_contagem_e_valida_urls(self):
        projeto = self.criar_projeto()
        token = self.token("admin-projects@example.com", "admin-password")

        invalido = self.client.put(
            f"/api/admin/projetos/{projeto['id']}",
            headers=self.auth(token),
            json={"repositorio_url": "javascript:alert(1)"}
        )
        self.assertEqual(invalido.status_code, 400)

        concluido = self.client.put(
            f"/api/admin/projetos/{projeto['id']}",
            headers=self.auth(token),
            json={"status": "concluido"}
        )
        self.assertEqual(concluido.status_code, 200, concluido.json)
        self.assertEqual(db.session.get(User, self.ids["lider"]).projetos_ativos, 0)
        self.assertEqual(db.session.get(User, self.ids["membro"]).projetos_ativos, 0)

        filtro = self.client.get("/api/projetos?status=concluido")
        self.assertEqual(filtro.status_code, 200)
        self.assertEqual(filtro.json["total"], 1)

        removido = self.client.delete(
            f"/api/admin/projetos/{projeto['id']}",
            headers=self.auth(token)
        )
        self.assertEqual(removido.status_code, 200)
        self.assertIsNone(db.session.get(Project, projeto["id"]))

    def test_excluir_lider_preserva_portfolio_e_documentacao(self):
        projeto = self.criar_projeto()
        token_lider = self.token("leader@example.com", "leader-password")
        documento = self.client.post(
            f"/api/projetos/{projeto['id']}/documentos",
            headers=self.auth(token_lider),
            data={"documento": (BytesIO(b"conteudo"), "guia.pdf")},
            content_type="multipart/form-data"
        )
        self.assertEqual(documento.status_code, 201)

        token_admin = self.token("admin-projects@example.com", "admin-password")
        removido = self.client.delete(
            f"/api/admin/membros/{self.ids['lider']}",
            headers=self.auth(token_admin)
        )
        self.assertEqual(removido.status_code, 200, removido.json)

        portfolio = self.client.get(f"/api/projetos/{projeto['id']}")
        self.assertEqual(portfolio.status_code, 200)
        self.assertIsNone(portfolio.json["projeto"]["lider"])
        self.assertNotIn(
            self.ids["lider"],
            {item["id"] for item in portfolio.json["projeto"]["membros"]}
        )
        self.assertEqual(len(portfolio.json["projeto"]["documentos"]), 1)
        self.assertIsNone(portfolio.json["projeto"]["documentos"][0]["enviado_por"])


if __name__ == "__main__":
    unittest.main()
