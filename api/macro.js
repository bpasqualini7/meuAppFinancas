// Proxy para dados macro — BCB + BolsaI + CoinGecko

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const BOLSAI_TOKEN = process.env.VITE_BOLSAI_TOKEN || ''
  const headers = { 'X-API-Key': BOLSAI_TOKEN }
  const BASE = 'https://api.usebolsai.com/api/v1'

  try {
    const [selicR, ipcaR, dolarR, selicMetaR, cdiR, ibovR, spR, btcR] = await Promise.allSettled([
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json').then(r => r.json()),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json').then(r => r.json()),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json').then(r => r.json()),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/2?formato=json').then(r => r.json()),
      fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json').then(r => r.json()),
      // IBOV via Yahoo Finance (^BVSP) e S&P500 (^GSPC)
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/BOVA11.SA?interval=1d&range=2d', { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.json()).catch(() => null),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/IVVB11.SA?interval=1d&range=2d', { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.json()).catch(() => null),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl,usd&include_24hr_change=true').then(r => r.json()),
    ])

    const selicDiario = selicR.status === 'fulfilled' ? parseFloat(selicR.value?.[0]?.valor) : null
    const selic = selicDiario != null ? ((Math.pow(1 + selicDiario / 100, 252) - 1) * 100) : null

    const selicMetaArr = selicMetaR.status === 'fulfilled' ? selicMetaR.value : []
    const selicMeta = selicMetaArr.length > 0 ? parseFloat(selicMetaArr[selicMetaArr.length - 1]?.valor) : null
    const selicMetaPrev = selicMetaArr.length > 1 ? parseFloat(selicMetaArr[selicMetaArr.length - 2]?.valor) : null
    const selicMetaChange = selicMeta != null && selicMetaPrev != null ? +(selicMeta - selicMetaPrev).toFixed(2) : 0
    const selicMetaDate = selicMetaArr.length > 0 ? selicMetaArr[selicMetaArr.length - 1]?.data : null

    const cdiDiario = cdiR.status === 'fulfilled' ? parseFloat(cdiR.value?.[0]?.valor) : null
    const cdi = cdiDiario != null ? ((Math.pow(1 + cdiDiario / 100, 252) - 1) * 100) : null

    const ipcaArr = ipcaR.status === 'fulfilled' ? ipcaR.value : []
    const ipca12 = ipcaArr.reduce((s, i) => s + parseFloat(i.valor || 0), 0)
    const dolar = dolarR.status === 'fulfilled' ? parseFloat(dolarR.value?.[0]?.valor) : null

    // IBOV via BOVA11 (ETF que replica o índice)
    const ibovQ = ibovR.status === 'fulfilled' && ibovR.value?.ticker ? ibovR.value : null
    const ibov = ibovQ ? { price: ibovQ.close, change_pct: 0 } : null

    // S&P500 via IVVB11 (ETF que replica o S&P em BRL)
    const spQ = spR.status === 'fulfilled' && spR.value?.ticker ? spR.value : null
    const sp500 = spQ ? { price: spQ.close, change_pct: 0 } : null

    const btcData = btcR.status === 'fulfilled' ? btcR.value?.bitcoin : null
    const btc = btcData ? {
      price_brl: btcData.brl,
      price_usd: btcData.usd,
      change_pct: btcData.brl_24h_change,
    } : null

    return res.status(200).json({
      selic, selicMeta, selicMetaPrev, selicMetaChange, selicMetaDate,
      cdi, ipca12, dolar, ibov, sp500, btc,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
