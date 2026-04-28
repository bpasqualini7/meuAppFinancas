// Vercel Serverless — proxy cotações BR
// Fonte primária: brapi.dev | Fallback: BolsaI

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { ticker } = req.query
  if (!ticker) return res.status(400).json({ error: 'ticker required' })

  const BRAPI   = process.env.VITE_BRAPI_TOKEN  || ''
  const BOLSAI  = process.env.VITE_BOLSAI_TOKEN || ''
  const BOLSAI_BASE = 'https://api.usebolsai.com/api/v1'

  // Variações do ticker a tentar (original + sem F final + sem 11 → base)
  const tickerClean = ticker.replace(/F$/, '')          // BBAS3F → BBAS3
  const tickerBase  = tickerClean.replace(/\d+$/, '')   // MXRF11 → MXRF
  const toTry = [...new Set([ticker, tickerClean])]

  // ── 1. brapi (mais estável, retorna tudo) ────────────────
  for (const t of toTry) {
    try {
      const r = await fetch(
        `https://brapi.dev/api/quote/${t}?fundamental=true&range=1d&interval=1d&token=${BRAPI}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!r.ok) continue
      const d = await r.json()
      const q = d?.results?.[0]
      if (q?.regularMarketPrice) {
        return res.status(200).json({
          price:      q.regularMarketPrice,
          change_pct: q.regularMarketChangePercent || 0,
          pl:         q.priceEarnings    || null,
          pvp:        q.priceToBook      || null,
          dy:         q.dividendYield    || null,
          high52:     q.fiftyTwoWeekHigh || null,
          low52:      q.fiftyTwoWeekLow  || null,
          ma200:      q.twoHundredDayAverage || null,
          source:     'brapi',
        })
      }
    } catch { /* continua */ }
  }

  // ── 2. BolsaI — FII ─────────────────────────────────────
  for (const t of [...toTry, tickerBase]) {
    try {
      const r = await fetch(`${BOLSAI_BASE}/fiis/${t}`,
        { headers: { 'X-API-Key': BOLSAI }, signal: AbortSignal.timeout(5000) })
      if (!r.ok) continue
      const d = await r.json()
      if (d?.close_price) {
        return res.status(200).json({
          price:      d.close_price,
          change_pct: 0,
          pvp:        d.pvp || null,
          dy:         d.dividend_yield_ttm || null,
          source:     'bolsai_fii',
        })
      }
    } catch { /* continua */ }
  }

  // ── 3. BolsaI — Ação ────────────────────────────────────
  for (const t of toTry) {
    try {
      const [qr, sr] = await Promise.allSettled([
        fetch(`${BOLSAI_BASE}/stocks/${t}/quote`,
          { headers: { 'X-API-Key': BOLSAI }, signal: AbortSignal.timeout(5000) }),
        fetch(`${BOLSAI_BASE}/stocks/${t}/stats`,
          { headers: { 'X-API-Key': BOLSAI }, signal: AbortSignal.timeout(5000) }),
      ])
      const q = qr.status === 'fulfilled' && qr.value.ok ? await qr.value.json() : null
      const s = sr.status === 'fulfilled' && sr.value.ok ? await sr.value.json() : null
      if (q?.close) {
        return res.status(200).json({
          price:      q.close,
          change_pct: s?.daily_change_pct || 0,
          high52:     s?.week_52_high || null,
          low52:      s?.week_52_low  || null,
          source:     'bolsai_stock',
        })
      }
    } catch { /* continua */ }
  }

  return res.status(404).json({ error: 'No data found', ticker })
}
