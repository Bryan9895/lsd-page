import os
import uuid
import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from werkzeug.utils import secure_filename
import jwt

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///banco_de_dados.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'uma_chave_secreta_muito_segura' 

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# ==========================================
# MODELO DO BANCO DE DADOS
# ==========================================
class Usuario(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(128), nullable=False)
    funcao = db.Column(db.String(100))
    bio = db.Column(db.String(160))
    instagram = db.Column(db.String(200))
    github = db.Column(db.String(200))
    foto = db.Column(db.String(200)) 
    is_admin = db.Column(db.Boolean, default=False)
    advertencias = db.Column(db.Integer, default=0)

with app.app_context():
    # Como adicionamos uma coluna nova, recrie o banco deletando o arquivo .db anterior se der erro
    db.create_all()

# ==========================================
# MIDDLEWARE DE SEGURANÇA (EXIGE TOKEN)
# ==========================================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        
        if not token:
            return jsonify({'erro': 'Token ausente. Faça login novamente.'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = Usuario.query.get(data['user_id'])
        except:
            return jsonify({'erro': 'Token inválido ou expirado.'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

# ==========================================
# ROTAS DA API
# ==========================================

@app.route('/uploads/<nome_arquivo>')
def acessar_foto(nome_arquivo):
    return send_from_directory(app.config['UPLOAD_FOLDER'], nome_arquivo)

@app.route('/api/auth/cadastro', methods=['POST'])
def cadastro():
    codigo_recebido = request.form.get('codigo_acesso')
    codigo_secreto = "20251321000001"

    if codigo_recebido != codigo_secreto:
        return jsonify({"erro": "Código de acesso inválido!"}), 403

    nome = request.form.get('nome')
    email = request.form.get('email')
    senha = request.form.get('senha')
    
    if Usuario.query.filter_by(email=email).first():
        return jsonify({"erro": "Este e-mail já está em uso."}), 400

    senha_criptografada = bcrypt.generate_password_hash(senha).decode('utf-8')
    url_foto = None
    foto = request.files.get('foto')
    
    if foto and foto.filename != '':
        extensao = foto.filename.rsplit('.', 1)[-1].lower()
        nome_unico = f"{uuid.uuid4().hex}.{extensao}"
        caminho_completo = os.path.join(app.config['UPLOAD_FOLDER'], nome_unico)
        foto.save(caminho_completo)
        url_foto = f"http://127.0.0.1:5000/uploads/{nome_unico}"

    # Dá admin automaticamente para o Bryan
    is_admin = True if nome.lower() == 'bryan william' else False

    novo_usuario = Usuario(
        nome=nome,
        email=email,
        senha_hash=senha_criptografada,
        funcao=request.form.get('funcao'),
        bio=request.form.get('bio'),
        instagram=request.form.get('instagram'),
        github=request.form.get('github'),
        foto=url_foto,
        is_admin=is_admin
    )
    db.session.add(novo_usuario)
    db.session.commit()

    return jsonify({"mensagem": "Cadastro realizado!"}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    dados = request.get_json()
    usuario = Usuario.query.filter_by(email=dados.get('email')).first()

    if usuario and bcrypt.check_password_hash(usuario.senha_hash, dados.get('senha')):
        token = jwt.encode({
            'user_id': usuario.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            "token": token, 
            "nome": usuario.nome,
            "foto": usuario.foto,
            "is_admin": usuario.is_admin
        }), 200
    
    return jsonify({"erro": "E-mail ou senha incorretos."}), 401

# --- NOVAS ROTAS DE PERFIL ---

@app.route('/api/perfil', methods=['GET'])
@token_required
def obter_perfil(current_user):
    return jsonify({
        "nome": current_user.nome,
        "email": current_user.email,
        "funcao": current_user.funcao,
        "bio": current_user.bio,
        "instagram": current_user.instagram,
        "github": current_user.github,
        "foto": current_user.foto,
        "is_admin": current_user.is_admin
    }), 200

@app.route('/api/perfil', methods=['PUT'])
@token_required
def atualizar_perfil(current_user):
    # Atualiza dados de texto
    current_user.bio = request.form.get('bio', current_user.bio)
    current_user.instagram = request.form.get('instagram', current_user.instagram)
    current_user.github = request.form.get('github', current_user.github)
    
    novo_email = request.form.get('email')
    if novo_email and novo_email != current_user.email:
        if Usuario.query.filter_by(email=novo_email).first():
            return jsonify({"erro": "Este e-mail já pertence a outra conta."}), 400
        current_user.email = novo_email

    # Atualiza foto
    foto = request.files.get('foto')
    if foto and foto.filename != '':
        extensao = foto.filename.rsplit('.', 1)[-1].lower()
        nome_unico = f"{uuid.uuid4().hex}.{extensao}"
        caminho_completo = os.path.join(app.config['UPLOAD_FOLDER'], nome_unico)
        foto.save(caminho_completo)
        current_user.foto = f"http://127.0.0.1:5000/uploads/{nome_unico}"

    db.session.commit()
    
    return jsonify({
        "mensagem": "Perfil atualizado com sucesso!",
        "foto_nova": current_user.foto
    }), 200

# ==========================================
# ROTAS DO PAINEL ADMINISTRATIVO
# ==========================================

@app.route('/api/admin/usuarios', methods=['GET'])
@token_required
def listar_usuarios(current_user):
    # Trava de segurança extra: só passa se for Admin
    if not current_user.is_admin:
        return jsonify({"erro": "Acesso negado. Área restrita para administradores."}), 403
    
    usuarios = Usuario.query.all()
    lista = []
    for u in usuarios:
        lista.append({
            "id": u.id,
            "nome": u.nome,
            "email": u.email,
            "funcao": u.funcao,
            "foto": u.foto,
            "is_admin": u.is_admin,
            "advertencias": u.advertencias
        })
    return jsonify(lista), 200

@app.route('/api/admin/usuarios/<int:user_id>', methods=['DELETE'])
@token_required
def excluir_usuario(current_user, user_id):
    if not current_user.is_admin:
        return jsonify({"erro": "Acesso negado."}), 403
    
    # Impede que o admin exclua a si mesmo sem querer
    if current_user.id == user_id:
        return jsonify({"erro": "Você não pode excluir sua própria conta por aqui."}), 400
        
    usuario = Usuario.query.get(user_id)
    if not usuario:
        return jsonify({"erro": "Usuário não encontrado."}), 404
        
    db.session.delete(usuario)
    db.session.commit()
    return jsonify({"mensagem": "Usuário removido da equipe com sucesso!"}), 200

@app.route('/api/admin/usuarios/<int:user_id>/toggle-admin', methods=['PUT'])
@token_required
def toggle_admin(current_user, user_id):
    if not current_user.is_admin:
        return jsonify({"erro": "Acesso negado."}), 403
        
    if current_user.id == user_id:
        return jsonify({"erro": "Você não pode alterar seu próprio nível de acesso."}), 400
        
    usuario = Usuario.query.get(user_id)
    if not usuario:
        return jsonify({"erro": "Usuário não encontrado."}), 404
        
    # Inverte o status de admin (se era True vira False, se era False vira True)
    usuario.is_admin = not usuario.is_admin
    db.session.commit()
    
    nivel = "Administrador" if usuario.is_admin else "Membro"
    return jsonify({"mensagem": f"{usuario.nome} agora é {nivel}!"}), 200

@app.route('/api/admin/usuarios/<int:user_id>/advertir', methods=['POST'])
@token_required
def advertir_usuario(current_user, user_id):
    if not current_user.is_admin:
        return jsonify({"erro": "Acesso negado."}), 403
        
    if current_user.id == user_id:
        return jsonify({"erro": "Você não pode advertir a si mesmo."}), 400
        
    usuario = Usuario.query.get(user_id)
    if not usuario:
        return jsonify({"erro": "Usuário não encontrado."}), 404
        
    # Incrementa o número de advertências
    if usuario.advertencias is None:
        usuario.advertencias = 0
    usuario.advertencias += 1
    
    db.session.commit()
    
    mensagem = f"Advertência aplicada em {usuario.nome}. Total: {usuario.advertencias}."
    if usuario.advertencias >= 3:
        mensagem += " ⚠️ ALERTA: Este usuário atingiu o limite de advertências!"
        
    return jsonify({"mensagem": mensagem}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)