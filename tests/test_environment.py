"""Verifica .env relativo ao projeto e prioridade do ambiente do servidor."""
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest


class EnvironmentTests(unittest.TestCase):
    def test_project_dotenv_and_server_override(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'backend').mkdir()
            source = Path(__file__).resolve().parents[1] / 'backend'
            for name in ('app.py', 'password_reset.py'):
                shutil.copy(source / name, root / 'backend' / name)
            (root / '.env').write_text(
                'APP_ENV=development\nMAIL_BACKEND=console\n'
                'SECRET_KEY=only-a-test-secret-with-over-32-characters\n'
                'LSD_ACCESS_CODE=00001\nPUBLIC_BASE_URL=http://127.0.0.1:5000\n'
                'MAIL_FROM=test@example.com\n', encoding='utf-8')
            environment = {k: v for k, v in os.environ.items()
                           if not k.startswith(('MAIL_', 'PUBLIC_BASE_', 'APP_ENV', 'SECRET_KEY',
                                                'DATABASE_PATH', 'UPLOAD_FOLDER', 'BACKUP_FOLDER',
                                                'PYTHON_DOTENV'))}
            environment['PYTHONPATH'] = str(root)
            check = ('from backend.app import app; '
                     "assert app.config['PUBLIC_BASE_URL'] == 'http://127.0.0.1:5000'; "
                     "assert app.config['MAIL_BACKEND'] == 'console'")
            subprocess.run([sys.executable, '-c', check], cwd='/tmp', env=environment,
                           check=True, capture_output=True)
            database = root / 'backend' / 'instance' / 'lsd_database.db'
            self.assertTrue(database.is_file())
            environment.update(APP_ENV='production', MAIL_BACKEND='smtp',
                               PUBLIC_BASE_URL='http://lsd.maranguape.ifce.edu.br',
                               DATABASE_PATH=str(database))
            check = ('from backend.app import app; '
                     "assert app.config['APP_ENV'] == 'production'; "
                     "assert app.config['PUBLIC_BASE_URL'] == 'http://lsd.maranguape.ifce.edu.br'; "
                     "assert app.config['MAIL_BACKEND'] == 'smtp'")
            subprocess.run([sys.executable, '-c', check], cwd='/tmp', env=environment,
                           check=True, capture_output=True)

    def test_production_rejects_missing_or_wrong_database_without_creating_one(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = Path(__file__).resolve().parents[1]
            shutil.copytree(source / 'backend', root / 'backend',
                            ignore=shutil.ignore_patterns('uploads', 'instance', 'backups', '__pycache__'))
            env = {k: v for k, v in os.environ.items() if k not in (
                'DATABASE_PATH', 'APP_ENV', 'PYTHONPATH', 'PYTHON_DOTENV')}
            env.update(PYTHONPATH=str(root), APP_ENV='production')
            env.update(SECRET_KEY='only-a-test-secret-with-over-32-characters',
                       LSD_ACCESS_CODE='00001')
            missing = root / 'backend' / 'instance' / 'incorrect.db'

            for value in (None, 'instance/incorrect.db', str(missing)):
                with self.subTest(value=value):
                    if value is None:
                        env.pop('DATABASE_PATH', None)
                    else:
                        env['DATABASE_PATH'] = value
                    result = subprocess.run([sys.executable, '-c', 'import backend.app'],
                                            cwd='/tmp', env=env, capture_output=True, text=True)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('DATABASE_PATH', result.stderr)
                    self.assertFalse(missing.exists())

            with sqlite3.connect(missing):
                pass
            result = subprocess.run([sys.executable, '-c', 'import backend.app'],
                                    cwd='/tmp', env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('tabela users', result.stderr)

            with sqlite3.connect(missing) as conexao:
                conexao.execute('CREATE TABLE users (id INTEGER PRIMARY KEY)')
            for key, value in (('SECRET_KEY', 'short'), ('LSD_ACCESS_CODE', '')):
                with self.subTest(key=key):
                    invalid = {**env, key: value}
                    result = subprocess.run([sys.executable, '-c', 'import backend.app'],
                                            cwd='/tmp', env=invalid, capture_output=True, text=True)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(key, result.stderr)
