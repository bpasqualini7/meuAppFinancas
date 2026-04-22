// Vercel Serverless Function — proxy para BolsaI e brapi
// Evita CORS chamando as APIs de servidor para servidor

export default async function handler(req, res) {
  // CORS — permite o frontend do Vercel chamar este proxy
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { ticker, type = 'quote' } = req.query
  if (!ticker) return res.status(400).json({ error: 'ticker required' })

  const BOLSAI_TOKEN = process.env.VITE_BOLSAI_TOKEN || ''
  const BRAPI_TOKEN  = process.env.VITE_BRAPI_TOKEN  || ''

  const headers = { 'X-API-Key': BOLSAI_TOKEN }
  const BASE = 'https://api.usebolsai.com/api/v1'

  try {
    // Tentar BolsaI primeiro
    if (type === 'quote') {
      // Tentar o ticker direto e sem sufixo numérico (ex: MXRF11 → MXRF)
      const tickerBase = ticker.replace(/\d+$/, '')
      
      const [qRes, sRes] = await Promise.allSettled([
        fetch(`${BASE}/stocks/${ticker}/quote`, { headers }),
        fetch(`${BASE}/stocks/${ticker}/stats`, { headers }),
      ])
      const q = qRes.status === 'fulfilled' && qRes.value.ok ? await qRes.value.json() : null
      const s = sRes.status === 'fulfilled' && sRes.value.ok ? await sRes.value.json() : null

      if (q?.ticker) {
        // Buscar fundamentais — tentar FII primeiro, depois ação
        let pl = null, pvp = null, dy = null
        try {
          const fiiRes = await fetch(`${BASE}/fiis/${ticker}`, { headers })
          if (fiiRes.ok) {
            const fii = await fiiRes.json()
            if (fii?.ticker) { pvp = fii.pvp; dy = fii.dividend_yield_ttm }
          } else {
            // Tentar sem sufixo (ex: MXRF)
            const fiiRes2 = await fetch(`${BASE}/fiis/${tickerBase}`, { headers })
            if (fiiRes2.ok) {
              const fii2 = await fiiRes2.json()
              if (fii2?.ticker) { pvp = fii2.pvp; dy = fii2.dividend_yield_ttm }
            } else {
              const fundRes = await fetch(`${BASE}/fundamentals/${ticker}`, { headers })
              if (fundRes.ok) {
                const fund = await fundRes.json()
                if (fund?.ticker) { pl = fund.pl; pvp = fund.pvp; dy = fund.dividend_yield_ttm }
              }
            }
          }
        } catch { /* ignora erro em fundamentais */ }

        return res.status(200).json({
          price: q.close,
          change_pct: s?.daily_change_pct || 0,
          pl, pvp, dy,
          high52: s?.week_52_high || null,
          low52: s?.week_52_low || null,
          source: 'bolsai',
        })
      }
    }

    if (type === 'history') {
      const hRes = await fetch(`${BASE}/stocks/${ticker}/history?limit=252`, { headers })
      if (hRes.ok) {
        const h = await hRes.json()
        return res.status(200).json(h)
      }
    }

    // Fallback: brapi
    const brapiRes = await fetch(
      `https://brapi.dev/api/quote/${ticker}?fundamental=true&range=1d&interval=1d&token=${BRAPI_TOKEN}`
    )
    const brapiData = await brapiRes.json()
    const bq = brapiData.results?.[0]
    if (bq) {
      return res.status(200).json({
        price: bq.regularMarketPrice,
        change_pct: bq.regularMarketChangePercent,
        pl: bq.priceEarnings,
        pvp: bq.priceToBook,
        dy: bq.dividendYield,
        ma200: bq.twoHundredDayAverage,
        high52: bq.fiftyTwoWeekHigh,
        low52: bq.fiftyTwoWeekLow,
        source: 'brapi',
      })
    }

    return res.status(404).json({ error: 'No data found' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
