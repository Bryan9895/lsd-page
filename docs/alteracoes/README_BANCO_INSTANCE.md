# Alteração — Banco de dados em `backend/instance`

![SQLite](https://img.shields.io/badge/Database-SQLite-003B57)
![Backend](https://img.shields.io/badge/Backend-Flask-000000)
![Status](https://img.shields.io/badge/status-implementado-brightgreen)

Esta documentação descreve a alteração responsável por mover o banco de dados SQLite principal do LSD para a pasta `backend/instance/`.

---

# Objetivo

Antes desta alteração, o arquivo principal do banco era criado diretamente em:

```text
backend/lsd_database.db
```

A estrutura foi ajustada para manter arquivos de instância separados do código-fonte do backend:

```text
backend/
├── app.py
├── instance/
│   └── lsd_database.db
├── uploads/
└── backups/
```

O novo caminho padrão é:

```text
backend/instance/lsd_database.db
```

---

# Implementação

O backend cria a pasta `instance` automaticamente caso ela ainda não exista:

```python
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")

os.makedirs(
    INSTANCE_DIR,
    exist_ok=True
)
```

Depois, o caminho do SQLite passa a utilizar essa pasta:

```python
DATABASE_PATH = os.path.abspath(
    os.getenv(
        "DATABASE_PATH",
        os.path.join(INSTANCE_DIR, "lsd_database.db")
    )
)
```

A URI utilizada pelo SQLAlchemy continua sendo montada a partir de `DATABASE_PATH`:

```python
app.config["SQLALCHEMY_DATABASE_URI"] = (
    "sqlite:///" + DATABASE_PATH
)
```

---

# Variável de ambiente

O caminho ainda pode ser sobrescrito através de:

```text
DATABASE_PATH
```

Exemplo:

```bash
export DATABASE_PATH=/caminho/persistente/lsd_database.db
```

Caso essa variável não seja definida, o backend utiliza automaticamente:

```text
backend/instance/lsd_database.db
```

---

# Por que usar `instance/`

A separação facilita:

- organização entre código e dados persistentes;
- exclusão do banco do Git através do `.gitignore`;
- manutenção em ambientes de desenvolvimento e produção;
- backups e restaurações;
- futuras migrações para outro banco de dados.

---

# Arquivo principal alterado

```text
backend/app.py
```

---

# Observação sobre bancos antigos

Se existir um banco antigo em:

```text
backend/lsd_database.db
```

e um novo banco em:

```text
backend/instance/lsd_database.db
```

eles são arquivos SQLite diferentes.

Antes de excluir um banco antigo, confirme qual arquivo contém os dados que deseja preservar e faça uma cópia de segurança.

---

# Estado

```text
[OK] Pasta instance criada automaticamente
[OK] Banco principal apontando para backend/instance
[OK] Compatível com DATABASE_PATH via ambiente
[OK] SQLAlchemy utilizando o novo caminho
```
