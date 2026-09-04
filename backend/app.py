import os
import uuid
from datetime import datetime, timedelta
from functools import wraps

import jwt

from flask import (
    Flask,
    request,
    jsonify,
    send_from_directory
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

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app.config["SECRET_KEY"] = os.getenv(
    "SECRET_KEY",
    "lsd_secret_key_2026_dev"
)

app.config["SQLALCHEMY_DATABASE_URI"] = (
    "sqlite:///" + os.path.join(BASE_DIR, "lsd_database.db")
)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["UPLOAD_FOLDER"] = os.path.join(
    BASE_DIR,
    "uploads"
)

app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024


# ============================================================
# CORS
# ============================================================

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": "*"
        }
    }
)


# ============================================================
# BANCO
# ============================================================

db = SQLAlchemy(app)
migrate = Migrate(app, db)


# ============================================================
# UPLOADS
# ============================================================

ALLOWED_IMAGE_EXTENSIONS = {
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif"
}

os.makedirs(
    app.config["UPLOAD_FOLDER"],
    exist_ok=True
)


def extensao_permitida(filename):
    if not filename:
        return False

    if "." not in filename:
        return False

    extensao = filename.rsplit(".", 1)[1].lower()

    return extensao in ALLOWED_IMAGE_EXTENSIONS


def salvar_arquivo(file_storage):
    """
    Salva uma imagem enviada pelo usuário e retorna
    o caminho público do arquivo.
    """

    if not file_storage:
        return None

    if not file_storage.filename:
        return None

    if not extensao_permitida(file_storage.filename):
        raise ValueError(
            "Formato de imagem não permitido."
        )

    extensao = file_storage.filename.rsplit(
        ".",
        1
    )[1].lower()

    nome_seguro = secure_filename(
        file_storage.filename
    )

    if not nome_seguro:
        nome_seguro = "arquivo"

    nome_unico = (
        f"{uuid.uuid4().hex}_"
        f"{nome_seguro.rsplit('.', 1)[0]}."
        f"{extensao}"
    )

    caminho = os.path.join(
        app.config["UPLOAD_FOLDER"],
        nome_unico
    )

    file_storage.save(caminho)

    return f"/uploads/{nome_unico}"


# ============================================================
# TRATAMENTO DE ERROS
# ============================================================

@app.errorhandler(400)
def bad_request(error):
    return jsonify({
        "success": False,
        "message": "Requisição inválida ou dados ausentes."
    }), 400


@app.errorhandler(401)
def unauthorized(error):
    return jsonify({
        "success": False,
        "message": "Não autorizado."
    }), 401


@app.errorhandler(403)
def forbidden(error):
    return jsonify({
        "success": False,
        "message": "Você não possui permissão para realizar esta ação."
    }), 403


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "message": "Recurso ou rota não encontrada."
    }), 404


@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        "success": False,
        "message": "Método HTTP não permitido para esta rota."
    }), 405


@app.errorhandler(413)
def request_too_large(error):
    return jsonify({
        "success": False,
        "message": "O arquivo enviado é muito grande. Limite: 16MB."
    }), 413


