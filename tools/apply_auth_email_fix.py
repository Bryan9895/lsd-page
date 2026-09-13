#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str):
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Marcador não encontrado em {path}: {old[:120]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def patch_auth():
    path = ROOT / "src/js/auth.js"
    text = path.read_text(encoding="utf-8")

    old = '''function destinoAposAutenticacao() {
    const destino = sessionStorage.getItem(REDIRECT_KEY) || "dashboard.html";
    sessionStorage.removeItem(REDIRECT_KEY);
    return /^dashboard\\.html(?:\\?[a-zA-Z0-9_=&%-]*)?$/.test(destino)
        ? destino
        : "dashboard.html";
}
'''
    new = '''function lerTokenSeguro() {
    try {
        const tokenLocal = localStorage.getItem(TOKEN_KEY);
        if (tokenLocal && tokenLocal !== "null" && tokenLocal !== "undefined") return tokenLocal;
    } catch (erro) {
        console.warn("localStorage indisponível; usando armazenamento de sessão.", erro);
    }

    try {
        const tokenSessao = sessionStorage.getItem(TOKEN_KEY);
        if (tokenSessao && tokenSessao !== "null" && tokenSessao !== "undefined") return tokenSessao;
    } catch (erro) {
        console.warn("sessionStorage indisponível.", erro);
    }

    return null;
}

function salvarTokenSeguro(token) {
    if (!token) return false;

    try {
        localStorage.setItem(TOKEN_KEY, token);
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) {}
        return true;
    } catch (erro) {
        console.warn("Não foi possível gravar no localStorage; tentando sessionStorage.", erro);
    }

    try {
        sessionStorage.setItem(TOKEN_KEY, token);
        return true;
    } catch (erro) {
        console.error("O navegador bloqueou o armazenamento do login.", erro);
        return false;
    }
}

function removerTokenSeguro() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) {}
}

function redirecionarSeguro(destino) {
    const url = new URL(destino, window.location.href).href;
    try {
        window.location.assign(url);
    } catch (erro) {
        console.warn("Falha no primeiro redirecionamento; tentando href.", erro);
        window.location.href = url;
    }
}
'''
    if old in text:
        text = text.replace(old, new, 1)

    old = '''        if (ok && dados.token) {
            localStorage.setItem(TOKEN_KEY, dados.token);
            window.location.href = destinoAposAutenticacao();
        } else {'''
    new = '''        if (ok && dados.token) {
            if (!salvarTokenSeguro(dados.token)) {
                mostrarMensagem(
                    "login-mensagem",
                    "erro",
                    "Login confirmado, mas o navegador bloqueou o armazenamento da sessão. Verifique as permissões de cookies/dados do site e tente novamente."
                );
                return;
            }
            redirecionarSeguro("dashboard.html");
        } else {'''
    if old not in text:
        raise SystemExit("Bloco de login não encontrado em auth.js")
    text = text.replace(old, new, 1)

    old = '''        if (ok && (dados.success || dados.token)) {
            if (dados.token) {
                localStorage.setItem(TOKEN_KEY, dados.token);
            }
            
            mostrarMensagem(
                "cadastro-mensagem",
                "sucesso",
                '<i class="fas fa-circle-check"></i> Conta criada com sucesso! Redirecionando...'
            );

            setTimeout(() => {
                window.location.href = destinoAposAutenticacao();
            }, 1500);
        } else {'''
    new = '''        if (ok && (dados.success || dados.token)) {
            if (dados.token && !salvarTokenSeguro(dados.token)) {
                mostrarMensagem(
                    "cadastro-mensagem",
                    "erro",
                    '<i class="fas fa-circle-exclamation"></i> Conta criada, mas o navegador bloqueou a sessão. Entre novamente após permitir os dados do site.'
                );
                return;
            }

            mostrarMensagem(
                "cadastro-mensagem",
                "sucesso",
                '<i class="fas fa-circle-check"></i> Conta criada com sucesso! Abrindo seu perfil...'
            );

            setTimeout(() => {
                redirecionarSeguro("dashboard.html");
            }, 2500);
        } else {'''
    if old not in text:
        raise SystemExit("Bloco de cadastro não encontrado em auth.js")
    text = text.replace(old, new, 1)

    text = text.replace("            localStorage.removeItem(TOKEN_KEY);", "            removerTokenSeguro();")
    path.write_text(text, encoding="utf-8")


def patch_dashboard():
    path = ROOT / "src/js/dashboard-base.js"
    text = path.read_text(encoding="utf-8")

    old = '''function obterToken() {
    const token = localStorage.getItem(TOKEN_KEY);

    if (
        !token ||
        token === "null" ||
        token === "undefined"
    ) {
        return null;
    }

    return token;
}

function redirecionarLogin() {
    const retorno = `${window.location.pathname.split("/").pop() || "dashboard.html"}${window.location.search}`;
    sessionStorage.setItem("lsd_redirect_after_login", retorno);
    localStorage.removeItem(TOKEN_KEY);

    if (!window.location.pathname.endsWith("entrar-login.html")) {
        window.location.href = "entrar-login.html";
    }
}
'''
    new = '''function obterToken() {
    let token = null;
    try { token = localStorage.getItem(TOKEN_KEY); } catch (_) {}
    if (!token || token === "null" || token === "undefined") {
        try { token = sessionStorage.getItem(TOKEN_KEY); } catch (_) {}
    }
    return (!token || token === "null" || token === "undefined") ? null : token;
}

function removerTokenDashboard() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) {}
}

function redirecionarLogin() {
    const retorno = `${window.location.pathname.split("/").pop() || "dashboard.html"}${window.location.search}`;
    try { sessionStorage.setItem("lsd_redirect_after_login", retorno); } catch (_) {}
    removerTokenDashboard();

    if (!window.location.pathname.endsWith("entrar-login.html")) {
        window.location.href = "entrar-login.html";
    }
}
'''
    if old not in text:
        raise SystemExit("Bloco de autenticação não encontrado em dashboard-base.js")
    text = text.replace(old, new, 1)

    text = text.replace(
        '    localStorage.setItem(TEMA_STORAGE_KEY, escuro ? "escuro" : "claro");',
        '    try { localStorage.setItem(TEMA_STORAGE_KEY, escuro ? "escuro" : "claro"); } catch (_) {}',
        1,
    )
    text = text.replace(
        '''            localStorage.removeItem(
                TOKEN_KEY
            );''',
        '''            removerTokenDashboard();''',
        1,
    )

    old = '''        formulario.reset();
        if (status) status.textContent = `${resposta.dados.destinatarios} destinatário(s) processado(s).`;
        mostrarToast("Comunicado enviado com sucesso.", "sucesso");'''
    new = '''        formulario.reset();
        const totalNotificacoes = Number(resposta.dados.destinatarios || 0);
        const totalEmails = Number(resposta.dados.destinatarios_email || 0);
        const emailEnviado = resposta.dados.email_enviado === true;
        const emailConfigurado = resposta.dados.email_configurado === true;

        if (status) {
            if (emailEnviado) {
                status.textContent = `${totalNotificacoes} membro(s) notificado(s) e ${totalEmails} e-mail(s) enviado(s).`;
            } else if (emailConfigurado) {
                status.textContent = `${totalNotificacoes} membro(s) notificado(s). O e-mail falhou; confira o SMTP no servidor.`;
            } else {
                status.textContent = `${totalNotificacoes} membro(s) notificado(s). SMTP ainda não configurado para envio real.`;
            }
        }
        mostrarToast(
            emailEnviado ? "Comunicado publicado e enviado por e-mail." : "Comunicado publicado nas notificações.",
            "sucesso"
        );'''
    if old not in text:
        raise SystemExit("Bloco de sucesso do comunicado não encontrado")
    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")


def patch_public_scripts():
    path = ROOT / "src/js/script-base.js"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        '    const token = localStorage.getItem("token_lsd");',
        '    let token = null;\n    try { token = localStorage.getItem("token_lsd"); } catch (_) {}\n    if (!token) { try { token = sessionStorage.getItem("token_lsd"); } catch (_) {} }',
        1,
    )
    text = text.replace(
        '                localStorage.removeItem("token_lsd");',
        '                try { localStorage.removeItem("token_lsd"); } catch (_) {}\n                try { sessionStorage.removeItem("token_lsd"); } catch (_) {}',
        1,
    )
    path.write_text(text, encoding="utf-8")

    path = ROOT / "src/js/v3-public.js"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        '    const token = () => localStorage.getItem(TOKEN_KEY);',
        '    const token = () => {\n        try { const value = localStorage.getItem(TOKEN_KEY); if (value) return value; } catch (_) {}\n        try { return sessionStorage.getItem(TOKEN_KEY); } catch (_) { return null; }\n    };',
        1,
    )
    path.write_text(text, encoding="utf-8")

    path = ROOT / "src/js/v3-dashboard.js"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        '    const token = () => localStorage.getItem(TOKEN_KEY);',
        '    const token = () => {\n        try { const value = localStorage.getItem(TOKEN_KEY); if (value) return value; } catch (_) {}\n        try { return sessionStorage.getItem(TOKEN_KEY); } catch (_) { return null; }\n    };',
        1,
    )
    path.write_text(text, encoding="utf-8")

    path = ROOT / "src/js/projetos.js"
    text = path.read_text(encoding="utf-8")
    marker = 'const TOKEN_KEY = "token_lsd";\n'
    helper = '''const TOKEN_KEY = "token_lsd";\nfunction obterTokenProjeto() {\n    try { const value = localStorage.getItem(TOKEN_KEY); if (value) return value; } catch (_) {}\n    try { return sessionStorage.getItem(TOKEN_KEY); } catch (_) { return null; }\n}\n'''
    if helper not in text:
        if marker not in text:
            raise SystemExit("TOKEN_KEY não encontrado em projetos.js")
        text = text.replace(marker, helper, 1)
    text = text.replace('localStorage.getItem(TOKEN_KEY)', 'obterTokenProjeto()')
    path.write_text(text, encoding="utf-8")


