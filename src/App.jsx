import { useState, useEffect, useRef } from 'react'
import { AppProvider, useApp, THEME } from './lib/context'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Extrato from './pages/Extrato'
import C20A from './pages/C20A'
import Watchlist from './pages/Watchlist'
import Proventos from './pages/Proventos'
import Cenario from './pages/Cenario'
import Realizados from './pages/Realizados'
import Calendario from './pages/Calendario'
import Guia from './pages/Guia'
import Settings from './pages/Settings'
import { Spinner } from './components/ui'
import { signOut } from './lib/supabase'
import { VERSION_STRING, BUILD_DATE } from './lib/version'

const NAV = [
  { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
  { id: 'portfolio', icon: '◈', label: 'Carteira' },
  { id: 'extrato',   icon: '↕', label: 'Extrato' },
  { id: 'realizados',  icon: '✓', label: 'Realizados' },
  { id: 'calendario',  icon: '📅', label: 'Calendário' },
  { id: 'c20a',      icon: '⭐', label: 'C20A' },
  { id: 'watchlist', icon: '◎', label: 'Watchlist' },
  { id: 'proventos', icon: '◇', label: 'Proventos' },
  { id: 'cenario',   icon: '◉', label: 'Cenário' },
  { id: 'guia',      icon: '?', label: 'Guia' },
  { id: 'settings',  icon: '⚙', label: 'Config.' },
]

// Badge Copom — mostra variação da Selic Meta quando houve mudança recente
function CopomBadge({ macro }) {
  if (!macro?.selicMetaChange || macro.selicMetaChange === 0) return null
  const up = macro.selicMetaChange > 0
  const color = up ? '#ef4444' : '#22c55e'  // alta = ruim (vermelho), baixa = bom (verde)
  const arrow = up ? '▲' : '▼'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: 9, fontWeight: 800, padding: '1px 5px',
      borderRadius: 999, marginLeft: 4,
      background: `${color}22`, color,
      border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
    }}>
      {arrow} {Math.abs(macro.selicMetaChange).toFixed(2)}%
    </span>
  )
}

const PAGES = {
  dashboard: Dashboard, portfolio: Portfolio, extrato: Extrato, realizados: Realizados,
  c20a: C20A, watchlist: Watchlist, proventos: Proventos,
  cenario: Cenario, guia: Guia, settings: Settings,
}

// Bottom nav principal (5 itens) + "Mais" para o resto
const BOTTOM_MAIN = ['dashboard', 'portfolio', 'extrato', 'realizados', 'settings']
const BOTTOM_MORE = ['c20a', 'watchlist', 'calendario', 'proventos', 'cenario', 'guia']