@app.errorhandler(500)
def internal_server_error(error):
    return jsonify({
        "success": False,
        "message": "Erro interno do servidor."
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
        default="Mar 2024"
    )

    projetos_ativos = db.Column(
        db.Integer,
        default=1
    )

    pontos = db.Column(
        db.Integer,
        default=0
    )

    is_admin = db.Column(
        db.Boolean,
        default=False
    )

    def to_dict(self):

        return {
            "id": self.id,
            "nome": self.nome,
            "email": self.email,
            "funcao": self.funcao,
            "bio": self.bio or "",
            "localizacao": self.localizacao or "",
            "github": self.github or "",
            "instagram": self.instagram or "",
            "foto": self.foto,
            "capa": self.capa,
            "data_entrada": self.data_entrada,
            "projetos_ativos": self.projetos_ativos or 0,
            "pontos": self.pontos or 0,
            "is_admin": bool(self.is_admin)
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

    # IMPORTANTE:
    # O modelo utiliza midia_url.
    # Todas as rotas abaixo também utilizam midia_url.
    midia_url = db.Column(
        db.String(255),
        nullable=True
    )

    data_criacao = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    autor = db.relationship(
        "User",
        backref="posts"
    )

    def to_dict(self):

        return {
            "id": self.id,
            "conteudo": self.conteudo or "",
            "midia_url": self.midia_url,
            "data_criacao": (
                self.data_criacao.isoformat()
                if self.data_criacao
                else None
            ),
            "autor": {
                "id": self.autor.id,
                "nome": self.autor.nome,
                "foto": self.autor.foto
            } if self.autor else None
        }


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

    # Impede que o mesmo card dê +5 novamente.
    pontuacao_concedida = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    responsavel = db.relationship(
        "User",
        backref="cards"
    )

    def to_dict(self):

        return {
            "id": self.id,
            "titulo": self.titulo,
            "descricao": self.descricao or "",
            "status": self.status,
            "cor": self.cor,
            "prioridade": self.prioridade,
            "responsavel_id": self.responsavel_id,

            "responsavel": {
                "id": self.responsavel.id,
                "nome": self.responsavel.nome,
                "foto": self.responsavel.foto
            } if self.responsavel else None,

            "pontuacao_concedida": bool(
                self.pontuacao_concedida
            )
        }


# ============================================================
# AUTENTICAÇÃO JWT
# ============================================================

def criar_token(user):

    payload = {
        "user_id": user.id,
        "exp": datetime.utcnow() + timedelta(days=7)
    }

    token = jwt.encode(
        payload,
        app.config["SECRET_KEY"],
        algorithm="HS256"
    )

    return token


def token_required(f):

    @wraps(f)
    def decorated(*args, **kwargs):

        auth_header = request.headers.get(
            "Authorization",
            ""
        ).strip()

        if not auth_header:
            return jsonify({
                "success": False,
                "message": "Token de autenticação ausente."
            }), 401

        partes = auth_header.split(
            " ",
            1
        )

        if (
            len(partes) != 2
            or partes[0].lower() != "bearer"
        ):
            return jsonify({
                "success": False,
                "message": "Formato de autenticação inválido."
            }), 401

        token = partes[1].strip()

        if not token:
            return jsonify({
                "success": False,
                "message": "Token de autenticação ausente."
            }), 401

        if token in ("null", "undefined"):
            return jsonify({
                "success": False,
                "message": "Token inválido."
            }), 401

        try:

            data = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"]
            )

            user_id = data.get("user_id")

            if not user_id:
                return jsonify({
                    "success": False,
                    "message": "Token inválido."
                }), 401

            current_user = db.session.get(
                User,
                user_id
            )

            if not current_user:

                return jsonify({
                    "success": False,
                    "message": "Usuário associado ao token não existe."
                }), 401

        except jwt.ExpiredSignatureError:

            return jsonify({
                "success": False,
                "message": "Sessão expirada. Faça login novamente."
            }), 401

        except jwt.InvalidTokenError:

            return jsonify({
                "success": False,
                "message": "Token de autenticação inválido."
            }), 401

        except Exception:

            return jsonify({
                "success": False,
                "message": "Não foi possível validar a autenticação."
            }), 401

        return f(
            current_user,
            *args,
            **kwargs
        )

    return decorated


# ============================================================
# TESTE DA API
# ============================================================

@app.route("/", methods=["GET"])
def index():

    return jsonify({
        "success": True,
        "message": "API do LSD funcionando.",
        "status": "online"
    }), 200


@app.route("/api/status", methods=["GET"])
def api_status():

    return jsonify({
        "success": True,
        "message": "Servidor funcionando.",
        "status": "online"
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

    if request.is_json:

        data = request.get_json(
            silent=True
        ) or {}

        nome = data.get("nome")
        email = data.get("email")
        senha = data.get("senha")

        funcao = data.get(
            "funcao",
            "Membro LSD"
        )

        bio = data.get(
            "bio",
            ""
        )

        foto_file = None

    else:

        data = request.form

        nome = data.get("nome")
        email = data.get("email")
        senha = data.get("senha")

        funcao = data.get(
            "funcao",
            "Membro LSD"
        )

        bio = data.get(
            "bio",
            ""
        )

        foto_file = (
            request.files.get("foto")
            or request.files.get("avatar")
        )

    nome = nome.strip() if nome else ""
    email = email.strip().lower() if email else ""
    senha = senha.strip() if senha else ""

    if not nome or not email or not senha:

        return jsonify({
            "success": False,
            "message": "Nome, e-mail e senha são obrigatórios."
        }), 400

    if len(senha) < 6:

        return jsonify({
            "success": False,
            "message": "A senha deve possuir pelo menos 6 caracteres."
        }), 400

    if User.query.filter_by(
        email=email
    ).first():

        return jsonify({
            "success": False,
            "message": "Este e-mail já está cadastrado."
        }), 400

    foto_path = "/uploads/default-avatar.png"

    try:

        if foto_file and foto_file.filename:

            foto_path = salvar_arquivo(
                foto_file
            )

        novo_usuario = User(
            nome=nome,
            email=email,
            senha_hash=generate_password_hash(
                senha
            ),
            funcao=funcao,
            bio=bio,
            foto=foto_path
        )

        db.session.add(
            novo_usuario
        )

        db.session.commit()

        token = criar_token(
            novo_usuario
        )

        return jsonify({
            "success": True,
            "message": "Conta criada com sucesso!",
            "token": token,
            "usuario": novo_usuario.to_dict()
        }), 201

    except ValueError as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": str(e)
        }), 400

    except Exception as e:

        db.session.rollback()

        print(
            "ERRO NO CADASTRO:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Erro ao registrar usuário no banco de dados."
        }), 500


