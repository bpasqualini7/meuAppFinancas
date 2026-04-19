// ── Price fetching — brapi.dev (BR) + CoinGecko (crypto) ──

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

// Fetch BR stock / FII via brapi.dev (free, no key needed)
export const fetchBR = async (ticker) => {
  const hit = fromCache(ticker)
  if (hit) return hit
  try {
    const r = await fetch(
      `https://brapi.dev/api/quote/${ticker}?fundamental=true&range=1d&interval=1d`
    )
    const d = await r.json()
    const q = d.results?.[0]
    if (!q) return null
    return cached(ticker, {
      price: q.regularMarketPrice,
      change_pct: q.regularMarketChangePercent,
      pl: q.priceEarnings,
      pvp: q.priceToBook,
      dy: q.dividendYield,
      ma200: q.twoHundredDayAverage,
      high52: q.fiftyTwoWeekHigh,
      low52: q.fiftyTwoWeekLow,
      source: 'brapi',
    })
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

// Fetch macro data from BCB (Banco Central do Brasil)
export const fetchMacro = async () => {
  const hit = fromCache('__macro__')
  if (hit) return hit
  try {
    const [selicR, ipcaR, dolarR] = await Promise.allSettled([
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json').then(r => r.json()),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json').then(r => r.json()),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json').then(r => r.json()),
    ])
    const selic = selicR.status === 'fulfilled' ? parseFloat(selicR.value?.[0]?.valor) : null
    const ipcaArr = ipcaR.status === 'fulfilled' ? ipcaR.value : []
    const ipca12 = ipcaArr.reduce((s, i) => s + parseFloat(i.valor || 0), 0)
    const dolar = dolarR.status === 'fulfilled' ? parseFloat(dolarR.value?.[0]?.valor) : null
    return cached('__macro__', { selic, ipca12, dolar, updatedAt: new Date().toISOString() })
  } catch {
    return null
  }
}

// Fetch news via RSS (InfoMoney → CORS proxy)
export const fetchNews = async () => {
  const hit = fromCache('__news__')
  if (hit) return hit
  try {
    const feeds = [
      'https://api.rss2json.com/v1/api.json?rss_url=https://www.infomoney.com.br/feed/',
      'https://api.rss2json.com/v1/api.json?rss_url=https://br.investing.com/rss/news.rss',
    ]
    const r = await fetch(feeds[0])
    const d = await r.json()
    const items = (d.items || []).slice(0, 8).map(i => ({
      title: i.title,
      link: i.link,
      date: i.pubDate,
      source: 'InfoMoney',
    }))
    return cached('__news__', items)
  } catch {
    return []
  }
}

// Auto-detect asset type and fetch accordingly
export const fetchPrice = async (ticker, assetClass) => {
  if (assetClass === 'crypto') return fetchCrypto(ticker)
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
