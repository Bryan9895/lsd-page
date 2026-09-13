#!/usr/bin/env python3
"""Aplica mudanças pequenas em arquivos legados grandes sem reformatá-los por inteiro."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, *, required=True):
    text = path.read_text(encoding="utf-8")
    if new in text:
        return False
    if old not in text:
        if required:
            raise SystemExit(f"Marcador não encontrado em {path}: {old[:100]!r}")
        return False
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    return True


def patch_app():
    path = ROOT / "backend" / "app.py"
    text = path.read_text(encoding="utf-8")

    # A data de entrada não pode ficar presa ao mês em que a feature foi criada.
    if "def mes_ano_fortaleza():" not in text:
        marker_user = "# ============================================================\n# MODELO USER\n# ============================================================"
        helper = '''MESES_PT_BR = ("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez")\n\n\ndef mes_ano_fortaleza():\n    agora = datetime.now(ZoneInfo("America/Fortaleza"))\n    return f"{MESES_PT_BR[agora.month - 1]} {agora.year}"\n\n\n'''
        if marker_user not in text:
            raise SystemExit("Marcador do modelo User não encontrado em backend/app.py")
        text = text.replace(marker_user, helper + marker_user, 1)
    text = text.replace('default="Set 2026"', 'default=mes_ano_fortaleza', 1)
    # Perfil novo começa neutro; localização só aparece depois que o membro preencher.
    text = text.replace('default="Maranguape, CE"', 'default=""', 1)

    if "register_v3_features(app, db, globals())" not in text:
        marker = "register_password_reset(app, db, User)\ninicializar_aplicacao()"
        replacement = """register_password_reset(app, db, User)
inicializar_aplicacao()

# Ajustes transversais da estabilização V3 são registrados somente depois que
# modelos, rotas e tabelas já existem. O import relativo mantém WSGI/pacote e o
# fallback mantém a execução direta compatíveis.
if __package__:
    from .v3_features import register_v3_features
else:
    from v3_features import register_v3_features
register_v3_features(app, db, globals())"""
        if marker not in text:
            raise SystemExit("Marcador final de inicialização não encontrado em backend/app.py")
        text = text.replace(marker, replacement, 1)

    # Corrige a estatística na origem também; o módulo V3 mantém uma segunda
    # proteção para bancos históricos com registros duplicados.
    pattern = re.compile(
        r"total_desbloqueios = UserAchievement\.query\.filter_by\(\s*"
        r"achievement_id=item\.achievement_id\s*\)\.count\(\)"
    )
    if pattern.search(text):
        text = pattern.sub(
            "total_desbloqueios = (\n"
            "            db.session.query(UserAchievement.user_id)\n"
            "            .filter(UserAchievement.achievement_id == item.achievement_id)\n"
            "            .distinct()\n"
            "            .count()\n"
            "        )",
            text,
            count=1,
        )

    path.write_text(text, encoding="utf-8")


def patch_dashboard_html():
    path = ROOT / "dashboard.html"
    text = path.read_text(encoding="utf-8")
    text = text.replace('<h1 id="perfilNome">Bryan William</h1>', '<h1 id="perfilNome">Seu perfil</h1>')
    text = text.replace(
        '<p id="perfilFuncao">Desenvolvedor Full Stack · Pesquisador LSD</p>',
        '<p id="perfilFuncao">Sua função no LSD</p>',
    )
    text = text.replace('alt="Capa — Laboratório LSD"', 'alt="Sua capa de perfil"')
    text = text.replace(
        '                    <button type="button" class="btn-secundario" id="btnNovoCardHeader"><i class="fas fa-plus"></i> Novo\n                    Card</button>\n',
        '',
    )
    text = text.replace(
        'Envie uma mensagem para todos os e-mails cadastrados no sistema.',
        'Publique um comunicado nas notificações de todos os membros do LSD.',
    )
    path.write_text(text, encoding="utf-8")


def wrap_script(original_name, base_name, enhancement_name):
    js_dir = ROOT / "src" / "js"
    original = js_dir / original_name
    base = js_dir / base_name
    text = original.read_text(encoding="utf-8")
    if "LSD V3 loader" in text:
        return
    if not base.exists():
        base.write_text(text, encoding="utf-8")
    wrapper = f'''/* LSD V3 loader — mantém o código legado intacto e carrega melhorias progressivas. */
(function () {{
    "use strict";
    document.write('<script src="./src/js/{base_name}"><\\/script>');
    document.write('<script src="./src/js/{enhancement_name}"><\\/script>');
}})();
'''
    original.write_text(wrapper, encoding="utf-8")


def patch_scripts():
    wrap_script("dashboard.js", "dashboard-base.js", "v3-dashboard.js")
    wrap_script("script.js", "script-base.js", "v3-public.js")


def patch_readme_note():
    path = ROOT / "docs" / "ESTABILIZACAO_V3.md"
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    note = """

## Pacote de estabilização V3 — notificações e mobile

A camada `backend/v3_features.py` reforça a atribuição de cards, corrige a
estatística de conquistas por usuários únicos, acrescenta nível ao perfil
público, normaliza timestamps UTC e alimenta o sino com eventos sociais,
entrada em projeto/comunidade e comunicados internos. O comunicado do painel
admin não envia e-mail nesta fase; ele cria uma notificação para cada membro.

A recuperação/alteração de senha continua usando e-mail. Em produção configure
`MAIL_*` e `PUBLIC_BASE_URL`; o botão "Alterar senha por e-mail" do perfil usa
o mesmo endpoint seguro de recuperação já testado.

No frontend, `v3-mobile.css` é aplicado progressivamente: desktop permanece
inalterado e as mudanças de Kanban, modais, cards e alvos de toque entram apenas
em telas menores.
"""
    if "## Pacote de estabilização V3 — notificações e mobile" not in text:
        path.write_text(text.rstrip() + note + "\n", encoding="utf-8")


def main():
    patch_app()
    patch_dashboard_html()
    patch_scripts()
    patch_readme_note()
    print("Correções V3 aplicadas com sucesso.")


if __name__ == "__main__":
    main()