# ============================================================
# LOGIN
# ============================================================

@app.route(
    "/api/login",
    methods=["POST"]
)
def login():

    data = request.get_json(
        silent=True
    ) or {}

    email = data.get(
        "email",
        ""
    ).strip().lower()

    senha = data.get(
        "senha",
        ""
    )

    if not email or not senha:

        return jsonify({
            "success": False,
            "message": "Preencha o e-mail e a senha."
        }), 400

    user = User.query.filter_by(
        email=email
    ).first()

    if not user:

        return jsonify({
            "success": False,
            "message": "E-mail ou senha incorretos."
        }), 401

    if not check_password_hash(
        user.senha_hash,
        senha
    ):

        return jsonify({
            "success": False,
            "message": "E-mail ou senha incorretos."
        }), 401

    token = criar_token(
        user
    )

    return jsonify({
        "success": True,
        "message": "Login realizado com sucesso.",
        "token": token,
        "usuario": user.to_dict()
    }), 200


# ============================================================
# PERFIL
# ============================================================

@app.route(
    "/api/perfil",
    methods=["GET", "PUT"]
)
@token_required
def perfil(current_user):

    # --------------------------
    # GET
    # --------------------------

    if request.method == "GET":

        return jsonify(
            current_user.to_dict()
        ), 200

    # --------------------------
    # PUT
    # --------------------------

    if request.is_json:

        data = request.get_json(
            silent=True
        ) or {}

    else:

        data = request.form

    nome = data.get(
        "nome"
    )

    email = data.get(
        "email"
    )

    if nome is not None:

        nome = nome.strip()

        if nome:
            current_user.nome = nome

    if email is not None:

        email = email.strip().lower()

        if not email:

            return jsonify({
                "success": False,
                "message": "O e-mail não pode ficar vazio."
            }), 400

        if email != current_user.email:

            outro_usuario = User.query.filter_by(
                email=email
            ).first()

            if outro_usuario:

                return jsonify({
                    "success": False,
                    "message": "Este e-mail já está em uso."
                }), 400

            current_user.email = email

    if "funcao" in data:

        current_user.funcao = (
            data.get("funcao") or ""
        )

    if "bio" in data:

        current_user.bio = (
            data.get("bio") or ""
        )

    if "localizacao" in data:

        current_user.localizacao = (
            data.get("localizacao") or ""
        )

    if "github" in data:

        current_user.github = (
            data.get("github") or ""
        )

    if "instagram" in data:

        current_user.instagram = (
            data.get("instagram") or ""
        )

    # --------------------------
    # AVATAR
    # --------------------------

    file_avatar = (
        request.files.get("avatar")
        or request.files.get("foto")
    )

    # --------------------------
    # CAPA
    # --------------------------

    file_capa = request.files.get(
        "capa"
    )

    try:

        if file_avatar and file_avatar.filename:

            current_user.foto = salvar_arquivo(
                file_avatar
            )

        if file_capa and file_capa.filename:

            current_user.capa = salvar_arquivo(
                file_capa
            )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Perfil atualizado com sucesso!",
            "usuario": current_user.to_dict()
        }), 200

    except ValueError as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": str(e)
        }), 400

    except Exception as e:

        db.session.rollback()

        print(
            "ERRO AO ATUALIZAR PERFIL:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Erro ao atualizar o perfil."
        }), 500


