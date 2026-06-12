# Design System — VerdeLima · Escritório Digital v2

> Especificação **canônica** do design system do Escritório Digital v2.
> Esta é a fonte da verdade visual do produto. Qualquer tela, componente ou
> ajuste de tema deve obedecer ao que está aqui.
>
> Versão 1.0 · CRM/dashboard pessoal de usuário único · Next.js 14 + Tailwind + temas dark/light.

---

## 1. Filosofia

O Escritório Digital v2 é uma ferramenta de trabalho que se olha o dia inteiro.
Logo, o visual existe para **organizar informação e apontar o que importa** — não
para decorar. O design system parte de três ideias:

1. **Verde lima é a identidade.** O produto "parece naturalmente verde" quando
   está funcionando — mas isso se expressa por **acentos estruturais contidos**,
   não por encher a tela de verde.
2. **O verde brilhante é raro e tem significado.** Ele é reservado para
   **eventos positivos importantes** (venda, meta, sucesso). Se o verde brilhante
   aparece em tudo, ele para de significar "ganhei".
3. **Menos poluição, mais hierarquia.** Cada cor saturada na tela compete por
   atenção. A regra padrão é **neutro**; cor é exceção com propósito.

> **Mantra:** _estrutura é contida, evento é brilhante, o resto é neutro._

---

## 2. Identidade visual — estrutural vs. evento

O erro mais comum (e a principal correção desta versão) é tratar "verde de marca"
e "verde de sucesso" como a mesma coisa. **São papéis diferentes do mesmo verde.**

| Camada | O que é | Tratamento do verde | Exemplos |
|---|---|---|---|
| **Estrutural** | A identidade ambiente do produto | Verde **contido**: acento pontual, fills sólidos discretos, fundos translúcidos baixos | Botão primário, item ativo da sidebar, foco de input, seleção de texto, ring |
| **Evento** | Um acontecimento positivo digno de registro | Verde **brilhante / glow**, protagonista do momento | Venda concluída, meta batida, toast de sucesso, KPI excelente, etapa "Venda Feita" |

Regra prática:

- **Estrutural** usa o token de acento no seu papel normal (`bg-lime`, `text-lime-fg`,
  `ring`/foco verde). Presença constante, intensidade baixa.
- **Evento** pode usar o verde no auge (glow, `bg-lime` cheio, animação de entrada
  sutil) — mas **só no momento do evento** e em **uma** região da tela por vez.

> Se você está em dúvida se algo é "estrutural" ou "evento": pergunte se aquilo
> **acontece** (evento) ou **simplesmente existe** (estrutural). Um botão existe.
> Uma venda acontece.

---

## 3. Semântica das cores

Há **duas famílias de cor** e elas **não se misturam**:

### 3.1 Cores de STATUS (carga semântica)

Comunicam **estado/qualidade**. Vocabulário fixo, usar com parcimônia.

| Status | Cor | Significado | Usar quando |
|---|---|---|---|
| **Positivo / sucesso** | 🟢 Verde lima | venda, conversão, meta, carteira ativa, crescimento | algo deu certo / está no estado ideal |
| **Atenção** | 🟡 Âmbar | requer ação ou olhar, mas não é erro | prazo próximo, proposta aguardando, pendência |
| **Negativo / erro / perda** | 🔴 Vermelho | erro do sistema, cancelamento, lead **perdido**, churn | algo falhou ou foi perdido de forma definitiva |
| **Neutro / inativo** | ⚪ Cinza-esverdeado | estado sem carga: frio, parado, rascunho, arquivado | lead frio, sem atividade, nada a sinalizar |

> **Regra de ouro:** verde / âmbar / vermelho são **status**, não categorias.
> Nunca use âmbar só porque "é uma etapa amarela" nem vermelho só porque "não é sucesso".

### 3.2 Cores de CATEGORIA (sem carga semântica)

Servem para **diferenciar itens equivalentes** (wayfinding). São **neutras
emocionalmente** — não dizem "bom" nem "ruim", só "diferente".

