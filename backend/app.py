import os
import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import jwt

app = Flask(__name__)
CORS(app)

# Configurações
app.config['SECRET_KEY'] = 'lsd_secret_key_2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///lsd_database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

db = SQLAlchemy(app)

# =========================================================
# MODELOS DE BANCO DE DADOS
# =========================================================

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(255), nullable=False)
    funcao = db.Column(db.String(100), default='Membro LSD')
    foto = db.Column(db.String(255), default='/uploads/default-avatar.png')
    capa = db.Column(db.String(255), default='/uploads/default-capa.jpg')
    projetos_ativos = db.Column(db.Integer, default=0)
    data_entrada = db.Column(db.String(50), default='Mar 2024')
    localizacao = db.Column(db.String(100), default='Maranguape, CE')
    is_admin = db.Column(db.Boolean, default=False)

class Card(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(100), nullable=False)
    descricao = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='afazer') # afazer, andamento, concluido
    cor = db.Column(db.String(20), default='amarelo') # amarelo, azul, rosa, verde, lilas
    data_criacao = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    responsavel_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    responsavel = db.relationship('User', backref='cards')

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    texto = db.Column(db.Text, nullable=False)
    data_criacao = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    usuario_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    usuario = db.relationship('User', backref='posts')
    curtidas = db.relationship('PostCurtida', backref='post', cascade="all, delete-orphan")

