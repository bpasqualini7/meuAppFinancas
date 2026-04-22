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
  // Renda fixa manual — sem cotação de mercado
  if (NO_MARKET_PRICE(ticker)) return null
  try {
    const r = await fetch(`/api/quote?ticker=${ticker}`)
    if (!r.ok) return null
    const d = await r.json()
    if (!d.price) return null
    return cached(ticker, d)
  } catch {
    return null
  }
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
