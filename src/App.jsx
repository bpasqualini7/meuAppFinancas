import { useState, useEffect } from 'react'
import { AppProvider, useApp, THEME } from './lib/context'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import C20A from './pages/C20A'
import Watchlist from './pages/Watchlist'
import Proventos from './pages/Proventos'
import Cenario from './pages/Cenario'
import Guia from './pages/Guia'
import Settings from './pages/Settings'
import { Spinner } from './components/ui'
import { signOut } from './lib/supabase'

const NAV = [
  { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
  { id: 'portfolio', icon: '◈', label: 'Carteira' },
  { id: 'c20a', icon: '⭐', label: 'C20A' },
  { id: 'watchlist', icon: '◎', label: 'Watchlist' },
  { id: 'proventos', icon: '◇', label: 'Proventos' },
  { id: 'cenario', icon: '◉', label: 'Cenário' },
  { id: 'guia', icon: '?', label: 'Guia' },
  { id: 'settings', icon: '⚙', label: 'Config.' },
]

const PAGES = { dashboard: Dashboard, portfolio: Portfolio, c20a: C20A, watchlist: Watchlist, proventos: Proventos, cenario: Cenario, guia: Guia, settings: Settings }

function Layout() {
  const { user, profile, loading } = useApp()
  const [page, setPage] = useState('dashboard')

  const theme = profile?.theme || 'dark'
  const fontSize = { sm: 12, md: 14, lg: 16 }[profile?.font_size || 'md']

  // Apply CSS vars
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <nav style={{
        width: 210, background: 'var(--bg2)', borderRight: '1px solid var(--bd)',
        display: 'flex', flexDirection: 'column', position: 'fixed',
        top: 0, left: 0, bottom: 0, zIndex: 50,
      }}>
        <div style={{ padding: '22px 18px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>◈</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>InvestHub</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
            {user.user_metadata?.full_name?.split(' ')[0] || user.email}
          </div>
        </div>

        <div style={{ flex: 1, padding: '6px 10px', overflowY: 'auto' }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              width: '100%', padding: '9px 11px', borderRadius: 9, border: 'none',
              background: page === n.id ? 'rgba(59,130,246,.15)' : 'transparent',
              color: page === n.id ? 'var(--ac)' : 'var(--tx2)',
              display: 'flex', alignItems: 'center', gap: 9,
              fontWeight: page === n.id ? 700 : 400,
              fontSize: fontSize, cursor: 'pointer', marginBottom: 2, textAlign: 'left',
              fontFamily: 'inherit', transition: 'all .12s',
            }}>
              <span style={{ fontSize: 14, width: 16, textAlign: 'center' }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--bd)' }}>
          <button onClick={signOut} style={{
            background: 'none', border: 'none', color: 'var(--tx3)',
            fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            → Sair
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ marginLeft: 210, flex: 1, padding: 28, minHeight: '100vh' }}>
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