- Usadas no **funil/pipeline** (ver §14) e em qualquer agrupamento que precise de
  distinção visual sem julgamento.
- Família **fria** (azul → índigo → violeta → roxo). Nunca verde/âmbar/vermelho,
  para não roubar o significado de status.

### 3.3 O conceito "saúde"

Este produto **não monitora "saúde do sistema"** (isso é vocabulário de
observabilidade/infra). Aqui, verde representa:

- **saúde do pipeline** · **carteira ativa** · **crescimento** · **conversão** · **vendas**

Sempre fale em termos de **negócio**, nunca de "sistema/uptime".

---

## 4. Dark mode (tema padrão)

Verde-preto premium. O dark pode parecer **mais vivo** (brilho/saturação do acento),
mas **nunca aumenta a área verde** — mais brilho ≠ mais verde.

### 4.1 Superfícies e texto

| Token (CSS var) | Tailwind | Hex | Uso |
|---|---|---|---|
| `--c-background` / `--bento-bg` | `bg-background` / `bg-bento-bg` | `#080D0A` | canvas principal |
| `--c-muted` | `bg-muted` | `#0D140F` | background secundário |
| `--c-card` / `--bento-panel` | `bg-card` / `bg-bento-panel` | `#111A14` | card / surface |
| `--c-input` / `--c-popover` | `bg-input` / `bg-popover` | `#17231B` | card elevado, inputs, popovers |
| `--c-border` / `--bento-border` | `border-border` | `#263328` | borda discreta |
| `--c-foreground` / `--bento-text` | `text-foreground` | `#F3F7EF` | texto principal (não branco puro) |
| `--c-muted-foreground` / `--bento-dim` | `text-muted-foreground` | `#A8B3A2` | texto secundário (cinza-esverdeado) |
| `--bento-muted` | `text-bento-muted` | `#6F7A6A` | texto fraco / placeholder |

### 4.2 Acento (verde lima)

| Papel | Token | Tailwind | Hex |
|---|---|---|---|
| Fill principal | `--accent` | `bg-lime` / `text-lime-fg` | `#B6FF3B` |
| Hover | `--accent-hover` | `hover:bg-lime-hover` | `#C8FF63` |
| Active / pressed | `--accent-dim` | `active:bg-lime-dim` | `#9FEA22` |
| Texto sobre fill | `--accent-ink` | `text-lime-ink` | `#08120A` |
| Fundo suave (badge +) | `--accent-soft` | `bg-lime-soft` | `#1E3A22` |
| Texto sobre soft | `--accent-soft-fg` | `text-lime-soft-fg` | `#C8FF63` |
| Borda verde (botão 2º) | `--accent-border` | `border-lime` / `border-lime/30` | `#2E4A2E` |
| Glow (evento) | `--accent-glow` | — | `rgba(182,255,59,.30)` |

### 4.3 Status

| Status | Hex (dark) | Tailwind base |
|---|---|---|
| Atenção (âmbar) | `#F5B83D` | `text-amber-400` / `bg-amber-900/20` |
| Erro/perda (vermelho) | `#EF4444` | `text-red-400` / `bg-red-900/20` |
| Neutro | `#A8B3A2` sobre `bg-muted` | `text-muted-foreground` / `bg-muted` |

---

## 5. Light mode

Verde **controlado**. Regra inegociável: **nunca verde neon puro sobre branco**.
Fills usam verde **fechado** com texto branco (contraste AA); texto-acento e bordas
usam verde fechado; fundos de badge usam verde **suave**.

### 5.1 Superfícies e texto

| Token | Tailwind | Hex | Uso |
|---|---|---|---|
| `--c-background` / `--bento-bg` | `bg-background` | `#F7FAF3` | canvas off-white esverdeado |
| `--c-card` / `--bento-panel` | `bg-card` | `#FFFFFF` | cards brancos |
| `--c-muted` | `bg-muted` | `#EEF5E7` | surface suave |
| `--c-border` | `border-border` | `#DCE8D1` | borda |
| `--c-foreground` | `text-foreground` | `#182014` | texto principal |
| `--c-muted-foreground` | `text-muted-foreground` | `#5D6658` | texto secundário |
| `--bento-muted` | `text-bento-muted` | `#8A9182` | texto fraco |

