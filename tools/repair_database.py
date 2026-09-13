"""Repara inconsistências conhecidas do banco LSD-PAGE sem expor dados.

Por padrão cria uma cópia ``*_repaired.db`` e preserva o banco original.
Use ``--in-place`` somente quando houver um backup externo confirmado.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


UPLOAD_RULES = (
    ("users", "foto", "replace", "/uploads/default-avatar.png"),
    ("users", "capa", "replace", "/uploads/default-capa.jpg"),
    ("posts", "midia_url", "null", None),
    ("posts", "arquivo_url", "null_post_attachment", None),
    ("projetos", "logo_url", "null", None),
    ("projeto_documentos", "arquivo_url", "delete", None),
)


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def table_exists(connection: sqlite3.Connection, table: str) -> bool:
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone() is not None


def column_exists(connection: sqlite3.Connection, table: str, column: str) -> bool:
    if not table_exists(connection, table):
        return False
    return any(
        row[1] == column
        for row in connection.execute(f"PRAGMA table_info({quote_identifier(table)})")
    )


def upload_filename(value: object) -> str | None:
    if not isinstance(value, str) or not value.startswith("/uploads/"):
        return None
    name = Path(value).name
    return name or None


def collect_upload_references(connection: sqlite3.Connection) -> list[dict]:
    references: list[dict] = []
    for table, column, action, default in UPLOAD_RULES:
        if not column_exists(connection, table, column):
            continue
        qtable = quote_identifier(table)
        qcolumn = quote_identifier(column)
        rows = connection.execute(
            f"SELECT rowid, {qcolumn} FROM {qtable} "
            f"WHERE {qcolumn} IS NOT NULL AND TRIM({qcolumn}) <> ''"
        ).fetchall()
        for rowid, value in rows:
            filename = upload_filename(value)
            if filename:
                references.append({
                    "table": table,
                    "column": column,
                    "rowid": rowid,
                    "value": value,
                    "filename": filename,
                    "action": action,
                    "default": default,
                })
    return references


def find_missing_uploads(
    connection: sqlite3.Connection, uploads: Path | None
) -> list[dict]:
    if uploads is None:
        return []
    missing = []
    for item in collect_upload_references(connection):
        if not (uploads / item["filename"]).is_file():
            missing.append(item)
    return missing


def duplicate_achievement_groups(connection: sqlite3.Connection) -> list[tuple[int, int, int]]:
    if not table_exists(connection, "user_achievements"):
        return []
    columns = {row[1] for row in connection.execute('PRAGMA table_info("user_achievements")')}
    if not {"user_id", "achievement_id"}.issubset(columns):
        return []
    return connection.execute(
        "SELECT user_id, achievement_id, COUNT(*) FROM user_achievements "
        "GROUP BY user_id, achievement_id HAVING COUNT(*) > 1"
    ).fetchall()


def inspect_database(database: Path, uploads: Path | None = None) -> dict:
    database = Path(database)
    with sqlite3.connect(database) as connection:
        quick_check = connection.execute("PRAGMA quick_check").fetchone()[0]
        tables = {
            row[0] for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
        duplicates = duplicate_achievement_groups(connection)
        missing_uploads = find_missing_uploads(connection, uploads)
        members = (
            connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            if "users" in tables else 0
        )
    return {
        "database": str(database.resolve()),
        "quick_check": quick_check,
        "tables": sorted(tables),
        "members": members,
        "foreign_key_issues": [list(row) for row in foreign_keys],
        "duplicate_achievement_groups": [list(row) for row in duplicates],
        "missing_uploads": missing_uploads,
        "ok": (
            quick_check == "ok"
            and "users" in tables
            and not foreign_keys
            and not duplicates
            and not missing_uploads
        ),
    }


def _repair_foreign_keys(connection: sqlite3.Connection, report: dict) -> None:
    issues = connection.execute("PRAGMA foreign_key_check").fetchall()
    for table, rowid, parent, fkid in issues:
        if rowid is None:
            report["warnings"].append(
                f"Não foi possível reparar automaticamente {table}: chave sem rowid."
            )
            continue
        qtable = quote_identifier(table)
        connection.execute(f"DELETE FROM {qtable} WHERE rowid = ?", (rowid,))
        report["removed_orphans"].append({
            "table": table,
            "rowid": rowid,
            "missing_parent": parent,
            "foreign_key_index": fkid,
        })


def _repair_duplicate_achievements(connection: sqlite3.Connection, report: dict) -> None:
    for user_id, achievement_id, count in duplicate_achievement_groups(connection):
        rowids = [
            row[0] for row in connection.execute(
                "SELECT rowid FROM user_achievements "
                "WHERE user_id=? AND achievement_id=? ORDER BY rowid",
                (user_id, achievement_id),
            )
        ]
        for rowid in rowids[1:]:
            connection.execute("DELETE FROM user_achievements WHERE rowid=?", (rowid,))
        report["deduplicated_achievements"].append({
            "user_id": user_id,
            "achievement_id": achievement_id,
            "previous_count": count,
            "kept_rowid": rowids[0],
        })


def _repair_missing_uploads(
    connection: sqlite3.Connection, uploads: Path | None, report: dict
) -> None:
    if uploads is None:
        return
    for item in find_missing_uploads(connection, uploads):
        table = item["table"]
        column = item["column"]
        rowid = item["rowid"]
        action = item["action"]
        qtable = quote_identifier(table)
        qcolumn = quote_identifier(column)

        if action == "replace":
            connection.execute(
                f"UPDATE {qtable} SET {qcolumn}=? WHERE rowid=?",
                (item["default"], rowid),
            )
        elif action == "null":
            connection.execute(
                f"UPDATE {qtable} SET {qcolumn}=NULL WHERE rowid=?", (rowid,)
            )
        elif action == "null_post_attachment":
            available = {
                row[1] for row in connection.execute('PRAGMA table_info("posts")')
            }
            assignments = ["arquivo_url=NULL"]
            if "arquivo_nome" in available:
                assignments.append("arquivo_nome=NULL")
            if "arquivo_mime" in available:
                assignments.append("arquivo_mime=NULL")
            connection.execute(
                f"UPDATE posts SET {', '.join(assignments)} WHERE rowid=?", (rowid,)
            )
        elif action == "delete":
            connection.execute(f"DELETE FROM {qtable} WHERE rowid=?", (rowid,))
        else:
            report["warnings"].append(
                f"Ação desconhecida para {table}.{column}: {action}"
            )
            continue

        report["fixed_upload_references"].append({
            "table": table,
            "column": column,
            "rowid": rowid,
            "old_value": item["value"],
            "action": action,
            "new_value": item["default"] if action == "replace" else None,
        })


def repair_database(
    source: Path,
    uploads: Path | None = None,
    output: Path | None = None,
    in_place: bool = False,
) -> tuple[Path, dict]:
    source = Path(source).resolve()
    if not source.is_file():
        raise FileNotFoundError(f"Banco não encontrado: {source}")

    uploads = Path(uploads).resolve() if uploads else None
    if uploads is not None and not uploads.is_dir():
        raise FileNotFoundError(f"Pasta de uploads não encontrada: {uploads}")

    if in_place and output is not None:
        raise ValueError("Use --in-place ou --output, nunca os dois.")

    if in_place:
        target = source
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safety_backup = source.with_name(f"{source.stem}.before_repair_{timestamp}{source.suffix}")
        shutil.copy2(source, safety_backup)
    else:
        target = Path(output).resolve() if output else source.with_name(
            f"{source.stem}_repaired{source.suffix}"
        )
        if target == source:
            raise ValueError("O arquivo de saída não pode sobrescrever o original sem --in-place.")
        shutil.copy2(source, target)
        safety_backup = None

    report = {
        "source": str(source),
        "output": str(target),
        "safety_backup": str(safety_backup) if safety_backup else None,
        "removed_orphans": [],
        "deduplicated_achievements": [],
        "fixed_upload_references": [],
        "warnings": [],
    }

    try:
        with sqlite3.connect(target) as connection:
            if connection.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise sqlite3.DatabaseError("O SQLite de origem falhou no quick_check.")
            connection.execute("BEGIN IMMEDIATE")
            _repair_foreign_keys(connection, report)
            _repair_duplicate_achievements(connection, report)
            _repair_missing_uploads(connection, uploads, report)

            quick = connection.execute("PRAGMA quick_check").fetchone()[0]
            remaining_fk = connection.execute("PRAGMA foreign_key_check").fetchall()
            if quick != "ok" or remaining_fk:
                connection.rollback()
                raise sqlite3.DatabaseError(
                    f"Validação pós-reparo falhou: quick_check={quick}, "
                    f"foreign_keys={len(remaining_fk)}"
                )
            connection.commit()
    except Exception:
        if not in_place and target.exists():
            target.unlink()
        raise

    final = inspect_database(target, uploads)
    report["final_validation"] = final
    return target, report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, help="Banco SQLite a reparar")
    parser.add_argument("--uploads", help="Pasta real de uploads para validar referências")
    parser.add_argument("--output", help="Caminho da cópia reparada")
    parser.add_argument("--in-place", action="store_true", help="Repara o original após criar backup de segurança")
    parser.add_argument("--report", help="Arquivo JSON para salvar o relatório")
    args = parser.parse_args()

    target, report = repair_database(
        Path(args.database),
        Path(args.uploads) if args.uploads else None,
        Path(args.output) if args.output else None,
        args.in_place,
    )
    if args.report:
        Path(args.report).write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    print(f"Banco reparado: {target}")
    print(f"Registros órfãos removidos: {len(report['removed_orphans'])}")
    print(f"Conquistas duplicadas corrigidas: {len(report['deduplicated_achievements'])}")
    print(f"Referências de upload corrigidas: {len(report['fixed_upload_references'])}")
    print("Validação final: OK" if report["final_validation"]["ok"] else "Validação final: ATENÇÃO")


if __name__ == "__main__":
    main()
