import os
import uuid
import json
import sqlite3
import threading
import zipfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from functools import wraps

import jwt

from flask import (
    Flask,
    request,
    jsonify,
    send_from_directory,
    send_file
)

from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate

from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from werkzeug.utils import secure_filename


# ============================================================
# CONFIGURAÇÃO
# ============================================================

app = Flask(__name__)

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

PROJECT_ROOT = os.path.dirname(BASE_DIR)
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"


# Chave usada pelos tokens JWT.
# Em produção, defina SECRET_KEY no ambiente do servidor.
app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY",
    "lsd_secret_key_2026_dev"
)


# ============================================================
# CÓDIGO DE ACESSO
# ============================================================

# Somente este código permite criar uma nova conta.
app.config["ACCESS_CODE"] = os.getenv(
    "LSD_ACCESS_CODE",
    "00001"
).strip()


# ============================================================
# ADMINISTRADOR PRINCIPAL
# ============================================================

app.config["ADMIN_EMAIL"] = os.getenv(
    "ADMIN_EMAIL",
    "bryan.william10@aluno.ifce.edu.br"
).strip().lower()


# ============================================================
# BANCO DE DADOS
# ============================================================

INSTANCE_DIR = os.path.join(BASE_DIR, "instance")

os.makedirs(
    INSTANCE_DIR,
    exist_ok=True
)

DATABASE_PATH = os.path.abspath(
    os.getenv(
        "DATABASE_PATH",
        os.path.join(INSTANCE_DIR, "lsd_database.db")
    )
)

app.config["SQLALCHEMY_DATABASE_URI"] = (
    "sqlite:///" + DATABASE_PATH
)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False



# ============================================================
# UPLOADS
# ============================================================

app.config["UPLOAD_FOLDER"] = os.path.abspath(
    os.getenv(
        "UPLOAD_FOLDER",
        os.path.join(BASE_DIR, "uploads")
    )
)

app.config["MAX_CONTENT_LENGTH"] = (
    16 * 1024 * 1024
)

os.makedirs(
    app.config["UPLOAD_FOLDER"],
    exist_ok=True
)


# ============================================================
# CORS
# ============================================================

# Em produção o frontend é servido pelo mesmo domínio da API,
# então CORS não é necessário. Para desenvolvimento local,
# liberamos apenas origens locais comuns.
if not IS_PRODUCTION:
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://127.0.0.1:5500",
                    "http://localhost:5500",
                    "http://127.0.0.1:8000",
                    "http://localhost:8000"
                ]
            }
        }
    )
else:
    cors_extra = [
        origem.strip()
        for origem in os.getenv("CORS_ORIGINS", "").split(",")
        if origem.strip()
    ]

    if cors_extra:
        CORS(
            app,
            resources={
                r"/api/*": {
                    "origins": cors_extra
                }
            }
        )


# ============================================================
# BANCO / MIGRATIONS
# ============================================================

db = SQLAlchemy(app)

migrate = Migrate(
    app,
    db
)


# ============================================================
# TIPOS DE ARQUIVO
# ============================================================

ALLOWED_IMAGE_EXTENSIONS = {
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif"
}


ALLOWED_ATTACHMENT_EXTENSIONS = (
    ALLOWED_IMAGE_EXTENSIONS
    |
    {
        "pdf",
        "txt",
        "md",
        "csv",
        "json",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
        "zip",
        "rar",
        "7z"
    }
)


# ============================================================
# FUNÇÕES DE UPLOAD
# ============================================================

def extensao_permitida(filename):

    if not filename:
        return False

    if "." not in filename:
        return False

    extensao = (
        filename
        .rsplit(".", 1)[1]
        .lower()
    )

    return (
        extensao
        in ALLOWED_IMAGE_EXTENSIONS
    )


def extensao_anexo_permitida(filename):

    if not filename:
        return False

    if "." not in filename:
        return False

    extensao = (
        filename
        .rsplit(".", 1)[1]
        .lower()
    )

    return (
        extensao
        in ALLOWED_ATTACHMENT_EXTENSIONS
    )


def salvar_arquivo(file_storage):
    """
    Salva uma imagem e retorna sua URL pública.
    """

    if not file_storage:
        return None

    if not file_storage.filename:
        return None

    if not extensao_permitida(
        file_storage.filename
    ):

        raise ValueError(
            "Formato de imagem não permitido."
        )

    nome_seguro = secure_filename(
        file_storage.filename
    )

    if not nome_seguro:
        nome_seguro = "imagem.jpg"

    extensao = (
        nome_seguro
        .rsplit(".", 1)[1]
        .lower()
    )

    nome_base = (
        nome_seguro
        .rsplit(".", 1)[0]
    )

    nome_unico = (
        f"{uuid.uuid4().hex}_"
        f"{nome_base}."
        f"{extensao}"
    )

    caminho = os.path.join(
        app.config["UPLOAD_FOLDER"],
        nome_unico
    )

    file_storage.save(
        caminho
    )

    return (
        f"/uploads/{nome_unico}"
    )


def salvar_anexo(file_storage):
    """
    Salva um anexo permitido.

    Retorna:
    (
        url,
        nome_original,
        mime
    )
    """

    if not file_storage:
        return None, None, None

    if not file_storage.filename:
        return None, None, None

    if not extensao_anexo_permitida(
        file_storage.filename
    ):

        raise ValueError(
            "Formato de arquivo não permitido."
        )

    nome_original = secure_filename(
        file_storage.filename
    )

    if not nome_original:
        nome_original = "arquivo"

    extensao = (
        nome_original
        .rsplit(".", 1)[1]
        .lower()
    )

    nome_base = (
        nome_original
        .rsplit(".", 1)[0]
    )

    nome_unico = (
        f"{uuid.uuid4().hex}_"
        f"{nome_base}."
        f"{extensao}"
    )

    caminho = os.path.join(
        app.config["UPLOAD_FOLDER"],
        nome_unico
    )

    file_storage.save(
        caminho
    )

    mime = (
        file_storage.mimetype
        or
        "application/octet-stream"
    )

    return (
        f"/uploads/{nome_unico}",
        nome_original,
        mime
    )


# ============================================================
# TRATAMENTO GLOBAL DE ERROS
# ============================================================

@app.errorhandler(400)
def erro_400(error):

    return jsonify({
        "success": False,
        "message":
            "Requisição inválida ou dados ausentes."
    }), 400


@app.errorhandler(401)
def erro_401(error):

    return jsonify({
        "success": False,
        "message":
            "Não autorizado."
    }), 401


@app.errorhandler(403)
def erro_403(error):

    return jsonify({
        "success": False,
        "message":
            "Você não possui permissão para realizar esta ação."
    }), 403


@app.errorhandler(404)
def erro_404(error):

    return jsonify({
        "success": False,
        "message":
            "Recurso ou rota não encontrada."
    }), 404


@app.errorhandler(405)
def erro_405(error):

    return jsonify({
        "success": False,
        "message":
            "Método HTTP não permitido."
    }), 405


@app.errorhandler(413)
def erro_413(error):

    return jsonify({
        "success": False,
        "message":
            "O arquivo enviado excede o limite de 16MB."
    }), 413


@app.errorhandler(500)
def erro_500(error):

    print(
        "ERRO INTERNO:",
        repr(error)
    )

    return jsonify({
        "success": False,
        "message":
            "Erro interno do servidor."
    }), 500


# ============================================================
# MODELO USER
# ============================================================

class User(db.Model):

    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    nome = db.Column(
        db.String(100),
        nullable=False
    )

    email = db.Column(
        db.String(120),
        unique=True,
        nullable=False
    )

    senha_hash = db.Column(
        db.String(255),
        nullable=False
    )

    funcao = db.Column(
        db.String(100),
        default="Membro LSD"
    )

    bio = db.Column(
        db.Text,
        default=""
    )

    localizacao = db.Column(
        db.String(100),
        default="Maranguape, CE"
    )

    github = db.Column(
        db.String(150),
        default=""
    )

    instagram = db.Column(
        db.String(150),
        default=""
    )

    # Lista JSON com linguagens/tecnologias escolhidas pelo membro.
    # Mantemos como TEXT para preservar compatibilidade com SQLite
    # e facilitar migrações de bancos já existentes.
    linguagens = db.Column(
        db.Text,
        default="[]",
        nullable=False
    )

    foto = db.Column(
        db.String(255),
        default="/uploads/default-avatar.png"
    )

    capa = db.Column(
        db.String(255),
        default="/uploads/default-capa.jpg"
    )

    data_entrada = db.Column(
        db.String(30),
        default="Set 2026"
    )

    projetos_ativos = db.Column(
        db.Integer,
        default=0
    )

    pontos = db.Column(
        db.Integer,
        default=0
    )

    is_admin = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    # Marca o último momento em que o membro criou um card.
    # No cadastro começa com a data da criação da conta para que a
    # conquista "Preguiçoso" só possa surgir após 14 dias completos.
    ultimo_card_criado_em = db.Column(
        db.DateTime,
        nullable=True
    )


    def linguagens_lista(self):
        """Retorna as tecnologias do perfil sempre como uma lista segura."""
        try:
            valor = json.loads(self.linguagens or "[]")
            if isinstance(valor, list):
                return [str(item).strip() for item in valor if str(item).strip()]
        except (TypeError, ValueError, json.JSONDecodeError):
            pass
        return []


    def to_dict(self):

        return {

            "id":
                self.id,

            "nome":
                self.nome,

            "email":
                self.email,

            "funcao":
                self.funcao or "",

            "bio":
                self.bio or "",

            "localizacao":
                self.localizacao or "",

            "github":
                self.github or "",

            "instagram":
                self.instagram or "",

            "linguagens":
                self.linguagens_lista(),

            "foto":
                self.foto,

            "capa":
                self.capa,

            "data_entrada":
                self.data_entrada,

            "projetos_ativos":
                self.projetos_ativos or 0,

            "pontos":
                self.pontos or 0,

            "is_admin":
                bool(self.is_admin),

            "ultimo_card_criado_em":
                (
                    self.ultimo_card_criado_em.isoformat()
                    if self.ultimo_card_criado_em
                    else None
                )

        }


# ============================================================
# MODELO POST
# ============================================================

