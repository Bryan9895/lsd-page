"""Contratos de autenticação para navegadores com localStorage indisponível."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class AuthStorageTests(unittest.TestCase):
    def test_login_and_register_have_session_storage_fallback(self):
        auth = (ROOT / "src/js/auth.js").read_text(encoding="utf-8")
        self.assertIn("function salvarTokenSeguro(token)", auth)
        self.assertIn("sessionStorage.setItem(TOKEN_KEY, token)", auth)
        self.assertIn('redirecionarSeguro("dashboard.html")', auth)
        self.assertIn("}, 2500);", auth)

    def test_dashboard_reads_token_from_both_storages(self):
        dashboard = (ROOT / "src/js/dashboard-base.js").read_text(encoding="utf-8")
        self.assertIn("localStorage.getItem(TOKEN_KEY)", dashboard)
        self.assertIn("sessionStorage.getItem(TOKEN_KEY)", dashboard)
        self.assertIn("removerTokenDashboard()", dashboard)

    def test_public_pages_also_accept_session_token(self):
        for relative in ("src/js/script-base.js", "src/js/v3-public.js", "src/js/v3-dashboard.js", "src/js/projetos.js"):
            content = (ROOT / relative).read_text(encoding="utf-8")
            self.assertIn("sessionStorage", content, relative)


if __name__ == "__main__":
    unittest.main()
