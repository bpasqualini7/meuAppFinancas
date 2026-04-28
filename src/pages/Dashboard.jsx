import { useState, useRef, useEffect } from 'react'
import { useApp, fmt, CLASS_LABEL, CLASS_COLOR } from '../lib/context'
import { KPI, Card, MiniDonut, BalBar, AttrBadge, Spinner } from '../components/ui'
import { getDashboardOrder, saveDashboardOrder, getDividends } from '../lib/supabase'

// ── Macro Ticker Strip ────────────────────────────────────
function MacroStrip({ macro }) {
  if (!macro) return null
  const fmtPct = (v) => v == null ? '' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`
  const fmtPctPlain = (v) => v == null ? '—' : `${Number(v).toFixed(2)}%`
  const selicReal = macro.selic && macro.ipca12 ? (macro.selic - macro.ipca12).toFixed(2) : null
  const indicators = [
    { key: 'selic_meta', label: 'SELIC Meta', value: fmtPctPlain(macro.selicMeta), sub: null, change: null, accent: 'var(--ac2)', tooltip: 'Taxa básica de juros definida pelo Copom. Referência para toda a economia.' },
    { key: 'selic', label: 'SELIC Over', value: fmtPctPlain(macro.selic), sub: null, change: null, accent: 'var(--ac2)', tooltip: 'Taxa SELIC efetiva diária (Over). Base para CDBs e Tesouro Selic.' },
    { key: 'cdi', label: 'CDI a.a.', value: fmtPctPlain(macro.cdi), sub: null, change: null, accent: '#a78bfa', tooltip: 'Certificado de Depósito Interbancário. Referência para renda fixa — CDBs, LCIs e LCAs.' },
    macro.ipca12 != null && { key: 'ipca', label: 'IPCA 12m', value: fmtPctPlain(macro.ipca12), sub: null, change: null, accent: '#fb923c', tooltip: 'Inflação oficial do Brasil (IPCA) acumulada nos últimos 12 meses.' },
    selicReal && { key: 'selic_real', label: 'Selic Real', value: `${selicReal}%`, sub: null, change: null, accent: '#34d399', tooltip: 'SELIC Over menos IPCA 12m — ganho real acima da inflação.' },
    macro.ibov && { key: 'ibov', label: 'IBOV', value: Number(macro.ibov.price).toLocaleString('pt-BR', { maximumFractionDigits: 0 }), sub: fmtPct(macro.ibov.change_pct), change: macro.ibov.change_pct, accent: '#4ade80', tooltip: 'Índice Bovespa — principal índice da bolsa brasileira, via ETF BOVA11.' },
    macro.sp500 && { key: 'sp500', label: 'S&P 500', value: Number(macro.sp500.price).toLocaleString('pt-BR', { maximumFractionDigits: 0 }), sub: fmtPct(macro.sp500.change_pct), change: macro.sp500.change_pct, accent: '#60a5fa', tooltip: 'Índice das 500 maiores empresas dos EUA, via ETF IVVB11 em BRL.' },
    macro.dolar != null && { key: 'dolar', label: 'USD/BRL', value: `R$\u00a0${Number(macro.dolar).toFixed(3)}`, sub: null, change: null, accent: '#34d399', tooltip: 'Taxa de câmbio Dólar/Real — fonte: Banco Central do Brasil.' },
    macro.btc && { key: 'btc', label: 'BTC', value: `R$\u00a0${Number(macro.btc.price_brl).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, sub: fmtPct(macro.btc.change_pct), change: macro.btc.change_pct, accent: '#f59e0b', tooltip: 'Bitcoin em reais — fonte: CoinGecko.' },
  ].filter(Boolean)
  const updatedTime = macro.updatedAt ? new Date(macro.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 0' }}>
        <span style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Indicadores Macro</span>
        {updatedTime && <span style={{ fontSize: 10, color: 'var(--tx3)' }}>Atualizado às {updatedTime}</span>}
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', padding: '10px 6px 12px', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
        {indicators.map((ind, i) => (
          <div key={ind.key} style={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>
            <div title={ind.tooltip || ''} style={{ padding: '8px 10px', minWidth: 88, textAlign: 'center', cursor: ind.tooltip ? 'help' : 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>{ind.label}</span>
                {ind.tooltip && <span style={{ fontSize: 9, color: 'var(--tx3)', lineHeight: 1, opacity: 0.7 }}>ⓘ</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx)', lineHeight: 1, marginBottom: ind.sub ? 3 : 0 }}>{ind.value}</div>
              {ind.sub && <div style={{ fontSize: 11, fontWeight: 600, color: ind.change != null ? (ind.change >= 0 ? 'var(--gr)' : 'var(--rd)') : 'var(--tx3)' }}>{ind.sub}</div>}
              <div style={{ height: 2, borderRadius: 1, background: ind.accent, marginTop: 6, opacity: 0.7 }} />
            </div>
            {i < indicators.length - 1 && <div style={{ width: 1, height: 36, background: 'var(--bd)', flexShrink: 0 }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Drag & Drop wrapper ───────────────────────────────────
function DraggableSection({ id, index, onDragStart, onDragOver, onDrop, children, editMode }) {
  const dragOver = useRef(false)
  const [isOver, setIsOver] = useState(false)

  if (!editMode) return <div>{children}</div>

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); setIsOver(true); onDragOver(index) }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => { e.preventDefault(); setIsOver(false); onDrop(index) }}
      style={{
        borderRadius: 14,
        border: isOver ? '2px dashed var(--ac)' : '2px dashed transparent',
        transition: 'border .15s, opacity .15s',
        cursor: 'grab',
        position: 'relative',
      }}
    >
      {/* Handle */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 10,
        background: 'var(--bg3)', border: '1px solid var(--bd)',
        borderRadius: 6, padding: '3px 6px', fontSize: 12,
        color: 'var(--tx3)', cursor: 'grab', userSelect: 'none',
      }}>⠿</div>
      {children}
    </div>
  )
}

// ── Seções do Dashboard ───────────────────────────────────
const DEFAULT_ORDER = ['kpis', 'allocation', 'sector', 'dividends_ranking', 'positions']

export default function Dashboard() {
  const { portfolio, prices, macro, profile, loading, user } = useApp()
  const [editMode, setEditMode] = useState(false)
  const [order, setOrder] = useState(() => {
    // Inicializa com localStorage para evitar flash, depois sincroniza com Supabase
    try { return JSON.parse(localStorage.getItem('dashboard_order')) || DEFAULT_ORDER }
    catch { return DEFAULT_ORDER }
  })
  const dragFrom = useRef(null)
  const [divHistory, setDivHistory] = useState([])
  // Carregar ordem do Supabase ao montar (sobrescreve localStorage se tiver versão mais recente)
  useEffect(() => {
    if (!user) return
    getDashboardOrder(user.id)
      .then(saved => {
        if (saved && Array.isArray(saved) && saved.length) {
          // Migrar: adicionar novas seções se não existirem no order salvo
          const allSections = ['kpis', 'allocation', 'sector', 'dividends_ranking', 'positions']
          const merged = [...saved, ...allSections.filter(s => !saved.includes(s))]
          setOrder(merged)
        }
      })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    getDividends(user.id).then(d => setDivHistory(d || [])).catch(() => {})
  }, [user?.id])

  if (loading) return <Spinner />

  const totalP = portfolio.reduce((s, a) => s + (prices[a.ticker]?.price || a.avg_price) * a.quantity, 0)
  const totalC = portfolio.reduce((s, a) => s + a.avg_price_net * a.quantity, 0)
  const ret = totalP - totalC
  const retPct = totalC ? (ret / totalC) * 100 : 0
  const byClass = {}
  portfolio.forEach(a => { const v = (prices[a.ticker]?.price || a.avg_price) * a.quantity; byClass[a.asset_class] = (byClass[a.asset_class] || 0) + v })
  const donut = Object.entries(byClass).map(([k, v]) => ({ label: CLASS_LABEL[k], value: v, color: CLASS_COLOR[k] }))
  const age = profile?.age || 35
  const rfT = profile?.target_rf_pct || age
  const fiiT = profile?.target_fii_pct || (100 - age) / 2
  const rvT = profile?.target_rv_pct || (100 - age) / 2
  const rfP = totalP ? ((byClass.fixed_income || 0) / totalP) * 100 : 0
  const fiiP = totalP ? ((byClass.fii || 0) / totalP) * 100 : 0
  const rvP = totalP ? (((byClass.stock_br || 0) + (byClass.stock_us || 0) + (byClass.crypto || 0)) / totalP) * 100 : 0
  // Ações = stock_br + stock_us + crypto (sem FII — FII tem linha própria)
  const monthly = portfolio.reduce((s, a) => s + (a.estimated_monthly_dividend_per_share || 0) * a.quantity, 0)

  // ── Por setor ─────────────────────────────────────────────
  const bySector = {}
  portfolio.forEach(a => {
    if (!a.sector) return
    const v = (prices[a.ticker]?.price || a.avg_price) * a.quantity
    bySector[a.sector] = (bySector[a.sector] || 0) + v
  })
  const sectorEntries = Object.entries(bySector).sort((a, b) => b[1] - a[1])
  const sectorMax = sectorEntries[0]?.[1] || 1

  // ── Ranking proventos ─────────────────────────────────────
  const divByTicker = {}
  ;(divHistory || []).forEach(d => {
    const ticker = d.assets?.ticker
    if (!ticker || !d.total_amount) return
    divByTicker[ticker] = (divByTicker[ticker] || 0) + (d.total_amount || 0)
  })
  const topDivs = Object.entries(divByTicker).sort((a, b) => b[1] - a[1]).slice(0, 8)

  // ── Últimos proventos recebidos ───────────────────────────
  const recentDivs = [...divHistory]
    .filter(d => d.payment_date)
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
    .slice(0, 6)

  // ── DY médio estimado da carteira ────────────────────────
  const assetsWithDY = portfolio.filter(a => prices[a.ticker]?.dy != null && Number(prices[a.ticker].dy) > 0)
  const avgDY = assetsWithDY.length
    ? assetsWithDY.reduce((s, a) => s + Number(prices[a.ticker].dy), 0) / assetsWithDY.length
    : null

  const handleDragStart = (i) => { dragFrom.current = i }
  const handleDragOver = (i) => { }
  const handleDrop = (i) => {
    if (dragFrom.current === null || dragFrom.current === i) return
    const newOrder = [...order]
    const [moved] = newOrder.splice(dragFrom.current, 1)
    newOrder.splice(i, 0, moved)
    setOrder(newOrder)
    // Persistir em ambos — localStorage (imediato) e Supabase (multi-browser)
    localStorage.setItem('dashboard_order', JSON.stringify(newOrder))
    if (user) saveDashboardOrder(user.id, newOrder).catch(() => {})
    dragFrom.current = null
  }

  const SECTIONS = {
    kpis: (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <KPI label="Patrimônio Total" value={fmt.brl(totalP)} sub={`Custo: ${fmt.brl(totalC)}`} />
        <KPI label="Retorno Total" value={fmt.brl(ret)} sub={fmt.pct(retPct)} color={ret >= 0 ? 'var(--gr)' : 'var(--rd)'} />
        <KPI label="Dividendos/mês" value={fmt.brl(monthly)} sub="Estimado (proventos cadastrados)" />
        <KPI label="Ativos na carteira" value={portfolio.length} sub={`${portfolio.filter(a=>a.asset_class==='fii').length} FIIs · ${portfolio.filter(a=>a.asset_class==='stock_br').length} Ações`} />
      </div>
    ),
    allocation: (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 14 }}>Alocação por Classe</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <MiniDonut data={donut} />
            <div style={{ flex: 1 }}>
              {donut.map(d => (
                <div key={d.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: d.color }} />
                      <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{d.label}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{totalP ? ((d.value / totalP) * 100).toFixed(1) : '0'}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginLeft: 13 }}>{fmt.brl(d.value)}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>Balanceamento por Idade</div>
          <p style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 14 }}>
            Meta p/ {age} anos (Config.): RF {rfT.toFixed(0)}% · FII {fiiT.toFixed(0)}% · Ações {rvT.toFixed(0)}%
          </p>
          <BalBar label={`Renda Fixa — ${fmt.brl(byClass.fixed_income||0)}`} current={rfP} target={rfT} color="var(--ac2)" />
          <BalBar label={`FIIs — ${fmt.brl(byClass.fii||0)}`} current={fiiP} target={fiiT} color="var(--am)" />
          <BalBar label={`Ações — ${fmt.brl((byClass.stock_br||0)+(byClass.stock_us||0))}`} current={rvP} target={rvT} color="var(--gr)" />
          {(() => {
            const gaps = [
              { label: 'Renda Fixa', diff: rfP - rfT },
              { label: 'FIIs', diff: fiiP - fiiT },
              { label: 'Ações', diff: rvP - rvT },
            ]
            const worst = gaps.reduce((a, b) => Math.abs(b.diff) > Math.abs(a.diff) ? b : a)
            if (Math.abs(worst.diff) <= 5) return null
            const msg = worst.diff < 0
              ? `⚠ ${worst.label} está ${Math.abs(worst.diff).toFixed(0)}pp abaixo da meta — priorize aqui`
              : `⚠ ${worst.label} está ${worst.diff.toFixed(0)}pp acima da meta — redirecione aportes`
            return (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', fontSize: 11, color: 'var(--am)', lineHeight: 1.5 }}>
                {msg}
              </div>
            )
          })()}
        </Card>
      </div>
    ),
    sector: sectorEntries.length > 0 ? (
      <Card>
        <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 14 }}>Alocação por Setor</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sectorEntries.map(([sector, val]) => (
            <div key={sector}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--tx2)', fontWeight: 500 }}>{sector}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{totalP > 0 ? ((val/totalP)*100).toFixed(1) : 0}%</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{fmt.brl(val)}</span>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(val/sectorMax)*100}%`, borderRadius: 3, background: 'var(--ac)', transition: 'width .4s' }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    ) : null,

    dividends_ranking: (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {/* Ranking proventos */}
        {topDivs.length > 0 && (
          <Card>
            <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 14 }}>
              Top Proventos Recebidos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {topDivs.map(([ticker, total], i) => {
                const maxDiv = topDivs[0][1]
                return (
                  <div key={ticker}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 10, color: 'var(--tx3)', minWidth: 14, fontWeight: 700 }}>{i+1}</span>
                        <span style={{ fontSize: 12, fontWeight: 800 }}>{ticker}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ac2)' }}>{fmt.brl(total)}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--bg3)', overflow: 'hidden', marginLeft: 21 }}>
                      <div style={{ height: '100%', width: `${(total/maxDiv)*100}%`, borderRadius: 2, background: 'rgba(168,85,247,.6)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Últimos recebidos + DY médio */}
        <Card>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>
            Últimos Proventos
          </div>
          {avgDY != null && (
            <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 12 }}>
              DY médio carteira: <span style={{ fontWeight: 800, color: avgDY > 8 ? 'var(--gr)' : 'var(--am)' }}>{avgDY.toFixed(1)}%</span>
            </div>
          )}
          {recentDivs.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < recentDivs.length - 1 ? '1px solid var(--bd)' : 'none' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{d.assets?.ticker}</div>
                <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{fmt.date(d.payment_date)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: 'var(--ac2)', fontSize: 13 }}>{fmt.brl(d.total_amount)}</div>
                <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{fmt.brl(d.amount_per_share)}/cota</div>
              </div>
            </div>
          ))}
          {recentDivs.length === 0 && <div style={{ color: 'var(--tx3)', fontSize: 12 }}>Nenhum provento registrado.</div>}
        </Card>
      </div>
    ),

    positions: portfolio.length > 0 ? (
      <Card>
        <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 14 }}>Posições em Destaque</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {portfolio.slice(0, 6).map(a => {
            const p = prices[a.ticker]
            const price = p?.price || a.avg_price
            const res = (price - a.avg_price) * a.quantity
            return (
              <div key={a.id} style={{ padding: '12px 14px', background: 'var(--bg3)', borderRadius: 10, border: '1px solid var(--bd)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{a.ticker}</span>
                  <AttrBadge ticker={a.ticker} prices={prices} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{fmt.brl(price)}</div>
                <div style={{ fontSize: 11, color: res >= 0 ? 'var(--gr)' : 'var(--rd)', marginTop: 2 }}>
                  {fmt.brl(res)} ({fmt.pct(a.avg_price ? ((price - a.avg_price) / a.avg_price) * 100 : 0)})
                </div>
                {p?.change_pct !== undefined && (
                  <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2 }}>
                    Hoje: <span style={{ color: p.change_pct >= 0 ? 'var(--gr)' : 'var(--rd)' }}>{fmt.pct(p.change_pct)}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    ) : null,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Macro Strip (sempre fixo no topo) ── */}
      <MacroStrip macro={macro} />

      {/* ── Botão editar layout ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {editMode && (
          <button onClick={() => { setOrder(DEFAULT_ORDER); localStorage.removeItem('dashboard_order') }}
            style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↺ Resetar
          </button>
        )}
        <button onClick={() => setEditMode(e => !e)} style={{
          padding: '5px 14px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
          border: `1px solid ${editMode ? 'var(--ac)' : 'var(--bd)'}`,
          background: editMode ? 'rgba(59,130,246,.15)' : 'var(--bg3)',
          color: editMode ? 'var(--ac)' : 'var(--tx3)', fontWeight: editMode ? 700 : 400,
        }}>
          {editMode ? '✓ Concluir' : '⠿ Editar layout'}
        </button>
      </div>

      {editMode && (
        <div style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', fontSize: 12, color: 'var(--ac)' }}>
          Arraste os blocos para reorganizar o Dashboard
        </div>
      )}

      {/* ── Seções draggable ── */}
      {order.map((id, index) => SECTIONS[id] ? (
        <DraggableSection key={id} id={id} index={index} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} editMode={editMode}>
          {SECTIONS[id]}
        </DraggableSection>
      ) : null)}
    </div>
  )
}