### 5.2 Acento (verde fechado)

| Papel | Tailwind | Hex | Nota |
|---|---|---|---|
| Fill principal | `bg-lime` | `#4F8500` | **texto branco** (`text-lime-ink` = `#FFFFFF`), AA ✅ |
| Hover | `hover:bg-lime-hover` | `#6FAF00` | |
| Active | `active:bg-lime-dim` | `#3F6900` | |
| Texto-acento | `text-lime-fg` | `#4F8500` | verde fechado p/ ler sobre branco |
| Fundo suave (badge +) | `bg-lime-soft` | `#E8F8D2` | |
| Texto sobre soft | `text-lime-soft-fg` | `#3F5A00` | |
| Borda verde | `border-lime` | `#B7E879` | |

### 5.3 Status (light)

| Status | Hex |
|---|---|
| Atenção (âmbar) | `#B7791F` |
| Erro/perda (vermelho) | `#DC2626` |
| Neutro | `#5D6658` sobre `#EEF5E7` |

> O tema é dirigido por **CSS variables** (`:root` = dark, `html.light` = light).
> Todos os tokens acima são theme-aware: o mesmo `bg-lime`/`text-foreground`
> resolve automaticamente para o valor certo em cada tema.

---

## 6. Tipografia

| Família | Token Tailwind | Fonte | Uso |
|---|---|---|---|
| Display | `font-display` | Space Grotesk | títulos, métricas grandes (KPIs) |
| Técnica | `font-tech` | JetBrains Mono | números, valores, timestamps, dados tabulares |
| Corpo | `font-body` | Inter | texto geral, labels, parágrafos |

Escala recomendada:

- **Métrica/KPI:** `font-display` 46px, `tracking-tight` (`-0.03em`), `leading-none`. Centavos a `0.52em` e apagados.
- **Título de seção:** `font-display` 18–24px, semibold.
- **Corpo:** `font-body` 14px (`text-sm`) padrão; 13px em densidade alta.
- **Label/secundário:** 12px (`text-xs`), `text-muted-foreground`.
- **Texto fraco:** 10–11px, `text-bento-muted`.

Regras:
- Texto principal **nunca** branco puro no dark (`#F3F7EF`, não `#FFF`).
- Não usar verde lima em blocos de texto longo — só em **números/labels de destaque**.
- Valores monetários e métricas em `font-tech` (alinhamento e legibilidade de dígitos).

---

## 7. Superfícies & elevação

Quatro níveis, do mais fundo ao mais alto. A elevação é dada por **mudança de
tom + borda discreta**, não por sombra pesada nem por glow.

```
canvas      #080D0A   ← fundo de tela / sidebar
 └ secundário #0D140F ← faixas, áreas de apoio
    └ card     #111A14 ← painéis, cards (a maioria do conteúdo vive aqui)
       └ elevado #17231B ← inputs, popovers, dropdowns, modais
```

- Borda sempre **discreta** (`#263328` dark / `#DCE8D1` light).
- Cantos: `rounded-bento` (14px) em painéis, `rounded-frame` (22px) em frames de
  seção, `rounded-btn` (10px) em botões.
- Sombra: baixa e neutra (`shadow-card`). **Glow verde só em evento.**
- Gradação de painel (`.bento-fx`) é sutil (160°, ~6% de variação). Não chapar, não exagerar.

---

## 8. Botões

| Variante | Dark | Light | Quando |
|---|---|---|---|
| **Primário** | `bg-lime text-lime-ink hover:bg-lime-hover active:bg-lime-dim` | idem (fill `#4F8500`, texto branco) | ação principal da tela (1 por contexto) |
| **Secundário** | `bg-card border border-lime/30 hover:border-lime/60 text-foreground` | idem | ação alternativa; borda verde discreta |
| **Ghost** | `hover:bg-muted text-foreground` | idem | ações terciárias, ícones |
| **Destrutivo** | `bg-red-600 text-white hover:bg-red-500` | idem | excluir, cancelar, perder |
| **Link** | `text-lime-fg hover:underline` | idem | navegação inline |