function Layout() {
  const { user, profile, loading, macro } = useApp()
  const [page, setPage] = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900)
  const [showMore, setShowMore] = useState(false)
  const [navVisible, setNavVisible] = useState(true)
  const lastScrollY = useRef(0)
  const navAutoHide = profile?.nav_auto_hide ?? false  // false = sempre fixo

  // Scroll listener para recolher/mostrar bottom nav
  useEffect(() => {
    if (!isMobile || !navAutoHide) { setNavVisible(true); return }
    const handler = () => {
      const current = window.scrollY
      if (current < 10) { setNavVisible(true); return }
      if (current < lastScrollY.current - 8) setNavVisible(true)   // rolou para cima
      else if (current > lastScrollY.current + 8) setNavVisible(false) // rolou para baixo
      lastScrollY.current = current
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [isMobile, navAutoHide])

  // Detectar resize
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const theme = profile?.theme || 'dark'
  const fontSize = { sm: 12, md: 14, lg: 16 }[profile?.font_size || 'md']

  useEffect(() => {
    const vars = THEME[theme] || THEME.dark
    const root = document.documentElement
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
    document.body.style.fontSize = fontSize + 'px'
    document.body.style.background = vars['--bg']
    document.body.style.minHeight = '100vh'
  }, [theme, fontSize])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Spinner />
    </div>
  )

  if (!user) return <Login />

  const PageComponent = PAGES[page] || Dashboard
  const sideW = collapsed ? 56 : 210

  const goTo = (id) => { setPage(id); setShowMore(false) }

  return (
    <div style={{ display: 'flex', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── Sidebar (desktop) ── */}
      {!isMobile && (
        <nav style={{
          width: sideW, background: 'var(--bg2)', borderRight: '1px solid var(--bd)',
          display: 'flex', flexDirection: 'column', position: 'fixed',
          top: 0, left: 0, height: '100vh', zIndex: 50,
          transition: 'width .2s ease', overflow: 'hidden', flexShrink: 0,
        }}>
          {/* Header */}
          <div style={{ padding: collapsed ? '16px 0' : '18px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', flexShrink: 0, minHeight: 60 }}>
            {!collapsed && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 18 }}>◈</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>InvestHub</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
                  {user.user_metadata?.full_name?.split(' ')[0] || user.email}
                </div>
              </div>
            )}
            <button onClick={() => setCollapsed(c => !c)} style={{
              background: 'var(--bg3)', border: '1px solid var(--bd)', borderRadius: 7,
              width: 26, height: 26, cursor: 'pointer', color: 'var(--tx3)',
              fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {collapsed ? '›' : '‹'}
            </button>
          </div>

          {/* Nav */}
          <div style={{ flex: 1, padding: collapsed ? '4px 0' : '4px 8px', overflowY: 'auto' }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => goTo(n.id)} title={collapsed ? n.label : ''} style={{
                width: '100%', padding: collapsed ? '10px 0' : '8px 10px',
                borderRadius: collapsed ? 0 : 8, border: 'none',
                background: page === n.id ? 'rgba(59,130,246,.15)' : 'transparent',
                color: page === n.id ? 'var(--ac)' : 'var(--tx2)',
                display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 9, fontWeight: page === n.id ? 700 : 400,
                fontSize, cursor: 'pointer', marginBottom: 1,
                fontFamily: 'inherit', transition: 'all .1s', whiteSpace: 'nowrap',
              }}>
                <span style={{ fontSize: 14, width: collapsed ? 'auto' : 16, textAlign: 'center', flexShrink: 0 }}>{n.icon}</span>
                {!collapsed && n.label}
                {!collapsed && n.id === 'cenario' && <CopomBadge macro={macro} />}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding: collapsed ? '10px 0' : '10px 16px', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
            <button onClick={signOut} style={{ background: 'none', border: 'none', color: 'var(--tx3)', fontSize: collapsed ? 15 : 11, cursor: 'pointer', fontFamily: 'inherit', display: 'block' }}>
              {collapsed ? '→' : '→ Sair'}
            </button>
            {!collapsed && (
              <div style={{ fontSize: 10, color: 'var(--tx3)', opacity: 0.4, fontFamily: 'monospace', marginTop: 6 }}>
                {VERSION_STRING} · {BUILD_DATE}
              </div>
            )}
          </div>
        </nav>
      )}

      {/* ── Main content ── */}
      <main style={{
        marginLeft: isMobile ? 0 : sideW,
        flex: 1, minWidth: 0,
        padding: isMobile ? '16px 14px 90px' : '24px 28px 40px',
        transition: 'margin-left .2s ease',
      }}>
        <div style={{ maxWidth: 1200 }}>
          {/* Título da página */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            {isMobile && (
              <span style={{ fontSize: 18 }}>{NAV.find(n => n.id === page)?.icon}</span>
            )}
            <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>
              {NAV.find(n => n.id === page)?.label}
            </h1>
            {isMobile && (
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--tx3)', fontFamily: 'monospace', opacity: 0.5 }}>
                {VERSION_STRING}
              </span>
            )}
          </div>
          <PageComponent onNavigate={goTo} />
        </div>
      </main>

      {/* ── Bottom nav (mobile) ── */}
      {isMobile && (
        <>
          {/* Overlay "Mais" */}
          {showMore && (
            <div onClick={() => setShowMore(false)} style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,.5)' }}>
              <div onClick={e => e.stopPropagation()} style={{
                position: 'absolute', bottom: 64, left: 0, right: 0,
                background: 'var(--bg2)', borderTop: '1px solid var(--bd)',
                padding: '12px 8px', display: 'flex', flexWrap: 'wrap', gap: 4,
              }}>
                {BOTTOM_MORE.map(id => {
                  const n = NAV.find(x => x.id === id)
                  return (
                    <button key={id} onClick={() => goTo(id)} style={{
                      flex: '1 1 calc(50% - 4px)', padding: '12px 8px',
                      background: page === id ? 'rgba(59,130,246,.15)' : 'var(--bg3)',
                      border: `1px solid ${page === id ? 'var(--ac)' : 'var(--bd)'}`,
                      borderRadius: 10, color: page === id ? 'var(--ac)' : 'var(--tx2)',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span>{n.icon}</span>{n.label}
                    </button>
                  )
                })}
                <button onClick={signOut} style={{
                  flex: '1 1 100%', padding: '10px', background: 'var(--bg3)',
                  border: '1px solid var(--bd)', borderRadius: 10,
                  color: 'var(--rd)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                }}>
                  → Sair
                </button>
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <nav style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
            background: 'var(--bg2)', borderTop: '1px solid var(--bd)',
            display: 'flex', justifyContent: 'space-around',
            padding: '6px 0 10px', boxShadow: '0 -4px 20px rgba(0,0,0,.3)',
            transform: navVisible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform .25s ease',
          }}>
            {BOTTOM_MAIN.map(id => {
              const n = NAV.find(x => x.id === id)
              const active = page === id
              return (
                <button key={id} onClick={() => goTo(id)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: active ? 'var(--ac)' : 'var(--tx3)',
                  fontSize: 10, fontFamily: 'inherit', padding: '4px 8px', minWidth: 48,
                }}>
                  <span style={{ fontSize: 20 }}>{n.icon}</span>
                  <span style={{ fontWeight: active ? 700 : 400, fontSize: 9 }}>{n.label}</span>
                </button>
              )
            })}
            <button onClick={() => setShowMore(m => !m)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              color: BOTTOM_MORE.includes(page) ? 'var(--ac)' : 'var(--tx3)',
              fontSize: 10, fontFamily: 'inherit', padding: '4px 8px', minWidth: 48,
              position: 'relative',
            }}>
              <span style={{ fontSize: 20 }}>⋯</span>
              <span style={{ fontWeight: BOTTOM_MORE.includes(page) ? 700 : 400, fontSize: 9 }}>Mais</span>
              {macro?.selicMetaChange !== 0 && macro?.selicMetaChange != null && (
                <span style={{
                  position: 'absolute', top: 2, right: 6,
                  width: 8, height: 8, borderRadius: '50%',
                  background: macro.selicMetaChange > 0 ? '#ef4444' : '#22c55e',
                  border: '1px solid var(--bg2)',
                }} />
              )}
            </button>
          </nav>
        </>
      )}
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
