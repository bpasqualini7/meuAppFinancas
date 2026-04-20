// ── Price fetching — brapi.dev (BR) + CoinGecko (crypto) ──

const BRAPI_TOKEN = import.meta.env.VITE_BRAPI_TOKEN || ''
const brapiUrl = (path) => `https://brapi.dev/api${path}${path.includes('?') ? '&' : '?'}token=${BRAPI_TOKEN}`

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
      brapiUrl(`/quote/${ticker}?fundamental=true&range=1d&interval=1d`)
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

// Fetch macro data from BCB (Banco Central do Brasil) + brapi (índices) + CoinGecko (BTC)
export const fetchMacro = async () => {
  const hit = fromCache('__macro__')
  if (hit) return hit
  try {
    const [selicR, ipcaR, dolarR, selicMetaR, cdiR, ibovR, spR, btcR] = await Promise.allSettled([
      // Selic over (taxa efetiva diária acumulada mensal → % a.a.)
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json').then(r => r.json()),
      // IPCA mensal — últimos 12 meses
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json').then(r => r.json()),
      // PTAX BRL/USD
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json').then(r => r.json()),
      // Selic Meta (decisão Copom — série 432)
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json').then(r => r.json()),
      // CDI over diário (série 12)
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json').then(r => r.json()),
      // Ibovespa via brapi (token obrigatório para índices — plano pago)
      brapiUrl('/quote/%5EBVSP?range=1d&interval=1d') ? fetch(brapiUrl('/quote/%5EBVSP?range=1d&interval=1d')).then(r => r.json()).catch(() => null) : Promise.resolve(null),
      // S&P500 via brapi (plano pago)
      fetch(brapiUrl('/quote/%5EGSPC?range=1d&interval=1d')).then(r => r.json()).catch(() => null),
      // BTC/BRL via CoinGecko
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl,usd&include_24hr_change=true', {headers:{'Accept':'application/json'}}).then(r => r.json()),
    ])

    const selicDiario = selicR.status === 'fulfilled' ? parseFloat(selicR.value?.[0]?.valor) : null
    const selic = selicDiario != null ? ((Math.pow(1 + selicDiario / 100, 252) - 1) * 100) : null
    const selicMeta = selicMetaR.status === 'fulfilled' ? parseFloat(selicMetaR.value?.[0]?.valor) : null
    const cdiDiario = cdiR.status === 'fulfilled' ? parseFloat(cdiR.value?.[0]?.valor) : null
    // CDI anualizado: (1 + taxa_diaria/100)^252 - 1
    const cdi = cdiDiario != null ? ((Math.pow(1 + cdiDiario / 100, 252) - 1) * 100) : null

    const ipcaArr = ipcaR.status === 'fulfilled' ? ipcaR.value : []
    const ipca12 = ipcaArr.reduce((s, i) => s + parseFloat(i.valor || 0), 0)

    const dolar = dolarR.status === 'fulfilled' ? parseFloat(dolarR.value?.[0]?.valor) : null

    const parseBrapi = (r) => {
      try {
        const q = r?.results?.[0]
        if (!q || q.error) return null
        return { price: q.regularMarketPrice, change_pct: q.regularMarketChangePercent }
      } catch { return null }
    }
    const ibov = ibovR.status === 'fulfilled' ? parseBrapi(ibovR.value) : null
    const sp500 = spR.status === 'fulfilled' ? parseBrapi(spR.value) : null

    const btcData = btcR.status === 'fulfilled' ? btcR.value?.bitcoin : null
    const btc = btcData ? {
      price_brl: btcData.brl,
      price_usd: btcData.usd,
      change_pct: btcData.brl_24h_change,
    } : null

    return cached('__macro__', {
      selic, selicMeta, cdi, ipca12, dolar,
      ibov, sp500, btc,
      updatedAt: new Date().toISOString(),
    })
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
