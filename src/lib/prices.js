// ── Price fetching — brapi.dev (BR) + CoinGecko (crypto) ──

const BRAPI_TOKEN = import.meta.env.VITE_BRAPI_TOKEN || ''
const brapiUrl = (path) => `https://brapi.dev/api${path}${path.includes('?') ? '&' : '?'}token=${BRAPI_TOKEN}`

const BOLSAI_TOKEN = import.meta.env.VITE_BOLSAI_TOKEN || ''
const bolsaiUrl = (path) => `https://api.usebolsai.com/api/v1${path}`
const bolsaiHeaders = { 'X-API-Key': BOLSAI_TOKEN }

const CACHE = {}
const TTL = 15 * 60 * 1000 // 15 min

const cached = (key, data) => {
  CACHE[key] = { data, ts: Date.now() }
  return data
}
const fromCache = (key) => {
  const c = CACHE[key]
  return c && Date.now() - c.ts < TTL ? c.data : null
}

// Ativos sem cotação de mercado (Tesouro Direto, CDB, etc.)
const NO_MARKET_PRICE = (ticker) => 
  ticker.startsWith('TESOURO') || ticker.startsWith('CDB') || 
  ticker.startsWith('LCI') || ticker.startsWith('LCA') ||
  ticker.startsWith('LC') || ticker.includes('IPCA') && ticker.length > 8

// Fetch BR stock / FII via proxy Vercel (/api/quote)
export const fetchBR = async (ticker) => {
  const hit = fromCache(ticker)
  if (hit) return hit
  if (NO_MARKET_PRICE(ticker)) return null
  try {
    const r = await fetch(`/api/quote?ticker=${ticker}`)
    if (r.ok) {
      const d = await r.json()
      if (d?.price) return cached(ticker, d)
    }
    // Fallback: tentar sem F final (SAPR11F → SAPR11)
    const clean = ticker.replace(/F$/, '')
    if (clean !== ticker) {
      const r2 = await fetch(`/api/quote?ticker=${clean}`)
      if (r2.ok) {
        const d2 = await r2.json()
        if (d2?.price) return cached(ticker, d2)
      }
    }
    return null
  } catch {
    return null
  }
}

// Quais tickers falharam na última busca (para debug)
export const FAILED_TICKERS = new Set()

export const fetchBRWithLog = async (ticker) => {
  const result = await fetchBR(ticker)
  if (!result) FAILED_TICKERS.add(ticker)
  else FAILED_TICKERS.delete(ticker)
  return result
}

// Fetch crypto via CoinGecko (free, no key needed)
const COIN_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
  BNB: 'binancecoin', ADA: 'cardano', DOT: 'polkadot',
  MATIC: 'matic-network', AVAX: 'avalanche-2',
}