Padrões:
- **Um** botão primário por contexto. Vários verdes lado a lado anulam a hierarquia.
- Altura mínima de toque **44px** em mobile.
- Primário tem profundidade sutil: inset highlight + sombra colorida **baixa**
  (`.bento-btn`). `active:scale(0.98)`. Sem glow no estado de repouso.
- Loading: spinner em `text-lime-ink` dentro do botão; manter largura.

---

## 9. Inputs

- Repouso: `bg-input border border-border` (dark `#17231B`/`#263328`).
- **Foco: borda verde lima** (`focus:border-lime`) — este é o acento estrutural
  do input. Sem glow forte; uma borda nítida basta.
- Placeholder: `text-bento-muted` / `text-muted-foreground`.
- Erro: `border-red-500` + mensagem em `text-red-400` (dark) / `text-red-600` (light).
- Desabilitado: `opacity-50 cursor-not-allowed`, sem mudar a cor de fundo.
- Campos read-only (ex.: e-mail do perfil) usam `text-muted-foreground` e cursor `not-allowed`.

```tsx
<input className="w-full bg-input border border-border rounded-btn px-3 py-2.5
                  text-sm text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:border-lime" />
```

---

## 10. Tabelas

- **Cabeçalho discreto:** `text-xs uppercase tracking-wide text-muted-foreground`,
  fundo igual ou levemente acima do card. Sem cor forte no header.
- **Linhas:** fundo `card`; hover `bg-muted`. Separador `border-border` finíssimo
  (ou `divide-border`). Densidade alta → 13px, `font-tech` em colunas numéricas.
- **Status na célula:** usar **badge** (§11), não texto colorido solto.
- **Valores positivos** (receita, ganho) podem usar `text-lime-fg`; **perdas** em
  `text-red-400`. Demais números permanecem neutros (`text-foreground`).
- Zebra striping é opcional e, se usado, **muito** sutil (`bg-muted/40`).

---

## 11. Badges

Dois tipos, alinhados à §3.

### Status (carga semântica)

| Badge | Dark | Light |
|---|---|---|
| Sucesso / positivo | `bg-lime-soft text-lime-soft-fg` | `bg-lime-soft text-lime-soft-fg` (`#E8F8D2`/`#3F5A00`) |
| Atenção | `bg-amber-900/20 text-amber-400` | `bg-amber-100 text-amber-700` (via compat) |
| Erro / perda | `bg-red-900/20 text-red-400` | `bg-red-100 text-red-700` |
| Neutro / inativo | `bg-muted text-muted-foreground` | idem |

### Categoria (sem carga) — wayfinding

- Usa a família fria (azul/índigo/violeta/roxo). Ver §14 para o mapa do funil.
- Formato: fundo translúcido + texto da mesma matiz + (opcional) ponto/dot.

Regras:
- Badge de sucesso usa o **soft** (`#1E3A22`/`#E8F8D2`), **não** o fill brilhante.
  O brilhante fica para **evento** (toast), não para um rótulo permanente.
- Badge sempre legível nos dois temas (o soft já é theme-aware).

---

## 12. Gráficos

- **Linha/série principal: verde lima** (`#B6FF3B` dark, `#4F8500`/`#6FAF00` light).
- **Grid quase invisível:** linhas a ~6% de opacidade (`rgba(255,255,255,.06)` dark /
  `rgba(0,0,0,.06)` light). O dado é o protagonista, não a grade.
- Barra "atual/hoje" recebe o acento (`.bento-bar.is-now`) com gradiente
  `accent → accent-dim` e glow **baixo**; barras de contexto ficam neutras (`#263328`).
- Comparações de proporção usam o trilho fino (`.bento-track` 3px) com `.bento-fill`
  (verde) vs `.bento-fill.mut` (neutro).
- Séries categóricas múltiplas → usar a família fria (§3.2), nunca múltiplos verdes.
- Eixos/labels em `text-muted-foreground`, valores em `font-tech`.

