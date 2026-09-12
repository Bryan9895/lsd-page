"""Verifica .env relativo ao projeto e prioridade do ambiente do servidor."""
import os
from pathlib import Path
import shutil
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
                'SECRET_KEY=only-a-test-secret\nPUBLIC_BASE_URL=http://127.0.0.1:5000\n'
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
            environment.update(APP_ENV='production', MAIL_BACKEND='smtp',
                               PUBLIC_BASE_URL='http://lsd.maranguape.ifce.edu.br')
            check = ('from backend.app import app; '
                     "assert app.config['APP_ENV'] == 'production'; "
                     "assert app.config['PUBLIC_BASE_URL'] == 'http://lsd.maranguape.ifce.edu.br'; "
                     "assert app.config['MAIL_BACKEND'] == 'smtp'")
            subprocess.run([sys.executable, '-c', check], cwd='/tmp', env=environment,
                           check=True, capture_output=True)
