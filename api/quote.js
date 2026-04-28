// Vercel Serverless — proxy cotações via Yahoo Finance (gratuito, sem token)
// Tickers BR: adicionar .SA | Tickers US: sem sufixo

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { ticker } = req.query
  if (!ticker) return res.status(400).json({ error: 'ticker required' })

  // Normalizar ticker — remover F final (fracionário)
  const clean = ticker.replace(/F$/, '')

  // Yahoo Finance: tickers BR precisam de .SA
  const US_TICKERS = ['MPW','AAPL','PLD','BK','BLK','JNJ','CSX','AVB','MSFT','GOOGL','AMZN']
  const isUS = US_TICKERS.includes(clean.toUpperCase())
  const yahooTicker = isUS ? clean.toUpperCase() : `${clean}.SA`

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'pt-BR,pt;q=0.9',
  }

  try {
    // Yahoo Finance v8 — cotação atual + fundamentals
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=5d&includePrePost=false`
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })

    if (r.ok) {
      const d = await r.json()
      const result = d?.chart?.result?.[0]
      const meta = result?.meta

      if (meta?.regularMarketPrice) {
        // Buscar fundamentals separadamente
        let pl = null, pvp = null, dy = null
        try {
          const qUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooTicker}?modules=summaryDetail,defaultKeyStatistics`
          const qr = await fetch(qUrl, { headers, signal: AbortSignal.timeout(5000) })
          if (qr.ok) {
            const qd = await qr.json()
            const sum = qd?.quoteSummary?.result?.[0]
            pl  = sum?.defaultKeyStatistics?.trailingPE?.raw || null
            pvp = sum?.defaultKeyStatistics?.priceToBook?.raw || null
            dy  = sum?.summaryDetail?.dividendYield?.raw
              ? sum.summaryDetail.dividendYield.raw * 100
              : null
          }
        } catch { /* fundamentals opcionais */ }

        // Calcular change_pct
        const closes = result?.indicators?.quote?.[0]?.close?.filter(Boolean) || []
        const prev = closes.length >= 2 ? closes[closes.length - 2] : null
        const curr = meta.regularMarketPrice
        const changePct = prev ? ((curr - prev) / prev) * 100 : (meta.regularMarketChangePercent || 0)

        return res.status(200).json({
          price:      curr,
          change_pct: changePct,
          pl, pvp, dy,
          high52:     meta.fiftyTwoWeekHigh  || null,
          low52:      meta.fiftyTwoWeekLow   || null,
          ma200:      meta.twoHundredDayAverage || null,
          currency:   meta.currency || 'BRL',
          source:     'yahoo',
        })
      }
    }

    // Fallback: brapi (caso Yahoo falhe)
    const BRAPI = process.env.VITE_BRAPI_TOKEN || ''
    for (const t of [clean, ticker]) {
      try {
        const br = await fetch(
          `https://brapi.dev/api/quote/${t}?fundamental=true&token=${BRAPI}`,
          { signal: AbortSignal.timeout(5000) }
        )
        if (br.ok) {
          const bd = await br.json()
          const bq = bd?.results?.[0]
          if (bq?.regularMarketPrice) {
            return res.status(200).json({
              price:      bq.regularMarketPrice,
              change_pct: bq.regularMarketChangePercent || 0,
              pl:         bq.priceEarnings  || null,
              pvp:        bq.priceToBook    || null,
              dy:         bq.dividendYield  || null,
              high52:     bq.fiftyTwoWeekHigh || null,
              low52:      bq.fiftyTwoWeekLow  || null,
              source:     'brapi',
            })
          }
        }
      } catch { /* continua */ }
    }

    return res.status(404).json({ error: 'No data found', ticker, yahooTicker })

  } catch (e) {
    return res.status(500).json({ error: e.message, ticker })
  }
}
