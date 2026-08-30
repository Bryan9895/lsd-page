from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from werkzeug.utils import secure_filename
import jwt
import datetime
import os

app = Flask(__name__)
CORS(app) # Permite que o frontend faça requisições para este servidor

# Configurações do Banco de Dados SQLite e chave de segurança
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///banco_de_dados.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'uma_chave_secreta_muito_segura' # Mude isso em produção!
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# ==========================================
# 1. MODELO DO BANCO DE DADOS
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
    foto = db.Column(db.String(200)) # Caminho da imagem salva

# Cria o banco de dados e as tabelas se não existirem
with app.app_context():
    db.create_all()

# ==========================================
# 2. ROTAS DA API
# ==========================================

# ROTA DE CADASTRO (Recebe FormData do auth.js)
@app.route('/api/auth/cadastro', methods=['POST'])
def cadastro():
    nome = request.form.get('nome')
    email = request.form.get('email')
    senha = request.form.get('senha')
    
    # Verifica se o email já existe
    if Usuario.query.filter_by(email=email).first():
        return jsonify({"erro": "Este e-mail já está em uso."}), 400

    # Criptografa a senha
    senha_criptografada = bcrypt.generate_password_hash(senha).decode('utf-8')

    # Trata o upload da foto (se houver)
    caminho_foto = None
    foto = request.files.get('foto')
    if foto and foto.filename != '':
        nome_arquivo = secure_filename(foto.filename)
        caminho_completo = os.path.join(app.config['UPLOAD_FOLDER'], nome_arquivo)
        foto.save(caminho_completo)
        caminho_foto = caminho_completo

    # Salva no banco de dados
    novo_usuario = Usuario(
        nome=nome,
        email=email,
        senha_hash=senha_criptografada,
        funcao=request.form.get('funcao'),
        bio=request.form.get('bio'),
        instagram=request.form.get('instagram'),
        github=request.form.get('github'),
        foto=caminho_foto
    )
    db.session.add(novo_usuario)
    db.session.commit()

    return jsonify({"mensagem": "Cadastro realizado com sucesso!"}), 201


# ROTA DE LOGIN (Recebe JSON do auth.js)
@app.route('/api/auth/login', methods=['POST'])
def login():
    dados = request.get_json()
    email = dados.get('email')
    senha = dados.get('senha')

    usuario = Usuario.query.filter_by(email=email).first()

    # Verifica se o usuário existe e se a senha criptografada bate com a digitada
    if usuario and bcrypt.check_password_hash(usuario.senha_hash, senha):
        # Gera um token de sessão válido por 24 horas
        token = jwt.encode({
            'user_id': usuario.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({"token": token, "mensagem": "Login aprovado!"}), 200
    
    return jsonify({"erro": "E-mail ou senha incorretos."}), 401


# ROTA DE RECUPERAR SENHA (Recebe JSON do auth.js)
@app.route('/api/auth/recuperar-senha', methods=['POST'])
def recuperar_senha():
    dados = request.get_json()
    email = dados.get('email')
    
    # Aqui você integraria um serviço de envio de e-mails (como SMTP, SendGrid, etc).
    # Por segurança, sempre retornamos sucesso mesmo se o e-mail não existir.
    print(f"Lógica de envio de e-mail acionada para: {email}")
    
    return jsonify({"ok": True, "mensagem": "Link enviado se o e-mail existir."}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)