// ── Versão do InvestHub ───────────────────────────────────
// Formato: SemVer + data do build
// MAJOR.MINOR.PATCH
// 0.x.x = pré-lançamento (desenvolvimento ativo)
// 1.0.0 = primeira versão estável completa

export const VERSION = {
  major: 0,
  minor: 9,
  patch: 8,
  date: '2026-04-25',
  label: 'beta',
}

export const VERSION_STRING = `v${VERSION.major}.${VERSION.minor}.${VERSION.patch}-${VERSION.label}`
export const BUILD_DATE = new Date(VERSION.date).toLocaleDateString('pt-BR')

// Changelog das versões
export const CHANGELOG = [
  { version: 'v0.9.1', date: '26/04/2026', desc: 'Cenário: aba Cripto — gráfico histórico, gatilhos compra/venda/manter, simulador de aporte, balanceamento proporcional, BTC/ETH/ADA/SOL/XRP/POL/LTC/LINK' },
  { version: 'v0.9.0', date: '25/04/2026', desc: 'Cenário: gráfico evolução patrimônio mês a mês, comparativo por classe (FII/Ação BR/outros), barras de dividendos, tooltip hover, tabela últimos 12m, aba Macro' },
  { version: 'v0.8.3', date: '25/04/2026', desc: 'Fix cotações 404 (fallback sem sufixo F), exportar CSV no Extrato e Carteira, melhoria proxy BolsaI fallback chain' },
  { version: 'v0.8.1', date: '25/04/2026', desc: 'Carteira: fix duplicata de classes, coluna Categoria/Setor clicável, filtro por setor via dropdown, asset_class normalizado' },
  { version: 'v0.8.0', date: '25/04/2026', desc: 'Carteira: dashboard KPIs, busca+filtros+ordenação, toggle tabela/cards, logos, Oportunidade, C20A (—/✓), modal extrato completo por ativo com ops+dividendos+PMP acumulado' },
  { version: 'v0.7.19', date: '24/04/2026', desc: 'Dashboard: KPIs só carteira, Selic Real no macro strip, tooltips nos índices, Ações no balanceamento' },
  { version: 'v0.7.18', date: '22/04/2026', desc: 'Item 9: Watchlist com toggle ☰ lista / ⊞ cards, tabela com DY, P/L, P/VP, score colorido' },
  { version: 'v0.7.17', date: '22/04/2026', desc: 'Item 8: Parser PDF nota Inter — importação automática de operações, review antes de confirmar' },
  { version: 'v0.7.16', date: '21/04/2026', desc: 'Item 7: drag-and-drop no Dashboard — reordenar blocos, persistido no localStorage' },
  { version: 'v0.7.15', date: '21/04/2026', desc: 'Item 5: Calendário do Extrato — grade mensal + linha do tempo, modal de detalhe por dia' },
  { version: 'v0.7.14', date: '21/04/2026', desc: 'Carteira: linha expansível com detalhes. Watchlist: modal com indicadores, score e análise' },
  { version: 'v0.7.13', date: '21/04/2026', desc: 'Proxy Vercel serverless para BolsaI e macro — resolve CORS definitivamente' },
  { version: 'v0.7.12', date: '21/04/2026', desc: 'BolsaI integrado como fonte primária de preços BR (ações, FIIs, fundamentais), brapi como fallback' },
  { version: 'v0.7.11', date: '21/04/2026', desc: 'C20A: tabela própria, adicionar/remover ativos, progresso de meta, slots clicáveis' },
  { version: 'v0.7.10', date: '21/04/2026', desc: 'Realizados: suporte a realizações parciais com tag âmbar e métricas de saldo em carteira' },
  { version: 'v0.7.9', date: '21/04/2026', desc: 'Item 4: seção Realizados com P&L, métricas e tags verde/vermelho' },
  { version: 'v0.7.8', date: '21/04/2026', desc: 'Item 2: badge Copom na sidebar/nav com variação da Selic Meta, card de decisão no Cenário' },
  { version: 'v0.7.7', date: '21/04/2026', desc: 'Item 1: nav mobile fixo/recolhível — configurável nas Settings' },
  { version: 'v0.7.6', date: '21/04/2026', desc: 'Mobile polish: grids responsivos, macro strip compacto, overflow corrigido, body bg fixo' },
  { version: 'v0.7.5', date: '21/04/2026', desc: 'Mobile redesign: bottom nav funcional, detecção de tela reativa, sem espaço em branco' },
  { version: 'v0.7.4', date: '20/04/2026', desc: 'Cenário isolado em arquivo próprio — fix definitivo de carregamento' },
  { version: 'v0.7.3', date: '20/04/2026', desc: 'Cenário: feeds RSS do Banco Central (notas, Copom, Focus, press releases)' },
  { version: 'v0.7.2', date: '20/04/2026', desc: 'Fix Cenário — fetchNews desabilitado (CORS), componente não trava mais' },
  { version: 'v0.7.1', date: '20/04/2026', desc: 'Fix Cenário (useEffect), Proventos, imports faltando, mobile bottom nav' },
  { version: 'v0.7.0', date: '20/04/2026', desc: 'Extrato com CRUD, sidebar colapsável, autocomplete com fallback' },
  { version: 'v0.6.0', date: '20/04/2026', desc: 'Macro strip no Dashboard — Selic, CDI, IPCA, IBOV, BTC' },
  { version: 'v0.5.0', date: '19/04/2026', desc: 'Cenário com ranking FII e dados Copom' },
  { version: 'v0.4.0', date: '19/04/2026', desc: 'Autocomplete BR+US, formulário adaptativo RF' },
  { version: 'v0.3.0', date: '19/04/2026', desc: 'C20A, Watchlist, Proventos, Cenário' },
  { version: 'v0.2.0', date: '19/04/2026', desc: 'Supabase, autenticação Google, Portfolio' },
  { version: 'v0.1.0', date: '19/04/2026', desc: 'Estrutura inicial — Vite + React + Supabase' },
]
