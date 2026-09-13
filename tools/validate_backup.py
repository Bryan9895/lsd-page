"""Valida um backup ZIP do LSD-PAGE sem restaurá-lo.

Confere SQLite, chaves estrangeiras, duplicidades de conquistas e se os arquivos
referenciados pelo banco realmente existem dentro do ZIP.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import tempfile
import zipfile
from pathlib import Path

from repair_database import (
    collect_upload_references,
    duplicate_achievement_groups,
)


def _database_members(names: list[str]) -> list[str]:
    return [
        name for name in names
        if name.lower().endswith((".db", ".sqlite", ".sqlite3"))
        and not name.endswith("/")
    ]


def validate_backup(backup: Path) -> dict:
    backup = Path(backup).resolve()
    if not backup.is_file():
        raise FileNotFoundError(f"Backup não encontrado: {backup}")

    report = {
        "backup": str(backup),
        "database_member": None,
        "quick_check": None,
        "members": 0,
        "foreign_key_issues": [],
        "duplicate_achievement_groups": [],
        "missing_uploads": [],
        "orphan_uploads": [],
        "warnings": [],
        "ok": False,
    }

    with zipfile.ZipFile(backup) as archive:
        names = archive.namelist()
        databases = _database_members(names)
        if len(databases) != 1:
            raise ValueError(
                f"O backup deve conter exatamente um SQLite; encontrados: {len(databases)}"
            )

        database_member = databases[0]
        report["database_member"] = database_member
        archived_uploads = {
            Path(name).name
            for name in names
            if not name.endswith("/") and name.startswith("uploads/")
        }

        with tempfile.TemporaryDirectory() as directory:
            extracted = Path(directory) / "backup.db"
            with archive.open(database_member) as source, extracted.open("wb") as destination:
                destination.write(source.read())

            with sqlite3.connect(extracted) as connection:
                report["quick_check"] = connection.execute("PRAGMA quick_check").fetchone()[0]
                tables = {
                    row[0] for row in connection.execute(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    )
                }
                if "users" not in tables:
                    report["warnings"].append("Tabela users ausente.")
                else:
                    report["members"] = connection.execute(
                        "SELECT COUNT(*) FROM users"
                    ).fetchone()[0]

                report["foreign_key_issues"] = [
                    list(row) for row in connection.execute("PRAGMA foreign_key_check")
                ]
                report["duplicate_achievement_groups"] = [
                    list(row) for row in duplicate_achievement_groups(connection)
                ]

                references = collect_upload_references(connection)
                referenced_names = {item["filename"] for item in references}
                report["missing_uploads"] = [
                    {
                        "table": item["table"],
                        "column": item["column"],
                        "rowid": item["rowid"],
                        "value": item["value"],
                    }
                    for item in references
                    if item["filename"] not in archived_uploads
                ]

                ignored_defaults = {"default-avatar.png", "default-capa.jpg"}
                report["orphan_uploads"] = sorted(
                    archived_uploads - referenced_names - ignored_defaults
                )

    report["ok"] = (
        report["quick_check"] == "ok"
        and not report["foreign_key_issues"]
        and not report["duplicate_achievement_groups"]
        and not report["missing_uploads"]
        and not report["warnings"]
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", help="Arquivo .zip gerado pelo sistema de backup")
    parser.add_argument("--json", dest="json_path", help="Salva o relatório completo em JSON")
    args = parser.parse_args()

    report = validate_backup(Path(args.backup))
    if args.json_path:
        Path(args.json_path).write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    print(f"Backup: {report['backup']}")
    print(f"SQLite: {report['quick_check']}")
    print(f"Membros: {report['members']}")
    print(f"Problemas de chave estrangeira: {len(report['foreign_key_issues'])}")
    print(f"Grupos de conquistas duplicadas: {len(report['duplicate_achievement_groups'])}")
    print(f"Uploads referenciados ausentes: {len(report['missing_uploads'])}")
    print(f"Uploads sem referência: {len(report['orphan_uploads'])}")
    print("RESULTADO: OK" if report["ok"] else "RESULTADO: PROBLEMAS ENCONTRADOS")
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