# ============================================================
# CARDS - LISTAR E CRIAR
# ============================================================

@app.route(
    "/api/cards",
    methods=["GET", "POST"]
)
@token_required
def handle_cards(current_user):

    # ========================================================
    # GET
    # ========================================================

    if request.method == "GET":

        cards = Card.query.order_by(
            Card.id.asc()
        ).all()

        return jsonify([
            card.to_dict()
            for card in cards
        ]), 200

    # ========================================================
    # POST
    # ========================================================

    data = request.get_json(
        silent=True
    ) or {}

    titulo = str(
        data.get("titulo", "")
    ).strip()

    descricao = str(
        data.get("descricao", "")
    ).strip()

    cor = data.get(
        "cor",
        "amarelo"
    )

    prioridade = data.get(
        "prioridade",
        "media"
    )

    if not titulo:

        return jsonify({
            "success": False,
            "message": "O título do card é obrigatório."
        }), 400

    status = data.get(
        "status",
        "afazer"
    )

    # Card novo deve começar em A Fazer.
    if status not in (
        "afazer",
        "andamento",
        "concluido"
    ):

        return jsonify({
            "success": False,
            "message": "Status do card inválido."
        }), 400

    # Não permitimos criar diretamente como concluído.
    if status == "concluido":

        return jsonify({
            "success": False,
            "message": "Um card novo não pode ser criado como concluído."
        }), 400

    responsavel_id = None

    responsavel_recebido = data.get(
        "responsavel_id"
    )

    # Caso o frontend envie "logado".
    if responsavel_recebido == "logado":

        responsavel_id = current_user.id

    # Caso envie um ID.
    elif responsavel_recebido is not None:

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
                "message": "Responsável inválido."
            }), 400

        # Verifica se o usuário existe.
        responsavel = db.session.get(
            User,
            responsavel_id
        )

        if not responsavel:

            return jsonify({
                "success": False,
                "message": "O responsável informado não existe."
            }), 400

    novo_card = Card(
        titulo=titulo,
        descricao=descricao,
        status=status,
        cor=cor,
        prioridade=prioridade,
        responsavel_id=responsavel_id,
        pontuacao_concedida=False
    )

    try:

        db.session.add(
            novo_card
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Card criado com sucesso!",
            "card": novo_card.to_dict()
        }), 201

    except Exception as e:

        db.session.rollback()

        print(
            "ERRO AO CRIAR CARD:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Erro ao salvar o card."
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
            "message": "Card não encontrado."
        }), 404

    if card.status == "concluido":

        return jsonify({
            "success": False,
            "message": "Não é possível assumir um card concluído."
        }), 400

    # Já pertence a outra pessoa.
    if (
        card.responsavel_id is not None
        and card.responsavel_id != current_user.id
    ):

        return jsonify({
            "success": False,
            "message": "Este card já pertence a outro membro."
        }), 403

    card.responsavel_id = current_user.id

    try:

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Card assumido com sucesso!",
            "card": card.to_dict()
        }), 200

    except Exception as e:

        db.session.rollback()

        print(
            "ERRO AO ASSUMIR CARD:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Não foi possível assumir o card."
        }), 500