class PostCurtida(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

# =========================================================
# DECORADOR DE AUTENTICAÇÃO JWT
# =========================================================

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(" ")[1]

        if not token:
            return jsonify({'message': 'Token de autenticação ausente!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'message': 'Usuário inválido!'}), 401
        except Exception as e:
            return jsonify({'message': 'Token inválido ou expirado!'}), 401

        return f(current_user, *args, **kwargs)
    return decorated

# =========================================================
# ROTAS DE AUTENTICAÇÃO E PERFIL
# =========================================================

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    senha = data.get('senha')

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.senha_hash, senha):
        return jsonify({'message': 'Credenciais inválidas!'}), 401

    token = jwt.encode({
        'user_id': user.id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }, app.config['SECRET_KEY'], algorithm="HS256")

    return jsonify({'token': token, 'user_id': user.id})

@app.route('/api/perfil', methods=['GET'])
@token_required
def get_perfil(current_user):
    return jsonify({
        'id': current_user.id,
        'nome': current_user.nome,
        'email': current_user.email,
        'funcao': current_user.funcao,
        'foto': current_user.foto,
        'capa': current_user.capa,
        'projetos_ativos': current_user.projetos_ativos,
        'data_entrada': current_user.data_entrada,
        'localizacao': current_user.localizacao,
        'is_admin': current_user.is_admin
    })

@app.route('/api/perfil', methods=['PUT'])
@token_required
def update_perfil(current_user):
    nome = request.form.get('nome')
    funcao = request.form.get('funcao')

    if nome: current_user.nome = nome
    if funcao: current_user.funcao = funcao

    if 'avatar' in request.files:
        file = request.files['avatar']
        if file.filename != '':
            filename = secure_filename(f"avatar_{current_user.id}_{file.filename}")
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            current_user.foto = f"/uploads/{filename}"

    if 'capa' in request.files:
        file = request.files['capa']
        if file.filename != '':
            filename = secure_filename(f"capa_{current_user.id}_{file.filename}")
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            current_user.capa = f"/uploads/{filename}"

    db.session.commit()
    return jsonify({'message': 'Perfil atualizado com sucesso!'})

# =========================================================
# ROTAS DO KANBAN (CARDS)
# =========================================================

@app.route('/api/cards', methods=['GET'])
@token_required
def get_cards(current_user):
    cards = Card.query.all()
    resultado = []
    for c in cards:
        resultado.append({
            'id': c.id,
            'titulo': c.titulo,
            'descricao': c.descricao,
            'status': c.status,
            'cor': c.cor,
            'data_criacao': c.data_criacao.isoformat(),
            'responsavel': {
                'id': c.responsavel.id,
                'nome': c.responsavel.nome,
                'foto': c.responsavel.foto
            } if c.responsavel else None
        })
    return jsonify(resultado)

@app.route('/api/cards', methods=['POST'])
@token_required
def create_card(current_user):
    data = request.get_json()
    
    novo_card = Card(
        titulo=data.get('titulo'),
        descricao=data.get('descricao', ''),
        status=data.get('status', 'afazer'),
        cor=data.get('cor', 'amarelo'),
        responsavel_id=current_user.id
    )
    db.session.add(novo_card)
    db.session.commit()

    return jsonify({'message': 'Card criado!', 'id': novo_card.id}), 201

@app.route('/api/cards/<int:card_id>', methods=['PUT'])
@token_required
def update_card(current_user, card_id):
    card = Card.query.get_or_404(card_id)
    data = request.get_json()

    card.titulo = data.get('titulo', card.titulo)
    card.descricao = data.get('descricao', card.descricao)
    card.status = data.get('status', card.status)
    card.cor = data.get('cor', card.cor)

    db.session.commit()
    return jsonify({'message': 'Card atualizado!'})

@app.route('/api/cards/<int:card_id>', methods=['DELETE'])
@token_required
def delete_card(current_user, card_id):
    card = Card.query.get_or_404(card_id)
    db.session.delete(card)
    db.session.commit()
    return jsonify({'message': 'Card excluído!'})

@app.route('/api/cards/<int:card_id>/assumir', methods=['POST'])
@token_required
def assumir_card(current_user, card_id):
    # Regra de negócio: limite de no máximo 2 tarefas ativas por usuário
    tarefas_ativas = Card.query.filter_by(responsavel_id=current_user.id).filter(Card.status != 'concluido').count()
    if tarefas_ativas >= 2:
        return jsonify({'message': 'Você já possui 2 tarefas em andamento! Conclua uma antes de assumir outra.'}), 400

    card = Card.query.get_or_404(card_id)
    card.responsavel_id = current_user.id
    if card.status == 'afazer':
        card.status = 'andamento'

    db.session.commit()
    return jsonify({'message': 'Tarefa assumida com sucesso!'})

# =========================================================
# ROTAS DO FEED DA COMUNIDADE (POSTS)
# =========================================================

@app.route('/api/posts', methods=['GET'])
@token_required
def get_posts(current_user):
    posts = Post.query.order_by(Post.data_criacao.desc()).all()
    resultado = []
    for p in posts:
        curtido_por_mim = any(c.usuario_id == current_user.id for c in p.curtidas)
        resultado.append({
            'id': p.id,
            'autor': p.usuario.nome,
            'foto': p.usuario.foto,
            'meta': f"{p.data_criacao.strftime('%d/%m/%Y às %H:%M')} · {p.usuario.funcao}",
            'texto': p.texto,
            'curtidas': len(p.curtidas),
            'curtido': curtido_por_mim
        })
    return jsonify(resultado)

@app.route('/api/posts', methods=['POST'])
@token_required
def create_post(current_user):
    data = request.get_json()
    texto = data.get('texto', '').strip()
    if not texto:
        return jsonify({'message': 'O texto do post não pode estar vazio.'}), 400

    novo_post = Post(texto=texto, usuario_id=current_user.id)
    db.session.add(novo_post)
    db.session.commit()

    return jsonify({'message': 'Post publicado com sucesso!'}), 201

@app.route('/api/posts/<int:post_id>/curtir', methods=['POST'])
@token_required
def curtir_post(current_user, post_id):
    curtida = PostCurtida.query.filter_by(post_id=post_id, usuario_id=current_user.id).first()
    if curtida:
        db.session.delete(curtida)
        db.session.commit()
        return jsonify({'message': 'Curtida removida!'})
    else:
        nova_curtida = PostCurtida(post_id=post_id, usuario_id=current_user.id)
        db.session.add(nova_curtida)
        db.session.commit()
        return jsonify({'message': 'Post curtido!'})

# =========================================================
# ROUTE DE MEMBROS E ARQUIVOS ESTÁTICOS
# =========================================================

@app.route('/api/membros', methods=['GET'])
@token_required
def get_membros(current_user):
    membros = User.query.filter(User.id != current_user.id).all()
    return jsonify([{
        'id': m.id,
        'nome': m.nome,
        'funcao': m.funcao,
        'foto': m.foto
    } for m in membros])

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# =========================================================
# POVOAMENTO INICIAL DE DADOS (SEED)
# =========================================================

def init_db():
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(email="bryan.william10@aluno.ifce.edu.br").first():
            user = User(
                nome="Bryan William",
                email="bryan.william10@aluno.ifce.edu.br",
                senha_hash=generate_password_hash("123456"),
                funcao="Desenvolvedor Full Stack · Pesquisador LSD",
                projetos_ativos=4,
                is_admin=True
            )
            db.session.add(user)
            db.session.commit()

            # Seed de cards
            cards_demo = [
                Card(titulo="FioCruz", descricao="Monitorar mosquitos modificados para impedir transmissão.", status="andamento", cor="amarelo", responsavel_id=user.id),
                Card(titulo="Racismo Algorítmico", descricao="Análise do impacto do racismo em IAs.", status="andamento", cor="rosa", responsavel_id=user.id),
                Card(titulo="Lupa Digital", descricao="Ferramenta visual com OpenCV.", status="afazer", cor="azul")
            ]
            db.session.add_all(cards_demo)
            db.session.commit()

@app.route('/api/register', methods=['POST'])
def register():
    # Suporta dados vindos via FormData ou via JSON
    data = request.form if request.form else (request.get_json() or {})
    
    email = data.get('email')
    nome = data.get('nome')
    senha = data.get('senha', '123456')
    funcao = data.get('funcao', 'Membro LSD')

    if not email or not nome:
        return jsonify({'message': 'Preencha os campos obrigatórios!'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'E-mail já cadastrado!'}), 400

    foto_path = '/uploads/default-avatar.png'
    if 'foto' in request.files:
        file = request.files['foto']
        if file.filename != '':
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            foto_path = f"/uploads/{filename}"

    novo_usuario = User(
        nome=nome,
        email=email,
        senha_hash=generate_password_hash(senha),
        funcao=funcao,
        foto=foto_path
    )
    
    db.session.add(novo_usuario)
    db.session.commit()
    
    return jsonify({'message': 'Usuário cadastrado com sucesso!'}), 201

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)