class Post(db.Model):

    __tablename__ = "posts"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    conteudo = db.Column(
        db.Text,
        nullable=True
    )

    midia_url = db.Column(
        db.String(255),
        nullable=True
    )

    arquivo_url = db.Column(
        db.String(255),
        nullable=True
    )

    arquivo_nome = db.Column(
        db.String(255),
        nullable=True
    )

    arquivo_mime = db.Column(
        db.String(120),
        nullable=True
    )

    codigo_snippet = db.Column(
        db.Text,
        nullable=True
    )

    codigo_linguagem = db.Column(
        db.String(50),
        nullable=True
    )

    data_criacao = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )


    autor = db.relationship(
        "User",
        backref="posts"
    )


    comentarios = db.relationship(
        "PostComment",
        backref="post",
        cascade="all, delete-orphan",
        order_by="PostComment.data_criacao.asc()"
    )


    curtidas = db.relationship(
        "PostLike",
        backref="post",
        cascade="all, delete-orphan"
    )


    def to_dict(
        self,
        current_user_id=None
    ):

        return {

            "id":
                self.id,

            "conteudo":
                self.conteudo or "",

            "midia_url":
                self.midia_url,

            "arquivo_url":
                self.arquivo_url,

            "arquivo_nome":
                self.arquivo_nome,

            "arquivo_mime":
                self.arquivo_mime,

            "codigo_snippet":
                self.codigo_snippet or "",

            "codigo_linguagem":
                self.codigo_linguagem
                or
                "texto",

            "data_criacao":
                self.data_criacao.isoformat()
                if self.data_criacao
                else None,

            "autor": {

                "id":
                    self.autor.id,

                "nome":
                    self.autor.nome,

                "foto":
                    self.autor.foto,

                "funcao":
                    self.autor.funcao

            }
            if self.autor
            else None,

            "comentarios": [
                comentario.to_dict()
                for comentario
                in self.comentarios
            ],

            "total_comentarios":
                len(
                    self.comentarios
                ),

            "total_curtidas":
                len(
                    self.curtidas
                ),

            "curtido_por_mim":
                any(
                    like.user_id
                    ==
                    current_user_id

                    for like
                    in self.curtidas
                )
                if current_user_id
                else False

        }


# ============================================================
# MODELO COMENTÁRIO
# ============================================================

class PostComment(db.Model):

    __tablename__ = "post_comments"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    post_id = db.Column(
        db.Integer,
        db.ForeignKey("posts.id"),
        nullable=False,
        index=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    conteudo = db.Column(
        db.Text,
        nullable=False
    )

    data_criacao = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    autor = db.relationship(
        "User"
    )


    def to_dict(self):

        return {

            "id":
                self.id,

            "post_id":
                self.post_id,

            "conteudo":
                self.conteudo,

            "data_criacao":
                self.data_criacao.isoformat()
                if self.data_criacao
                else None,

            "autor": {

                "id":
                    self.autor.id,

                "nome":
                    self.autor.nome,

                "foto":
                    self.autor.foto

            }
            if self.autor
            else None

        }


# ============================================================
# MODELO CURTIDA
# ============================================================

class PostLike(db.Model):

    __tablename__ = "post_likes"

    __table_args__ = (
        db.UniqueConstraint(
            "post_id",
            "user_id",
            name="uq_post_like"
        ),
    )

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    post_id = db.Column(
        db.Integer,
        db.ForeignKey("posts.id"),
        nullable=False,
        index=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    data_criacao = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )


# ============================================================
# MODELO ADVERTÊNCIA
# ============================================================

class Advertencia(db.Model):

    __tablename__ = "advertencias"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    membro_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    admin_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    motivo = db.Column(
        db.Text,
        nullable=False
    )

    data_criacao = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    lida = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    data_leitura = db.Column(
        db.DateTime,
        nullable=True
    )

    membro = db.relationship(
        "User",
        foreign_keys=[membro_id],
        backref=db.backref(
            "advertencias_recebidas",
            lazy=True
        )
    )

    admin = db.relationship(
        "User",
        foreign_keys=[admin_id],
        backref=db.backref(
            "advertencias_emitidas",
            lazy=True
        )
    )

    def to_dict(self):

        return {
            "id": self.id,
            "membro_id": self.membro_id,
            "admin_id": self.admin_id,
            "motivo": self.motivo,
            "lida": bool(self.lida),
            "data_criacao": (
                self.data_criacao.isoformat()
                if self.data_criacao
                else None
            ),
            "data_leitura": (
                self.data_leitura.isoformat()
                if self.data_leitura
                else None
            ),
            "admin": {
                "id": self.admin.id,
                "nome": self.admin.nome
            } if self.admin else {
                "id": None,
                "nome": "Administração LSD"
            }
        }


# ============================================================
# MODELOS DE CONQUISTAS
# ============================================================

class Achievement(db.Model):
    """Catálogo de conquistas. A lógica de desbloqueio pode ser adicionada depois."""

    __tablename__ = "achievements"

    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(80), unique=True, nullable=False)
    nome = db.Column(db.String(120), nullable=False)
    descricao = db.Column(db.String(300), default="")
    icone = db.Column(db.String(255), default="")
    raridade = db.Column(db.String(30), default="comum")

    def to_dict(self):
        return {
            "id": self.id,
            "codigo": self.codigo,
            "nome": self.nome,
            "descricao": self.descricao or "",
            "icone": self.icone or "",
            "raridade": self.raridade or "comum"
        }


class UserAchievement(db.Model):
    """Relaciona uma conquista a um membro sem implementar o desbloqueio automático."""

    __tablename__ = "user_achievements"
    __table_args__ = (
        db.UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    achievement_id = db.Column(db.Integer, db.ForeignKey("achievements.id"), nullable=False, index=True)
    data_conquista = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    conquista = db.relationship("Achievement")

    def to_dict(self):
        dados = self.conquista.to_dict() if self.conquista else {}
        dados["data_conquista"] = (
            self.data_conquista.isoformat() if self.data_conquista else None
        )
        return dados


# ============================================================
# MODELO CARD
# ============================================================

class Card(db.Model):

    __tablename__ = "cards"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    titulo = db.Column(
        db.String(120),
        nullable=False
    )

    descricao = db.Column(
        db.Text,
        nullable=True
    )

    status = db.Column(
        db.String(20),
        default="afazer",
        nullable=False
    )

    cor = db.Column(
        db.String(20),
        default="amarelo"
    )

    prioridade = db.Column(
        db.String(20),
        default="media"
    )

    responsavel_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True
    )

    # Quem criou o card. É diferente do responsável que assumiu a tarefa.
    criador_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    data_criacao = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=True
    )

    pontuacao_concedida = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    responsavel = db.relationship(
        "User",
        foreign_keys=[responsavel_id],
        backref="cards"
    )

    criador = db.relationship(
        "User",
        foreign_keys=[criador_id],
        backref="cards_criados"
    )


    def to_dict(self):

        return {

            "id":
                self.id,

            "titulo":
                self.titulo,

            "descricao":
                self.descricao or "",

            "status":
                self.status,

            "cor":
                self.cor,

            "prioridade":
                self.prioridade,

            "responsavel_id":
                self.responsavel_id,

            "criador_id":
                self.criador_id,

            "data_criacao":
                (
                    self.data_criacao.isoformat()
                    if self.data_criacao
                    else None
                ),

            "responsavel": {

                "id":
                    self.responsavel.id,

                "nome":
                    self.responsavel.nome,

                "foto":
                    self.responsavel.foto

            }
            if self.responsavel
            else None,

            "pontuacao_concedida":
                bool(
                    self.pontuacao_concedida
                )

        }



# ============================================================
# SISTEMA DE CONQUISTAS
# ============================================================

CONQUISTAS_PADRAO = [
    {
        "codigo": "bem_vindo",
        "nome": "Bem Vindo!",
        "descricao": "Entrou na sua conta e passou a fazer parte da comunidade LSD.",
        "icone": "/src/images/conquistas/bem_vindo.png",
        "raridade": "comum"
    },
    {
        "codigo": "100_pontos",
        "nome": "100 pontos",
        "descricao": "Alcançou 100 pontos no quadro Kanban.",
        "icone": "/src/images/conquistas/100_pontos.png",
        "raridade": "bronze"
    },
    {
        "codigo": "300_pontos",
        "nome": "300 pontos",
        "descricao": "Alcançou 300 pontos no quadro Kanban.",
        "icone": "/src/images/conquistas/300_pontos.png",
        "raridade": "prata"
    },
    {
        "codigo": "500_pontos",
        "nome": "500 pontos",
        "descricao": "Alcançou 500 pontos no quadro Kanban.",
        "icone": "/src/images/conquistas/500_pontos.png",
        "raridade": "ouro"
    },
    {
        "codigo": "1000_pontos",
        "nome": "1000 pontos",
        "descricao": "Alcançou 1000 pontos no quadro Kanban.",
        "icone": "/src/images/conquistas/1000_pontos.png",
        "raridade": "diamante"
    },
    {
        "codigo": "comentarista",
        "nome": "Comentarista",
        "descricao": "Publicou pelo menos 30 comentários no Feed da Comunidade.",
        "icone": "/src/images/conquistas/comentarista.png",
        "raridade": "comum"
    },
    {
        "codigo": "criador_cards",
        "nome": "Criador de Cards",
        "descricao": "Criou pelo menos 30 cards no quadro Kanban.",
        "icone": "/src/images/conquistas/criador_cards.png",
        "raridade": "comum"
    },
    {
        "codigo": "preguicoso",
        "nome": "Preguiçoso",
        "descricao": "Passou 2 semanas completas sem criar um novo card.",
        "icone": "/src/images/conquistas/preguicoso.png",
        "raridade": "especial"
    },
    {
        "codigo": "sempre_confusao",
        "nome": "Sempre em confusão",
        "descricao": "Recebeu 3 advertências da administração.",
        "icone": "/src/images/conquistas/sempre_confusao.png",
        "raridade": "especial"
    }
]


def garantir_catalogo_conquistas():
    """Cria/atualiza o catálogo fixo de conquistas sem apagar desbloqueios."""
    alterado = False

    for item in CONQUISTAS_PADRAO:
        conquista = Achievement.query.filter_by(
            codigo=item["codigo"]
        ).first()

        if not conquista:
            conquista = Achievement(**item)
            db.session.add(conquista)
            alterado = True
            continue

        for campo in ("nome", "descricao", "icone", "raridade"):
            novo_valor = item[campo]
            if getattr(conquista, campo) != novo_valor:
                setattr(conquista, campo, novo_valor)
                alterado = True

    if alterado:
        db.session.commit()


