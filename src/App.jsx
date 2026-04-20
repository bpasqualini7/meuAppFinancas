import { useState, useEffect } from 'react'
import { AppProvider, useApp, THEME } from './lib/context'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Extrato from './pages/Extrato'
import C20A from './pages/C20A'
import Watchlist from './pages/Watchlist'
import Proventos from './pages/Proventos'
import Cenario from './pages/Cenario'
import Guia from './pages/Guia'
import Settings from './pages/Settings'
import { Spinner } from './components/ui'
import { signOut } from './lib/supabase'
import { VERSION_STRING, BUILD_DATE } from './lib/version'

const NAV = [
  { id: 'dashboard',  icon: '⬡',  label: 'Dashboard' },
  { id: 'portfolio',  icon: '◈',  label: 'Carteira' },
  { id: 'extrato',    icon: '↕',  label: 'Extrato' },
  { id: 'c20a',       icon: '⭐', label: 'C20A' },
  { id: 'watchlist',  icon: '◎',  label: 'Watchlist' },
  { id: 'proventos',  icon: '◇',  label: 'Proventos' },
  { id: 'cenario',    icon: '◉',  label: 'Cenário' },
  { id: 'guia',       icon: '?',  label: 'Guia' },
  { id: 'settings',   icon: '⚙',  label: 'Config.' },
]

const PAGES = {
  dashboard: Dashboard, portfolio: Portfolio, extrato: Extrato,
  c20a: C20A, watchlist: Watchlist, proventos: Proventos,
  cenario: Cenario, guia: Guia, settings: Settings,
}

function Layout() {
  const { user, profile, loading } = useApp()
  const [page, setPage] = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)

  const theme = profile?.theme || 'dark'
  const fontSize = { sm: 12, md: 14, lg: 16 }[profile?.font_size || 'md']

  useEffect(() => {
    const vars = THEME[theme] || THEME.dark
    const root = document.documentElement
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
    document.body.style.fontSize = fontSize + 'px'
  }, [theme, fontSize])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Spinner />
    </div>
  )

  if (!user) return <Login />

  const PageComponent = PAGES[page] || Dashboard
  const sideW = collapsed ? 56 : 210

  return (
    <div style={{ display: 'flex', background: 'var(--bg)', alignItems: 'flex-start' }}>
      {/* Sidebar */}
      <nav style={{
        width: sideW, background: 'var(--bg2)', borderRight: '1px solid var(--bd)',
        display: 'flex', flexDirection: 'column', position: 'fixed',
        top: 0, left: 0, height: '100vh', zIndex: 50,
        transition: 'width .2s cubic-bezier(.4,0,.2,1)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: collapsed ? '18px 0' : '18px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', minHeight: 64, flexShrink: 0 }}>
          {!collapsed && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 20 }}>◈</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>InvestHub</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
                {user.user_metadata?.full_name?.split(' ')[0] || user.email}
              </div>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expandir' : 'Minimizar'} style={{
            background: 'var(--bg3)', border: '1px solid var(--bd)',
            borderRadius: 7, width: 28, height: 28, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--tx3)', fontSize: 13, flexShrink: 0,
            transition: 'background .15s',
          }}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: collapsed ? '6px 0' : '6px 8px', overflowY: 'auto' }}>
          {NAV.map(n => {
            const active = page === n.id
            return (
              <button key={n.id} onClick={() => setPage(n.id)} title={collapsed ? n.label : ''} style={{
                width: '100%', padding: collapsed ? '10px 0' : '9px 10px',
                borderRadius: collapsed ? 0 : 9, border: 'none',
                background: active ? 'rgba(59,130,246,.15)' : 'transparent',
                color: active ? 'var(--ac)' : 'var(--tx2)',
                display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? 0 : 9,
                fontWeight: active ? 700 : 400,
                fontSize, cursor: 'pointer', marginBottom: 2,
                fontFamily: 'inherit', transition: 'all .12s',
                whiteSpace: 'nowrap',
              }}>
                <span style={{ fontSize: 15, width: collapsed ? 'auto' : 16, textAlign: 'center', flexShrink: 0 }}>{n.icon}</span>
                {!collapsed && n.label}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: collapsed ? '12px 0' : '12px 16px 10px', borderTop: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'flex-start', gap: 6 }}>
          <button onClick={signOut} title="Sair" style={{
            background: 'none', border: 'none', color: 'var(--tx3)',
            fontSize: collapsed ? 16 : 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {collapsed ? '→' : '→ Sair'}
          </button>
          {!collapsed && (
            <div style={{ fontSize: 10, color: 'var(--tx3)', opacity: 0.5, fontFamily: 'monospace', letterSpacing: '0.03em' }}>
              {VERSION_STRING} · {BUILD_DATE}
            </div>
          )}
        </div>
      </nav>

      {/* Main */}
      <main style={{ marginLeft: sideW, flex: 1, padding: 28, paddingBottom: 40, transition: 'margin-left .2s cubic-bezier(.4,0,.2,1)' }}>
        <div style={{ maxWidth: 1200 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx)', marginBottom: 20, letterSpacing: '-0.02em' }}>
            {NAV.find(n => n.id === page)?.label}
          </h1>
          <PageComponent onNavigate={setPage} />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  )
}
