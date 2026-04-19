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
export const searchAssets = async (query) => {
  const { data, error } = await supabase
    .from('assets')
    .select('id, ticker, name, asset_class, sector')
    .or(`ticker.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(10)
  if (error) throw error
  return data
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