def patch_email():
    path = ROOT / "backend/v3_features.py"
    text = path.read_text(encoding="utf-8")
    old = '''        users = User.query.order_by(User.id.asc()).all()
        for member in users:
            db.session.add(Notification(user_id=member.id, tipo="comunicado", titulo=subject, mensagem=message))
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Comunicado publicado nas notificações de todos os membros.",
            "destinatarios": len(users),
            "canal": "notificacao_interna",
        }), 200'''
    new = '''        users = User.query.order_by(User.id.asc()).all()
        for member in users:
            db.session.add(Notification(user_id=member.id, tipo="comunicado", titulo=subject, mensagem=message))
        db.session.commit()

        recipients = []
        seen = set()
        for member in users:
            email = str(getattr(member, "email", "") or "").strip()
            key = email.lower()
            if email and key not in seen:
                seen.add(key)
                recipients.append(email)

        email_configurado = (
            app.config.get("MAIL_BACKEND") == "smtp"
            and all(app.config.get(name) for name in ("MAIL_HOST", "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_FROM"))
            and app.config.get("MAIL_SECURITY") in {"ssl", "starttls"}
            and bool(recipients)
            and callable(namespace.get("send_announcement_email"))
        )
        email_enviado = False
        if email_configurado:
            try:
                namespace["send_announcement_email"](app.config, recipients, subject, message)
                email_enviado = True
            except Exception:
                app.logger.error("Comunicado salvo nas notificações, mas o transporte SMTP falhou.")

        return jsonify({
            "success": True,
            "message": (
                "Comunicado publicado e enviado por e-mail."
                if email_enviado
                else "Comunicado publicado nas notificações dos membros."
            ),
            "destinatarios": len(users),
            "destinatarios_email": len(recipients),
            "email_configurado": email_configurado,
            "email_enviado": email_enviado,
            "canal": "notificacao_interna_e_email" if email_enviado else "notificacao_interna",
        }), 200'''
    if old not in text:
        raise SystemExit("Bloco de comunicado interno não encontrado em v3_features.py")
    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")

    env = ROOT / ".env.example"
    text = env.read_text(encoding="utf-8")
    text = text.replace(
        'MAIL_PASSWORD=\nMAIL_FROM=desenvolvimento@example.com',
        '# Use uma senha de app do provedor. Nunca envie esta senha ao GitHub.\nMAIL_PASSWORD=\nMAIL_FROM=desenvolvimento@example.com',
        1,
    )
    env.write_text(text, encoding="utf-8")


