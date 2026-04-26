import { useState, useEffect, useRef } from 'react'
import { useApp, fmt, CLASS_LABEL } from '../lib/context'
import { Card, KPI, Spinner, Empty } from '../components/ui'
import { fetchNews } from '../lib/prices'
import { getOperationsForChart, getDividendsForChart, getCriptoPositions, saveCriptoPositions } from '../lib/supabase'
import { fetchAllCriptoPrices, fetchCriptoHistory, getCoinGeckoId } from '../lib/prices'

// ── Paleta de linhas por classe ─────────────────────────
const CLASS_COLORS = {
  total:    { stroke: '#6366f1', fill: 'rgba(99,102,241,.08)',  label: 'Total' },
  stock_br: { stroke: '#22c55e', fill: 'rgba(34,197,94,.08)',   label: 'Ação BR' },
  fii:      { stroke: '#f59e0b', fill: 'rgba(245,158,11,.08)',  label: 'FII' },
  stock_us: { stroke: '#60a5fa', fill: 'rgba(96,165,250,.08)',  label: 'Ação EUA' },
  etf_br:   { stroke: '#34d399', fill: 'rgba(52,211,153,.08)',  label: 'ETF BR' },
  crypto:   { stroke: '#fb923c', fill: 'rgba(251,146,60,.08)',  label: 'Cripto' },
  other:    { stroke: '#94a3b8', fill: 'rgba(148,163,184,.08)', label: 'Outros' },
}

// ── Calcula evolução de patrimônio mês a mês ─────────────
function buildPatrimonioData(ops, divs) {
  if (!ops.length) return { months: [], series: {} }

  // Descobrir range de meses
  const firstDate = new Date(ops[0].op_date)
  const lastDate  = new Date()
  const months    = []
  const cur = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
  while (cur <= lastDate) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }

  // Agrupar operações por classe → por ativo → acumular qtd e custo
  // Vamos calcular o custo acumulado (patrimônio a preço de custo) por mês
  const classes = ['total', ...new Set(ops.map(o => o.assets?.asset_class).filter(Boolean))]
  
  // Estado acumulado: { [ticker]: { qty, avgPrice, asset_class } }
  const state = {}
  let opIdx = 0

  // Dividendos mensais por classe
  const divByMonth = {} // { 'YYYY-MM': { total, stock_br, fii, ... } }
  divs.forEach(d => {
    const m = d.payment_date.slice(0, 7)
    const cls = d.assets?.asset_class || 'other'
    if (!divByMonth[m]) divByMonth[m] = {}
    divByMonth[m].total = (divByMonth[m].total || 0) + d.total_amount
    divByMonth[m][cls]  = (divByMonth[m][cls]  || 0) + d.total_amount
  })

  // Para cada mês, processar ops até o fim do mês e calcular patrimônio
  const series = {}
  classes.forEach(c => { series[c] = [] })
  const divSeries   = {}
  classes.forEach(c => { divSeries[c] = [] })

  months.forEach(month => {
    const endOfMonth = new Date(month.slice(0,4), parseInt(month.slice(5,7)), 0, 23, 59, 59)
    // Processar todas as ops até o fim desse mês
    while (opIdx < ops.length && new Date(ops[opIdx].op_date) <= endOfMonth) {
      const op = ops[opIdx]
      const ticker = op.assets?.ticker
      const cls    = op.assets?.asset_class || 'other'
      if (!ticker) { opIdx++; continue }
      if (!state[ticker]) state[ticker] = { qty: 0, cost: 0, asset_class: cls }
      if (op.op_type === 'buy') {
        state[ticker].cost += op.total_value
        state[ticker].qty  += op.quantity
      } else {
        // Venda: abate custo proporcionalmente
        if (state[ticker].qty > 0) {
          const avgP = state[ticker].cost / state[ticker].qty
          state[ticker].cost -= avgP * op.quantity
          state[ticker].qty  -= op.quantity
          if (state[ticker].qty <= 0) { state[ticker].qty = 0; state[ticker].cost = 0 }
        }
      }
      opIdx++
    }

    // Somar patrimônio (a preço de custo) por classe
    const byClass = {}
    Object.values(state).forEach(s => {
      if (s.qty <= 0) return
      const c = s.asset_class
      byClass[c]   = (byClass[c]   || 0) + s.cost
      byClass.total = (byClass.total || 0) + s.cost
    })
    classes.forEach(c => {
      series[c].push(byClass[c] || 0)
      divSeries[c].push(divByMonth[month]?.[c === 'total' ? 'total' : c] || 0)
    })
  })

  return { months, series, divSeries, classes: classes.filter(c => c !== 'total') }
}