# ============================================================
# ATUALIZAR / DELETAR CARD
# ============================================================

@app.route(
    "/api/cards/<int:card_id>",
    methods=["PUT", "DELETE"]
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
            "message": "Card não encontrado."
        }), 404

    # ========================================================
    # DELETE
    # ========================================================

    if request.method == "DELETE":

        # Somente o responsável ou administrador
        # pode excluir o card.
        if (
            card.responsavel_id is not None
            and card.responsavel_id != current_user.id
            and not current_user.is_admin
        ):

            return jsonify({
                "success": False,
                "message": "Apenas o responsável ou um administrador pode excluir este card."
            }), 403

        try:

            db.session.delete(
                card
            )

            db.session.commit()

            return jsonify({
                "success": True,
                "message": "Card excluído com sucesso."
            }), 200

        except Exception as e:

            db.session.rollback()

            print(
                "ERRO AO EXCLUIR CARD:",
                repr(e)
            )

            return jsonify({
                "success": False,
                "message": "Não foi possível excluir o card."
            }), 500

    # ========================================================
    # PUT
    # ========================================================

    data = request.get_json(
        silent=True
    ) or {}

    novo_status = data.get(
        "status"
    )

    status_anterior = card.status

    # ========================================================
    # REGRA DE RESPONSÁVEL
    # ========================================================

    # Para mover um card, ele obrigatoriamente precisa
    # pertencer à pessoa que está tentando movê-lo.
    if novo_status is not None:

        if card.responsavel_id != current_user.id:

            return jsonify({
                "success": False,
                "message": "Somente o membro que assumiu o card pode movê-lo."
            }), 403

    # ========================================================
    # REGRA DE STATUS
    # ========================================================

    status_validos = {
        "afazer",
        "andamento",
        "concluido"
    }

    if novo_status is not None:

        if novo_status not in status_validos:

            return jsonify({
                "success": False,
                "message": "Status inválido."
            }), 400

        # Card concluído é definitivo.
        if (
            status_anterior == "concluido"
            and novo_status != "concluido"
        ):

            return jsonify({
                "success": False,
                "message": "Cards concluídos não podem voltar para outra coluna."
            }), 400

        # A Fazer -> Concluído NÃO é permitido.
        if (
            status_anterior == "afazer"
            and novo_status == "concluido"
        ):

            return jsonify({
                "success": False,
                "message": "O card precisa passar por 'Em Andamento' antes de ser concluído."
            }), 400

        # Em Andamento -> A Fazer NÃO é permitido.
        if (
            status_anterior == "andamento"
            and novo_status == "afazer"
        ):

            return jsonify({
                "success": False,
                "message": "Um card em andamento não pode voltar para 'A Fazer'."
            }), 400

        # Só permite:
        # A Fazer -> Em Andamento
        # Em Andamento -> Concluído
        # Concluído -> Concluído
        transicoes = {
            "afazer": ["andamento"],
            "andamento": ["concluido"],
            "concluido": []
        }

        if (
            novo_status != status_anterior
            and novo_status not in transicoes.get(
                status_anterior,
                []
            )
        ):

            return jsonify({
                "success": False,
                "message": "Essa movimentação não é permitida."
            }), 400

    # ========================================================
    # ATUALIZAÇÃO DOS DADOS
    # ========================================================

    if novo_status is not None:

        card.status = novo_status

    if "titulo" in data:

        titulo = str(
            data.get("titulo") or ""
        ).strip()

        if not titulo:

            return jsonify({
                "success": False,
                "message": "O título do card não pode ficar vazio."
            }), 400

        card.titulo = titulo

    if "descricao" in data:

        card.descricao = (
            data.get("descricao") or ""
        )

    if "cor" in data:

        card.cor = (
            data.get("cor")
            or "amarelo"
        )

    if "prioridade" in data:

        card.prioridade = (
            data.get("prioridade")
            or "media"
        )

    # ========================================================
    # PONTUAÇÃO
    # ========================================================

    # Somente na primeira passagem para concluído.
    if (
        status_anterior != "concluido"
        and novo_status == "concluido"
        and not card.pontuacao_concedida
    ):

        dono = db.session.get(
            User,
            card.responsavel_id
        )

        if dono:

            dono.pontos = (
                dono.pontos or 0
            ) + 5

            card.pontuacao_concedida = True

    # ========================================================
    # COMMIT
    # ========================================================

    try:

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Card atualizado com sucesso.",
            "card": card.to_dict()
        }), 200

    except Exception as e:

        db.session.rollback()

        print(
            "ERRO AO ATUALIZAR CARD:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Não foi possível atualizar o card."
        }), 500


