"""Testes puros para resiliência do frontend de auth e configuração de e-mail."""
from pathlib import Path
import unittest
from unittest.mock import patch

from backend import password_reset


ROOT = Path(__file__).resolve().parents[1]


class AuthAndEmailHardeningTests(unittest.TestCase):
    def base_config(self):
        return {
            "APP_ENV": "development",
            "MAIL_BACKEND": "smtp",
            "MAIL_PROVIDER": "gmail",
            "MAIL_HOST": "smtp.gmail.com",
            "MAIL_PORT": 587,
            "MAIL_SECURITY": "starttls",
            "MAIL_TIMEOUT": 10,
            "MAIL_BATCH_SIZE": 40,
            "MAIL_USERNAME": "sender@example.com",
            "MAIL_PASSWORD": "app-password",
            "MAIL_FROM": "sender@example.com",
            "MAIL_REPLY_TO": "",
            "PUBLIC_BASE_URL": "http://127.0.0.1:5000",
        }

    def test_smtp_configuration_status_is_safe_and_complete(self):
        status = password_reset.email_configuration_status(self.base_config())
        self.assertTrue(status["configured"])
        self.assertEqual(status["provider"], "gmail")
        self.assertNotIn("MAIL_PASSWORD", status)
        self.assertNotIn("MAIL_USERNAME", status)
        self.assertNotIn("app-password", repr(status))

        invalid = self.base_config()
        invalid["MAIL_PASSWORD"] = ""
        invalid_status = password_reset.email_configuration_status(invalid)
        self.assertFalse(invalid_status["configured"])
        self.assertIn("MAIL_PASSWORD", invalid_status["missing"])

    def test_test_email_uses_starttls_login_and_timeout(self):
        config = self.base_config()
        with patch.object(password_reset.smtplib, "SMTP") as smtp:
            password_reset.send_test_email(config, "admin@example.com")
            smtp.assert_called_once_with("smtp.gmail.com", 587, timeout=10)
            connection = smtp.return_value.__enter__.return_value
            connection.starttls.assert_called_once()
            connection.login.assert_called_once_with("sender@example.com", "app-password")
            connection.send_message.assert_called_once()

    def test_announcement_is_batched_and_uses_bcc(self):
        config = self.base_config()
        config["MAIL_BATCH_SIZE"] = 2
        recipients = ["a@example.com", "b@example.com", "c@example.com", "a@example.com"]
        messages = []

        with patch.object(password_reset, "_deliver_message", side_effect=lambda _c, m: messages.append(m)):
            password_reset.send_announcement_email(config, recipients, "Aviso", "Mensagem de teste")

        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0]["To"], "sender@example.com")
        self.assertEqual(messages[0]["Bcc"], "a@example.com, b@example.com")
        self.assertEqual(messages[1]["Bcc"], "c@example.com")

    def test_auth_frontend_guarantees_success_feedback_and_redirect(self):
        source = (ROOT / "src" / "js" / "auth.js").read_text(encoding="utf-8")
        self.assertIn("Conta criada com sucesso! Redirecionando para o seu perfil", source)
        self.assertIn("scrollIntoView", source)
        self.assertIn("SIGNUP_REDIRECT_DELAY_MS", source)
        self.assertIn('"dashboard.html"', source)
        self.assertIn('"entrar-login.html?cadastro=sucesso"', source)
        self.assertIn("cadastroEmAndamento", source)


if __name__ == "__main__":
    unittest.main()