def verificar_conquistas(usuario):
    """
    Confere os requisitos atuais e grava apenas as conquistas que ainda
    não pertencem ao membro. Pode ser executada várias vezes com segurança.
    """
    if not usuario:
        return []

    garantir_catalogo_conquistas()

    desbloqueadas = {
        item.conquista.codigo
        for item in UserAchievement.query.filter_by(
            user_id=usuario.id
        ).all()
        if item.conquista
    }

    pontos = int(usuario.pontos or 0)
    total_comentarios = PostComment.query.filter_by(
        user_id=usuario.id
    ).count()

    total_cards_criados = Card.query.filter_by(
        criador_id=usuario.id
    ).count()

    total_advertencias = Advertencia.query.filter_by(
        membro_id=usuario.id
    ).count()

    referencia_preguica = usuario.ultimo_card_criado_em
    passou_duas_semanas = bool(
        referencia_preguica
        and datetime.utcnow() >= referencia_preguica + timedelta(days=14)
    )

    requisitos = {
        "bem_vindo": True,
        "100_pontos": pontos >= 100,
        "300_pontos": pontos >= 300,
        "500_pontos": pontos >= 500,
        "1000_pontos": pontos >= 1000,
        "comentarista": total_comentarios >= 30,
        "criador_cards": total_cards_criados >= 30,
        "preguicoso": passou_duas_semanas,
        "sempre_confusao": total_advertencias >= 3
    }

    novas = []

    for codigo, cumpriu in requisitos.items():
        if not cumpriu or codigo in desbloqueadas:
            continue

        conquista = Achievement.query.filter_by(
            codigo=codigo
        ).first()

        if not conquista:
            continue

        vinculo = UserAchievement(
            user_id=usuario.id,
            achievement_id=conquista.id
        )
        db.session.add(vinculo)
        novas.append(codigo)

    if novas:
        db.session.commit()

    ordem = [item["codigo"] for item in CONQUISTAS_PADRAO]

    registros = (
        UserAchievement.query
        .filter_by(user_id=usuario.id)
        .all()
    )

    registros.sort(
        key=lambda registro: (
            ordem.index(registro.conquista.codigo)
            if registro.conquista and registro.conquista.codigo in ordem
            else 999
        )
    )

    return registros


# ============================================================
# JWT
# ============================================================

def criar_token(user):

    payload = {

        "user_id":
            user.id,

        "exp":
            datetime.utcnow()
            +
            timedelta(days=7)

    }

    return jwt.encode(
        payload,
        app.config["SECRET_KEY"],
        algorithm="HS256"
    )


# ============================================================
# TOKEN REQUIRED
# ============================================================

def token_required(f):

    @wraps(f)
    def decorated(
        *args,
        **kwargs
    ):

        auth_header = (
            request.headers.get(
                "Authorization",
                ""
            )
            .strip()
        )


        if not auth_header:

            return jsonify({
                "success": False,
                "message":
                    "Token de autenticação ausente."
            }), 401


        partes = auth_header.split(
            " ",
            1
        )


        if (
            len(partes) != 2
            or
            partes[0].lower()
            !=
            "bearer"
        ):

            return jsonify({
                "success": False,
                "message":
                    "Formato de autenticação inválido."
            }), 401


        token = partes[1].strip()


        if (
            not token
            or
            token in (
                "null",
                "undefined"
            )
        ):

            return jsonify({
                "success": False,
                "message":
                    "Token inválido."
            }), 401


        try:

            dados = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"]
            )


            user_id = dados.get(
                "user_id"
            )


            if not user_id:

                return jsonify({
                    "success": False,
                    "message":
                        "Token inválido."
                }), 401


            current_user = (
                db.session.get(
                    User,
                    int(user_id)
                )
            )


            if not current_user:

                return jsonify({
                    "success": False,
                    "message":
                        "Usuário associado ao token não existe."
                }), 401


        except jwt.ExpiredSignatureError:

            return jsonify({
                "success": False,
                "message":
                    "Sessão expirada. Faça login novamente."
            }), 401


        except jwt.InvalidTokenError:

            return jsonify({
                "success": False,
                "message":
                    "Token de autenticação inválido."
            }), 401


        except Exception as erro:

            print(
                "ERRO JWT:",
                repr(erro)
            )

            return jsonify({
                "success": False,
                "message":
                    "Não foi possível validar a autenticação."
            }), 401


        return f(
            current_user,
            *args,
            **kwargs
        )


    return decorated


# ============================================================
# ADMIN REQUIRED
# ============================================================

def admin_required(f):
    """
    Exige:
    1. JWT válido
    2. Usuário existente
    3. is_admin == True
    """

    @wraps(f)
    @token_required
    def decorated(
        current_user,
        *args,
        **kwargs
    ):

        if not bool(
            current_user.is_admin
        ):

            return jsonify({
                "success": False,
                "message":
                    "Acesso negado. Esta função é exclusiva para administradores."
            }), 403


        return f(
            current_user,
            *args,
            **kwargs
        )


    return decorated


# ============================================================
# GARANTIR ADMIN PRINCIPAL
# ============================================================

def garantir_admin_principal():
    """
    Sempre que o servidor inicia:

    - procura a conta do administrador principal;
    - se existir e is_admin estiver False, altera para True;
    - impede depender de edição manual no SQLite.
    """

    admin_email = (
        app.config[
            "ADMIN_EMAIL"
        ]
        .strip()
        .lower()
    )


    usuario = (
        User.query
        .filter(
            db.func.lower(
                User.email
            )
            ==
            admin_email
        )
        .first()
    )


    if not usuario:

        print(
            "[ADMIN] A conta principal ainda não existe:"
        )

        print(
            f"[ADMIN] {admin_email}"
        )

        return


    alterado = False


    if not usuario.is_admin:

        usuario.is_admin = True
        alterado = True


    # Garante que o e-mail continue normalizado.
    if (
        usuario.email
        !=
        admin_email
    ):

        usuario.email = admin_email
        alterado = True


    if alterado:

        try:

            db.session.commit()

            print(
                "[ADMIN] Administrador principal configurado:"
            )

            print(
                f"[ADMIN] {usuario.email}"
            )

        except Exception as erro:

            db.session.rollback()

            print(
                "[ADMIN] Erro ao promover administrador:",
                repr(erro)
            )

    else:

        print(
            "[ADMIN] Administrador confirmado:"
        )

        print(
            f"[ADMIN] {usuario.email}"
        )



# ============================================================
# BACKUPS AUTOMÁTICOS
# ============================================================

BACKUP_FOLDER = os.path.abspath(
    os.getenv(
        "BACKUP_FOLDER",
        os.path.join(BASE_DIR, "backups")
    )
)

BACKUP_RETENTION = max(
    1,
    int(os.getenv("BACKUP_RETENTION", "5"))
)

BACKUP_TIMEZONE = os.getenv(
    "BACKUP_TIMEZONE",
    "America/Fortaleza"
).strip()

BACKUP_MARKER_PATH = os.path.join(
    BACKUP_FOLDER,
    ".ultimo_backup_diario"
)

_backup_lock = threading.Lock()

os.makedirs(
    BACKUP_FOLDER,
    exist_ok=True
)


def _agora_backup():
    try:
        return datetime.now(
            ZoneInfo(BACKUP_TIMEZONE)
        )
    except Exception:
        return datetime.utcnow()


def _listar_backups():
    arquivos = []

    if not os.path.isdir(BACKUP_FOLDER):
        return arquivos

    for nome in os.listdir(BACKUP_FOLDER):
        if not (
            nome.startswith("lsd_backup_")
            and nome.endswith(".zip")
        ):
            continue

        caminho = os.path.join(
            BACKUP_FOLDER,
            nome
        )

        if not os.path.isfile(caminho):
            continue

        stat = os.stat(caminho)

        arquivos.append({
            "nome": nome,
            "tamanho_bytes": stat.st_size,
            "modificado_em": datetime.fromtimestamp(
                stat.st_mtime
            ).isoformat()
        })

    arquivos.sort(
        key=lambda item: item["modificado_em"],
        reverse=True
    )

    return arquivos


def _aplicar_retencao_backups():
    backups = _listar_backups()

    for item in backups[BACKUP_RETENTION:]:
        caminho = os.path.join(
            BACKUP_FOLDER,
            item["nome"]
        )

        try:
            os.remove(caminho)
        except OSError:
            pass


def criar_backup(
    origem="manual"
):
    """
    Cria um snapshot consistente do SQLite e inclui uploads.

    O SQLite é copiado usando sqlite3.Connection.backup(),
    evitando copiar diretamente um arquivo que esteja sendo
    escrito naquele momento.
    """

    with _backup_lock:

        os.makedirs(
            BACKUP_FOLDER,
            exist_ok=True
        )

        agora = _agora_backup()

        timestamp = agora.strftime(
            "%Y%m%d_%H%M%S"
        )

        nome_backup = (
            f"lsd_backup_{origem}_{timestamp}.zip"
        )

        caminho_backup = os.path.join(
            BACKUP_FOLDER,
            nome_backup
        )

        temp_db = os.path.join(
            BACKUP_FOLDER,
            f".snapshot_{uuid.uuid4().hex}.sqlite3"
        )

        try:
            # Snapshot consistente do SQLite.
            origem_db = sqlite3.connect(
                DATABASE_PATH,
                timeout=30
            )

            destino_db = sqlite3.connect(
                temp_db
            )

            try:
                origem_db.backup(
                    destino_db
                )
            finally:
                destino_db.close()
                origem_db.close()

            metadados = {
                "versao": "2.3.2",
                "criado_em": agora.isoformat(),
                "timezone": BACKUP_TIMEZONE,
                "origem": origem,
                "database": "database/lsd_database.db",
                "uploads": "uploads/"
            }

            with zipfile.ZipFile(
                caminho_backup,
                "w",
                compression=zipfile.ZIP_DEFLATED,
                compresslevel=6
            ) as zipf:

                zipf.write(
                    temp_db,
                    arcname="database/lsd_database.db"
                )

                upload_folder = app.config[
                    "UPLOAD_FOLDER"
                ]

                if os.path.isdir(
                    upload_folder
                ):
                    for raiz, _, arquivos in os.walk(
                        upload_folder
                    ):
                        for arquivo in arquivos:
                            caminho = os.path.join(
                                raiz,
                                arquivo
                            )

                            relativo = os.path.relpath(
                                caminho,
                                upload_folder
                            )

                            zipf.write(
                                caminho,
                                arcname=os.path.join(
                                    "uploads",
                                    relativo
                                )
                            )

                zipf.writestr(
                    "backup.json",
                    json.dumps(
                        metadados,
                        ensure_ascii=False,
                        indent=2
                    )
                )

            _aplicar_retencao_backups()

            return {
                "success": True,
                "nome": nome_backup,
                "caminho": caminho_backup,
                "tamanho_bytes": os.path.getsize(
                    caminho_backup
                ),
                "criado_em": agora.isoformat(),
                "origem": origem
            }

        finally:
            if os.path.exists(
                temp_db
            ):
                try:
                    os.remove(
                        temp_db
                    )
                except OSError:
                    pass


