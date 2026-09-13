"""Testes das ferramentas de segurança do banco e dos backups."""

import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.repair_database import inspect_database, repair_database
from tools.validate_backup import validate_backup


SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    foto TEXT,
    capa TEXT
);
CREATE TABLE posts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    midia_url TEXT,
    arquivo_url TEXT,
    arquivo_nome TEXT,
    arquivo_mime TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE achievements (
    id INTEGER PRIMARY KEY
);
CREATE TABLE user_achievements (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    achievement_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(achievement_id) REFERENCES achievements(id)
);
CREATE TABLE post_reactions (
    id INTEGER PRIMARY KEY,
    post_id INTEGER,
    user_id INTEGER,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE projetos (
    id INTEGER PRIMARY KEY,
    logo_url TEXT
);
CREATE TABLE projeto_documentos (
    id INTEGER PRIMARY KEY,
    projeto_id INTEGER,
    arquivo_url TEXT,
    FOREIGN KEY(projeto_id) REFERENCES projetos(id)
);
"""


def build_broken_database(path: Path) -> None:
    with sqlite3.connect(path) as connection:
        connection.executescript(SCHEMA)
        connection.execute(
            "INSERT INTO users(id, foto, capa) VALUES(1, ?, ?)",
            ("/uploads/missing-avatar.png", "/uploads/default-capa.jpg"),
        )
        connection.execute("INSERT INTO achievements(id) VALUES(1)")
        connection.execute(
            "INSERT INTO user_achievements(id, user_id, achievement_id) VALUES(1, 1, 1)"
        )
        connection.execute(
            "INSERT INTO user_achievements(id, user_id, achievement_id) VALUES(2, 1, 1)"
        )
        connection.execute("INSERT INTO projetos(id, logo_url) VALUES(1, NULL)")
        connection.execute(
            "INSERT INTO projeto_documentos(id, projeto_id, arquivo_url) VALUES(1, 1, ?)",
            ("/uploads/missing-document.pdf",),
        )
        # SQLite permite criar dados legados inconsistentes com FK desligada (padrão da conexão).
        connection.execute(
            "INSERT INTO post_reactions(id, post_id, user_id) VALUES(1, 999, 1)"
        )
        connection.commit()


def make_uploads(path: Path) -> None:
    path.mkdir()
    (path / "default-avatar.png").write_bytes(b"avatar")
    (path / "default-capa.jpg").write_bytes(b"cover")


class DatabaseSafetyToolsTests(unittest.TestCase):
    def test_repair_preserves_source_and_fixes_known_inconsistencies(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "lsd_database.db"
            uploads = root / "uploads"
            build_broken_database(source)
            make_uploads(uploads)

            target, report = repair_database(source, uploads)

            self.assertTrue(source.is_file())
            self.assertNotEqual(source, target)
            self.assertEqual(len(report["removed_orphans"]), 1)
            self.assertEqual(len(report["deduplicated_achievements"]), 1)
            self.assertEqual(len(report["fixed_upload_references"]), 2)
            self.assertTrue(report["final_validation"]["ok"])

            original = inspect_database(source, uploads)
            repaired = inspect_database(target, uploads)
            self.assertFalse(original["ok"])
            self.assertTrue(repaired["ok"])

            with sqlite3.connect(target) as connection:
                self.assertEqual(
                    connection.execute("SELECT foto FROM users WHERE id=1").fetchone()[0],
                    "/uploads/default-avatar.png",
                )
                self.assertEqual(
                    connection.execute("SELECT COUNT(*) FROM projeto_documentos").fetchone()[0],
                    0,
                )
                self.assertEqual(
                    connection.execute("SELECT COUNT(*) FROM user_achievements").fetchone()[0],
                    1,
                )

    def test_validate_backup_reports_broken_and_accepts_repaired_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "lsd_database.db"
            uploads = root / "uploads"
            build_broken_database(source)
            make_uploads(uploads)

            broken_zip = root / "broken.zip"
            with zipfile.ZipFile(broken_zip, "w") as archive:
                archive.write(source, "database/lsd_database.db")
                for item in uploads.iterdir():
                    archive.write(item, f"uploads/{item.name}")

            broken = validate_backup(broken_zip)
            self.assertFalse(broken["ok"])
            self.assertEqual(len(broken["foreign_key_issues"]), 1)
            self.assertEqual(len(broken["duplicate_achievement_groups"]), 1)
            self.assertEqual(len(broken["missing_uploads"]), 2)

            repaired, _ = repair_database(source, uploads)
            repaired_zip = root / "repaired.zip"
            with zipfile.ZipFile(repaired_zip, "w") as archive:
                archive.write(repaired, "database/lsd_database.db")
                for item in uploads.iterdir():
                    archive.write(item, f"uploads/{item.name}")

            valid = validate_backup(repaired_zip)
            self.assertTrue(valid["ok"])
            self.assertEqual(valid["foreign_key_issues"], [])
            self.assertEqual(valid["missing_uploads"], [])


if __name__ == "__main__":
    unittest.main()
