// ── PORTFOLIO ─────────────────────────────────────────────
import { useState } from 'react'
import { useApp, fmt, CLASS_LABEL, CLASS_COLOR, getMagicNumber } from '../lib/context'
import { Card, Btn, Badge, AttrBadge, AssetSearch, Spinner, Empty, Input, KPI } from '../components/ui'
import { insertDividend, addToWatchlist, updateProfile } from '../lib/supabase'

export function Portfolio() {
  const { portfolio, prices, divBalances, loading, refreshPortfolio } = useApp()
  const [filter, setFilter] = useState('all')

  if (loading) return <Spinner />

  const classes = [...new Set(portfolio.map(a => a.asset_class))]
  const filtered = portfolio.filter(a => filter === 'all' || a.asset_class === filter)

  const balances = {}
  divBalances.forEach(d => { balances[d.ticker] = d.available_balance })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filtros de classe */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn color="ghost" onClick={() => setFilter('all')} style={{ border: filter === 'all' ? '2px solid var(--ac)' : undefined }}>Todos</Btn>
        {classes.map(c => (
          <Btn key={c} color="ghost" onClick={() => setFilter(c)} style={{ border: filter === c ? '2px solid var(--ac)' : undefined }}>
            {CLASS_LABEL[c]}
          </Btn>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty icon="◈" message="Nenhum ativo na carteira ainda. Registre operações no Extrato!" />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)' }}>
                {['Ativo', 'Classe', 'Qtd', 'PM', 'PMP 💡', 'Cotação', 'Resultado', 'Div. Acum.', 'Saldo Prov.', 'Nº Mágico', 'Badge', 'C20A'].map(h => (
                  <th key={h} style={{ padding: '9px 11px', textAlign: 'left', color: 'var(--tx3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bd)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const p = prices[a.ticker], price = p?.price || a.avg_price
                const res = (price - a.avg_price) * a.quantity
                const resPct = a.avg_price ? ((price - a.avg_price) / a.avg_price) * 100 : 0
                const magic = getMagicNumber(price, a.estimated_monthly_dividend_per_share)
                const saldo = balances[a.ticker] || 0
                return (
                  <tr key={a.asset_id} style={{ borderBottom: '1px solid var(--bd)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                    <td style={{ padding: '9px 11px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--tx)' }}>{a.ticker}</div>
                      <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{a.name}</div>
                    </td>
                    <td style={{ padding: '9px 11px' }}>
                      <Badge color={a.asset_class === 'fii' ? 'fii' : a.asset_class === 'crypto' ? 'crypto' : 'green'}>
                        {CLASS_LABEL[a.asset_class]}
                      </Badge>
                    </td>
                    <td style={{ padding: '9px 11px', fontWeight: 700 }}>{fmt.num(a.quantity, 0)}</td>
                    <td style={{ padding: '9px 11px', color: 'var(--tx2)' }}>{fmt.brl(a.avg_price)}</td>
                    <td style={{ padding: '9px 11px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--gr)' }}>{fmt.brl(a.avg_price_net)}</div>
                      <div style={{ fontSize: 9, color: 'var(--tx3)' }}>do bolso</div>
                    </td>
                    <td style={{ padding: '9px 11px' }}>
                      <div style={{ fontWeight: 800 }}>{fmt.brl(price)}</div>
                      {p?.change_pct !== undefined && (
                        <div style={{ fontSize: 10, color: p.change_pct >= 0 ? 'var(--gr)' : 'var(--rd)' }}>
                          {fmt.pct(p.change_pct)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '9px 11px' }}>
                      <div style={{ fontWeight: 700, color: res >= 0 ? 'var(--gr)' : 'var(--rd)' }}>{fmt.brl(res)}</div>
                      <div style={{ fontSize: 10, color: res >= 0 ? 'var(--gr)' : 'var(--rd)' }}>{fmt.pct(resPct)}</div>
                    </td>
                    <td style={{ padding: '9px 11px', color: 'var(--ac2)', fontWeight: 700 }}>{fmt.brl(a.cumulative_dividends)}</td>
                    <td style={{ padding: '9px 11px' }}>
                      <div style={{ fontWeight: 700, color: saldo > 0 ? 'var(--ac2)' : 'var(--tx3)' }}>{saldo > 0 ? fmt.brl(saldo) : '—'}</div>
                    </td>
                    <td style={{ padding: '9px 11px', color: 'var(--am)', fontWeight: 700 }}>
                      {magic ? `${magic}x` : '—'}
                    </td>
                    <td style={{ padding: '9px 11px' }}><AttrBadge ticker={a.ticker} prices={prices} /></td>
                    <td style={{ padding: '9px 11px' }}>
                      <Badge color={a.c20a_included ? 'green' : 'accent'}>{a.c20a_included ? '✓' : '+'}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function C20A() {
  const { portfolio, prices } = useApp()
  const c20a = portfolio.filter(a => a.is_c20a)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,rgba(59,130,246,.08),rgba(99,102,241,.08))', border: '1px solid rgba(99,102,241,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Carteira C20A ⭐</h2>
            <p style={{ fontSize: 13, color: 'var(--tx2)', margin: '4px 0 0' }}>Meta: R$500–R$1.000/mês por ativo na aposentadoria</p>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--ac)' }}>{c20a.length}<span style={{ fontSize: 16, color: 'var(--tx3)' }}>/20</span></div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {c20a.map(a => {
          const price = prices[a.ticker]?.price || a.avg_price
          const monthly = (a.estimated_monthly_dividend_per_share || 0) * a.quantity
          const mid = (a.c20a_target_min + a.c20a_target_max) / 2
          const tq = a.estimated_monthly_dividend_per_share > 0 ? Math.ceil(mid / a.estimated_monthly_dividend_per_share) : null
          const prog = tq ? Math.min((a.quantity / tq) * 100, 100) : 0
          const ok = monthly >= a.c20a_target_min
          const magic = getMagicNumber(price, a.estimated_monthly_dividend_per_share)
          return (
            <Card key={a.asset_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div><div style={{ fontWeight: 800, fontSize: 16 }}>{a.ticker}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>{a.name}</div></div>
                {ok && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(34,197,94,.15)', color: 'var(--gr)' }}>✓ Meta</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[['Tenho', fmt.num(a.quantity, 0), 'cotas'], ['Meta', tq ? fmt.num(tq, 0) : '—', 'cotas'], ['Renda/mês', fmt.brl(monthly), ''], ['Alvo', `${fmt.brl(a.c20a_target_min)}–${fmt.brl(a.c20a_target_max)}`, '']].map(([l, v, s]) => (
                  <div key={l} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '7px 10px' }}>
                    <div style={{ fontSize: 9, color: 'var(--tx3)' }}>{l}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: l === 'Meta' ? 'var(--ac)' : l === 'Renda/mês' && ok ? 'var(--gr)' : 'var(--tx)' }}>{v}</div>
                    {s && <div style={{ fontSize: 9, color: 'var(--tx2)' }}>{s}</div>}
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--tx3)' }}>Progresso</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ok ? 'var(--gr)' : 'var(--ac)' }}>{prog.toFixed(0)}%</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg4)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${prog}%`, background: ok ? 'var(--gr)' : 'var(--ac)', borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <AttrBadge ticker={a.ticker} prices={prices} />
                {magic && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,.15)', color: 'var(--ac2)' }}>✧ Nº Mágico: {fmt.num(magic, 0)}</span>}
              </div>
            </Card>
          )
        })}
        {Array.from({ length: 20 - c20a.length }).map((_, i) => (
          <div key={i} style={{ border: '2px dashed var(--bd)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, color: 'var(--tx3)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Adicionar
          </div>
        ))}
      </div>
    </div>
  )
}

// ── WATCHLIST ─────────────────────────────────────────────
export function Watchlist() {
  const { user, watchlist, prices, refreshPortfolio } = useApp()
  const [search, setSearch] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <AssetSearch onSelect={async (a) => { await addToWatchlist(user.id, a.id); refreshPortfolio() }} placeholder="Adicionar ativo para acompanhar..." />
        </div>
      </div>
      {watchlist.length === 0 ? (
        <Empty icon="◎" message="Nenhum ativo na watchlist. Busque acima para adicionar." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {watchlist.map(w => {
            const ticker = w.assets?.ticker
            const p = prices[ticker]
            const metrics = [
              ['P/L', p?.pl, p?.pl < 12],
              ['P/VP', p?.pvp, p?.pvp < 1.2],
              ['DY', p?.dy && `${p.dy.toFixed(1)}%`, p?.dy > 6],
              ['MM200', p?.ma200 && fmt.brl(p.ma200), p?.price < p?.ma200],
            ].filter(([, v]) => v)
            return (
              <Card key={w.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div><div style={{ fontWeight: 800, fontSize: 18 }}>{ticker}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>{w.assets?.name}</div></div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{p ? fmt.brl(p.price) : '—'}</div>
                    {p?.change_pct !== undefined && <div style={{ fontSize: 11, color: p.change_pct >= 0 ? 'var(--gr)' : 'var(--rd)' }}>{fmt.pct(p.change_pct)}</div>}
                  </div>
                </div>
                {metrics.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                    {metrics.map(([l, v, ok]) => (
                      <div key={l} style={{ background: 'var(--bg3)', borderRadius: 7, padding: '6px 9px' }}>
                        <div style={{ fontSize: 9, color: 'var(--tx3)' }}>{l}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: ok ? 'var(--gr)' : 'var(--tx)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AttrBadge ticker={ticker} prices={prices} />
                  <Btn size="sm" color="accent">+ Comprar</Btn>
                </div>
                {w.notes && <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--tx3)', paddingTop: 10, borderTop: '1px solid var(--bd)' }}>{w.notes}</p>}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── PROVENTOS ─────────────────────────────────────────────
export function Proventos() {
  const { user, dividends, divBalances, portfolio, loading, refreshPortfolio } = useApp()
  const [tab, setTab] = useState('list')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [form, setForm] = useState({ amount_per_share: '', payment_date: new Date().toISOString().slice(0, 10), quantity_held: '' })
  const [saving, setSaving] = useState(false)

  const total = dividends.reduce((s, d) => s + d.total_amount, 0)
  const saldo = divBalances.reduce((s, d) => s + (d.available_balance || 0), 0)
  const year = new Date().getFullYear()
  const totalYear = dividends.filter(d => new Date(d.payment_date).getFullYear() === year).reduce((s, d) => s + d.total_amount, 0)

  const handleSave = async () => {
    if (!selectedAsset || !form.amount_per_share || !form.quantity_held) return
    setSaving(true)
    try {
      const qty = parseFloat(form.quantity_held)
      const aps = parseFloat(form.amount_per_share)
      await insertDividend({
        user_id: user.id, asset_id: selectedAsset.id,
        amount_per_share: aps, quantity_held: qty,
        total_amount: aps * qty, payment_date: form.payment_date, source: 'manual',
      })
      await refreshPortfolio()
      setTab('list')
      setSelectedAsset(null)
      setForm({ amount_per_share: '', payment_date: new Date().toISOString().slice(0, 10), quantity_held: '' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <KPI label={`Total ${year}`} value={fmt.brl(totalYear)} sub="Proventos recebidos" color="var(--gr)" />
        <KPI label="Saldo Disponível" value={fmt.brl(saldo)} sub="Para reinvestir" color="var(--am)" />
        <KPI label="Média Mensal" value={fmt.brl(totalYear / (new Date().getMonth() + 1))} sub={`Jan–${new Date().toLocaleString('pt-BR', { month: 'short' })} ${year}`} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {[['list', 'Histórico'], ['add', '+ Lançar Provento'], ['balances', 'Saldos por Ativo']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--ac)' : 'var(--bg3)', color: tab === t ? 'white' : 'var(--tx2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
        ))}
      </div>

      {tab === 'list' && (
        <Card>
          {dividends.length === 0 ? <Empty icon="◇" message="Nenhum provento lançado ainda." /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['Ativo', 'Total', 'Por Cota', 'Cotas', 'Data', 'Saldo Disp.'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--tx3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--bd)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {dividends.map((d, i) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--bd)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 800 }}>{d.assets?.ticker}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 800, color: 'var(--gr)' }}>{fmt.brl(d.total_amount)}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--tx2)' }}>{fmt.brl(d.amount_per_share)}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--tx2)' }}>{fmt.num(d.quantity_held, 0)}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--tx2)' }}>{fmt.date(d.payment_date)}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ color: (d.available_balance || 0) > 0 ? 'var(--am)' : 'var(--tx3)', fontWeight: 700 }}>
                        {fmt.brl(d.available_balance || 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'add' && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Lançar Provento Recebido</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Ativo</label>
              <AssetSearch onSelect={setSelectedAsset} placeholder="Buscar ativo..." />
              {selectedAsset && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ac)' }}>✓ {selectedAsset.ticker}</div>}
            </div>
            <Input label="Valor por cota (R$)" type="number" value={form.amount_per_share} onChange={e => setForm(f => ({ ...f, amount_per_share: e.target.value }))} placeholder="0,00" />
            <Input label="Cotas na data" type="number" value={form.quantity_held} onChange={e => setForm(f => ({ ...f, quantity_held: e.target.value }))} placeholder="0" />
            <Input label="Data de pagamento" type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
            {form.amount_per_share && form.quantity_held && (
              <div style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: 9, fontSize: 13 }}>
                Total: <strong style={{ color: 'var(--gr)' }}>{fmt.brl(parseFloat(form.amount_per_share || 0) * parseFloat(form.quantity_held || 0))}</strong>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={handleSave} color="green" disabled={saving || !selectedAsset}>
              {saving ? 'Salvando...' : 'Salvar Provento'}
            </Btn>
            <Btn onClick={() => setTab('list')} color="ghost">Cancelar</Btn>
          </div>
        </Card>
      )}

      {tab === 'balances' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {divBalances.filter(d => d.available_balance > 0).map(d => (
            <Card key={d.asset_id}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{d.ticker}</div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Total recebido</div>
              <div style={{ fontSize: 14, color: 'var(--tx2)', marginBottom: 8 }}>{fmt.brl(d.total_received)}</div>
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>Saldo disponível</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--am)' }}>{fmt.brl(d.available_balance)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CENÁRIO ECONÔMICO ─────────────────────────────────────
export function Cenario() {
  const { macro } = useApp()
  const [news, setNews] = useState([])
  const [loadingNews, setLoadingNews] = useState(true)

  useState(() => {
    fetchNews().then(n => { setNews(n || []); setLoadingNews(false) })
  })

  const selicReal = macro?.selic && macro?.ipca12 ? macro.selic - macro.ipca12 : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Macro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {macro?.selic && <KPI label="Selic" value={`${fmt.num(macro.selic, 2)}%`} sub="a.a. — Banco Central" color="var(--ac)" />}
        {macro?.ipca12 && <KPI label="IPCA 12m" value={`${fmt.num(macro.ipca12, 2)}%`} sub="Acumulado" color="var(--am)" />}
        {selicReal && <KPI label="Selic Real" value={`${fmt.num(selicReal, 2)}%`} sub="Selic − IPCA" color={selicReal > 4 ? 'var(--gr)' : 'var(--am)'} />}
        {macro?.dolar && <KPI label="Dólar" value={fmt.brl(macro.dolar)} sub="USD/BRL" />}
      </div>

      {/* Indicator */}
      {macro?.selic && macro?.ipca12 && (
        <Card style={{ background: selicReal > 5 ? 'rgba(34,197,94,.05)' : 'rgba(245,158,11,.05)', border: `1px solid ${selicReal > 5 ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.3)'}` }}>
          <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6 }}>
            {selicReal > 5
              ? `📈 Renda fixa atraente — Selic real de ${fmt.num(selicReal, 2)}% está acima de 5%. Momento favorável para posições em RF.`
              : `⚠ Selic real de ${fmt.num(selicReal, 2)}% — avalie se a rentabilidade real compensa frente à inflação.`}
          </div>
        </Card>
      )}

      {/* News */}
      <Card>
        <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 14 }}>Últimas Notícias</div>
        {loadingNews ? <Spinner /> : news.length === 0 ? (
          <div style={{ color: 'var(--tx3)', fontSize: 13 }}>Nenhuma notícia carregada. Verifique conexão.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {news.map((n, i) => (
              <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{
                display: 'block', padding: '12px 0', borderBottom: i < news.length - 1 ? '1px solid var(--bd)' : 'none',
                textDecoration: 'none', color: 'var(--tx)',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{n.source} · {new Date(n.date).toLocaleDateString('pt-BR')}</div>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── GUIA / WIKI ───────────────────────────────────────────
const GUIDE = [
  {
    title: 'PM — Preço Médio',
    content: 'O Preço Médio (PM) é calculado pela média ponderada de todas as compras de um ativo, sem descontar proventos. Ex: comprou 10 ações a R$10 e depois mais 10 a R$12 → PM = R$11.',
  },
  {
    title: 'PMP — Preço Médio do Bolso',
    content: 'O PMP (Preço Médio do Bolso) desconta do custo real os proventos que você utilizou para comprar mais ações. É o quanto você de fato tirou do seu dinheiro para montar a posição. Ex: comprou 1 ação a R$10, mas usou R$2 de dividendos → PMP = R$8.',
  },
  {
    title: 'Número Mágico',
    content: 'Indica quantas cotas você precisa ter para que 1 pagamento de dividendo seja suficiente para comprar mais 1 cota. Fórmula: Preço da ação ÷ Dividendo por cota. Ex: MXRF11 a R$9,87 pagando R$0,08/cota → Número Mágico = 124 cotas.',
  },
  {
    title: 'Saldo de Proventos',
    content: 'Pool acumulado de proventos recebidos que ainda não foram utilizados em compras. Cada vez que você registra uma compra e informa que usou proventos, esse saldo diminui. Pode vir de qualquer ativo da carteira.',
  },
  {
    title: 'C20A — Carteira dos 20 Ativos',
    content: 'Estratégia pessoal de aposentadoria com no máximo 20 ativos escolhidos, cada um com meta de gerar R$500 a R$1.000/mês em proventos. O sistema calcula quantas cotas você precisa ter de cada ativo para atingir essa meta, com base no histórico de dividendos do ano corrente.',
  },
  {
    title: 'Balanceamento por Idade',
    content: 'Regra sugerida: sua % em Renda Fixa deve ser próxima à sua idade. O restante é dividido entre FIIs e Renda Variável. Ex: 35 anos → 35% RF, ~32% FII, ~33% RV. Você pode personalizar esses percentuais nas configurações.',
  },
  {
    title: 'Badge de Atratividade',
    content: 'Indicador automático baseado em 4 critérios: P/L abaixo de 12x, P/VP abaixo de 1,2x, Dividend Yield acima de 6%, e preço abaixo da Média Móvel de 200 dias. 2 critérios = "Atenção" (amarelo). 3 ou mais = "Atraente" (verde). Passe o mouse sobre o badge para ver os critérios atendidos.',
  },
  {
    title: 'P/L — Preço sobre Lucro',
    content: 'Indica quantos anos de lucro seriam necessários para recuperar o investimento. P/L abaixo de 12x é considerado atraente. Não se aplica a FIIs e criptomoedas.',
  },
  {
    title: 'P/VP — Preço sobre Valor Patrimonial',
    content: 'Compara o preço de mercado com o valor patrimonial por cota. P/VP abaixo de 1 significa que você está pagando menos que o patrimônio real — considerado atraente. Muito relevante para FIIs.',
  },
  {
    title: 'DY — Dividend Yield',
    content: 'Percentual de proventos pagos nos últimos 12 meses em relação ao preço atual. DY acima de 6% é considerado interessante no InvestHub. Fórmula: (Proventos 12m ÷ Preço atual) × 100.',
  },
  {
    title: 'MM200 — Média Móvel de 200 dias',
    content: 'Indicador técnico que representa o preço médio das últimas 200 pregões. Preço abaixo da MM200 pode indicar que o ativo está descontado historicamente — um dos critérios do badge de atratividade.',
  },
  {
    title: 'Watchlist',
    content: 'Lista de ativos que você quer acompanhar sem necessariamente ter na carteira. Ideal para monitorar pontos de entrada. Você pode converter um ativo da watchlist em compra direto pela interface.',
  },
]

export function Guia() {
  const [open, setOpen] = useState(null)
  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ color: 'var(--tx2)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
        Referência rápida de todos os conceitos e métricas usados no InvestHub.
      </p>
      {GUIDE.map((g, i) => (
        <div key={i} style={{ borderBottom: '1px solid var(--bd)' }}>
          <button onClick={() => setOpen(open === i ? null : i)} style={{
            width: '100%', padding: '14px 0', background: 'none', border: 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            color: 'var(--tx)', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {g.title}
            <span style={{ color: 'var(--tx3)', fontSize: 18, fontWeight: 400 }}>{open === i ? '−' : '+'}</span>
          </button>
          {open === i && (
            <p style={{ paddingBottom: 16, color: 'var(--tx2)', fontSize: 13, lineHeight: 1.7 }}>{g.content}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── SETTINGS ──────────────────────────────────────────────
export function Settings() {
  const { user, profile, setProfile, refreshPortfolio } = useApp()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await updateProfile(user.id, {
        theme: profile.theme, font_size: profile.font_size,
        age: profile.age, target_rf_pct: profile.target_rf_pct,
        target_fii_pct: profile.target_fii_pct, target_rv_pct: profile.target_rv_pct,
        dashboard_layout: profile.dashboard_layout,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const upd = (k, v) => setProfile(p => ({ ...p, [k]: v }))

  return (
    <div style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 18 }}>Aparência</h3>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Tema</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {['dark', 'light'].map(t => (
              <button key={t} onClick={() => upd('theme', t)} style={{
                flex: 1, padding: 12, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                border: `2px solid ${profile?.theme === t ? 'var(--ac)' : 'var(--bd)'}`,
                background: t === 'dark' ? '#0a0e1a' : '#f0f4f8',
                color: t === 'dark' ? '#e2e8f0' : '#0f172a', fontWeight: 700, fontSize: 14,
              }}>{t === 'dark' ? '🌙 Escuro' : '☀️ Claro'}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Tamanho da Fonte</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['sm', 13, 'A'], ['md', 15, 'A'], ['lg', 18, 'A']].map(([k, s, l]) => (
              <button key={k} onClick={() => upd('font_size', k)} style={{
                flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                border: `2px solid ${profile?.font_size === k ? 'var(--ac)' : 'var(--bd)'}`,
                background: 'var(--bg3)', color: 'var(--tx)', fontWeight: profile?.font_size === k ? 800 : 400, fontSize: s,
              }}>{l}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 18 }}>Perfil de Investidor</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Sua Idade" type="number" value={profile?.age || ''} onChange={e => upd('age', parseInt(e.target.value))} placeholder="Ex: 35" />
          <p style={{ fontSize: 11, color: 'var(--tx3)', marginTop: -8 }}>Usada para calcular o balanceamento ideal por idade</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Input label="Meta RF %" type="number" value={profile?.target_rf_pct || ''} onChange={e => upd('target_rf_pct', parseFloat(e.target.value))} />
            <Input label="Meta FII %" type="number" value={profile?.target_fii_pct || ''} onChange={e => upd('target_fii_pct', parseFloat(e.target.value))} />
            <Input label="Meta RV %" type="number" value={profile?.target_rv_pct || ''} onChange={e => upd('target_rv_pct', parseFloat(e.target.value))} />
          </div>
        </div>
        <Btn onClick={handleSave} color="accent" style={{ marginTop: 16 }} disabled={saving}>
          {saving ? 'Salvando...' : saved ? '✓ Salvo!' : 'Salvar Configurações'}
        </Btn>
      </Card>
    </div>
  )
}