def garantir_backup_diario():
    """
    PythonAnywhere Beginner não oferece Scheduled Tasks para
    novas contas em 2026. Por isso o backup diário é "lazy":
    a primeira visita do dia cria o backup.

    Se não houver nenhuma visita em um dia, não há alterações
    novas a proteger naquele período.
    """

    hoje = _agora_backup().date().isoformat()

    try:
        if os.path.exists(
            BACKUP_MARKER_PATH
        ):
            ultimo = (
                open(
                    BACKUP_MARKER_PATH,
                    "r",
                    encoding="utf-8"
                )
                .read()
                .strip()
            )

            if ultimo == hoje:
                return None
    except OSError:
        pass

    with _backup_lock:
        # Verifica novamente após obter o lock.
        try:
            if os.path.exists(
                BACKUP_MARKER_PATH
            ):
                ultimo = (
                    open(
                        BACKUP_MARKER_PATH,
                        "r",
                        encoding="utf-8"
                    )
                    .read()
                    .strip()
                )

                if ultimo == hoje:
                    return None
        except OSError:
            pass

    # criar_backup já possui seu próprio lock; chamamos fora do
    # bloco anterior para não adquirir o mesmo lock duas vezes.
    resultado = criar_backup(
        "diario"
    )

    try:
        with open(
            BACKUP_MARKER_PATH,
            "w",
            encoding="utf-8"
        ) as arquivo:
            arquivo.write(
                hoje
            )
    except OSError as erro:
        print(
            "[BACKUP] Não foi possível gravar marcador:",
            repr(erro)
        )

    print(
        "[BACKUP] Backup diário criado:",
        resultado["nome"]
    )

    return resultado


@app.before_request
def verificar_backup_automatico():
    # Evita criar backup durante a própria transferência de um
    # arquivo de backup e reduz verificações em assets estáticos.
    if (
        request.path.startswith("/src/")
        or request.path.startswith("/uploads/")
        or request.path.startswith("/api/admin/backups/")
    ):
        return None

    try:
        garantir_backup_diario()
    except Exception as erro:
        # Falha de backup não derruba o site.
        print(
            "[BACKUP] Falha no backup automático:",
            repr(erro)
        )

    return None



# ============================================================
# API STATUS
# ============================================================

@app.route(
    "/",
    methods=["GET"]
)
def index():
    return send_from_directory(
        PROJECT_ROOT,
        "index.html"
    )


@app.route(
    "/<path:pagina>",
    methods=["GET"]
)
def paginas_frontend(pagina):
    """
    Serve somente páginas HTML conhecidas.
    Assets em /src possuem uma rota separada.
    """

    paginas = {
        "index.html",
        "dashboard.html",
        "entrar-login.html",
        "login.html",
        "recuperar-senha.html"
    }

    if pagina not in paginas:
        return jsonify({
            "success": False,
            "message": "Página não encontrada."
        }), 404

    return send_from_directory(
        PROJECT_ROOT,
        pagina
    )


@app.route(
    "/src/<path:filename>",
    methods=["GET"]
)
def serve_src(filename):
    return send_from_directory(
        os.path.join(
            PROJECT_ROOT,
            "src"
        ),
        filename
    )


@app.route(
    "/api/status",
    methods=["GET"]
)
def api_status():

    return jsonify({
        "success": True,
        "message":
            "Servidor funcionando.",
        "status":
            "online"
    }), 200


# ============================================================
# CADASTRO
# ============================================================

@app.route(
    "/api/register",
    methods=["POST"]
)
@app.route(
    "/api/cadastro",
    methods=["POST"]
)
def register():

    try:

        # ====================================================
        # JSON OU FORMDATA
        # ====================================================

        if request.is_json:

            data = (
                request.get_json(
                    silent=True
                )
                or {}
            )

            foto_file = None

        else:

            data = request.form

            foto_file = (
                request.files.get(
                    "foto"
                )
                or
                request.files.get(
                    "avatar"
                )
            )


        # ====================================================
        # DADOS
        # ====================================================

        nome = str(
            data.get(
                "nome",
                ""
            )
        ).strip()


        email = str(
            data.get(
                "email",
                ""
            )
        ).strip().lower()


        senha = str(
            data.get(
                "senha",
                ""
            )
        )


        funcao = str(
            data.get(
                "funcao",
                "Membro LSD"
            )
        ).strip()


        bio = str(
            data.get(
                "bio",
                ""
            )
        ).strip()


        github = str(
            data.get(
                "github",
                ""
            )
        ).strip()


        instagram = str(
            data.get(
                "instagram",
                ""
            )
        ).strip()


        codigo_acesso = str(
            data.get(
                "codigo_acesso",
                ""
            )
        ).strip()


        # ====================================================
        # VALIDAÇÃO DO CÓDIGO DE ACESSO
        # ====================================================

        if (
            codigo_acesso
            !=
            app.config["ACCESS_CODE"]
        ):

            return jsonify({
                "success": False,
                "message":
                    "Código de acesso da equipe inválido."
            }), 403


        # ====================================================
        # VALIDAÇÕES
        # ====================================================

        if not nome:

            return jsonify({
                "success": False,
                "message":
                    "Informe seu nome."
            }), 400


        if not email:

            return jsonify({
                "success": False,
                "message":
                    "Informe seu e-mail."
            }), 400


        if not senha:

            return jsonify({
                "success": False,
                "message":
                    "Informe uma senha."
            }), 400


        if len(senha) < 8:

            return jsonify({
                "success": False,
                "message":
                    "A senha deve possuir pelo menos 8 caracteres."
            }), 400


        # ====================================================
        # E-MAIL DUPLICADO
        # ====================================================

        existente = (
            User.query
            .filter(
                db.func.lower(
                    User.email
                )
                ==
                email
            )
            .first()
        )


        if existente:

            return jsonify({
                "success": False,
                "message":
                    "Este e-mail já está cadastrado."
            }), 409


        # ====================================================
        # ADMIN
        # ====================================================

        # O navegador não escolhe se alguém é admin.
        # Apenas o e-mail configurado abaixo nasce como
        # administrador principal.

        eh_admin = (
            email
            ==
            app.config[
                "ADMIN_EMAIL"
            ].lower()
        )


        # ====================================================
        # FOTO
        # ====================================================

        foto_path = (
            "/uploads/default-avatar.png"
        )


        if (
            foto_file
            and
            foto_file.filename
        ):

            foto_path = salvar_arquivo(
                foto_file
            )


        # ====================================================
        # CRIA USUÁRIO
        # ====================================================

        novo_usuario = User(

            nome=nome,

            email=email,

            senha_hash=
                generate_password_hash(
                    senha
                ),

            funcao=
                funcao
                or
                "Membro LSD",

            bio=bio,

            github=github,

            instagram=instagram,

            foto=foto_path,

            is_admin=eh_admin,

            ultimo_card_criado_em=datetime.utcnow()

        )


        db.session.add(
            novo_usuario
        )

        db.session.commit()

        # O cadastro já autentica o usuário; portanto ele recebe
        # imediatamente a conquista de boas-vindas.
        verificar_conquistas(novo_usuario)


        token = criar_token(
            novo_usuario
        )


        return jsonify({

            "success":
                True,

            "message":
                "Conta criada com sucesso!",

            "token":
                token,

            "usuario":
                novo_usuario.to_dict()

        }), 201


    except ValueError as erro:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message":
                str(erro)
        }), 400


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO NO CADASTRO:",
            repr(erro)
        )


        return jsonify({
            "success": False,
            "message":
                "Erro ao registrar usuário no banco de dados."
        }), 500


# ============================================================
# LOGIN
# ============================================================

@app.route(
    "/api/login",
    methods=["POST"]
)
def login():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    email = str(
        data.get(
            "email",
            ""
        )
    ).strip().lower()


    senha = str(
        data.get(
            "senha",
            ""
        )
    )


    if (
        not email
        or
        not senha
    ):

        return jsonify({
            "success": False,
            "message":
                "Preencha o e-mail e a senha."
        }), 400


    user = (
        User.query
        .filter(
            db.func.lower(
                User.email
            )
            ==
            email
        )
        .first()
    )


    if not user:

        return jsonify({
            "success": False,
            "message":
                "E-mail ou senha incorretos."
        }), 401


    if not check_password_hash(
        user.senha_hash,
        senha
    ):

        return jsonify({
            "success": False,
            "message":
                "E-mail ou senha incorretos."
        }), 401


    # ========================================================
    # PROTEÇÃO EXTRA DO ADMIN PRINCIPAL
    # ========================================================

    if (
        user.email.lower()
        ==
        app.config[
            "ADMIN_EMAIL"
        ].lower()
        and
        not user.is_admin
    ):

        user.is_admin = True

        try:

            db.session.commit()

        except Exception:

            db.session.rollback()


    # Reavalia as conquistas a cada login. Isso também cobre
    # requisitos baseados em tempo, pontos, comentários e advertências.
    verificar_conquistas(user)

    token = criar_token(
        user
    )


    return jsonify({

        "success":
            True,

        "message":
            "Login realizado com sucesso.",

        "token":
            token,

        "usuario":
            user.to_dict()

    }), 200


# ============================================================
# USUÁRIO ATUAL
# ============================================================

@app.route(
    "/api/me",
    methods=["GET"]
)
@token_required
def obter_usuario_atual(
    current_user
):

    return jsonify({

        "success":
            True,

        "usuario":
            current_user.to_dict()

    }), 200


# ============================================================
# PERFIL
# ============================================================