// ── SVG Sparkline multi-linhas ────────────────────────────
function PatrimonioChart({ months, series, divSeries, activeClasses, showDivs }) {
  const W = 680, H = 280, PAD = { top: 16, right: 16, bottom: 36, left: 72 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const [hoverIdx, setHoverIdx] = useState(null)

  if (!months.length) return null

  // Linhas ativas
  const linesToDraw = ['total', ...activeClasses]

  // Escala Y — max de todas as linhas ativas
  const allVals = linesToDraw.flatMap(c => series[c] || [])
  const maxVal  = Math.max(...allVals, 1)
  const yScale  = v => innerH - (v / maxVal) * innerH

  // Escala X
  const xScale = i => (i / (months.length - 1 || 1)) * innerW

  // Eixo Y labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({
    val: maxVal * r,
    y: yScale(maxVal * r)
  }))

  // Eixo X — mostrar a cada ~3 meses
  const step = Math.max(1, Math.ceil(months.length / 8))
  const xTicks = months
    .map((m, i) => ({ m, i }))
    .filter((_, i) => i % step === 0 || i === months.length - 1)

  const pathD = (cls) => {
    const vals = series[cls] || []
    return vals.map((v, i) =>
      `${i === 0 ? 'M' : 'L'} ${PAD.left + xScale(i)} ${PAD.top + yScale(v)}`
    ).join(' ')
  }

  const areaD = (cls) => {
    const vals = series[cls] || []
    if (!vals.length) return ''
    const line = vals.map((v, i) =>
      `${i === 0 ? 'M' : 'L'} ${PAD.left + xScale(i)} ${PAD.top + yScale(v)}`
    ).join(' ')
    return `${line} L ${PAD.left + xScale(vals.length-1)} ${PAD.top + innerH} L ${PAD.left} ${PAD.top + innerH} Z`
  }

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', minWidth: 300, height: 'auto', display: 'block' }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Grid */}
        {yTicks.map(({ y, val }) => (
          <g key={val}>
            <line x1={PAD.left} y1={PAD.top + y} x2={W - PAD.right} y2={PAD.top + y}
              stroke="var(--bd)" strokeWidth=".5" strokeDasharray="3,3" />
            <text x={PAD.left - 6} y={PAD.top + y + 4} textAnchor="end"
              fontSize="9" fill="var(--tx3)" fontFamily="system-ui">
              {val >= 1000 ? `${(val/1000).toFixed(0)}k` : val.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X ticks */}
        {xTicks.map(({ m, i }) => (
          <text key={m} x={PAD.left + xScale(i)} y={H - 8}
            textAnchor="middle" fontSize="9" fill="var(--tx3)" fontFamily="system-ui">
            {m.slice(2,4)}/{m.slice(5,7)}
          </text>
        ))}

        {/* Áreas (só total e a linha selecionada) */}
        {linesToDraw.map(cls => {
          const cc = CLASS_COLORS[cls] || CLASS_COLORS.other
          return (
            <path key={`area-${cls}`} d={areaD(cls)}
              fill={cc.fill} />
          )
        })}

        {/* Barras de dividendos mensais */}
        {showDivs && months.map((m, i) => {
          const dv = divSeries.total?.[i] || 0
          if (!dv) return null
          const maxDiv = Math.max(...(divSeries.total || [1]), 1)
          const barH = Math.max(2, (dv / maxDiv) * 28)
          const x = PAD.left + xScale(i)
          return (
            <rect key={`div-${i}`}
              x={x - 3} y={PAD.top + innerH - barH}
              width={6} height={barH}
              fill="rgba(168,85,247,.5)" rx="1"
            />
          )
        })}

        {/* Linhas */}
        {linesToDraw.map(cls => {
          const cc = CLASS_COLORS[cls] || CLASS_COLORS.other
          const isTotal = cls === 'total'
          return (
            <path key={`line-${cls}`} d={pathD(cls)}
              fill="none"
              stroke={cc.stroke}
              strokeWidth={isTotal ? 2.5 : 1.5}
              strokeDasharray={isTotal ? 'none' : '5,3'}
            />
          )
        })}

        {/* Hover crosshair */}
        {hoverIdx !== null && (
          <>
            <line
              x1={PAD.left + xScale(hoverIdx)} y1={PAD.top}
              x2={PAD.left + xScale(hoverIdx)} y2={PAD.top + innerH}
              stroke="var(--tx3)" strokeWidth="1" strokeDasharray="3,2"
            />
            {linesToDraw.map(cls => {
              const v = series[cls]?.[hoverIdx] || 0
              const cc = CLASS_COLORS[cls] || CLASS_COLORS.other
              return (
                <circle key={`dot-${cls}`}
                  cx={PAD.left + xScale(hoverIdx)}
                  cy={PAD.top + yScale(v)}
                  r="4" fill={cc.stroke} stroke="var(--bg2)" strokeWidth="2"
                />
              )
            })}
          </>
        )}

        {/* Zona hover invisível */}
        {months.map((m, i) => (
          <rect key={`hover-${i}`}
            x={PAD.left + xScale(i) - (innerW / months.length / 2)}
            y={PAD.top} width={innerW / months.length} height={innerH}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && (
        <div style={{
          position: 'absolute', top: 8, left: 80,
          background: 'var(--bg2)', border: '1px solid var(--bd)',
          borderRadius: 10, padding: '10px 14px', fontSize: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,.2)', pointerEvents: 'none', zIndex: 10,
          minWidth: 160
        }}>
          <div style={{ fontWeight: 700, color: 'var(--tx3)', fontSize: 10, marginBottom: 6 }}>
            {months[hoverIdx].slice(5,7)}/{months[hoverIdx].slice(0,4)}
          </div>
          {linesToDraw.map(cls => {
            const v = series[cls]?.[hoverIdx] || 0
            const cc = CLASS_COLORS[cls] || CLASS_COLORS.other
            return (
              <div key={cls} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
                <span style={{ color: cc.stroke, fontWeight: cls === 'total' ? 800 : 500 }}>
                  {cc.label}
                </span>
                <span style={{ fontWeight: cls === 'total' ? 800 : 400 }}>
                  {fmt.brl(v)}
                </span>
              </div>
            )
          })}
          {(divSeries.total?.[hoverIdx] || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--bd)' }}>
              <span style={{ color: 'rgba(168,85,247,.9)', fontWeight: 500 }}>Dividendos</span>
              <span>{fmt.brl(divSeries.total[hoverIdx])}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── CRIPTO TAB ────────────────────────────────────────────
// (imports centralizados no topo do arquivo)

// Posições iniciais da carteira do usuário
const DEFAULT_POSITIONS = [
  { symbol: 'BTC',  qty: 0, avgPrice: 0, refBuy: 0, refSell: 0 },
  { symbol: 'ETH',  qty: 0, avgPrice: 0, refBuy: 0, refSell: 0 },
  { symbol: 'ADA',  qty: 0, avgPrice: 0, refBuy: 0, refSell: 0 },
  { symbol: 'SOL',  qty: 0, avgPrice: 0, refBuy: 0, refSell: 0 },
  { symbol: 'XRP',  qty: 0, avgPrice: 0, refBuy: 0, refSell: 0 },
  { symbol: 'POL',  qty: 0, avgPrice: 0, refBuy: 0, refSell: 0 },
  { symbol: 'LTC',  qty: 0, avgPrice: 0, refBuy: 0, refSell: 0 },
  { symbol: 'LINK', qty: 0, avgPrice: 0, refBuy: 0, refSell: 0 },
]

// ── Calcula gatilhos e sinais ─────────────────────────────
function calcSignals(pos, price) {
  if (!price || !pos.avgPrice) return null
  const pct = ((price - pos.avgPrice) / pos.avgPrice) * 100
  const refBuyPct = pos.refBuy ? ((pos.refBuy - price) / pos.refBuy) * 100 : null
  const refSellPct = pos.refSell ? ((price - pos.refSell) / pos.refSell) * 100 : null
  const patrimonio = pos.qty * price
  const custoTotal = pos.qty * pos.avgPrice
  const lucro = patrimonio - custoTotal

  // Classificação do sinal
  let signal = 'hold'
  let signalReasons = []
  let signalScore = 0 // -3 a +3 (negativo = venda, positivo = compra)

  // Vs PM
  if (pct < -20) { signalScore += 2; signalReasons.push(`Preço ${pct.toFixed(1)}% abaixo do PM — oportunidade forte`) }
  else if (pct < -10) { signalScore += 1; signalReasons.push(`Preço ${pct.toFixed(1)}% abaixo do PM — atenção`) }
  else if (pct > 50) { signalScore -= 2; signalReasons.push(`Preço ${pct.toFixed(1)}% acima do PM — considere venda parcial`) }
  else if (pct > 30) { signalScore -= 1; signalReasons.push(`Preço ${pct.toFixed(1)}% acima do PM`) }

  // Vs referência de compra
  if (pos.refBuy && price <= pos.refBuy) {
    signalScore += 1.5
    signalReasons.push(`Abaixo da sua ref. de compra (${fmt.brl(pos.refBuy)})`)
  }
  // Vs referência de venda
  if (pos.refSell && price >= pos.refSell) {
    signalScore -= 1.5
    signalReasons.push(`Acima da sua ref. de venda (${fmt.brl(pos.refSell)})`)
  }

  if (signalScore >= 2) signal = 'strong_buy'
  else if (signalScore >= 1) signal = 'buy'
  else if (signalScore <= -2) signal = 'strong_sell'
  else if (signalScore <= -1) signal = 'sell'
  else signal = 'hold'

  return { pct, patrimonio, custoTotal, lucro, signal, signalReasons, signalScore }
}

// Sugestão de aporte
function calcAporteSugestao(pos, price, aporte) {
  if (!aporte || !price) return null
  const qtdComprar = aporte / price
  const novaQty = pos.qty + qtdComprar
  const novoCusto = (pos.qty * pos.avgPrice) + aporte
  const novoPM = novaQty > 0 ? novoCusto / novaQty : 0
  const reducaoPM = pos.avgPrice > 0 ? pos.avgPrice - novoPM : 0
  return { qtdComprar, novaQty, novoPM, reducaoPM }
}

// Sugestão de balanceamento
function calcBalanceSugestao(positions, prices, totalAporte) {
  // Distribuir proporcionalmente por % de sinal de compra
  const buySignals = positions
    .map(p => {
      const pr = prices[p.symbol]?.price
      const sig = calcSignals(p, pr)
      return { ...p, price: pr, score: sig?.signalScore || 0 }
    })
    .filter(p => p.score > 0 && p.price)

  if (!buySignals.length) return []
  const totalScore = buySignals.reduce((s, p) => s + p.score, 0)
  return buySignals.map(p => ({
    symbol: p.symbol,
    pct: (p.score / totalScore) * 100,
    valor: (p.score / totalScore) * totalAporte,
    price: p.price,
  }))
}

const SIGNAL_CONFIG = {
  strong_buy:  { label: 'Compra Forte', color: '#22c55e', bg: 'rgba(34,197,94,.12)',  icon: '▲▲' },
  buy:         { label: 'Comprar',      color: '#86efac', bg: 'rgba(134,239,172,.12)', icon: '▲'  },
  hold:        { label: 'Manter',       color: '#94a3b8', bg: 'rgba(148,163,184,.1)',  icon: '●'  },
  sell:        { label: 'Vender Parcial', color: '#fbbf24', bg: 'rgba(251,191,36,.12)', icon: '▼' },
  strong_sell: { label: 'Venda Forte',  color: '#ef4444', bg: 'rgba(239,68,68,.12)',  icon: '▼▼' },
}

// ── Mini gráfico SVG ──────────────────────────────────────
function MiniChart({ history, signal, refBuy, refSell }) {
  if (!history?.length) return (
    <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 11 }}>Carregando...</div>
  )
  const W = 260, H = 60, PAD = 4
  const prices = history.map(h => h.price)
  const min = Math.min(...prices), max = Math.max(...prices)
  const range = max - min || 1
  const xS = (i) => PAD + (i / (prices.length - 1)) * (W - PAD * 2)
  const yS = (v) => H - PAD - ((v - min) / range) * (H - PAD * 2)
  const sc = SIGNAL_CONFIG[signal] || SIGNAL_CONFIG.hold
  const d = prices.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xS(i)} ${yS(v)}`).join(' ')
  const area = `${d} L ${xS(prices.length-1)} ${H} L ${PAD} ${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 60, display: 'block' }}>
      <defs>
        <linearGradient id={`gr-${signal}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sc.color} stopOpacity=".25" />
          <stop offset="100%" stopColor={sc.color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#gr-${signal})`} />
      <path d={d} fill="none" stroke={sc.color} strokeWidth="1.5" />
      {refBuy && refBuy > min && refBuy < max && (
        <line x1={PAD} y1={yS(refBuy)} x2={W - PAD} y2={yS(refBuy)}
          stroke="#22c55e" strokeWidth="1" strokeDasharray="3,2" opacity=".7" />
      )}
      {refSell && refSell > min && refSell < max && (
        <line x1={PAD} y1={yS(refSell)} x2={W - PAD} y2={yS(refSell)}
          stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" opacity=".7" />
      )}
    </svg>
  )
}

export function CriptoTab() {
  const [positions, setPositions] = useState(() => {
    const saved = getCriptoPositions()
    if (saved.length) return saved
    return DEFAULT_POSITIONS
  })
  const [prices, setPrices] = useState({})
  const [histories, setHistories] = useState({})
  const [loadingPrices, setLoadingPrices] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editPos, setEditPos] = useState(null) // symbol em edição
  const [aporte, setAporte] = useState('')
  const [selectedSymbol, setSelectedSymbol] = useState('BTC')
  const [period, setPeriod] = useState(90)
  const [showBalance, setShowBalance] = useState(false)

  // Buscar preços
  useEffect(() => {
    const symbols = positions.map(p => p.symbol)
    setLoadingPrices(true)
    fetchAllCriptoPrices(symbols).then(p => {
      setPrices(p)
      setLoadingPrices(false)
    })
    // Atualizar a cada 60s
    const iv = setInterval(() => {
      fetchAllCriptoPrices(symbols).then(setPrices)
    }, 60000)
    return () => clearInterval(iv)
  }, [positions.map(p => p.symbol).join(',')])

  // Buscar histórico do ativo selecionado
  useEffect(() => {
    if (histories[`${selectedSymbol}-${period}`]) return
    fetchCriptoHistory(selectedSymbol, period).then(h => {
      if (h) setHistories(prev => ({ ...prev, [`${selectedSymbol}-${period}`]: h }))
    })
  }, [selectedSymbol, period])

  const save = (newPos) => {
    setPositions(newPos)
    saveCriptoPositions(newPos)
  }

  const updateField = (symbol, field, value) => {
    save(positions.map(p => p.symbol === symbol ? { ...p, [field]: parseFloat(value) || 0 } : p))
  }

  const selectedPos = positions.find(p => p.symbol === selectedSymbol)
  const selectedPrice = prices[selectedSymbol]?.price
  const selectedSig = calcSignals(selectedPos, selectedPrice)
  const selectedHistory = histories[`${selectedSymbol}-${period}`]
  const sc = SIGNAL_CONFIG[selectedSig?.signal || 'hold']

  // Totais
  const totalPatrimonio = positions.reduce((s, p) => s + (p.qty * (prices[p.symbol]?.price || 0)), 0)
  const totalCusto = positions.reduce((s, p) => s + (p.qty * p.avgPrice), 0)
  const totalLucro = totalPatrimonio - totalCusto

  // Sugestão de aporte
  const aporteNum = parseFloat(aporte) || 0
  const aporteDetail = aporteNum > 0 && selectedPrice
    ? calcAporteSugestao(selectedPos, selectedPrice, aporteNum)
    : null

  // Sugestão de balanceamento
  const balance = showBalance && aporteNum > 0
    ? calcBalanceSugestao(positions, prices, aporteNum)
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* KPIs cripto */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 10 }}>
        <KPI label="Patrimônio Cripto" value={fmt.brl(totalPatrimonio)} sub={`${positions.filter(p=>p.qty>0).length} ativos`} color="var(--ac)" />
        <KPI label="Custo Total" value={fmt.brl(totalCusto)} sub="Investido" />
        <KPI label="Resultado" value={fmt.brl(totalLucro)} sub={totalCusto > 0 ? `${((totalLucro/totalCusto)*100).toFixed(1)}%` : '—'} color={totalLucro >= 0 ? 'var(--gr)' : 'var(--rd)'} />
      </div>

      {/* Grid de cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 10 }}>
        {positions.map(pos => {
          const pr = prices[pos.symbol]
          const sig = calcSignals(pos, pr?.price)
          const sconf = SIGNAL_CONFIG[sig?.signal || 'hold']
          const isSelected = selectedSymbol === pos.symbol
          return (
            <div key={pos.symbol}
              onClick={() => setSelectedSymbol(pos.symbol)}
              style={{ background: 'var(--bg2)', border: `1.5px solid ${isSelected ? sconf.color : 'var(--bd)'}`, borderRadius: 14, padding: 12, cursor: 'pointer', transition: 'border .15s' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{pos.symbol}</div>
                  {pr && <div style={{ fontSize: 11, color: pr.change24h >= 0 ? 'var(--gr)' : 'var(--rd)', fontWeight: 700 }}>
                    {pr.change24h >= 0 ? '+' : ''}{pr.change24h?.toFixed(2)}% 24h
                  </div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{pr ? fmt.brl(pr.price) : '—'}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: sconf.bg, color: sconf.color }}>
                    {sconf.icon} {sconf.label}
                  </span>
                </div>
              </div>

              {/* Métricas */}
              {pos.qty > 0 && sig && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
                  {[
                    ['Patrimônio', fmt.brl(sig.patrimonio)],
                    ['Resultado', fmt.brl(sig.lucro)],
                    ['PM', fmt.brl(pos.avgPrice)],
                    ['Vs PM', `${sig.pct >= 0 ? '+' : ''}${sig.pct.toFixed(1)}%`],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--bg3)', borderRadius: 7, padding: '5px 8px' }}>
                      <div style={{ fontSize: 9, color: 'var(--tx3)' }}>{l}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Refs */}
              {(pos.refBuy > 0 || pos.refSell > 0) && (
                <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
                  {pos.refBuy > 0 && <span style={{ color: '#22c55e', background: 'rgba(34,197,94,.1)', padding: '2px 7px', borderRadius: 99 }}>▲ {fmt.brl(pos.refBuy)}</span>}
                  {pos.refSell > 0 && <span style={{ color: '#ef4444', background: 'rgba(239,68,68,.1)', padding: '2px 7px', borderRadius: 99 }}>▼ {fmt.brl(pos.refSell)}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detalhe do ativo selecionado */}
      {selectedPos && (
        <div style={{ background: 'var(--bg2)', border: `1px solid ${sc.color}40`, borderRadius: 16, overflow: 'hidden' }}>
          {/* Header detalhe */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: sc.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 900, fontSize: 20 }}>{selectedSymbol}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: sc.color, padding: '3px 10px', borderRadius: 99, background: 'var(--bg2)' }}>
                {sc.icon} {sc.label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[30,90,365].map(d => (
                <button key={d} onClick={() => setPeriod(d)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${period===d ? sc.color : 'var(--bd)'}`, background: period===d ? sc.bg : 'transparent', color: period===d ? sc.color : 'var(--tx3)', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', fontWeight: period===d ? 700 : 400 }}>
                  {d === 365 ? '1a' : `${d}d`}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Gráfico */}
            <MiniChart history={selectedHistory} signal={selectedSig?.signal || 'hold'} refBuy={selectedPos.refBuy} refSell={selectedPos.refSell} />
            {(selectedPos.refBuy > 0 || selectedPos.refSell > 0) && (
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--tx3)' }}>
                {selectedPos.refBuy > 0 && <span>── <span style={{ color: '#22c55e' }}>verde</span> = ref. compra ({fmt.brl(selectedPos.refBuy)})</span>}
                {selectedPos.refSell > 0 && <span>── <span style={{ color: '#ef4444' }}>vermelho</span> = ref. venda ({fmt.brl(selectedPos.refSell)})</span>}
              </div>
            )}

            {/* Razões do sinal */}
            {selectedSig?.signalReasons.length > 0 && (
              <div style={{ background: sc.bg, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Análise do sinal</div>
                {selectedSig.signalReasons.map((r, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--tx2)', marginBottom: 3 }}>· {r}</div>
                ))}
              </div>
            )}

            {/* Editar posição */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Minha posição</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 8 }}>
                {[
                  ['Quantidade', 'qty', selectedPos.qty],
                  ['Preço Médio (R$)', 'avgPrice', selectedPos.avgPrice],
                  ['Ref. Compra (R$)', 'refBuy', selectedPos.refBuy],
                  ['Ref. Venda (R$)', 'refSell', selectedPos.refSell],
                ].map(([label, field, val]) => (
                  <div key={field}>
                    <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 3 }}>{label}</div>
                    <input
                      type="number" step="any"
                      defaultValue={val || ''}
                      onBlur={e => updateField(selectedSymbol, field, e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Simulador de aporte */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Simulador de aporte
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 140 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', fontSize: 12 }}>R$</span>
                  <input
                    type="number" placeholder="Valor a investir"
                    value={aporte}
                    onChange={e => setAporte(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px 8px 28px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                <button onClick={() => setShowBalance(v => !v)} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${showBalance ? 'var(--ac)' : 'var(--bd)'}`, background: showBalance ? 'rgba(99,102,241,.12)' : 'var(--bg3)', color: showBalance ? 'var(--ac)' : 'var(--tx3)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: showBalance ? 700 : 400 }}>
                  ⚖ Balancear
                </button>
              </div>

              {/* Resultado do aporte */}
              {aporteDetail && (
                <div style={{ marginTop: 10, background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    Com R$ {fmt.num(aporteNum, 2)} em {selectedSymbol}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      ['Qtd. a comprar', `${aporteDetail.qtdComprar.toFixed(6)} ${selectedSymbol}`],
                      ['Nova quantidade', `${aporteDetail.novaQty.toFixed(6)} ${selectedSymbol}`],
                      ['Novo PM', fmt.brl(aporteDetail.novoPM)],
                      ['Redução PM', aporteDetail.reducaoPM > 0 ? `−${fmt.brl(aporteDetail.reducaoPM)}` : '—'],
                    ].map(([l, v]) => (
                      <div key={l} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {selectedSig?.signal?.includes('buy') && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,.08)', borderRadius: 8, padding: '8px 12px' }}>
                      ✓ Sinal de compra ativo · Aportar agora reduz o PM em {fmt.brl(Math.abs(aporteDetail.reducaoPM))}
                    </div>
                  )}
                  {selectedSig?.signal === 'hold' && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--tx3)', background: 'var(--bg3)', borderRadius: 8, padding: '8px 12px' }}>
                      ● Sem sinal claro — aporte neutro, monitore o preço
                    </div>
                  )}
                  {selectedSig?.signal?.includes('sell') && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24', background: 'rgba(251,191,36,.08)', borderRadius: 8, padding: '8px 12px' }}>
                      ⚠ Sinal de venda ativo — comprar agora não é ideal para buy & hold de longo prazo
                    </div>
                  )}
                </div>
              )}

              {/* Sugestão de balanceamento */}
              {showBalance && balance.length > 0 && (
                <div style={{ marginTop: 10, background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                    Sugestão de balanceamento — R$ {fmt.num(aporteNum, 2)}
                  </div>
                  {balance.map(b => (
                    <div key={b.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ fontWeight: 800, minWidth: 40 }}>{b.symbol}</div>
                      <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 99, overflow: 'hidden', height: 6 }}>
                        <div style={{ width: `${b.pct}%`, height: '100%', background: 'var(--ac)', borderRadius: 99 }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                        {fmt.brl(b.valor)} <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>({b.pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6 }}>
                    Distribuição proporcional aos sinais de compra ativos
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Componente principal ──────────────────────────────────
export default function Cenario() {
  const { user, macro } = useApp()
  const [tab, setTab] = useState('patrimonio')
  const [news, setNews] = useState([])
  const [loadingNews, setLoadingNews] = useState(false)

  // Estado do gráfico
  const [chartData, setChartData] = useState(null)
  const [loadingChart, setLoadingChart] = useState(false)
  const [activeClasses, setActiveClasses] = useState([])
  const [showDivs, setShowDivs] = useState(true)
  const [period, setPeriod] = useState('all') // all | 12 | 24

  useEffect(() => {
    if (tab !== 'patrimonio' || !user) return
    if (chartData) return
    setLoadingChart(true)
    Promise.all([
      getOperationsForChart(user.id),
      getDividendsForChart(user.id),
    ]).then(([ops, divs]) => {
      const built = buildPatrimonioData(ops, divs)
      setChartData(built)
      // Ativar classes que têm dados
      setActiveClasses(built.classes.filter(c =>
        (built.series[c] || []).some(v => v > 0)
      ))
    }).finally(() => setLoadingChart(false))
  }, [tab, user])

  useEffect(() => {
    if (tab !== 'macro') return
    if (news.length) return
    setLoadingNews(true)
    fetchNews()
      .then(n => setNews(Array.isArray(n) ? n : []))
      .catch(() => setNews([]))
      .finally(() => setLoadingNews(false))
  }, [tab])

  const selicReal = macro?.selic && macro?.ipca12 ? macro.selic - macro.ipca12 : null
  const copomChanged = macro?.selicMetaChange && macro.selicMetaChange !== 0
  const copomDate = macro?.selicMetaDate
    ? new Date(macro.selicMetaDate.split('/').reverse().join('-'))
        .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  // Slice de meses por período
  const slicedData = (() => {
    if (!chartData) return null
    if (period === 'all') return chartData
    const n = parseInt(period)
    const slice = (arr) => arr.slice(-n)
    const newSeries = {}
    const newDivSeries = {}
    Object.keys(chartData.series).forEach(k => { newSeries[k] = slice(chartData.series[k]) })
    Object.keys(chartData.divSeries).forEach(k => { newDivSeries[k] = slice(chartData.divSeries[k]) })
    return { ...chartData, months: slice(chartData.months), series: newSeries, divSeries: newDivSeries }
  })()

  // KPIs do gráfico
  const lastIdx = slicedData?.months.length - 1
  const patrimonioAtual = lastIdx >= 0 ? (slicedData.series.total?.[lastIdx] || 0) : 0
  const patrimonioInicio = slicedData?.series.total?.[0] || 0
  const evol = patrimonioInicio > 0 ? ((patrimonioAtual - patrimonioInicio) / patrimonioInicio) * 100 : 0
  const totalDivChart = slicedData?.divSeries.total?.reduce((s, v) => s + v, 0) || 0

  const toggleClass = (cls) => {
    setActiveClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    )
  }

  const TABS = [
    { id: 'patrimonio', label: 'Evolução Patrimônio' },
    { id: 'cripto', label: '₿ Cripto' },
    { id: 'macro', label: 'Macro / Cenário' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--bd)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', border: 'none', background: 'none',
            borderBottom: tab === t.id ? '2px solid var(--ac)' : '2px solid transparent',
            color: tab === t.id ? 'var(--ac)' : 'var(--tx3)',
            fontWeight: tab === t.id ? 700 : 400, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
            transition: 'color .15s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── ABA: Evolução Patrimônio ── */}
      {tab === 'patrimonio' && (
        <>
          {loadingChart ? <Spinner /> : !slicedData ? null : (
            <>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <KPI label="Patrimônio atual" value={fmt.brl(patrimonioAtual)} sub="A preço de custo" color="var(--ac)" />
                <KPI label="Variação período" value={fmt.pct(evol)} sub={`${slicedData.months[0]?.slice(5,7)}/${slicedData.months[0]?.slice(0,4)} → hoje`} color={evol >= 0 ? 'var(--gr)' : 'var(--rd)'} />
                <KPI label="Dividendos período" value={fmt.brl(totalDivChart)} sub="Total recebido" color="var(--ac2)" />
              </div>

              {/* Controles */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Período */}
                <div style={{ display: 'flex', border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden' }}>
                  {[['all','Tudo'],['24','24m'],['12','12m']].map(([v, l]) => (
                    <button key={v} onClick={() => setPeriod(v)} style={{
                      padding: '6px 12px', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12,
                      background: period === v ? 'var(--ac)' : 'var(--bg3)',
                      color: period === v ? 'white' : 'var(--tx3)',
                      fontWeight: period === v ? 700 : 400
                    }}>{l}</button>
                  ))}
                </div>

                {/* Toggle dividendos */}
                <button onClick={() => setShowDivs(v => !v)} style={{
                  padding: '6px 12px', borderRadius: 8, border: `1px solid ${showDivs ? 'rgba(168,85,247,.5)' : 'var(--bd)'}`,
                  background: showDivs ? 'rgba(168,85,247,.12)' : 'var(--bg3)',
                  color: showDivs ? 'rgba(168,85,247,.9)' : 'var(--tx3)',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: showDivs ? 700 : 400, cursor: 'pointer'
                }}>▌ Dividendos</button>

                <div style={{ width: 1, height: 22, background: 'var(--bd)' }} />

                {/* Toggle por classe */}
                <span style={{ fontSize: 11, color: 'var(--tx3)' }}>Comparar:</span>
                {slicedData.classes.filter(c => (slicedData.series[c]||[]).some(v=>v>0)).map(cls => {
                  const cc = CLASS_COLORS[cls] || CLASS_COLORS.other
                  const on = activeClasses.includes(cls)
                  return (
                    <button key={cls} onClick={() => toggleClass(cls)} style={{
                      padding: '5px 11px', borderRadius: 99, border: `1.5px solid ${cc.stroke}`,
                      background: on ? cc.fill : 'transparent',
                      color: on ? cc.stroke : 'var(--tx3)',
                      fontFamily: 'inherit', fontSize: 11, fontWeight: on ? 700 : 400,
                      cursor: 'pointer'
                    }}>{cc.label}</button>
                  )
                })}
              </div>

              {/* Gráfico */}
              <Card style={{ padding: '16px 12px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                  Patrimônio a preço de custo · hover para detalhes
                </div>
                <PatrimonioChart
                  months={slicedData.months}
                  series={slicedData.series}
                  divSeries={slicedData.divSeries}
                  activeClasses={activeClasses}
                  showDivs={showDivs}
                />
                {/* Legenda */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--bd)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <div style={{ width: 18, height: 2.5, background: CLASS_COLORS.total.stroke, borderRadius: 2 }} />
                    <span style={{ color: CLASS_COLORS.total.stroke, fontWeight: 700 }}>Total</span>
                  </div>
                  {activeClasses.map(cls => {
                    const cc = CLASS_COLORS[cls] || CLASS_COLORS.other
                    return (
                      <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                        <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={cc.stroke} strokeWidth="1.5" strokeDasharray="5,3"/></svg>
                        <span style={{ color: cc.stroke }}>{cc.label}</span>
                      </div>
                    )
                  })}
                  {showDivs && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                      <div style={{ width: 8, height: 10, background: 'rgba(168,85,247,.5)', borderRadius: 2 }} />
                      <span style={{ color: 'rgba(168,85,247,.9)' }}>Dividendos</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Tabela mensal resumida — últimos 12 meses */}
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', fontSize: 11, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Últimos 12 meses
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg3)' }}>
                        {['Mês', 'Patrimônio', 'FII', 'Ação BR', 'Outros', 'Dividendos'].map(h => (
                          <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--tx3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...slicedData.months].slice(-12).reverse().map((m, i) => {
                        const idx = slicedData.months.length - 1 - i
                        const total = slicedData.series.total?.[idx] || 0
                        const fii   = slicedData.series.fii?.[idx] || 0
                        const sbr   = slicedData.series.stock_br?.[idx] || 0
                        const other = total - fii - sbr
                        const div   = slicedData.divSeries.total?.[idx] || 0
                        const prevTotal = slicedData.series.total?.[idx-1] || total
                        const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0
                        return (
                          <tr key={m} style={{ borderBottom: '1px solid var(--bd)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                              {m.slice(5,7)}/{m.slice(0,4)}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 800 }}>
                              {fmt.brl(total)}
                              {delta !== 0 && <span style={{ fontSize: 10, marginLeft: 5, color: delta >= 0 ? 'var(--gr)' : 'var(--rd)' }}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</span>}
                            </td>
                            <td style={{ padding: '8px 12px', color: CLASS_COLORS.fii.stroke }}>{fii > 0 ? fmt.brl(fii) : '—'}</td>
                            <td style={{ padding: '8px 12px', color: CLASS_COLORS.stock_br.stroke }}>{sbr > 0 ? fmt.brl(sbr) : '—'}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--tx3)' }}>{other > 1 ? fmt.brl(other) : '—'}</td>
                            <td style={{ padding: '8px 12px', color: 'rgba(168,85,247,.9)', fontWeight: div > 0 ? 700 : 400 }}>{div > 0 ? fmt.brl(div) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {/* ── ABA: Cripto ── */}
      {tab === 'cripto' && <CriptoTab />}

      {/* ── ABA: Macro / Cenário ── */}
      {tab === 'macro' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {macro?.selicMeta != null && <KPI label="Selic Meta" value={`${fmt.num(macro.selicMeta, 2)}%`} sub="Decisão Copom" color="var(--ac2)" />}
            {macro?.selic != null && <KPI label="Selic Over" value={`${fmt.num(macro.selic, 2)}%`} sub="a.a. efetiva" color="var(--ac)" />}
            {macro?.cdi != null && <KPI label="CDI a.a." value={`${fmt.num(macro.cdi, 2)}%`} sub="Anualizado" color="#a78bfa" />}
            {macro?.ipca12 != null && <KPI label="IPCA 12m" value={`${fmt.num(macro.ipca12, 2)}%`} sub="Acumulado" color="var(--am)" />}
            {selicReal != null && <KPI label="Selic Real" value={`${fmt.num(selicReal, 2)}%`} sub="Selic − IPCA" color={selicReal > 4 ? 'var(--gr)' : 'var(--am)'} />}
            {macro?.dolar != null && <KPI label="Dólar" value={fmt.brl(macro.dolar)} sub="USD/BRL PTAX" />}
          </div>

          {copomChanged && (
            <Card style={{ background: macro.selicMetaChange > 0 ? 'rgba(239,68,68,.05)' : 'rgba(34,197,94,.05)', border: `1px solid ${macro.selicMetaChange > 0 ? 'rgba(239,68,68,.3)' : 'rgba(34,197,94,.3)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{macro.selicMetaChange > 0 ? '📈' : '📉'}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: macro.selicMetaChange > 0 ? 'var(--rd)' : 'var(--gr)' }}>
                    Copom {macro.selicMetaChange > 0 ? 'elevou' : 'reduziu'} a Selic em {Math.abs(macro.selicMetaChange).toFixed(2)}%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>
                    De {macro.selicMetaPrev?.toFixed(2)}% → {macro.selicMeta?.toFixed(2)}% a.a.{copomDate && ` · ${copomDate}`}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {selicReal != null && (
            <Card style={{ background: selicReal > 5 ? 'rgba(34,197,94,.05)' : 'rgba(245,158,11,.05)', border: `1px solid ${selicReal > 5 ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.3)'}` }}>
              <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6 }}>
                {selicReal > 5
                  ? `📈 Renda fixa atraente — Selic real de ${fmt.num(selicReal, 2)}% está acima de 5%. Momento favorável para posições em RF.`
                  : `⚠ Selic real de ${fmt.num(selicReal, 2)}% — avalie se a rentabilidade real compensa frente à inflação.`}
              </div>
            </Card>
          )}

          <Card>
            <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 14 }}>
              Comunicados do Banco Central
            </div>
            {loadingNews ? <Spinner /> : news.length === 0
              ? <div style={{ color: 'var(--tx3)', fontSize: 13 }}>Feed indisponível no momento.</div>
              : news.map((n, i) => (
                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '12px 0', borderBottom: i < news.length - 1 ? '1px solid var(--bd)' : 'none', textDecoration: 'none', color: 'var(--tx)' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{n.source} · {n.date ? new Date(n.date).toLocaleDateString('pt-BR') : ''}</div>
                </a>
              ))
            }
          </Card>
        </>
      )}
    </div>
  )
}