---

## 13. Sidebar

- Fundo **limpo**, mesmo tom do canvas (`bg-sidebar` = `#080D0A` dark / `#F7FAF3` light).
- **Item ativo em verde lima** (estrutural): `bg-lime/15 text-lime-fg` + indicador
  (ponto/dot `bg-lime`). Item inativo: `text-muted-foreground`, hover `bg-muted`.
- Ícones: `currentColor`; ativos herdam o verde, inativos ficam neutros.
- Logo: marca; quando ausente, fallback em quadrado `bg-lime` com glifo `text-lime-ink`.
- Sem gradientes chamativos, sem glow. A sidebar é estrutura, não evento.
- Largura: 56 (expandida) / 60px (colapsada); tooltips no estado colapsado.

---

## 14. Pipeline / Funil Comercial

A correção central desta versão. O funil é **wayfinding**, não status — então usa
**cores categóricas frias** nas etapas intermediárias, e reserva as cores
semânticas só para os extremos de resultado.

| Etapa | Tipo | Cor | Racional |
|---|---|---|---|
| **Novo Lead** | categoria | 🔵 azul | entrada, "frio/novo" |
| **Interagiu** | categoria | 🟦 índigo | progressão fria |
| **Reunião** | categoria | 🟣 violeta | progressão |
| **Proposta** | categoria | 🟪 roxo | progressão (perto do fechamento) |
| **Venda Feita** | **evento +** | 🟢 **verde lima** | sucesso — o estado ideal do produto |
| **Perdido** | **status −** | 🔴 **vermelho** | perda definitiva |

Princípios:
- As 4 etapas ativas formam uma **rampa fria coesa** (azul → roxo) que "esquenta"
  em direção ao fechamento, e então **estoura em verde** no ganho. Isso faz o
  "Venda Feita" registrar como evento, justamente por contrastar com a rampa fria.
- **Proposta NÃO usa âmbar.** Âmbar é status de atenção; usar âmbar numa etapa
  implicaria "essa etapa é um alerta", o que é falso. (Migração: o código atual
  ainda usa âmbar em Proposta — deve passar para a matiz categórica acima.)
- **Venda Feita** = verde lima (já implementado, era emerald).
- **Perdido** = vermelho (status de perda, não categoria).
- **Lead frio/parado** dentro de qualquer etapa **não** vira vermelho — recebe
  tratamento **neutro** (badge neutro / opacidade levemente reduzida no card),
  porque não é erro, é ausência de atividade.

Colunas Kanban herdam essas cores do config de etapas (`MAIN_FLOW`) — mudar a etapa
no token central propaga para coluna, card e legenda de métricas.

---

## 15. Toasts

- **Venda concluída / sucesso importante:** verde lima **protagonista** — este é o
  momento do verde brilhante. Fundo `bg-lime` ou borda+ícone verde forte, ícone de
  check, entrada com leve glow que decai. É o auge do acento estrutural→evento.
- **Atenção:** âmbar (`#F5B83D`), ícone de alerta.
- **Erro / perda:** vermelho (`#EF4444`/`#DC2626`), ícone de erro.
- **Info / neutro:** superfície elevada neutra (`bg-popover`), sem cor de status.
- Toasts são **efêmeros** — é aceitável usar o verde cheio aqui porque ele some.
  Não confundir com badge permanente (que usa o soft).

---

## 16. Estados

| Estado | Tratamento |
|---|---|
| **Hover** | superfície sobe um nível (`bg-muted`) ou borda ganha acento (`hover:border-lime/60`) |
| **Active/pressed** | `active:scale(0.98)` em botões; fill vai para `lime-dim` |
| **Foco (teclado)** | borda/ring verde lima (`focus:border-lime` / `ring`) — acessibilidade |
| **Selecionado** | `bg-lime/15 text-lime-fg` (mesmo padrão do item ativo da sidebar) |
| **Desabilitado** | `opacity-50 cursor-not-allowed`, sem recolorir |
| **Loading** | spinner verde/ink, skeleton em `bg-muted` pulsando devagar |
| **Vazio (empty)** | ícone neutro + texto `text-muted-foreground` + 1 CTA primário verde |
| **Neutro / frio / inativo** | `text-muted-foreground` sobre `bg-muted`; **nunca** vermelho |
| **Online / ao vivo** | exceção de animação: pulso sutil verde (`animate-live`) |