@app.route(
    "/api/perfil",
    methods=[
        "GET",
        "PUT"
    ]
)
@token_required
def perfil(
    current_user
):

    # ========================================================
    # GET
    # ========================================================

    if request.method == "GET":

        return jsonify(
            current_user.to_dict()
        ), 200


    # ========================================================
    # PUT
    # ========================================================

    if request.is_json:

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

    else:

        data = request.form


    # ========================================================
    # NOME
    # ========================================================

    if "nome" in data:

        nome = str(
            data.get(
                "nome",
                ""
            )
        ).strip()

        if nome:
            current_user.nome = nome


    # ========================================================
    # EMAIL
    # ========================================================

    if "email" in data:

        novo_email = str(
            data.get(
                "email",
                ""
            )
        ).strip().lower()


        if not novo_email:

            return jsonify({
                "success": False,
                "message":
                    "O e-mail não pode ficar vazio."
            }), 400


        # O administrador principal não pode alterar
        # o e-mail que o identifica como administrador.
        if (
            current_user.email.lower()
            ==
            app.config[
                "ADMIN_EMAIL"
            ].lower()
            and
            novo_email
            !=
            app.config[
                "ADMIN_EMAIL"
            ].lower()
        ):

            return jsonify({
                "success": False,
                "message":
                    "O e-mail do administrador principal não pode ser alterado."
            }), 403


        if (
            novo_email
            !=
            current_user.email.lower()
        ):

            existente = (
                User.query
                .filter(
                    db.func.lower(
                        User.email
                    )
                    ==
                    novo_email
                )
                .first()
            )


            if existente:

                return jsonify({
                    "success": False,
                    "message":
                        "Este e-mail já está em uso."
                }), 400


            current_user.email = (
                novo_email
            )


    # ========================================================
    # DEMAIS CAMPOS
    # ========================================================

    if "funcao" in data:

        current_user.funcao = str(
            data.get(
                "funcao",
                ""
            )
        )


    if "bio" in data:

        current_user.bio = str(
            data.get(
                "bio",
                ""
            )
        )


    if "localizacao" in data:

        current_user.localizacao = str(
            data.get(
                "localizacao",
                ""
            )
        )


    if "github" in data:

        current_user.github = str(
            data.get(
                "github",
                ""
            )
        )


    if "instagram" in data:

        current_user.instagram = str(
            data.get(
                "instagram",
                ""
            )
        )


    # Linguagens/tecnologias: JSON aceita lista; FormData aceita múltiplos
    # checkboxes com o mesmo nome (linguagens).
    if request.is_json:
        if "linguagens" in data:
            linguagens_recebidas = data.get("linguagens") or []
        else:
            linguagens_recebidas = None
    else:
        linguagens_recebidas = request.form.getlist("linguagens")

    if linguagens_recebidas is not None:
        if not isinstance(linguagens_recebidas, list):
            linguagens_recebidas = [linguagens_recebidas]

        linguagens_limpas = []
        for linguagem in linguagens_recebidas:
            nome_linguagem = str(linguagem).strip()[:40]
            if nome_linguagem and nome_linguagem not in linguagens_limpas:
                linguagens_limpas.append(nome_linguagem)

        # Evita perfis com centenas de tags enviadas manualmente.
        current_user.linguagens = json.dumps(
            linguagens_limpas[:20],
            ensure_ascii=False
        )


    avatar = (
        request.files.get(
            "avatar"
        )
        or
        request.files.get(
            "foto"
        )
    )


    capa = request.files.get(
        "capa"
    )


    try:

        if (
            avatar
            and
            avatar.filename
        ):

            current_user.foto = (
                salvar_arquivo(
                    avatar
                )
            )


        if (
            capa
            and
            capa.filename
        ):

            current_user.capa = (
                salvar_arquivo(
                    capa
                )
            )


        # O administrador principal continua admin.
        if (
            current_user.email.lower()
            ==
            app.config[
                "ADMIN_EMAIL"
            ].lower()
        ):

            current_user.is_admin = True


        db.session.commit()


        return jsonify({

            "success":
                True,

            "message":
                "Perfil atualizado com sucesso!",

            "usuario":
                current_user.to_dict()

        }), 200


    except ValueError as erro:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message":
                str(erro)
        }), 400


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO PERFIL:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Erro ao atualizar o perfil."
        }), 500


# ============================================================
# CARDS - LISTAR / CRIAR
# ============================================================

@app.route(
    "/api/cards",
    methods=[
        "GET",
        "POST"
    ]
)
@token_required
def handle_cards(
    current_user
):

    # ========================================================
    # GET
    # ========================================================

    if request.method == "GET":

        cards = (
            Card.query
            .order_by(
                Card.id.asc()
            )
            .all()
        )


        return jsonify([
            card.to_dict()
            for card
            in cards
        ]), 200


    # ========================================================
    # POST
    # ========================================================

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    titulo = str(
        data.get(
            "titulo",
            ""
        )
    ).strip()


    descricao = str(
        data.get(
            "descricao",
            ""
        )
    ).strip()


    status = str(
        data.get(
            "status",
            "afazer"
        )
    )


    cor = str(
        data.get(
            "cor",
            "amarelo"
        )
    )


    prioridade = str(
        data.get(
            "prioridade",
            "media"
        )
    )


    if not titulo:

        return jsonify({
            "success": False,
            "message":
                "O título do card é obrigatório."
        }), 400


    status_validos = {
        "afazer",
        "andamento",
        "concluido"
    }


    if status not in status_validos:

        return jsonify({
            "success": False,
            "message":
                "Status do card inválido."
        }), 400


    if status == "concluido":

        return jsonify({
            "success": False,
            "message":
                "Um card novo não pode ser criado como concluído."
        }), 400


    responsavel_recebido = (
        data.get(
            "responsavel_id"
        )
    )


    responsavel_id = None


    if responsavel_recebido in (
        None,
        "",
        "null"
    ):

        responsavel_id = None


    elif (
        responsavel_recebido
        ==
        "logado"
    ):

        responsavel_id = (
            current_user.id
        )


    else:

        try:

            responsavel_id = int(
                responsavel_recebido
            )

        except (
            TypeError,
            ValueError
        ):

            return jsonify({
                "success": False,
                "message":
                    "Responsável inválido."
            }), 400


        responsavel = (
            db.session.get(
                User,
                responsavel_id
            )
        )


        if not responsavel:

            return jsonify({
                "success": False,
                "message":
                    "O responsável selecionado não existe."
            }), 400


    novo_card = Card(

        titulo=titulo,

        descricao=descricao,

        status=status,

        cor=cor,

        prioridade=prioridade,

        responsavel_id=
            responsavel_id,

        criador_id=current_user.id,

        data_criacao=datetime.utcnow(),

        pontuacao_concedida=False

    )


    try:

        agora_card = datetime.utcnow()
        novo_card.data_criacao = agora_card
        current_user.ultimo_card_criado_em = agora_card

        db.session.add(
            novo_card
        )

        db.session.commit()

        verificar_conquistas(current_user)


        return jsonify({

            "success":
                True,

            "message":
                "Card criado com sucesso!",

            "card":
                novo_card.to_dict()

        }), 201


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO CARD:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Erro ao salvar o card."
        }), 500


# ============================================================
# ASSUMIR CARD
# ============================================================

@app.route(
    "/api/cards/<int:card_id>/assumir",
    methods=["POST"]
)
@token_required
def assumir_card(
    current_user,
    card_id
):

    card = db.session.get(
        Card,
        card_id
    )


    if not card:

        return jsonify({
            "success": False,
            "message":
                "Card não encontrado."
        }), 404


    if card.status == "concluido":

        return jsonify({
            "success": False,
            "message":
                "Não é possível assumir um card concluído."
        }), 400


    if (
        card.responsavel_id
        is not None
        and
        card.responsavel_id
        !=
        current_user.id
    ):

        return jsonify({
            "success": False,
            "message":
                "Este card já pertence a outro membro."
        }), 403


    card.responsavel_id = (
        current_user.id
    )


    try:

        db.session.commit()

        return jsonify({

            "success":
                True,

            "message":
                "Card assumido com sucesso!",

            "card":
                card.to_dict()

        }), 200


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO ASSUMIR CARD:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Não foi possível assumir o card."
        }), 500


# ============================================================
# ATUALIZAR / DELETAR CARD
# ============================================================

@app.route(
    "/api/cards/<int:card_id>",
    methods=[
        "PUT",
        "DELETE"
    ]
)
@token_required
def atualizar_deletar_card(
    current_user,
    card_id
):

    card = db.session.get(
        Card,
        card_id
    )


    if not card:

        return jsonify({
            "success": False,
            "message":
                "Card não encontrado."
        }), 404


    # ========================================================
    # DELETE
    # ========================================================

    if request.method == "DELETE":

        if (
            card.responsavel_id
            is not None
            and
            card.responsavel_id
            !=
            current_user.id
            and
            not current_user.is_admin
        ):

            return jsonify({
                "success": False,
                "message":
                    "Apenas o responsável ou um administrador pode excluir o card."
            }), 403


        try:

            db.session.delete(
                card
            )

            db.session.commit()

            return jsonify({
                "success": True,
                "message":
                    "Card excluído com sucesso."
            }), 200


        except Exception as erro:

            db.session.rollback()

            print(
                "ERRO EXCLUIR CARD:",
                repr(erro)
            )

            return jsonify({
                "success": False,
                "message":
                    "Não foi possível excluir o card."
            }), 500


    # ========================================================
    # PUT
    # ========================================================

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    novo_status = (
        data.get(
            "status"
        )
    )


    status_anterior = (
        card.status
    )


    if (
        novo_status
        is not None
    ):

        # Admin não move cards dos outros.
        # Somente responsável move card.
        if (
            card.responsavel_id
            !=
            current_user.id
        ):

            return jsonify({
                "success": False,
                "message":
                    "Somente o membro responsável pode mover este card."
            }), 403


        status_validos = {
            "afazer",
            "andamento",
            "concluido"
        }


        if (
            novo_status
            not in
            status_validos
        ):

            return jsonify({
                "success": False,
                "message":
                    "Status inválido."
            }), 400


        if (
            status_anterior
            ==
            "concluido"
            and
            novo_status
            !=
            "concluido"
        ):

            return jsonify({
                "success": False,
                "message":
                    "Cards concluídos não podem voltar."
            }), 400


        if (
            status_anterior
            ==
            "afazer"
            and
            novo_status
            ==
            "concluido"
        ):

            return jsonify({
                "success": False,
                "message":
                    "O card precisa passar por Em Andamento antes de ser concluído."
            }), 400


        if (
            status_anterior
            ==
            "andamento"
            and
            novo_status
            ==
            "afazer"
        ):

            return jsonify({
                "success": False,
                "message":
                    "Um card em andamento não pode voltar para A Fazer."
            }), 400


        transicoes = {

            "afazer": [
                "andamento"
            ],

            "andamento": [
                "concluido"
            ],

            "concluido": []

        }


        if (
            novo_status
            !=
            status_anterior
            and
            novo_status
            not in
            transicoes.get(
                status_anterior,
                []
            )
        ):

            return jsonify({
                "success": False,
                "message":
                    "Essa movimentação não é permitida."
            }), 400


        card.status = (
            novo_status
        )


    # ========================================================
    # CAMPOS
    # ========================================================

    if "titulo" in data:

        titulo = str(
            data.get(
                "titulo",
                ""
            )
        ).strip()

        if not titulo:

            return jsonify({
                "success": False,
                "message":
                    "O título não pode ficar vazio."
            }), 400

        card.titulo = titulo


    if "descricao" in data:

        card.descricao = str(
            data.get(
                "descricao",
                ""
            )
        )


    if "cor" in data:

        card.cor = str(
            data.get(
                "cor",
                "amarelo"
            )
        )


    if "prioridade" in data:

        card.prioridade = str(
            data.get(
                "prioridade",
                "media"
            )
        )


    # ========================================================
    # PONTUAÇÃO
    # ========================================================

    if (
        status_anterior
        !=
        "concluido"
        and
        novo_status
        ==
        "concluido"
        and
        not card.pontuacao_concedida
    ):

        dono = (
            db.session.get(
                User,
                card.responsavel_id
            )
        )


        if dono:

            dono.pontos = (
                dono.pontos or 0
            ) + 5

            card.pontuacao_concedida = (
                True
            )


    try:

        db.session.commit()

        if card.responsavel_id:
            membro_pontuado = db.session.get(User, card.responsavel_id)
            if membro_pontuado:
                verificar_conquistas(membro_pontuado)

        return jsonify({

            "success":
                True,

            "message":
                "Card atualizado com sucesso.",

            "card":
                card.to_dict()

        }), 200


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO ATUALIZAR CARD:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Não foi possível atualizar o card."
        }), 500


