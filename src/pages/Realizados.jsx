import { useState, useEffect } from 'react'
import { useApp, fmt, CLASS_LABEL } from '../lib/context'
import { Card, Badge, Spinner, Empty } from '../components/ui'
import { getRealizedPositions } from '../lib/supabase'

export default function Realizados() {
  const { user } = useApp()
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('date_desc')

  useEffect(() => {
    if (!user) return
    getRealizedPositions(user.id)
      .then(setPositions)
      .catch(() => setPositions([]))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <Spinner />

  const sorted = [...positions].sort((a, b) => {
    if (sortBy === 'date_desc') return new Date(b.last_sell_date) - new Date(a.last_sell_date)
    if (sortBy === 'pnl_desc') return b.realized_pnl - a.realized_pnl
    if (sortBy === 'pnl_asc')  return a.realized_pnl - b.realized_pnl
    if (sortBy === 'ticker')   return a.ticker.localeCompare(b.ticker)
    return 0
  })

  const totalPnl = positions.reduce((s, p) => s + p.realized_pnl, 0)
  const wins = positions.filter(p => p.realized_pnl > 0).length
  const losses = positions.filter(p => p.realized_pnl < 0).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Resumo */}
      {positions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <Card>
            <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 6 }}>Resultado Total</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: totalPnl >= 0 ? 'var(--gr)' : 'var(--rd)' }}>{fmt.brl(totalPnl)}</div>
            <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>{positions.length} ativo{positions.length !== 1 ? 's' : ''} realizado{positions.length !== 1 ? 's' : ''}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, marginBottom: 6 }}>Lucros / Prejuízos</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gr)' }}>{wins}</div>
                <div style={{ fontSize: 10, color: 'var(--tx3)' }}>lucros</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--bd)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--rd)' }}>{losses}</div>
                <div style={{ fontSize: 10, color: 'var(--tx3)' }}>prejuízos</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Ordenação */}
      {positions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 700 }}>Ordenar:</span>
          {[
            ['date_desc', 'Mais recente'],
            ['pnl_desc',  'Maior lucro'],
            ['pnl_asc',   'Maior perda'],
            ['ticker',    'Ativo A-Z'],
          ].map(([v, l]) => (
            <button key={v} onClick={() => setSortBy(v)} style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: sortBy === v ? 700 : 400,
              border: `1px solid ${sortBy === v ? 'var(--ac)' : 'var(--bd)'}`,
              background: sortBy === v ? 'rgba(59,130,246,.15)' : 'var(--bg3)',
              color: sortBy === v ? 'var(--ac)' : 'var(--tx3)',
            }}>{l}</button>
          ))}
        </div>
      )}

      {/* Lista */}
      {sorted.length === 0 ? (
        <Empty icon="◈" message="Nenhuma posição realizada ainda. Registre uma venda no Extrato para ela aparecer aqui." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(p => {
            const isProfit = p.realized_pnl >= 0
            const pnlPct = p.total_cost > 0 ? (p.realized_pnl / p.total_cost) * 100 : 0
            return (
              <Card key={p.asset_id} style={{ borderLeft: `4px solid ${isProfit ? 'var(--gr)' : 'var(--rd)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  {/* Info do ativo */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: 16 }}>{p.ticker}</span>
                      <Badge color={p.asset_class === 'fii' ? 'fii' : p.asset_class === 'crypto' ? 'crypto' : 'green'}>
                        {CLASS_LABEL[p.asset_class] || p.asset_class}
                      </Badge>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
                        borderRadius: 999, fontSize: 10, fontWeight: 700,
                        background: isProfit ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
                        color: isProfit ? 'var(--gr)' : 'var(--rd)',
                      }}>
                        {isProfit ? '✓ Realizado com lucro' : '✗ Realizado com prejuízo'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 10 }}>
                      {p.name}
                    </div>

                    {/* Métricas em grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                      {[
                        ['Qtd comprada', fmt.num(p.total_bought, 0)],
                        ['Qtd vendida', fmt.num(p.total_sold, 0)],
                        ['PM compra', fmt.brl(p.avg_buy_price)],
                        ['PM venda', fmt.brl(p.avg_sell_price)],
                        ['Custo total', fmt.brl(p.total_cost)],
                        ['Receita total', fmt.brl(p.total_revenue)],
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* P&L destacado */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>Resultado</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: isProfit ? 'var(--gr)' : 'var(--rd)' }}>
                      {fmt.brl(p.realized_pnl)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isProfit ? 'var(--gr)' : 'var(--rd)' }}>
                      {fmt.pct(pnlPct)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 6 }}>
                      {p.first_buy_date && fmt.date(p.first_buy_date)}
                      {p.first_buy_date && p.last_sell_date && ' → '}
                      {p.last_sell_date && fmt.date(p.last_sell_date)}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
