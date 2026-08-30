import os
import uuid
import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from werkzeug.utils import secure_filename
import jwt

# 1. Primeiro criamos a aplicação Flask
app = Flask(__name__)
CORS(app)

# 2. Configurações gerais
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///banco_de_dados.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'uma_chave_secreta_muito_segura' # Mude isso em produção!

# 3. Configuração da pasta de uploads
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
    foto = db.Column(db.String(200)) # Aqui vamos salvar a URL completa da foto

with app.app_context():
    db.create_all()

# ==========================================
# ROTAS DA API
# ==========================================

# ROTA PARA EXIBIR A FOTO NO NAVEGADOR
@app.route('/uploads/<nome_arquivo>')
def acessar_foto(nome_arquivo):
    return send_from_directory(app.config['UPLOAD_FOLDER'], nome_arquivo)

# ROTA DE CADASTRO
@app.route('/api/auth/cadastro', methods=['POST'])
def cadastro():
    codigo_recebido = request.form.get('codigo_acesso')
    codigo_secreto = "20251321000001"

    # Se o código estiver errado, bloqueia o cadastro na hora!
    if codigo_recebido != codigo_secreto:
        return jsonify({"erro": "Código de acesso da equipe inválido!"}), 403

    nome = request.form.get('nome')
    email = request.form.get('email')
    senha = request.form.get('senha')
    
    if Usuario.query.filter_by(email=email).first():
        return jsonify({"erro": "Este e-mail já está em uso."}), 400

    senha_criptografada = bcrypt.generate_password_hash(senha).decode('utf-8')

    url_foto = None
    foto = request.files.get('foto')
    
    # Lógica inteligente para salvar a foto
    if foto and foto.filename != '':
        # Pega a extensão do arquivo (ex: .png, .jpg)
        extensao = foto.filename.rsplit('.', 1)[-1].lower()
        # Cria um nome único usando UUID para não sobreescrever fotos
        nome_unico = f"{uuid.uuid4().hex}.{extensao}"
        
        caminho_completo = os.path.join(app.config['UPLOAD_FOLDER'], nome_unico)
        foto.save(caminho_completo)
        
        # Salva a URL completa para o front-end usar direto na tag <img>
        url_foto = f"http://127.0.0.1:5000/uploads/{nome_unico}"

    novo_usuario = Usuario(
        nome=nome,
        email=email,
        senha_hash=senha_criptografada,
        funcao=request.form.get('funcao'),
        bio=request.form.get('bio'),
        instagram=request.form.get('instagram'),
        github=request.form.get('github'),
        foto=url_foto
    )
    db.session.add(novo_usuario)
    db.session.commit()

    return jsonify({"mensagem": "Cadastro realizado com sucesso!"}), 201


# ROTA DE LOGIN 
@app.route('/api/auth/login', methods=['POST'])
def login():
    dados = request.get_json()
    email = dados.get('email')
    senha = dados.get('senha')

    usuario = Usuario.query.filter_by(email=email).first()

    if usuario and bcrypt.check_password_hash(usuario.senha_hash, senha):
        token = jwt.encode({
            'user_id': usuario.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            "token": token, 
            "mensagem": "Login aprovado!",
            "nome": usuario.nome,
            "foto": usuario.foto
        }), 200
    
    return jsonify({"erro": "E-mail ou senha incorretos."}), 401


# ROTA DE RECUPERAR SENHA
@app.route('/api/auth/recuperar-senha', methods=['POST'])
def recuperar_senha():
    dados = request.get_json()
    email = dados.get('email')
    
    print(f"Lógica de envio de e-mail acionada para: {email}")
    
    return jsonify({"ok": True, "mensagem": "Link enviado se o e-mail existir."}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)