# ============================================================
# FEED - LISTAR
# ============================================================

@app.route(
    "/api/posts",
    methods=["GET"]
)
@token_required
def listar_posts(
    current_user
):

    posts = (
        Post.query
        .order_by(
            Post.data_criacao.desc()
        )
        .all()
    )


    return jsonify([
        post.to_dict(
            current_user.id
        )
        for post
        in posts
    ]), 200


# ============================================================
# FEED - CRIAR
# ============================================================

@app.route(
    "/api/posts",
    methods=["POST"]
)
@token_required
def criar_post(
    current_user
):

    if request.is_json:

        data = (
            request.get_json(
                silent=True
            )
            or {}
        )

        conteudo = str(
            data.get(
                "conteudo",
                ""
            )
        ).strip()

        codigo_snippet = str(
            data.get(
                "codigo_snippet",
                ""
            )
        ).strip()

        codigo_linguagem = str(
            data.get(
                "codigo_linguagem",
                "texto"
            )
        ).strip()[:50]

        arquivo = None


    else:

        conteudo = (
            request.form.get(
                "conteudo",
                ""
            )
            or ""
        ).strip()


        codigo_snippet = (
            request.form.get(
                "codigo_snippet",
                ""
            )
            or ""
        ).strip()


        codigo_linguagem = (
            request.form.get(
                "codigo_linguagem",
                "texto"
            )
            or
            "texto"
        ).strip()[:50]


        arquivo = (
            request.files.get(
                "arquivo"
            )
        )


    possui_arquivo = bool(
        arquivo
        and
        arquivo.filename
    )


    if (
        not conteudo
        and
        not codigo_snippet
        and
        not possui_arquivo
    ):

        return jsonify({
            "success": False,
            "message":
                "Escreva algo, adicione código ou anexe um arquivo."
        }), 400


    if len(conteudo) > 2000:

        return jsonify({
            "success": False,
            "message":
                "O texto pode possuir no máximo 2000 caracteres."
        }), 400


    if len(codigo_snippet) > 12000:

        return jsonify({
            "success": False,
            "message":
                "O código pode possuir no máximo 12000 caracteres."
        }), 400


    midia_url = None
    arquivo_url = None
    arquivo_nome = None
    arquivo_mime = None


    try:

        if possui_arquivo:

            extensao = (
                arquivo.filename
                .rsplit(".", 1)[1]
                .lower()
                if "." in arquivo.filename
                else ""
            )


            if (
                extensao
                in
                ALLOWED_IMAGE_EXTENSIONS
            ):

                midia_url = (
                    salvar_arquivo(
                        arquivo
                    )
                )

                arquivo_nome = (
                    secure_filename(
                        arquivo.filename
                    )
                )

                arquivo_mime = (
                    arquivo.mimetype
                )

            else:

                (
                    arquivo_url,
                    arquivo_nome,
                    arquivo_mime
                ) = salvar_anexo(
                    arquivo
                )


        novo_post = Post(

            user_id=
                current_user.id,

            conteudo=
                conteudo,

            midia_url=
                midia_url,

            arquivo_url=
                arquivo_url,

            arquivo_nome=
                arquivo_nome,

            arquivo_mime=
                arquivo_mime,

            codigo_snippet=
                codigo_snippet,

            codigo_linguagem=
                codigo_linguagem

        )


        db.session.add(
            novo_post
        )

        db.session.commit()


        return jsonify({

            "success":
                True,

            "message":
                "Post publicado com sucesso!",

            "post":
                novo_post.to_dict(
                    current_user.id
                )

        }), 201


    except ValueError as erro:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message":
                str(erro)
        }), 400


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO POST:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Não foi possível publicar o post."
        }), 500


# ============================================================
# COMENTAR
# ============================================================

@app.route(
    "/api/posts/<int:post_id>/comentarios",
    methods=["POST"]
)
@token_required
def comentar_post(
    current_user,
    post_id
):

    post = db.session.get(
        Post,
        post_id
    )


    if not post:

        return jsonify({
            "success": False,
            "message":
                "Post não encontrado."
        }), 404


    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    conteudo = str(
        data.get(
            "conteudo",
            ""
        )
    ).strip()


    if not conteudo:

        return jsonify({
            "success": False,
            "message":
                "Digite um comentário."
        }), 400


    if len(conteudo) > 1000:

        return jsonify({
            "success": False,
            "message":
                "O comentário pode possuir no máximo 1000 caracteres."
        }), 400


    comentario = PostComment(

        post_id=
            post.id,

        user_id=
            current_user.id,

        conteudo=
            conteudo

    )


    try:

        db.session.add(
            comentario
        )

        db.session.commit()

        verificar_conquistas(current_user)


        return jsonify({

            "success":
                True,

            "comentario":
                comentario.to_dict()

        }), 201


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO COMENTÁRIO:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Não foi possível publicar o comentário."
        }), 500


# ============================================================
# EXCLUIR COMENTÁRIO
# ============================================================

@app.route(
    "/api/comentarios/<int:comentario_id>",
    methods=["DELETE"]
)
@token_required
def deletar_comentario(
    current_user,
    comentario_id
):

    comentario = db.session.get(
        PostComment,
        comentario_id
    )


    if not comentario:

        return jsonify({
            "success": False,
            "message":
                "Comentário não encontrado."
        }), 404


    if (
        comentario.user_id
        !=
        current_user.id
        and
        not current_user.is_admin
    ):

        return jsonify({
            "success": False,
            "message":
                "Você não pode excluir este comentário."
        }), 403


    try:

        db.session.delete(
            comentario
        )

        db.session.commit()


        return jsonify({
            "success": True,
            "message":
                "Comentário excluído."
        }), 200


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO EXCLUIR COMENTÁRIO:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Erro ao excluir comentário."
        }), 500


# ============================================================
# CURTIR / DESCURTIR
# ============================================================

@app.route(
    "/api/posts/<int:post_id>/curtir",
    methods=["POST"]
)
@token_required
def curtir_post(
    current_user,
    post_id
):

    post = db.session.get(
        Post,
        post_id
    )


    if not post:

        return jsonify({
            "success": False,
            "message":
                "Post não encontrado."
        }), 404


    like = (
        PostLike.query
        .filter_by(
            post_id=post.id,
            user_id=current_user.id
        )
        .first()
    )


    if like:

        db.session.delete(
            like
        )

        curtido = False

    else:

        novo_like = PostLike(

            post_id=
                post.id,

            user_id=
                current_user.id

        )

        db.session.add(
            novo_like
        )

        curtido = True


    try:

        db.session.commit()


        total = (
            PostLike.query
            .filter_by(
                post_id=post.id
            )
            .count()
        )


        return jsonify({

            "success":
                True,

            "curtido":
                curtido,

            "total_curtidas":
                total

        }), 200


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO CURTIDA:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Não foi possível atualizar a curtida."
        }), 500


# ============================================================
# EXCLUIR POST
# ============================================================

@app.route(
    "/api/posts/<int:post_id>",
    methods=["DELETE"]
)
@token_required
def deletar_post(
    current_user,
    post_id
):

    post = db.session.get(
        Post,
        post_id
    )


    if not post:

        return jsonify({
            "success": False,
            "message":
                "Post não encontrado."
        }), 404


    if (
        post.user_id
        !=
        current_user.id
        and
        not current_user.is_admin
    ):

        return jsonify({
            "success": False,
            "message":
                "Você não pode excluir este post."
        }), 403


    try:

        db.session.delete(
            post
        )

        db.session.commit()


        return jsonify({
            "success": True,
            "message":
                "Post excluído."
        }), 200


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO EXCLUIR POST:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Não foi possível excluir o post."
        }), 500


# ============================================================
# DESTAQUES
# ============================================================

@app.route(
    "/api/membros/destaque",
    methods=["GET"]
)
@app.route(
    "/api/destaques",
    methods=["GET"]
)
@token_required
def membros_destaque(
    current_user
):

    membros = (
        User.query
        .order_by(
            User.pontos.desc(),
            User.id.asc()
        )
        .limit(5)
        .all()
    )


    return jsonify([
        membro.to_dict()
        for membro
        in membros
    ]), 200


# ============================================================
# LISTAR MEMBROS
# ============================================================

@app.route(
    "/api/membros",
    methods=["GET"]
)
@token_required
def listar_membros(
    current_user
):

    membros = (
        User.query
        .order_by(
            User.nome.asc()
        )
        .all()
    )


    return jsonify([
        membro.to_dict()
        for membro
        in membros
    ]), 200


# ============================================================
# PERFIL PÚBLICO DE MEMBRO
# ============================================================

