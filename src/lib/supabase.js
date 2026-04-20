import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})

// ── Auth helpers ──────────────────────────────────────────
export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: import.meta.env.VITE_REDIRECT_URL || window.location.origin,
    },
  })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

// ── Portfolio ─────────────────────────────────────────────
export const getPortfolio = async (userId) => {
  const { data, error } = await supabase
    .from('portfolio_summary')
    .select('*')
    .eq('user_id', userId)
    .order('asset_class')
  if (error) throw error
  return data
}

export const upsertPortfolioAsset = async (payload) => {
  const { data, error } = await supabase
    .from('portfolio_assets')
    .upsert(payload, { onConflict: 'user_id,asset_id' })
    .select()
  if (error) throw error
  return data
}

// ── Operations ────────────────────────────────────────────
export const getOperations = async (userId) => {
  const { data, error } = await supabase
    .from('operations')
    .select('*, assets(ticker, name, asset_class)')
    .eq('user_id', userId)
    .order('op_date', { ascending: false })
  if (error) throw error
  return data
}

export const insertOperation = async (payload) => {
  const { data, error } = await supabase
    .from('operations')
    .insert(payload)
    .select()
  if (error) throw error
  return data
}

// ── Dividends ─────────────────────────────────────────────
export const getDividends = async (userId) => {
  const { data, error } = await supabase
    .from('dividends')
    .select('*, assets(ticker, name)')
    .eq('user_id', userId)
    .order('payment_date', { ascending: false })
  if (error) throw error
  return data
}

export const getDividendBalances = async (userId) => {
  const { data, error } = await supabase
    .from('dividend_balances')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

export const insertDividend = async (payload) => {
  const { data, error } = await supabase
    .from('dividends')
    .insert(payload)
    .select()
  if (error) throw error
  return data
}

// ── Watchlist ─────────────────────────────────────────────
export const getWatchlist = async (userId) => {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*, assets(ticker, name, asset_class, sector)')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

export const addToWatchlist = async (userId, assetId) => {
  const { data, error } = await supabase
    .from('watchlist')
    .insert({ user_id: userId, asset_id: assetId })
    .select()
  if (error) throw error
  return data
}

// ── Assets search (autocomplete) ──────────────────────────
// Detecta classe do ativo pelo sufixo/padrão do ticker
const detectAssetClass = (ticker, brapiData) => {
  const t = ticker.toUpperCase()
  // FIIs: terminam em 11 e não são ETFs conhecidos
  const ETF_BR = ['BOVA11','SMAL11','IVVB11','HASH11','GOLD11','DIVO11','FIND11','BBSD11','SPXI11','EURP11']
  if (ETF_BR.includes(t)) return 'etf_br'
  if (t.endsWith('11') && t.length <= 7) return 'fii'
  // Ações BR: 4 letras + 1-2 dígitos (ex: PETR4, VALE3, BBAS3)
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) return 'stock_br'
  // Ações BR3 (unit): ex BPAC11 — já pego em fii acima, mas pode ter exceção
  return 'stock_br'
}

// Busca na brapi por ticker exato — retorna objeto compatível com assets
const searchBrapi = async (query) => {
  const q = query.toUpperCase().trim()
  if (q.length < 2) return []
  try {
    const r = await fetch(`https://brapi.dev/api/quote/${q}?fundamental=true`)
    const d = await r.json()
    const result = d.results?.[0]
    if (!result || result.error) return []
    const assetClass = detectAssetClass(q, result)
    return [{
      id: `brapi_${q}`,          // ID temporário — será resolvido no upsert
      ticker: q,
      name: result.longName || result.shortName || q,
      asset_class: assetClass,
      sector: result.sector || null,
      _fromBrapi: true,           // flag para o upsert saber que precisa criar no assets
    }]
  } catch {
    return []
  }
}

// Busca primeiro no Supabase, fallback na brapi
export const searchAssets = async (query) => {
  const q = query.trim()
  if (q.length < 2) return []

  // 1. Supabase
  try {
    const { data } = await supabase
      .from('assets')
      .select('id, ticker, name, asset_class, sector')
      .or(`ticker.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(8)

    if (data && data.length > 0) return data
  } catch { /* silently fallback */ }

  // 2. Fallback: brapi (ticker exato)
  return searchBrapi(q)
}

// Garante que o ativo existe na tabela assets — cria se vier da brapi
export const ensureAsset = async (asset) => {
  if (!asset._fromBrapi) return asset.id

  // Tenta inserir (ignora se já existe)
  const { data, error } = await supabase
    .from('assets')
    .upsert(
      { ticker: asset.ticker, name: asset.name, asset_class: asset.asset_class, sector: asset.sector },
      { onConflict: 'ticker' }
    )
    .select('id')
    .single()

  if (error) {
    // Se deu conflito, busca o id existente
    const { data: existing } = await supabase
      .from('assets')
      .select('id')
      .eq('ticker', asset.ticker)
      .single()
    return existing?.id
  }
  return data?.id
}

// ── Profile ───────────────────────────────────────────────
export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export const updateProfile = async (userId, payload) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
  if (error) throw error
  return data
}

// ── Price cache ───────────────────────────────────────────
export const getPriceCache = async (tickers) => {
  const { data, error } = await supabase
    .from('price_cache')
    .select('*')
    .in('ticker', tickers)
  if (error) throw error
  return data
}

export const upsertPriceCache = async (payload) => {
  const { error } = await supabase
    .from('price_cache')
    .upsert(payload, { onConflict: 'ticker' })
  if (error) throw error
}
