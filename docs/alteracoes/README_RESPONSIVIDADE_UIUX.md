# Alteração — Responsividade e UI/UX do Dashboard

![CSS](https://img.shields.io/badge/CSS-Responsivo-1572B6)
![Mobile](https://img.shields.io/badge/Mobile-Mobile--First-2EA44F)
![UX](https://img.shields.io/badge/UI%2FUX-Otimizado-E8A020)
![Status](https://img.shields.io/badge/status-implementado-brightgreen)

Esta documentação descreve a revisão de responsividade e experiência de uso do Dashboard LSD, com foco em uso diário em celulares, tablets e notebooks.

---

# Objetivos

A revisão prioriza:

- navegação confortável em telas pequenas;
- alvos de toque maiores;
- melhor legibilidade;
- menos conteúdo espremido;
- Kanban utilizável no celular;
- abas do dashboard acessíveis sem quebrar layout;
- maior consistência entre modo claro e modo escuro;
- respeito às áreas seguras de celulares modernos;
- correção do modal de edição de perfil em telas menores.

---

# Navbar do Dashboard

A navbar continua fixa no topo, porém passa a se adaptar conforme a largura disponível.

Em telas grandes:

```text
Logo | Busca | Tema | Site | Sair
```

Em celulares:

```text
Logo             Tema | Site | Sair
Busca em largura total
```

Os textos dos botões secundários são ocultados no celular, mantendo os ícones e `aria-labels` para acessibilidade.

Também foram adicionados tamanhos mínimos de toque próximos de 42–44px.

---

# Abas do Dashboard

As abas:

```text
Quadro Kanban
Feed da Comunidade
Membros
Painel Admin
```

passam a possuir rolagem horizontal em telas pequenas.

Isso evita comprimir excessivamente os textos e botões.

No celular, a barra de abas permanece visível durante a navegação da página através de `position: sticky`.

---

# Kanban no celular

Em vez de reduzir as três colunas até os cards ficarem estreitos demais, o Kanban utiliza navegação horizontal.

Cada coluna ocupa aproximadamente a largura da tela:

```text
[A Fazer] → [Em andamento] → [Concluído]
```

Foi utilizado `scroll-snap` para tornar o movimento entre as colunas mais previsível em telas touch.

---

# Modal Editar Perfil

O problema em que o modal ultrapassava a altura da tela e impedia o usuário de acessar o botão de salvar foi corrigido.

As principais mudanças são:

```css
max-height: calc(100dvh - 32px);
overflow-y: auto;
-webkit-overflow-scrolling: touch;
overscroll-behavior: contain;
```

No celular, o modal funciona visualmente como um `bottom sheet`:

```text
┌──────────────────────┐
│ Editar Perfil      × │
│                      │
│ conteúdo rolável     │
│        ...           │
│                      │
├──────────────────────┤
│ Cancelar | Salvar    │ ← área fixa
└──────────────────────┘
```

A área de ações utiliza `position: sticky`, mantendo os controles acessíveis enquanto o usuário percorre o formulário.

Em celulares muito estreitos, o botão **Salvar Perfil** aparece acima do botão Cancelar para priorizar a ação principal.

---

# Inputs no celular

Os campos do formulário passam a utilizar fonte de `16px` no mobile.

Além de melhorar a leitura, isso evita o zoom automático que navegadores como Safari no iPhone podem aplicar em inputs pequenos.

---

# Safe Area

A página considera dispositivos com notch e barras do sistema utilizando:

```css
env(safe-area-inset-top)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
env(safe-area-inset-right)
```

Também foi atualizado o viewport do dashboard para:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

---

# Modo escuro refinado

O modo escuro foi reorganizado usando variáveis semânticas de interface.

Exemplos:

```css
--dash-bg
--dash-surface
--dash-surface-soft
--dash-border
--dash-text
--dash-text-soft
--dash-accent
```

A nova paleta evita áreas excessivamente pretas e mantém hierarquia entre fundo, cards, inputs e elementos elevados.

Também foram melhorados:

- bordas;
- contraste de textos secundários;
- campos de formulário;
- estados de foco;
- botões secundários;
- Kanban;
- comentários;
- conquistas;
- modais.

---

# Acessibilidade e touch

Foram aplicadas melhorias para uso por toque:

- controles maiores;
- `touch-action: manipulation`;
- ações dos cards visíveis em dispositivos que não possuem hover;
- foco visual em controles de navegação;
- manutenção de `aria-label` nos botões compactos.

---

# Breakpoints principais

```text
> 980px      Desktop / notebook
<= 980px     Tablet / notebook compacto
<= 700px     Mobile
<= 430px     Celulares pequenos
```

---

# Arquivos modificados

```text
dashboard.html
src/css/dashboard.css
```

A lógica de backend não precisou ser alterada para esta atualização.

---

# Estado

```text
Implementado
```
