"""Verificação somente leitura do banco escolhido para o deploy."""

import argparse
import os
import sqlite3
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", default=os.environ.get("DATABASE_PATH"),
                        help="Caminho absoluto do mesmo DATABASE_PATH configurado no WSGI")
    parser.add_argument("--uploads", default=os.environ.get("UPLOAD_FOLDER"),
                        help="Pasta de uploads configurada no WSGI")
    parser.add_argument("--schema", action="store_true",
                        help="Exibe tabelas e colunas para preparar migrations, sem dados pessoais")
    args = parser.parse_args()

    if not args.database or not Path(args.database).is_absolute():
        parser.error("informe --database com o caminho absoluto usado pelo WSGI")
    database = Path(args.database)
    if not database.is_file():
        parser.error(f"o banco não existe: {database}")

    try:
        with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True) as conexao:
            integridade = conexao.execute("PRAGMA quick_check").fetchone()[0]
            tabelas = {linha[0] for linha in conexao.execute(
                "SELECT name FROM sqlite_master WHERE type='table'")}
            if integridade != "ok" or "users" not in tabelas:
                parser.error("SQLite inválido ou sem tabela users; o deploy não deve iniciar")
            membros = conexao.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            print(f"Banco confirmado: {database.resolve()}")
            print(f"Integridade: {integridade}; membros: {membros}")
            print("Tabelas principais: " + ", ".join(
                nome for nome in ("users", "cards", "posts", "projects", "notifications")
                if nome in tabelas))
            if args.schema:
                for tabela in sorted(tabelas - {"sqlite_sequence"}):
                    nome_seguro = '"' + tabela.replace('"', '""') + '"'
                    colunas = conexao.execute(f"PRAGMA table_info({nome_seguro})").fetchall()
                    print(f"{tabela}: " + ", ".join(coluna[1] for coluna in colunas))
    except sqlite3.DatabaseError as erro:
        parser.error(f"falha ao ler SQLite: {erro}")

    if args.uploads:
        pasta = Path(args.uploads)
        if not pasta.is_dir():
            parser.error(f"pasta de uploads ausente: {pasta}")
        print(f"Uploads confirmados: {pasta.resolve()}")


if __name__ == "__main__":
    main()
