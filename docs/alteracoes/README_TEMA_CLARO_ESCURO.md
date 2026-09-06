# Alteração — Tema claro e escuro do Dashboard

![JavaScript](https://img.shields.io/badge/JavaScript-Tema-F7DF1E)
![CSS](https://img.shields.io/badge/CSS-Dark%20Mode-1572B6)
![Storage](https://img.shields.io/badge/Persistência-localStorage-6A5ACD)
![Status](https://img.shields.io/badge/status-implementado-brightgreen)

Esta documentação descreve o sistema de alternância entre modo claro e modo escuro do Dashboard LSD.

A funcionalidade foi adicionada para melhorar o conforto visual e permitir que o usuário escolha o tema da interface.

---

# Botão de tema

A navbar possui um botão de alternância identificado no JavaScript por:

```text
btnTemaDashboard
```

Quando o dashboard está claro, o botão oferece o modo escuro.

Quando está escuro, oferece o modo claro.

O ícone é atualizado automaticamente:

```text
Claro  → lua
Escuro → sol
```

O `aria-label` também é alterado para manter a acessibilidade do controle.

---

# Persistência da preferência

A preferência é armazenada no navegador utilizando:

```javascript
const TEMA_STORAGE_KEY = "lsd_dashboard_tema";
```

Os valores utilizados são:

```text
claro
escuro
```

Portanto, quando o usuário fecha ou recarrega a página, o tema escolhido continua ativo.

---

# Aplicação antecipada do tema

No início do `dashboard.js`, o tema salvo é verificado antes da montagem completa da interface:

```javascript
if (localStorage.getItem(TEMA_STORAGE_KEY) === "escuro") {
    document.documentElement.classList.add("tema-escuro");
}
```

Essa abordagem reduz o efeito visual de um clarão branco antes de o modo escuro ser aplicado.

---

# Classe utilizada

O modo escuro é controlado pela classe:

```css
html.tema-escuro
```

Exemplo:

```javascript
document.documentElement.classList.toggle(
    "tema-escuro",
    escuro
);
```

---

# Componentes estilizados

As regras de modo escuro abrangem áreas como:

- body do dashboard;
- navbar;
- cards laterais;
- perfil;
- Kanban;
- feed;
- diretório de membros;
- Painel Admin;
- modais;
- formulários;
- inputs;
- botões;
- abas;
- progresso;
- conquistas.

Também é utilizado:

```css
color-scheme: dark;
```

para melhorar a integração dos controles nativos do navegador.

---

# Funções principais

O frontend possui as funções:

```javascript
temaEscuroAtivo()
atualizarBotaoTema()
definirTemaDashboard(tema)
inicializarTemaDashboard()
```

Fluxo:

```text
Clique no botão
      ↓
Verifica tema atual
      ↓
Alterna claro/escuro
      ↓
Atualiza classe HTML
      ↓
Salva no localStorage
      ↓
Atualiza ícone e acessibilidade
```

---

# Principais arquivos envolvidos

```text
dashboard.html
src/js/dashboard.js
src/css/dashboard.css
```

---

# Estado

```text
[OK] Botão na navbar
[OK] Tema claro
[OK] Tema escuro
[OK] Preferência persistente
[OK] Ícone dinâmico
[OK] aria-label dinâmico
[OK] Redução de flash ao carregar
```