# ============================================================
# FEED - LISTAR POSTS
# ============================================================

@app.route(
    "/api/posts",
    methods=["GET"]
)
@token_required
def listar_posts(current_user):

    posts = Post.query.order_by(
        Post.data_criacao.desc()
    ).all()

    return jsonify([
        post.to_dict()
        for post in posts
    ]), 200


# ============================================================
# FEED - CRIAR POST
# ============================================================

@app.route(
    "/api/posts",
    methods=["POST"]
)
@token_required
def criar_post(current_user):

    if request.is_json:

        data = request.get_json(
            silent=True
        ) or {}

        conteudo = (
            data.get("conteudo")
            or ""
        ).strip()

        arquivo = None

    else:

        conteudo = (
            request.form.get("conteudo")
            or ""
        ).strip()

        arquivo = request.files.get(
            "arquivo"
        )

    if not conteudo and not arquivo:

        return jsonify({
            "success": False,
            "message": "Escreva algo ou envie uma imagem."
        }), 400

    if len(conteudo) > 500:

        return jsonify({
            "success": False,
            "message": "O post pode possuir no máximo 500 caracteres."
        }), 400

    midia_url = None

    try:

        if arquivo and arquivo.filename:

            midia_url = salvar_arquivo(
                arquivo
            )

        novo_post = Post(
            user_id=current_user.id,
            conteudo=conteudo,
            midia_url=midia_url
        )

        db.session.add(
            novo_post
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Post publicado com sucesso!",
            "post": novo_post.to_dict()
        }), 201

    except ValueError as e:

        db.session.rollback()

        return jsonify({
            "success": False,
            "message": str(e)
        }), 400

    except Exception as e:

        db.session.rollback()

        print(
            "ERRO AO CRIAR POST:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Não foi possível publicar o post."
        }), 500


# ============================================================
# FEED - DELETAR POST
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
            "message": "Post não encontrado."
        }), 404

    if (
        post.user_id != current_user.id
        and not current_user.is_admin
    ):

        return jsonify({
            "success": False,
            "message": "Você não pode excluir este post."
        }), 403

    try:

        db.session.delete(
            post
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Post excluído."
        }), 200

    except Exception as e:

        db.session.rollback()

        print(
            "ERRO AO EXCLUIR POST:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Não foi possível excluir o post."
        }), 500


# ============================================================
# DESTAQUES - TOP 5
# ============================================================