@app.route(
    "/api/membros/<int:user_id>/perfil",
    methods=["GET"]
)
@token_required
def perfil_publico_membro(current_user, user_id):
    """Perfil completo visível aos membros autenticados do LSD."""

    membro = db.session.get(User, user_id)

    if not membro:
        return jsonify({
            "success": False,
            "message": "Membro não encontrado."
        }), 404

    cards_membro = (
        Card.query
        .filter(Card.responsavel_id == membro.id)
        .order_by(Card.id.desc())
        .all()
    )

    # Também reavalia aqui para conquistas que dependem apenas
    # da passagem do tempo, como "Preguiçoso".
    conquistas = verificar_conquistas(membro)

    # Projetos terão modelo próprio futuramente. Mantemos o contrato da API
    # desde já para o frontend não precisar ser refeito quando isso chegar.
    return jsonify({
        "success": True,
        "membro": membro.to_dict(),
        "cards": [card.to_dict() for card in cards_membro],
        "conquistas": [item.to_dict() for item in conquistas],
        "projetos": []
    }), 200


# ============================================================
# CONQUISTAS DO MEMBRO LOGADO
# ============================================================

@app.route(
    "/api/conquistas/minhas",
    methods=["GET"]
)
@token_required
def minhas_conquistas(current_user):
    conquistas = verificar_conquistas(current_user)

    return jsonify({
        "success": True,
        "total": len(conquistas),
        "conquistas": [
            item.to_dict()
            for item in conquistas
        ]
    }), 200


# ============================================================
# ADMIN - LISTAR MEMBROS
# ============================================================

@app.route(
    "/api/admin/membros",
    methods=["GET"]
)
@admin_required
def listar_membros_admin(
    current_user
):

    membros = (
        User.query
        .order_by(
            User.nome.asc()
        )
        .all()
    )


    return jsonify({

        "success":
            True,

        "membros": [
            {
                **membro.to_dict(),
                "advertencias_total": Advertencia.query.filter_by(
                    membro_id=membro.id
                ).count(),
                "advertencias_nao_lidas": Advertencia.query.filter_by(
                    membro_id=membro.id,
                    lida=False
                ).count()
            }
            for membro
            in membros
        ]

    }), 200


# ============================================================
# ADVERTÊNCIAS - MEMBRO LOGADO
# ============================================================

@app.route(
    "/api/advertencias",
    methods=["GET"]
)
@token_required
def listar_minhas_advertencias(
    current_user
):

    advertencias = (
        Advertencia.query
        .filter_by(
            membro_id=current_user.id
        )
        .order_by(
            Advertencia.data_criacao.desc()
        )
        .all()
    )

    return jsonify({
        "success": True,
        "advertencias": [
            advertencia.to_dict()
            for advertencia
            in advertencias
        ],
        "total": len(advertencias),
        "nao_lidas": sum(
            1
            for advertencia
            in advertencias
            if not advertencia.lida
        )
    }), 200


@app.route(
    "/api/advertencias/<int:advertencia_id>/ler",
    methods=["POST"]
)
@token_required
def marcar_advertencia_como_lida(
    current_user,
    advertencia_id
):

    advertencia = db.session.get(
        Advertencia,
        advertencia_id
    )

    if not advertencia:
        return jsonify({
            "success": False,
            "message": "Advertência não encontrada."
        }), 404

    if advertencia.membro_id != current_user.id:
        return jsonify({
            "success": False,
            "message": "Você não pode alterar esta advertência."
        }), 403

    if not advertencia.lida:
        advertencia.lida = True
        advertencia.data_leitura = datetime.utcnow()

        try:
            db.session.commit()
        except Exception as erro:
            db.session.rollback()
            print("ERRO AO MARCAR ADVERTÊNCIA:", repr(erro))
            return jsonify({
                "success": False,
                "message": "Não foi possível confirmar a leitura da advertência."
            }), 500

    return jsonify({
        "success": True,
        "message": "Advertência marcada como ciente.",
        "advertencia": advertencia.to_dict()
    }), 200


# ============================================================
# ADMIN - ADVERTÊNCIAS
# ============================================================

@app.route(
    "/api/admin/membros/<int:user_id>/advertencias",
    methods=["GET"]
)
@admin_required
def listar_advertencias_membro_admin(
    current_user,
    user_id
):

    membro = db.session.get(
        User,
        user_id
    )

    if not membro:
        return jsonify({
            "success": False,
            "message": "Membro não encontrado."
        }), 404

    advertencias = (
        Advertencia.query
        .filter_by(
            membro_id=membro.id
        )
        .order_by(
            Advertencia.data_criacao.desc()
        )
        .all()
    )

    return jsonify({
        "success": True,
        "membro": membro.to_dict(),
        "advertencias": [
            advertencia.to_dict()
            for advertencia
            in advertencias
        ]
    }), 200


@app.route(
    "/api/admin/membros/<int:user_id>/advertencias",
    methods=["POST"]
)
@admin_required
def criar_advertencia_admin(
    current_user,
    user_id
):

    membro = db.session.get(
        User,
        user_id
    )

    if not membro:
        return jsonify({
            "success": False,
            "message": "Membro não encontrado."
        }), 404

    if membro.id == current_user.id:
        return jsonify({
            "success": False,
            "message": "Você não pode advertir sua própria conta."
        }), 400

    data = request.get_json(
        silent=True
    ) or {}

    motivo = str(
        data.get(
            "motivo",
            ""
        )
    ).strip()

    if len(motivo) < 5:
        return jsonify({
            "success": False,
            "message": "Informe um motivo com pelo menos 5 caracteres."
        }), 400

    if len(motivo) > 1000:
        return jsonify({
            "success": False,
            "message": "O motivo pode possuir no máximo 1000 caracteres."
        }), 400

    advertencia = Advertencia(
        membro_id=membro.id,
        admin_id=current_user.id,
        motivo=motivo,
        lida=False
    )

    try:
        db.session.add(
            advertencia
        )
        db.session.commit()

        verificar_conquistas(membro)

        return jsonify({
            "success": True,
            "message": "Advertência enviada com sucesso.",
            "advertencia": advertencia.to_dict(),
            "advertencias_total": Advertencia.query.filter_by(
                membro_id=membro.id
            ).count(),
            "advertencias_nao_lidas": Advertencia.query.filter_by(
                membro_id=membro.id,
                lida=False
            ).count()
        }), 201

    except Exception as erro:
        db.session.rollback()
        print("ERRO AO CRIAR ADVERTÊNCIA:", repr(erro))
        return jsonify({
            "success": False,
            "message": "Não foi possível registrar a advertência."
        }), 500


@app.route(
    "/api/admin/advertencias/<int:advertencia_id>",
    methods=["DELETE"]
)
@admin_required
def excluir_advertencia_admin(
    current_user,
    advertencia_id
):

    advertencia = db.session.get(
        Advertencia,
        advertencia_id
    )

    if not advertencia:
        return jsonify({
            "success": False,
            "message": "Advertência não encontrada."
        }), 404

    membro_id = advertencia.membro_id

    try:
        db.session.delete(
            advertencia
        )
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Advertência removida com sucesso.",
            "membro_id": membro_id,
            "advertencias_total": Advertencia.query.filter_by(
                membro_id=membro_id
            ).count(),
            "advertencias_nao_lidas": Advertencia.query.filter_by(
                membro_id=membro_id,
                lida=False
            ).count()
        }), 200

    except Exception as erro:
        db.session.rollback()
        print("ERRO AO EXCLUIR ADVERTÊNCIA:", repr(erro))
        return jsonify({
            "success": False,
            "message": "Não foi possível remover a advertência."
        }), 500


# ============================================================
# ADMIN - ATUALIZAR MEMBRO
# ============================================================

@app.route(
    "/api/admin/membros/<int:user_id>",
    methods=["PUT"]
)
@app.route(
    "/api/membros/<int:user_id>",
    methods=["PUT"]
)
@admin_required
def editar_membro(
    current_user,
    user_id
):

    membro = db.session.get(
        User,
        user_id
    )


    if not membro:

        return jsonify({
            "success": False,
            "message":
                "Membro não encontrado."
        }), 404


    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    admin_principal = (
        membro.email.lower()
        ==
        app.config[
            "ADMIN_EMAIL"
        ].lower()
    )


    # ========================================================
    # NOME
    # ========================================================

    if "nome" in data:

        nome = str(
            data.get(
                "nome",
                ""
            )
        ).strip()

        if nome:

            membro.nome = nome


    # ========================================================
    # EMAIL
    # ========================================================

    if "email" in data:

        novo_email = str(
            data.get(
                "email",
                ""
            )
        ).strip().lower()


        if admin_principal:

            if (
                novo_email
                !=
                app.config[
                    "ADMIN_EMAIL"
                ].lower()
            ):

                return jsonify({
                    "success": False,
                    "message":
                        "O e-mail do administrador principal não pode ser alterado."
                }), 403


        elif (
            novo_email
            and
            novo_email
            !=
            membro.email.lower()
        ):

            existente = (
                User.query
                .filter(
                    db.func.lower(
                        User.email
                    )
                    ==
                    novo_email
                )
                .first()
            )


            if existente:

                return jsonify({
                    "success": False,
                    "message":
                        "Este e-mail já está em uso."
                }), 400


            membro.email = (
                novo_email
            )


    # ========================================================
    # FUNÇÃO
    # ========================================================

    if "funcao" in data:

        membro.funcao = str(
            data.get(
                "funcao",
                ""
            )
        )


    # ========================================================
    # ADMIN
    # ========================================================

    if "is_admin" in data:

        # Admin principal nunca pode perder permissão.
        if admin_principal:

            membro.is_admin = True

        else:

            valor = data.get(
                "is_admin"
            )


            # Evita bool("false") == True.
            if isinstance(
                valor,
                bool
            ):

                membro.is_admin = (
                    valor
                )

            elif isinstance(
                valor,
                str
            ):

                membro.is_admin = (
                    valor.strip().lower()
                    in
                    {
                        "true",
                        "1",
                        "sim",
                        "yes"
                    }
                )

            else:

                membro.is_admin = bool(
                    valor
                )


    # Proteção final.
    if admin_principal:

        membro.is_admin = True


    try:

        db.session.commit()


        return jsonify({

            "success":
                True,

            "message":
                "Membro atualizado com sucesso.",

            "usuario":
                membro.to_dict()

        }), 200


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO ADMIN ATUALIZAR:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Não foi possível atualizar o membro."
        }), 500


# ============================================================
# ADMIN - EXCLUIR MEMBRO
# ============================================================

