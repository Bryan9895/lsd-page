"""Verificações estruturais da navbar compartilhada."""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class SharedNavigationTests(unittest.TestCase):
    def test_three_pages_use_shared_navigation(self):
        index = (ROOT / "index.html").read_text(encoding="utf-8")
        projetos = (ROOT / "projetos.html").read_text(encoding="utf-8")
        dashboard = (ROOT / "dashboard.html").read_text(encoding="utf-8")

        self.assertIn('<nav class="site-nav">', index)
        self.assertIn('class="site-nav scrolled"', projetos)
        self.assertIn('class="site-nav site-nav-dashboard scrolled"', dashboard)
        self.assertNotIn('class="dash-nav-logo"', dashboard)

        for label in ("Sobre", "Projetos", "Equipe", "Redes", "Perfil"):
            self.assertIn(f">{label}</a>", dashboard)

    def test_navigation_uses_profile_height(self):
        styles = (ROOT / "src/css/styles.css").read_text(encoding="utf-8")
        responsive = (ROOT / "src/css/responsivo.css").read_text(encoding="utf-8")
        dashboard = (ROOT / "src/css/dashboard.css").read_text(encoding="utf-8")

        self.assertIn("height: 66px;", styles)
        self.assertIn(".site-nav,", responsive)
        self.assertIn("height: 66px;", responsive)
        self.assertIn(".dash-nav .site-nav-dashboard", dashboard)
        self.assertIn("height: 66px;", dashboard)


if __name__ == "__main__":
    unittest.main()