export const fetchCrypto = async (ticker) => {
  const hit = fromCache(ticker)
  if (hit) return hit
  try {
    const id = COIN_MAP[ticker] || ticker.toLowerCase()
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=brl,usd&include_24hr_change=true`
    )
    const d = await r.json()
    if (!d[id]) return null
    return cached(ticker, {
      price: d[id].brl,
      price_usd: d[id].usd,
      change_pct: d[id].brl_24h_change,
      pl: null, pvp: null, dy: null, ma200: null,
      source: 'coingecko',
    })
  } catch {
    return null
  }
}

// Fetch macro via proxy Vercel (/api/macro)
export const fetchMacro = async () => {
  const hit = fromCache('__macro__')
  if (hit) return hit
  try {
    const r = await fetch('/api/macro')
    if (!r.ok) return null
    const d = await r.json()
    return cached('__macro__', d)
  } catch {
    return null
  }
}


// Fetch news via RSS (InfoMoney → CORS proxy)
// Feeds RSS do Banco Central do Brasil
const BCB_FEEDS = [
  { url: 'https://www.bcb.gov.br/api/feed/pt-br/notas/rss',         label: 'BCB — Notas' },
  { url: 'https://www.bcb.gov.br/api/feed/pt-br/pressreleases/rss', label: 'BCB — Press Releases' },
  { url: 'https://www.bcb.gov.br/api/feed/pt-br/copom/rss',         label: 'BCB — Copom' },
  { url: 'https://www.bcb.gov.br/api/feed/pt-br/boletimfocus/rss',  label: 'BCB — Focus' },
]

const parseRSS = (xmlText, source) => {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'text/xml')
    const items = [...doc.querySelectorAll('item')].slice(0, 5)
    return items.map(item => ({
      title: item.querySelector('title')?.textContent || '',
      link: item.querySelector('link')?.textContent || '#',
      date: item.querySelector('pubDate')?.textContent || '',
      source,
    }))
  } catch { return [] }
}

export const fetchNews = async () => {
  const hit = fromCache('__news__')
  if (hit) return hit

  const results = []
  await Promise.allSettled(
    BCB_FEEDS.map(async ({ url, label }) => {
      try {
        const r = await fetch(url)
        if (!r.ok) return
        const text = await r.text()
        if (!text.includes('<item>')) return
        const items = parseRSS(text, label)
        results.push(...items)
      } catch { /* ignora feeds com erro */ }
    })
  )

  // Ordenar por data mais recente
  const sorted = results.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10)
  if (sorted.length > 0) return cached('__news__', sorted)
  return []
}

// Auto-detect asset type and fetch accordingly
export const fetchPrice = async (ticker, assetClass) => {
  if (!ticker) return null
  if (assetClass === 'crypto') return fetchCrypto(ticker)
  // AAPL, MSFT etc sem sufixo → tentar como ação US via proxy também
  return fetchBR(ticker)
}

// Batch fetch for entire portfolio
export const fetchAllPrices = async (assets) => {
  const results = {}
  await Promise.allSettled(
    assets.map(async (a) => {
      const data = await fetchPrice(a.ticker, a.asset_class)
      if (data) results[a.ticker] = data
    })
  )
  return results
}

// ── CoinGecko — preços cripto em BRL ─────────────────────
const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', ADA: 'cardano',
  SOL: 'solana', XRP: 'ripple', POL: 'matic-network',
  LTC: 'litecoin', LINK: 'chainlink', BNB: 'binancecoin',
  DOGE: 'dogecoin', DOT: 'polkadot', AVAX: 'avalanche-2',
}

export const getCoinGeckoId = (symbol) =>
  COINGECKO_IDS[symbol.toUpperCase()] || symbol.toLowerCase()

export const fetchCriptoPrice = async (symbol) => {
  const id = getCoinGeckoId(symbol)
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=brl&include_24hr_change=true&include_7d_change=true`
    )
    if (!r.ok) return null
    const d = await r.json()
    const data = d[id]
    if (!data) return null
    return {
      price: data.brl,
      change24h: data.brl_24h_change || 0,
      change7d: data.brl_7d_change || 0,
    }
  } catch { return null }
}

export const fetchCriptoHistory = async (symbol, days = 90) => {
  const id = getCoinGeckoId(symbol)
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=brl&days=${days}&interval=daily`
    )
    if (!r.ok) return null
    const d = await r.json()
    // prices: [[timestamp, price], ...]
    return (d.prices || []).map(([ts, price]) => ({
      date: new Date(ts).toISOString().slice(0, 10),
      price,
    }))
  } catch { return null }
}

export const fetchAllCriptoPrices = async (symbols) => {
  const ids = symbols.map(getCoinGeckoId).join(',')
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=brl&include_24hr_change=true&include_7d_change=true`
    )
    if (!r.ok) return {}
    const d = await r.json()
    const result = {}
    symbols.forEach(sym => {
      const id = getCoinGeckoId(sym)
      if (d[id]) result[sym] = {
        price: d[id].brl,
        change24h: d[id].brl_24h_change || 0,
        change7d: d[id].brl_7d_change || 0,
      }
    })
    return result
  } catch { return {} }
}