@app.route(
    "/api/admin/membros/<int:user_id>",
    methods=["DELETE"]
)
@app.route(
    "/api/membros/<int:user_id>",
    methods=["DELETE"]
)
@admin_required
def excluir_membro(
    current_user,
    user_id
):

    membro = db.session.get(
        User,
        user_id
    )


    if not membro:

        return jsonify({
            "success": False,
            "message":
                "Membro não encontrado."
        }), 404


    # Não pode excluir a própria conta.
    if (
        membro.id
        ==
        current_user.id
    ):

        return jsonify({
            "success": False,
            "message":
                "Você não pode excluir sua própria conta."
        }), 400


    # Administrador principal nunca pode ser excluído.
    if (
        membro.email.lower()
        ==
        app.config[
            "ADMIN_EMAIL"
        ].lower()
    ):

        return jsonify({
            "success": False,
            "message":
                "O administrador principal não pode ser excluído."
        }), 403


    try:

        # ====================================================
        # CARDS
        # ====================================================

        Card.query.filter_by(
            responsavel_id=
                membro.id
        ).update({

            "responsavel_id":
                None

        })


        # ====================================================
        # CURTIDAS
        # ====================================================

        PostLike.query.filter_by(
            user_id=membro.id
        ).delete(
            synchronize_session=False
        )


        # ====================================================
        # COMENTÁRIOS
        # ====================================================

        PostComment.query.filter_by(
            user_id=membro.id
        ).delete(
            synchronize_session=False
        )


        # ====================================================
        # ADVERTÊNCIAS
        # ====================================================

        # Remove advertências recebidas pelo membro que será excluído.
        Advertencia.query.filter_by(
            membro_id=membro.id
        ).delete(
            synchronize_session=False
        )

        # Preserva o histórico das advertências que esse usuário emitiu
        # caso ele seja um administrador removido.
        Advertencia.query.filter_by(
            admin_id=membro.id
        ).update(
            {"admin_id": None},
            synchronize_session=False
        )


        # ====================================================
        # POSTS
        # ====================================================

        posts = (
            Post.query
            .filter_by(
                user_id=membro.id
            )
            .all()
        )


        for post in posts:

            db.session.delete(
                post
            )


        # ====================================================
        # USUÁRIO
        # ====================================================

        db.session.delete(
            membro
        )


        db.session.commit()


        return jsonify({
            "success": True,
            "message":
                "Membro excluído com sucesso."
        }), 200


    except Exception as erro:

        db.session.rollback()

        print(
            "ERRO ADMIN EXCLUIR:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message":
                "Não foi possível excluir o membro."
        }), 500



# ============================================================
# ADMIN - BACKUPS
# ============================================================

@app.route(
    "/api/admin/backups",
    methods=["GET"]
)
@admin_required
def listar_backups_admin(
    current_user
):
    backups = _listar_backups()

    ultimo_diario = None

    try:
        if os.path.exists(
            BACKUP_MARKER_PATH
        ):
            ultimo_diario = (
                open(
                    BACKUP_MARKER_PATH,
                    "r",
                    encoding="utf-8"
                )
                .read()
                .strip()
            )
    except OSError:
        pass

    return jsonify({
        "success": True,
        "backups": backups,
        "retencao": BACKUP_RETENTION,
        "timezone": BACKUP_TIMEZONE,
        "ultimo_backup_diario": ultimo_diario
    }), 200


@app.route(
    "/api/admin/backups",
    methods=["POST"]
)
@admin_required
def criar_backup_admin(
    current_user
):
    try:
        resultado = criar_backup(
            "manual"
        )

        return jsonify({
            "success": True,
            "message": "Backup criado com sucesso.",
            "backup": {
                "nome": resultado["nome"],
                "tamanho_bytes": resultado[
                    "tamanho_bytes"
                ],
                "criado_em": resultado[
                    "criado_em"
                ]
            }
        }), 201

    except Exception as erro:
        print(
            "[BACKUP] Erro no backup manual:",
            repr(erro)
        )

        return jsonify({
            "success": False,
            "message": "Não foi possível criar o backup."
        }), 500


@app.route(
    "/api/admin/backups/<path:filename>",
    methods=["GET"]
)
@admin_required
def baixar_backup_admin(
    current_user,
    filename
):
    nome = os.path.basename(
        filename
    )

    if (
        nome != filename
        or not nome.startswith("lsd_backup_")
        or not nome.endswith(".zip")
    ):
        return jsonify({
            "success": False,
            "message": "Backup inválido."
        }), 400

    caminho = os.path.join(
        BACKUP_FOLDER,
        nome
    )

    if not os.path.isfile(
        caminho
    ):
        return jsonify({
            "success": False,
            "message": "Backup não encontrado."
        }), 404

    return send_file(
        caminho,
        as_attachment=True,
        download_name=nome,
        mimetype="application/zip"
    )




# ============================================================
# UPLOADS
# ============================================================

@app.route(
    "/uploads/<path:filename>",
    methods=["GET"]
)
def serve_upload(
    filename
):

    return send_from_directory(
        app.config[
            "UPLOAD_FOLDER"
        ],
        filename
    )


# ============================================================
# COMPATIBILIDADE DO BANCO EXISTENTE
# ============================================================

def garantir_schema_feed():
    """
    Adiciona campos do feed em bancos antigos
    sem apagar os dados existentes.
    """

    from sqlalchemy import (
        inspect,
        text
    )


    inspector = inspect(
        db.engine
    )


    tabelas = set(
        inspector.get_table_names()
    )


    # ========================================================
    # POSTS
    # ========================================================

    if "posts" in tabelas:

        colunas = {

            coluna["name"]

            for coluna
            in inspector.get_columns(
                "posts"
            )

        }


        faltantes = {

            "arquivo_url":
                "VARCHAR(255)",

            "arquivo_nome":
                "VARCHAR(255)",

            "arquivo_mime":
                "VARCHAR(120)",

            "codigo_snippet":
                "TEXT",

            "codigo_linguagem":
                "VARCHAR(50)"

        }


        for (
            nome,
            tipo
        ) in faltantes.items():

            if (
                nome
                not in
                colunas
            ):

                db.session.execute(
                    text(
                        f"""
                        ALTER TABLE posts
                        ADD COLUMN {nome} {tipo}
                        """
                    )
                )


        db.session.commit()


    # Cria tabelas que ainda não existirem.
    db.create_all()


# ============================================================
# GARANTIR CAMPOS DE PERFIL SOCIAL
# ============================================================

def garantir_schema_perfis():
    """Atualiza bancos antigos sem apagar dados já existentes."""
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    tabelas = set(inspector.get_table_names())

    if "users" in tabelas:
        colunas = {coluna["name"] for coluna in inspector.get_columns("users")}

        if "linguagens" not in colunas:
            print("[BANCO] Criando coluna users.linguagens...")
            db.session.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN linguagens TEXT NOT NULL DEFAULT '[]'"
                )
            )
            db.session.commit()

        if "ultimo_card_criado_em" not in colunas:
            print("[BANCO] Criando coluna users.ultimo_card_criado_em...")
            db.session.execute(
                text(
                    "ALTER TABLE users "
                    "ADD COLUMN ultimo_card_criado_em DATETIME"
                )
            )
            # Usuários antigos começam a contar as duas semanas a partir
            # desta atualização para não receberem a conquista por engano.
            db.session.execute(
                text(
                    "UPDATE users "
                    "SET ultimo_card_criado_em = CURRENT_TIMESTAMP "
                    "WHERE ultimo_card_criado_em IS NULL"
                )
            )
            db.session.commit()

    if "cards" in tabelas:
        colunas_cards = {
            coluna["name"]
            for coluna in inspector.get_columns("cards")
        }

        if "criador_id" not in colunas_cards:
            print("[BANCO] Criando coluna cards.criador_id...")
            db.session.execute(
                text(
                    "ALTER TABLE cards "
                    "ADD COLUMN criador_id INTEGER"
                )
            )
            db.session.commit()

        if "data_criacao" not in colunas_cards:
            print("[BANCO] Criando coluna cards.data_criacao...")
            db.session.execute(
                text(
                    "ALTER TABLE cards "
                    "ADD COLUMN data_criacao DATETIME"
                )
            )
            db.session.execute(
                text(
                    "UPDATE cards "
                    "SET data_criacao = CURRENT_TIMESTAMP "
                    "WHERE data_criacao IS NULL"
                )
            )
            db.session.commit()

    # As tabelas de conquistas são criadas pelo SQLAlchemy quando faltarem.
    db.create_all()


# ============================================================
# GARANTIR COLUNA IS_ADMIN
# ============================================================

def garantir_schema_admin():
    """
    Caso o banco seja muito antigo e ainda não possua
    a coluna is_admin, cria automaticamente.
    """

    from sqlalchemy import (
        inspect,
        text
    )


    inspector = inspect(
        db.engine
    )


    tabelas = set(
        inspector.get_table_names()
    )


    if "users" not in tabelas:
        return


    colunas = {

        coluna["name"]

        for coluna
        in inspector.get_columns(
            "users"
        )

    }


    if (
        "is_admin"
        not in
        colunas
    ):

        print(
            "[BANCO] Criando coluna users.is_admin..."
        )


        db.session.execute(
            text(
                """
                ALTER TABLE users
                ADD COLUMN is_admin BOOLEAN
                NOT NULL DEFAULT 0
                """
            )
        )


        db.session.commit()


# ============================================================
# INICIALIZAÇÃO
# ============================================================

def inicializar_aplicacao():
    """
    Executado tanto com `python app.py` quanto via WSGI
    (PythonAnywhere).
    """

    with app.app_context():
        db.create_all()

        garantir_schema_admin()
        garantir_schema_feed()
        garantir_schema_perfis()
        garantir_catalogo_conquistas()
        garantir_admin_principal()


# Em hospedagem WSGI o bloco __main__ não é executado.
# Por isso a preparação do banco precisa ocorrer na importação.
inicializar_aplicacao()


if __name__ == "__main__":

    print(
        "=" * 60
    )

    print(
        "LSD v2.3.2"
    )

    print(
        "Ambiente:",
        APP_ENV
    )

    print(
        "Servidor local:"
    )

    print(
        "http://127.0.0.1:5000"
    )

    print(
        ""
    )

    print(
        "Administrador principal:"
    )

    print(
        app.config[
            "ADMIN_EMAIL"
        ]
    )

    print(
        ""
    )

    print(
        "Backups:"
    )

    print(
        BACKUP_FOLDER
    )

    print(
        "=" * 60
    )

    app.run(
        host="0.0.0.0",
        port=int(
            os.getenv(
                "PORT",
                "5000"
            )
        ),
        debug=not IS_PRODUCTION
    )
