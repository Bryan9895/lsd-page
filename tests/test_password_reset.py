import os
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit, parse_qs

TEMP = tempfile.TemporaryDirectory()
os.environ.update(DATABASE_PATH=TEMP.name + '/test.db', UPLOAD_FOLDER=TEMP.name + '/uploads',
                  BACKUP_FOLDER=TEMP.name + '/backups', SECRET_KEY='test-secret-' * 8,
                  MAIL_HOST='smtp.example.com', MAIL_USERNAME='test', MAIL_PASSWORD='test',
                  MAIL_FROM='test@example.com', PUBLIC_BASE_URL='https://lsd.example.com',
                  APP_ENV='development', MAIL_BACKEND='smtp', MAIL_SECURITY='starttls', MAIL_PORT='587')
from backend.app import app, db, User
from backend import password_reset
from werkzeug.security import generate_password_hash
SEND_RESET_EMAIL = password_reset.send_reset_email


class PasswordResetTests(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        db.session.add(User(nome='Teste', email='member@example.com', senha_hash=generate_password_hash('old-password')))
        db.session.commit()
        self.client = app.test_client()
        self.mail = patch.object(password_reset, 'send_reset_email').start()

    def tearDown(self):
        patch.stopall()
        db.session.remove()
        self.context.pop()

    def request_token(self):
        response = self.client.post('/api/recuperar-senha', json={'email': 'MEMBER@example.com'})
        self.assertEqual(response.status_code, 202)
        return parse_qs(urlsplit(self.mail.call_args.args[2]).fragment)['token'][0]

    def test_full_flow_replay_sibling_links_and_sessions(self):
        old = self.client.post('/api/login', json={'email': 'member@example.com', 'senha': 'old-password'}).json['token']
        token = self.request_token()
        sibling = self.request_token()
        with self.client.get('/redefinir-senha.html') as response:
            self.assertEqual(response.status_code, 200)
        payload = {'token': token, 'senha': 'new-password'}
        self.assertEqual(self.client.post('/api/redefinir-senha', json=payload).status_code, 200)
        self.assertEqual(self.client.post('/api/redefinir-senha', json=payload).status_code, 400)
        self.assertEqual(self.client.post('/api/redefinir-senha', json={**payload, 'token': sibling}).status_code, 400)
        self.assertEqual(self.client.post('/api/login', json={'email': 'member@example.com', 'senha': 'old-password'}).status_code, 401)
        new = self.client.post('/api/login', json={'email': 'member@example.com', 'senha': 'new-password'})
        self.assertEqual(new.status_code, 200)
        self.assertEqual(self.client.get('/api/perfil', headers={'Authorization': 'Bearer ' + old}).status_code, 401)
        self.assertEqual(self.client.get('/api/perfil', headers={'Authorization': 'Bearer ' + new.json['token']}).status_code, 200)

    def test_unknown_email_has_same_response(self):
        known = self.client.post('/api/recuperar-senha', json={'email': 'member@example.com'})
        unknown = self.client.post('/api/recuperar-senha', json={'email': 'unknown@example.com'})
        self.assertEqual((known.status_code, known.json), (unknown.status_code, unknown.json))
        self.assertEqual(self.mail.call_count, 1)

    def test_expiry_and_invalid_inputs(self):
        token = self.request_token()
        with patch.object(password_reset.time, 'time', return_value=password_reset.time.time() + 1801):
            self.assertEqual(self.client.post('/api/redefinir-senha', json={'token': token, 'senha': 'new-password'}).status_code, 400)
        for body in ([], {'email': []}, {'email': 'bad'}):
            self.assertEqual(self.client.post('/api/recuperar-senha', json=body).status_code, 400)
        for body in ([], {'token': [], 'senha': 'new-password'}, {'token': token, 'senha': 'short'}):
            self.assertEqual(self.client.post('/api/redefinir-senha', json=body).status_code, 400)

    def test_limits_persist_between_requests(self):
        for _ in range(5):
            self.client.post('/api/recuperar-senha', json={'email': 'member@example.com'})
        self.assertEqual(self.mail.call_count, 3)
        for _ in range(15):
            self.client.post('/api/recuperar-senha', json={'email': 'other@example.com'})
        self.assertEqual(self.client.post('/api/recuperar-senha', json={'email': 'other@example.com'}).status_code, 429)

    def test_delivery_failure_and_missing_config(self):
        self.mail.side_effect = OSError('private SMTP details')
        with self.assertLogs(app.logger, level='ERROR') as logs:
            token = self.request_token()
        self.assertNotIn('private SMTP details', str(logs.output))
        self.assertEqual(self.client.post('/api/redefinir-senha', json={'token': token, 'senha': 'new-password'}).status_code, 400)
        with patch.dict(app.config, MAIL_PASSWORD=''):
            self.assertEqual(self.client.post('/api/recuperar-senha', json={'email': 'member@example.com'}).status_code, 503)

    def test_smtp_uses_tls_and_timeout(self):
        with patch.object(password_reset.smtplib, 'SMTP') as smtp:
            SEND_RESET_EMAIL(app.config, 'member@example.com', 'https://example.com/#token=test')
            smtp.assert_called_once_with('smtp.example.com', 587, timeout=10)
            smtp.return_value.__enter__.return_value.starttls.assert_called_once()
            smtp.return_value.__enter__.return_value.send_message.assert_called_once()

    def test_http_local_and_institutional_login_and_reset(self):
        for environment, origin in (
            ('development', 'http://127.0.0.1:5000'),
            ('production', 'http://lsd.maranguape.ifce.edu.br'),
        ):
            with self.subTest(environment=environment), patch.dict(
                    app.config, APP_ENV=environment, PUBLIC_BASE_URL=origin):
                token = self.request_token()
                self.assertTrue(self.mail.call_args.args[2].startswith(origin + '/redefinir-senha.html#token='))
                response = self.client.post('/api/redefinir-senha', base_url=origin,
                                            json={'token': token, 'senha': 'new-password'})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(self.client.post('/api/login', base_url=origin,
                    json={'email': 'member@example.com', 'senha': 'new-password'}).status_code, 200)

    def test_invalid_origins_do_not_send_mail(self):
        for origin in ('', '//example.com', 'ftp://example.com', 'http://user:pass@example.com',
                       'http://example.com/path', 'http://example.com?x=1', 'http://example.com#x',
                       'http://[', 'http://example.com:bad', 'http://exam ple.com'):
            with self.subTest(origin=origin), patch.dict(app.config, PUBLIC_BASE_URL=origin):
                self.assertEqual(self.client.post('/api/recuperar-senha',
                    json={'email': 'member@example.com'}).status_code, 503)
        self.mail.assert_not_called()

    def test_console_flow_without_smtp_credentials(self):
        from io import StringIO
        output = StringIO()
        with patch.dict(app.config, MAIL_BACKEND='console', MAIL_PASSWORD='', MAIL_USERNAME='',
                        PUBLIC_BASE_URL='http://127.0.0.1:5000'), patch('sys.stdout', output):
            self.mail.side_effect = SEND_RESET_EMAIL
            token = self.request_token()
            self.assertIn('EMAIL LOCAL', output.getvalue())
            self.assertEqual(self.client.post('/api/redefinir-senha',
                json={'token': token, 'senha': 'new-password'}).status_code, 200)
        with patch.dict(app.config, MAIL_BACKEND='console', APP_ENV='production'):
            self.assertEqual(self.client.post('/api/recuperar-senha',
                json={'email': 'member@example.com'}).status_code, 503)
            with self.assertRaises(ValueError):
                SEND_RESET_EMAIL(app.config, 'member@example.com', 'http://example.com')

    def test_admin_announcement_uses_unique_bcc_recipients(self):
        admin = User(nome='Admin', email='admin@example.com',
                     senha_hash=generate_password_hash('admin-password'), is_admin=True)
        duplicate = User(nome='Duplicado', email='MEMBER@example.com',
                         senha_hash=generate_password_hash('other-password'))
        db.session.add_all([admin, duplicate])
        db.session.commit()

        member_token = self.client.post('/api/login', json={
            'email': 'member@example.com', 'senha': 'old-password'
        }).json['token']
        self.assertEqual(self.client.post(
            '/api/admin/comunicados',
            headers={'Authorization': 'Bearer ' + member_token},
            json={'assunto': 'Aviso', 'mensagem': 'Mensagem para a equipe.'}
        ).status_code, 403)

        admin_token = self.client.post('/api/login', json={
            'email': 'admin@example.com', 'senha': 'admin-password'
        }).json['token']
        with patch('backend.app.send_announcement_email') as send:
            response = self.client.post(
                '/api/admin/comunicados',
                headers={'Authorization': 'Bearer ' + admin_token},
                json={'assunto': 'Aviso', 'mensagem': 'Mensagem para a equipe.'}
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['destinatarios'], 2)
        recipients = send.call_args.args[1]
        self.assertEqual(recipients, ['admin@example.com', 'member@example.com'])

        invalid = self.client.post(
            '/api/admin/comunicados',
            headers={'Authorization': 'Bearer ' + admin_token},
            json={'assunto': 'Oi', 'mensagem': 'curta'}
        )
        self.assertEqual(invalid.status_code, 400)

if __name__ == '__main__':
    unittest.main()
