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

export const deleteDividend = async (id) => {
  const { error } = await supabase.from('dividends').delete().eq('id', id)
  if (error) throw error
}

export const updateDividend = async (id, payload) => {
  const { error } = await supabase.from('dividends').update(payload).eq('id', id)
  if (error) throw error
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
  const t = ticker.toUpperCase().trim()

  // ETFs conhecidos (terminam em 11 mas não são FIIs)
  const ETF_BR = ['BOVA11','SMAL11','IVVB11','HASH11','GOLD11','DIVO11','FIND11',
                  'BBSD11','SPXI11','EURP11','FIXA11','ISUS11','XFIX11','BDIV11',
                  'ECOO11','MATB11','GOVB11','IMAB11','IRFM11','LFTE11']
  if (ETF_BR.includes(t)) return 'etf_br'

  // FIIs: 4-6 letras + 11 (ex: MXRF11, HGLG11, KNRI11, XPML11)
  if (/^[A-Z]{4,6}11$/.test(t)) return 'fii'

  // BDRs: 4 letras + 34 (ex: AAPL34, MSFT34) — checar ANTES de stock_br
  if (/^[A-Z]{4}34$/.test(t)) return 'stock_us'

  // Ações BR: 4 letras + 1 dígito (ex: PETR4, VALE3) ou + F (ex: PETR4F)
  if (/^[A-Z]{4}\d{1,2}F?$/.test(t)) return 'stock_br'

  return 'stock_br'
}

// Monta sugestão local baseada no ticker digitado (fallback sem API)
const localSuggest = (query) => {
  const q = query.toUpperCase().trim()
  if (q.length < 2) return []
  const assetClass = detectAssetClass(q, null)
  return [{
    id: `local_${q}`,
    ticker: q,
    name: q,  // será atualizado ao salvar via brapi
    asset_class: assetClass,
    sector: null,
    _fromBrapi: true,
  }]
}

// Busca na brapi por ticker exato — retorna objeto compatível com assets
const searchBrapi = async (query) => {
  const q = query.toUpperCase().trim()
  if (q.length < 2) return []
  try {
    const token = import.meta.env.VITE_BRAPI_TOKEN || ''
    const r = await fetch(`https://brapi.dev/api/quote/${q}?fundamental=true&token=${token}`)
    if (!r.ok) return localSuggest(q)  // fallback local se brapi falhar
    const d = await r.json()
    const result = d.results?.[0]
    if (!result || result.error) return localSuggest(q)
    const assetClass = detectAssetClass(q, result)
    return [{
      id: `brapi_${q}`,
      ticker: q,
      name: result.longName || result.shortName || q,
      asset_class: assetClass,
      sector: result.sector || null,
      _fromBrapi: true,
    }]
  } catch {
    return localSuggest(q)
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

// ── C20A ─────────────────────────────────────────────────
export const addToC20A = async (userId, assetId, targetMin = 500, targetMax = 1000) => {
  const { data, error } = await supabase
    .from('c20a_assets')
    .upsert({ user_id: userId, asset_id: assetId, target_min: targetMin, target_max: targetMax },
      { onConflict: 'user_id,asset_id' })
    .select()
  if (error) throw error
  return data
}

export const removeFromC20A = async (userId, assetId) => {
  const { error } = await supabase
    .from('c20a_assets')
    .delete()
    .eq('user_id', userId)
    .eq('asset_id', assetId)
  if (error) throw error
}

// ── Realized positions ───────────────────────────────────
export const getRealizedPositions = async (userId) => {
  const { data, error } = await supabase
    .from('realized_positions')
    .select('*')
    .eq('user_id', userId)
    .order('last_sell_date', { ascending: false })
  if (error) throw error
  return data || []
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
