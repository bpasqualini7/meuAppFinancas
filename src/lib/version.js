// ── Versão do InvestHub ───────────────────────────────────
// Formato: SemVer + data do build
// MAJOR.MINOR.PATCH
// 0.x.x = pré-lançamento (desenvolvimento ativo)
// 1.0.0 = primeira versão estável completa

export const VERSION = {
  major: 0,
  minor: 7,
  patch: 7,
  date: '2026-04-20',
  label: 'beta',
}

export const VERSION_STRING = `v${VERSION.major}.${VERSION.minor}.${VERSION.patch}-${VERSION.label}`
export const BUILD_DATE = new Date(VERSION.date).toLocaleDateString('pt-BR')

// Changelog das versões
export const CHANGELOG = [
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
