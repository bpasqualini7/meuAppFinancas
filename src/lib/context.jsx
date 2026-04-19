import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, getProfile, getPortfolio, getDividends, getDividendBalances, getWatchlist } from './supabase'
import { fetchAllPrices, fetchMacro } from './prices'

export const AppContext = createContext({})
export const useApp = () => useContext(AppContext)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [portfolio, setPortfolio] = useState([])
  const [dividends, setDividends] = useState([])
  const [divBalances, setDivBalances] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [prices, setPrices] = useState({})
  const [macro, setMacro] = useState(null)
  const [loading, setLoading] = useState(true)

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (!session) setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load data when user is set
  const loadAll = useCallback(async (uid) => {
    setLoading(true)
    try {
      const [prof, port, divs, divBal, wl, mac] = await Promise.allSettled([
        getProfile(uid),
        getPortfolio(uid),
        getDividends(uid),
        getDividendBalances(uid),
        getWatchlist(uid),
        fetchMacro(),
      ])
      if (prof.status === 'fulfilled') setProfile(prof.value)
      const portData = port.status === 'fulfilled' ? port.value : []
      setPortfolio(portData)
      if (divs.status === 'fulfilled') setDividends(divs.value)
      if (divBal.status === 'fulfilled') setDivBalances(divBal.value)
      if (wl.status === 'fulfilled') setWatchlist(wl.value)
      if (mac.status === 'fulfilled') setMacro(mac.value)

      // Fetch prices for all portfolio + watchlist assets
      const allAssets = [
        ...portData,
        ...(wl.status === 'fulfilled' ? wl.value.map(w => w.assets) : [])
      ].filter(Boolean)
      if (allAssets.length) {
        const px = await fetchAllPrices(allAssets)
        setPrices(px)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) loadAll(user.id)
    else { setPortfolio([]); setDividends([]); setWatchlist([]); setPrices({}) }
  }, [user, loadAll])

  const refreshPortfolio = () => user && loadAll(user.id)

  return (
    <AppContext.Provider value={{
      user, profile, setProfile,
      portfolio, setPortfolio,
      dividends, setDividends,
      divBalances,
      watchlist, setWatchlist,
      prices, setPrices,
      macro,
      loading,
      refreshPortfolio,
    }}>
      {children}
    </AppContext.Provider>
  )
}

// ── Formatters ────────────────────────────────────────────
export const fmt = {
  brl: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0),
  pct: (v) => `${Number(v || 0) >= 0 ? '+' : ''}${Number(v || 0).toFixed(2)}%`,
  num: (v, d = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }),
  date: (s) => new Date(s).toLocaleDateString('pt-BR'),
}

// ── Labels/colors ─────────────────────────────────────────
export const CLASS_LABEL = {
  stock_br: 'Ação BR', stock_us: 'Ação EUA', fii: 'FII',
  fixed_income: 'Renda Fixa', crypto: 'Cripto', etf_br: 'ETF BR',
  etf_us: 'ETF EUA', other: 'Outro',
}
export const CLASS_COLOR = {
  stock_br: '#4ade80', stock_us: '#60a5fa', fii: '#f59e0b',
  fixed_income: '#a78bfa', crypto: '#fb923c', etf_br: '#34d399',
  etf_us: '#93c5fd', other: '#94a3b8',
}

// ── Badge de atratividade ──────────────────────────────────
export const getAttractiveBadge = (ticker, prices) => {
  const p = prices?.[ticker]
  if (!p) return null
  let score = 0
  const reasons = []
  if (p.pl && p.pl < 12) { score++; reasons.push(`P/L ${Number(p.pl).toFixed(1)}x`) }
  if (p.pvp && p.pvp < 1.2) { score++; reasons.push(`P/VP ${Number(p.pvp).toFixed(2)}x`) }
  if (p.dy && p.dy > 6) { score++; reasons.push(`DY ${Number(p.dy).toFixed(1)}%`) }
  if (p.ma200 && p.price < p.ma200) { score++; reasons.push('Abaixo MM200') }
  return score >= 2 ? { level: score >= 3 ? 'strong' : 'mild', reasons } : null
}

// ── Número mágico ─────────────────────────────────────────
export const getMagicNumber = (price, dps) =>
  dps > 0 ? Math.ceil(price / dps) : null

// ── Theme vars ────────────────────────────────────────────
export const THEME = {
  dark: {
    '--bg': '#0a0e1a', '--bg2': '#111827', '--bg3': '#1e2433', '--bg4': '#252d3d',
    '--bd': '#2a3347', '--tx': '#e2e8f0', '--tx2': '#94a3b8', '--tx3': '#64748b',
    '--ac': '#3b82f6', '--ac2': '#6366f1', '--gr': '#22c55e', '--rd': '#ef4444', '--am': '#f59e0b',
  },
  light: {
    '--bg': '#f0f4f8', '--bg2': '#ffffff', '--bg3': '#f8fafc', '--bg4': '#e2e8f0',
    '--bd': '#cbd5e1', '--tx': '#0f172a', '--tx2': '#475569', '--tx3': '#94a3b8',
    '--ac': '#2563eb', '--ac2': '#4f46e5', '--gr': '#16a34a', '--rd': '#dc2626', '--am': '#d97706',
  },
}