def patch_tests():
    path = ROOT / "tests/test_password_reset.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        'from backend.app import app, db, User, Post, Notification, Notification',
        'from backend.app import app, db, User, Post, Notification',
        1,
    )
    text = text.replace(
        "        self.assertEqual(response.json['canal'], 'notificacao_interna')\n        self.assertEqual(response.json['destinatarios'], 3)\n        send.assert_not_called()\n        self.assertEqual(Notification.query.filter_by(tipo='comunicado').count(), 3)",
        "        self.assertEqual(response.json['canal'], 'notificacao_interna_e_email')\n        self.assertEqual(response.json['destinatarios'], 3)\n        self.assertEqual(response.json['destinatarios_email'], 2)\n        self.assertTrue(response.json['email_enviado'])\n        send.assert_called_once()\n        self.assertEqual(send.call_args.args[1], ['admin@example.com', 'member@example.com'])\n        self.assertEqual(Notification.query.filter_by(tipo='comunicado').count(), 3)",
        1,
    )
    path.write_text(text, encoding="utf-8")

    path = ROOT / "tests/test_v3_stabilization.py"
    text = path.read_text(encoding="utf-8")
    if 'from unittest.mock import patch' not in text:
        text = text.replace('import unittest\n', 'import unittest\nfrom unittest.mock import patch\n', 1)
    old = '''    def test_admin_announcement_becomes_internal_notification(self):
        headers = self.auth("admin-v3@example.com", "admin-password")
        response = self.client.post("/api/admin/comunicados", headers=headers, json={
            "assunto": "Reunião geral",
            "mensagem": "Hoje teremos uma reunião geral do laboratório às 17h.",
        })
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json["canal"], "notificacao_interna")
        self.assertEqual(response.json["destinatarios"], 3)
        self.assertEqual(Notification.query.filter_by(tipo="comunicado").count(), 3)
'''
    new = '''    def test_admin_announcement_notifies_and_sends_email(self):
        headers = self.auth("admin-v3@example.com", "admin-password")
        with patch("backend.app.send_announcement_email") as send:
            response = self.client.post("/api/admin/comunicados", headers=headers, json={
                "assunto": "Reunião geral",
                "mensagem": "Hoje teremos uma reunião geral do laboratório às 17h.",
            })
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json["canal"], "notificacao_interna_e_email")
        self.assertTrue(response.json["email_enviado"])
        self.assertEqual(response.json["destinatarios"], 3)
        self.assertEqual(response.json["destinatarios_email"], 3)
        send.assert_called_once()
        self.assertEqual(Notification.query.filter_by(tipo="comunicado").count(), 3)
'''
    if old not in text:
        raise SystemExit("Teste antigo de comunicado V3 não encontrado")
    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")

    path = ROOT / "tests/test_auth_storage.py"
    path.write_text('''"""Contratos de autenticação para navegadores com localStorage indisponível."""\nfrom pathlib import Path\nimport unittest\n\nROOT = Path(__file__).resolve().parents[1]\n\n\nclass AuthStorageTests(unittest.TestCase):\n    def test_login_and_register_have_session_storage_fallback(self):\n        auth = (ROOT / "src/js/auth.js").read_text(encoding="utf-8")\n        self.assertIn("function salvarTokenSeguro(token)", auth)\n        self.assertIn("sessionStorage.setItem(TOKEN_KEY, token)", auth)\n        self.assertIn('redirecionarSeguro("dashboard.html")', auth)\n        self.assertIn("}, 2500);", auth)\n\n    def test_dashboard_reads_token_from_both_storages(self):\n        dashboard = (ROOT / "src/js/dashboard-base.js").read_text(encoding="utf-8")\n        self.assertIn("localStorage.getItem(TOKEN_KEY)", dashboard)\n        self.assertIn("sessionStorage.getItem(TOKEN_KEY)", dashboard)\n        self.assertIn("removerTokenDashboard()", dashboard)\n\n    def test_public_pages_also_accept_session_token(self):\n        for relative in ("src/js/script-base.js", "src/js/v3-public.js", "src/js/v3-dashboard.js", "src/js/projetos.js"):\n            content = (ROOT / relative).read_text(encoding="utf-8")\n            self.assertIn("sessionStorage", content, relative)\n\n\nif __name__ == "__main__":\n    unittest.main()\n''', encoding="utf-8")


def main():
    patch_auth()
    patch_dashboard()
    patch_public_scripts()
    patch_email()
    patch_tests()
    print("Correções de autenticação e e-mail aplicadas.")


if __name__ == "__main__":
    main()
