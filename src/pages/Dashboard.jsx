import { useApp, fmt, CLASS_LABEL, CLASS_COLOR } from '../lib/context'
import { KPI, Card, MiniDonut, BalBar, AttrBadge, Spinner } from '../components/ui'

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
  const rfP = ((byClass.fixed_income || 0) / totalP) * 100
  const fiiP = ((byClass.fii || 0) / totalP) * 100
  const rvP = (((byClass.stock_br || 0) + (byClass.stock_us || 0) + (byClass.crypto || 0)) / totalP) * 100

  const monthly = portfolio.reduce((s, a) => s + (a.estimated_monthly_dividend_per_share || 0) * a.quantity, 0)
  const saldoProvento = dividends.reduce((s, d) => {
    // calc available from raw dividends (simplified here, use dividend_balances in real use)
    return s
  }, 0)

  const realSelic = macro?.selic
  const ipca12 = macro?.ipca12
  const selicReal = realSelic && ipca12 ? realSelic - ipca12 : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <KPI label="Patrimônio Total" value={fmt.brl(totalP)} sub={`Custo: ${fmt.brl(totalC)}`} />
        <KPI label="Retorno" value={fmt.brl(ret)} sub={fmt.pct(retPct)} color={ret >= 0 ? 'var(--gr)' : 'var(--rd)'} />
        <KPI label="Dividendos/mês" value={fmt.brl(monthly)} sub="Estimado ano corrente" />
        {macro && <KPI label="Selic" value={`${fmt.num(macro.selic, 2)}%`} sub={selicReal ? `Real: ${fmt.num(selicReal, 2)}%` : 'a.a.'} />}
        {macro?.dolar && <KPI label="USD/BRL" value={fmt.brl(macro.dolar)} sub="Banco Central" />}
      </div>

      {/* Allocation + Balance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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

      {/* Top assets */}
      {portfolio.length > 0 && (
        <Card>
          <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 14 }}>Posições em Destaque</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
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
                    {fmt.brl(res)} ({fmt.pct(((price - a.avg_price) / a.avg_price) * 100)})
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
