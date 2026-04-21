import { useApp, fmt, CLASS_LABEL, CLASS_COLOR } from '../lib/context'
import { KPI, Card, MiniDonut, BalBar, AttrBadge, Spinner } from '../components/ui'

// ── Macro Ticker Strip ────────────────────────────────────
function MacroStrip({ macro }) {
  if (!macro) return null

  const fmtPct = (v) => v == null ? '' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`
  const fmtPctPlain = (v) => v == null ? '—' : `${Number(v).toFixed(2)}%`

  const indicators = [
    {
      key: 'selic_meta',
      label: 'SELIC Meta',
      value: fmtPctPlain(macro.selicMeta),
      sub: null, change: null,
      accent: 'var(--ac2)',
    },
    {
      key: 'selic',
      label: 'SELIC Over',
      value: fmtPctPlain(macro.selic),
      sub: null, change: null,
      accent: 'var(--ac2)',
    },
    {
      key: 'cdi',
      label: 'CDI a.a.',
      value: fmtPctPlain(macro.cdi),
      sub: null, change: null,
      accent: '#a78bfa',
    },
    macro.ipca12 != null && {
      key: 'ipca',
      label: 'IPCA 12m',
      value: fmtPctPlain(macro.ipca12),
      sub: macro.selic && macro.ipca12 ? `Real: ${(macro.selic - macro.ipca12).toFixed(2)}%` : null,
      change: null,
      accent: '#fb923c',
    },
    macro.ibov && {
      key: 'ibov',
      label: 'IBOV',
      value: Number(macro.ibov.price).toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
      sub: fmtPct(macro.ibov.change_pct),
      change: macro.ibov.change_pct,
      accent: '#4ade80',
    },
    macro.sp500 && {
      key: 'sp500',
      label: 'S&P 500',
      value: Number(macro.sp500.price).toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
      sub: fmtPct(macro.sp500.change_pct),
      change: macro.sp500.change_pct,
      accent: '#60a5fa',
    },
    macro.dolar != null && {
      key: 'dolar',
      label: 'USD/BRL',
      value: `R$\u00a0${Number(macro.dolar).toFixed(3)}`,
      sub: null, change: null,
      accent: '#34d399',
    },
    macro.btc && {
      key: 'btc',
      label: 'BTC',
      value: `R$\u00a0${Number(macro.btc.price_brl).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
      sub: fmtPct(macro.btc.change_pct),
      change: macro.btc.change_pct,
      accent: '#f59e0b',
    },
  ].filter(Boolean)

  const updatedTime = macro.updatedAt
    ? new Date(macro.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--bd)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 0',
      }}>
        <span style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
          Indicadores Macro
        </span>
        {updatedTime && (
          <span style={{ fontSize: 10, color: 'var(--tx3)' }}>Atualizado às {updatedTime}</span>
        )}
      </div>

      <div style={{
        display: 'flex',
        overflowX: 'auto',
        padding: '10px 6px 12px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {indicators.map((ind, i) => (
          <div key={ind.key} style={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>
            <div style={{ padding: '8px 10px', minWidth: 88, textAlign: 'center' }}>
              <div style={{
                fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase',
                letterSpacing: '0.07em', fontWeight: 700, marginBottom: 4,
              }}>
                {ind.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx)', lineHeight: 1, marginBottom: ind.sub ? 3 : 0 }}>
                {ind.value}
              </div>
              {ind.sub && (
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: ind.change != null ? (ind.change >= 0 ? 'var(--gr)' : 'var(--rd)') : 'var(--tx3)',
                }}>
                  {ind.sub}
                </div>
              )}
              <div style={{ height: 2, borderRadius: 1, background: ind.accent, marginTop: 6, opacity: 0.7 }} />
            </div>
            {i < indicators.length - 1 && (
              <div style={{ width: 1, height: 36, background: 'var(--bd)', flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { portfolio, dividends, prices, macro, profile, loading } = useApp()

  if (loading) return <Spinner />

  const totalP = portfolio.reduce((s, a) => s + (prices[a.ticker]?.price || a.avg_price) * a.quantity, 0)
  const totalC = portfolio.reduce((s, a) => s + a.avg_price_net * a.quantity, 0)
  const ret = totalP - totalC
  const retPct = totalC ? (ret / totalC) * 100 : 0

  const byClass = {}
  portfolio.forEach(a => {
    const v = (prices[a.ticker]?.price || a.avg_price) * a.quantity
    byClass[a.asset_class] = (byClass[a.asset_class] || 0) + v
  })

  const donut = Object.entries(byClass).map(([k, v]) => ({
    label: CLASS_LABEL[k], value: v, color: CLASS_COLOR[k],
  }))

  const age = profile?.age || 35
  const rfT = profile?.target_rf_pct || age
  const fiiT = profile?.target_fii_pct || (100 - age) / 2
  const rvT = profile?.target_rv_pct || (100 - age) / 2
  const rfP = totalP ? ((byClass.fixed_income || 0) / totalP) * 100 : 0
  const fiiP = totalP ? ((byClass.fii || 0) / totalP) * 100 : 0
  const rvP = totalP ? (((byClass.stock_br || 0) + (byClass.stock_us || 0) + (byClass.crypto || 0)) / totalP) * 100 : 0

  const monthly = portfolio.reduce((s, a) => s + (a.estimated_monthly_dividend_per_share || 0) * a.quantity, 0)

  const realSelic = macro?.selic
  const ipca12 = macro?.ipca12
  const selicReal = realSelic && ipca12 ? realSelic - ipca12 : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Macro Strip ── */}
      <MacroStrip macro={macro} />

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <KPI label="Patrimônio Total" value={fmt.brl(totalP)} sub={`Custo: ${fmt.brl(totalC)}`} />
        <KPI label="Retorno" value={fmt.brl(ret)} sub={fmt.pct(retPct)} color={ret >= 0 ? 'var(--gr)' : 'var(--rd)'} />
        <KPI label="Dividendos/mês" value={fmt.brl(monthly)} sub="Estimado ano corrente" />
        {macro && <KPI label="Selic" value={`${fmt.num(macro.selic, 2)}%`} sub={selicReal ? `Real: ${fmt.num(selicReal, 2)}%` : 'a.a.'} />}
        {macro?.dolar && <KPI label="USD/BRL" value={fmt.brl(macro.dolar)} sub="Banco Central" />}
      </div>

      {/* ── Allocation + Balance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 14 }}>Alocação por Classe</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <MiniDonut data={donut} />
            <div style={{ flex: 1 }}>
              {donut.map(d => (
                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: d.color }} />
                    <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{d.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    {totalP ? ((d.value / totalP) * 100).toFixed(1) : '0'}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>Balanceamento por Idade</div>
          <p style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 14 }}>
            Para {age} anos: RF {rfT.toFixed(0)}% / FII {fiiT.toFixed(0)}% / RV {rvT.toFixed(0)}%
          </p>
          <BalBar label="Renda Fixa" current={rfP} target={rfT} color="var(--ac2)" />
          <BalBar label="FIIs" current={fiiP} target={fiiT} color="var(--am)" />
          <BalBar label="Renda Variável" current={rvP} target={rvT} color="var(--gr)" />
          {Math.abs(rfP - rfT) > 5 && (
            <div style={{ marginTop: 10, padding: '7px 10px', borderRadius: 8, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', fontSize: 11, color: 'var(--am)' }}>
              ⚠ Carteira desbalanceada — reforce a Renda Fixa
            </div>
          )}
        </Card>
      </div>

      {/* ── Top assets ── */}
      {portfolio.length > 0 && (
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
      )}
    </div>
  )
}