> Animação ambiente é **proibida** (o acabamento é estático). Únicas exceções:
> pulso "online", hover/active de botão, e o glow efêmero de um toast de evento.

---

## 17. Exemplos de uso

**✅ KPI positivo (evento) — verde protagonista:**
```tsx
<div className="bento-fx is-hero p-5">
  <p className="text-xs text-muted-foreground">Vendas no mês</p>
  <p className="bento-metric text-lime-fg">R$ 48<span className="cents">.250</span></p>
</div>
```

**✅ Botão primário (estrutural) — verde contido:**
```tsx
<button className="bento-btn px-6 py-2.5 rounded-btn font-semibold">Salvar</button>
```

**✅ Badge de etapa do funil (categoria):**
```tsx
<span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/20 text-indigo-400">Interagiu</span>
```

**✅ Badge "Venda Feita" (status positivo, permanente → soft):**
```tsx
<span className="text-xs px-2 py-0.5 rounded-full bg-lime-soft text-lime-soft-fg">Venda Feita</span>
```

**✅ Lead frio (neutro, não erro):**
```tsx
<span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Sem atividade · 12d</span>
```

---

## 18. Regras do que evitar

- ❌ **Verde em tudo.** Se a tela inteira é verde, nada é verde. Acento é exceção.
- ❌ **Verde brilhante em estado permanente** (badge fixo, fundo de card). Brilhante = evento efêmero.
- ❌ **Âmbar ou vermelho como cor de categoria/etapa.** São status. Etapa usa frio.
- ❌ **Vermelho para lead frio/parado/rascunho.** Não é erro — é neutro.
- ❌ **Verde neon puro sobre branco** no light mode. Fill fechado + texto branco.
- ❌ **Branco puro (`#FFF`) em texto** no dark. Use `#F3F7EF`.
- ❌ **Mais área verde no dark** "porque pode brilhar mais". Mais brilho ≠ mais verde.
- ❌ **Glow/animação ambiente.** Acabamento é estático (ver exceções na §16).
- ❌ **Vários botões primários** no mesmo contexto.
- ❌ **Vocabulário de "saúde do sistema/uptime".** Aqui é pipeline, carteira, conversão, vendas.
- ❌ **Texto longo em verde lima.** Só números/labels de destaque.
- ❌ **Cor de status em gráfico decorativo.** Verde na série principal, frio nas categóricas.

---

## 19. Referência rápida de tokens

**Acento (theme-aware):** `lime` · `lime-hover` · `lime-dim` · `lime-ink` · `lime-fg` · `lime-soft` · `lime-soft-fg` · `lime-border`
**Superfícies:** `background` · `muted` · `card` · `input`/`popover` · `border` · `bento-bg`/`panel`/`border`
**Texto:** `foreground` · `muted-foreground` · `bento-muted`
**Status:** `lime-*` (positivo) · `warning`/`amber-*` (atenção) · `destructive`/`red-*` (erro/perda) · `muted-foreground` (neutro)
**Sidebar:** `sidebar` · `sidebar-foreground` · `sidebar-muted` · `sidebar-accent`
**Tipografia:** `font-display` · `font-tech` · `font-body`
**Raio:** `rounded-bento` (14) · `rounded-frame` (22) · `rounded-btn` (10)

Fonte de implementação: tokens em `src/app/globals.css` (`:root` = dark, `html.light` = light)
e em `tailwind.config.ts`. Camadas de compatibilidade (dark e light) remapeiam hexes
legados para os tokens — migrar para tokens diretos é dívida técnica a quitar pós-lançamento.

---

_Documento canônico. Mudou a regra? Atualize aqui primeiro, depois o código._