@app.route(
    "/api/membros/destaque",
    methods=["GET"]
)
@app.route(
    "/api/destaques",
    methods=["GET"]
)
def membros_destaque():

    membros = User.query.order_by(
        User.pontos.desc(),
        User.id.asc()
    ).limit(5).all()

    return jsonify([
        membro.to_dict()
        for membro in membros
    ]), 200


# ============================================================
# LISTAR MEMBROS
# ============================================================

@app.route(
    "/api/membros",
    methods=["GET"]
)
@token_required
def listar_membros(current_user):

    membros = User.query.order_by(
        User.nome.asc()
    ).all()

    return jsonify([
        membro.to_dict()
        for membro in membros
    ]), 200


# ============================================================
# ADMIN - EDITAR MEMBRO
# ============================================================

@app.route(
    "/api/membros/<int:user_id>",
    methods=["PUT"]
)
@token_required
def editar_membro(
    current_user,
    user_id
):

    if not current_user.is_admin:

        return jsonify({
            "success": False,
            "message": "Acesso permitido somente para administradores."
        }), 403

    membro = db.session.get(
        User,
        user_id
    )

    if not membro:

        return jsonify({
            "success": False,
            "message": "Membro não encontrado."
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    if "nome" in data:

        nome = str(
            data.get("nome") or ""
        ).strip()

        if nome:
            membro.nome = nome

    if "email" in data:

        email = str(
            data.get("email") or ""
        ).strip().lower()

        if email and email != membro.email:

            existente = User.query.filter_by(
                email=email
            ).first()

            if existente:

                return jsonify({
                    "success": False,
                    "message": "Este e-mail já está em uso."
                }), 400

            membro.email = email

    if "funcao" in data:

        membro.funcao = (
            data.get("funcao")
            or ""
        )

    if "is_admin" in data:

        membro.is_admin = bool(
            data.get("is_admin")
        )

    try:

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Membro atualizado.",
            "usuario": membro.to_dict()
        }), 200

    except Exception as e:

        db.session.rollback()

        print(
            "ERRO ADMIN:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Não foi possível atualizar o membro."
        }), 500


# ============================================================
# ADMIN - EXCLUIR MEMBRO
# ============================================================

@app.route(
    "/api/membros/<int:user_id>",
    methods=["DELETE"]
)
@token_required
def excluir_membro(
    current_user,
    user_id
):

    if not current_user.is_admin:

        return jsonify({
            "success": False,
            "message": "Acesso permitido somente para administradores."
        }), 403

    if user_id == current_user.id:

        return jsonify({
            "success": False,
            "message": "Você não pode excluir sua própria conta por aqui."
        }), 400

    membro = db.session.get(
        User,
        user_id
    )

    if not membro:

        return jsonify({
            "success": False,
            "message": "Membro não encontrado."
        }), 404

    try:

        # Remove cards associados.
        Card.query.filter_by(
            responsavel_id=membro.id
        ).update({
            "responsavel_id": None
        })

        # Remove posts.
        Post.query.filter_by(
            user_id=membro.id
        ).delete(
            synchronize_session=False
        )

        db.session.delete(
            membro
        )

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Membro excluído."
        }), 200

    except Exception as e:

        db.session.rollback()

        print(
            "ERRO AO EXCLUIR MEMBRO:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "message": "Não foi possível excluir o membro."
        }), 500


# ============================================================
# ARQUIVOS UPLOADS
# ============================================================

@app.route(
    "/uploads/<path:filename>",
    methods=["GET"]
)
def serve_upload(filename):

    return send_from_directory(
        app.config["UPLOAD_FOLDER"],
        filename
    )


# ============================================================
# INICIALIZAÇÃO
# ============================================================

if __name__ == "__main__":

    with app.app_context():

        db.create_all()

    print("=" * 60)
    print("LSD API iniciada")
    print("Servidor: http://127.0.0.1:5000")
    print("Status:    http://127.0.0.1:5000/api/status")
    print("=" * 60)

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )