// ── PORTFOLIO ─────────────────────────────────────────────
import { useState, useEffect } from 'react'
import React from 'react'
import { useApp, fmt, CLASS_LABEL, CLASS_COLOR, getMagicNumber } from '../lib/context'
import { Card, Btn, Badge, AttrBadge, AssetSearch, Spinner, Empty, Input, KPI } from '../components/ui'
import { insertDividend, deleteDividend, updateDividend, addToWatchlist, updateProfile, addToC20A, removeFromC20A } from '../lib/supabase'

export function Portfolio() {
  const { portfolio, prices, divBalances, loading, refreshPortfolio } = useApp()
  const [filter, setFilter] = useState('all')
  const [expandedTicker, setExpandedTicker] = useState(null)

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
                const isExpanded = expandedTicker === a.ticker
                return (
                  <React.Fragment key={a.asset_id}>
                  <tr
                    onClick={() => setExpandedTicker(isExpanded ? null : a.ticker)}
                    style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--bd)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)', cursor: 'pointer' }}>
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
                  {isExpanded && (
                    <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                      <td colSpan={12} style={{ padding: '0 0 14px 0', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                        <div style={{ margin: '0 11px', padding: '14px', background: 'var(--bg3)', borderRadius: 10, border: '1px solid var(--bd)' }}>
                          <div style={{ fontSize: 10, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                            Detalhes — {a.ticker}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                            {[
                              ['Patrimônio', fmt.brl(price * a.quantity)],
                              ['Custo total', fmt.brl(a.avg_price * a.quantity)],
                              ['PM', fmt.brl(a.avg_price)],
                              ['PMP (bolso)', fmt.brl(a.avg_price_net)],
                              ['Cotação', fmt.brl(price)],
                              ['Resultado', fmt.brl(res)],
                              ['Retorno %', fmt.pct(resPct)],
                              p?.dy != null && ['DY 12m', `${Number(p.dy).toFixed(1)}%`],
                              p?.pl != null && ['P/L', `${Number(p.pl).toFixed(1)}x`],
                              p?.pvp != null && ['P/VP', `${Number(p.pvp).toFixed(2)}x`],
                              p?.high52 != null && ['Máx 52s', fmt.brl(p.high52)],
                              p?.low52 != null && ['Mín 52s', fmt.brl(p.low52)],
                            ].filter(Boolean).map(([label, value]) => (
                              <div key={label} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px' }}>
                                <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 3 }}>{label}</div>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{value}</div>
                              </div>
                            ))}
                          </div>
                          {p?.source && (
                            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--tx3)' }}>
                              Fonte: {p.source} · {a.asset_class === 'fii' ? 'Fundo Imobiliário' : CLASS_LABEL[a.asset_class]}
                              {a.sector && ` · ${a.sector}`}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
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
  const { user, portfolio, prices, refreshPortfolio } = useApp()
  const c20a = portfolio.filter(a => a.c20a_included)
  const available = portfolio.filter(a => !a.c20a_included)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(null)

  const handleAdd = async (asset) => {
    setSaving(asset.asset_id)
    try {
      await addToC20A(user.id, asset.asset_id)
      await refreshPortfolio()
    } finally { setSaving(null); setShowAdd(false) }
  }

  const handleRemove = async (asset) => {
    setSaving(asset.asset_id)
    try {
      await removeFromC20A(user.id, asset.asset_id)
      await refreshPortfolio()
    } finally { setSaving(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,rgba(59,130,246,.08),rgba(99,102,241,.08))', border: '1px solid rgba(99,102,241,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Carteira C20A ⭐</h2>
            <p style={{ fontSize: 13, color: 'var(--tx2)', margin: '4px 0 0' }}>Meta: R$500–R$1.000/mês por ativo na aposentadoria</p>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--ac)' }}>
            {c20a.length}<span style={{ fontSize: 16, color: 'var(--tx3)' }}>/20</span>
          </div>
        </div>
      </Card>

      {/* Botão adicionar */}
      {available.length > 0 && c20a.length < 20 && (
        <div>
          <Btn onClick={() => setShowAdd(s => !s)} color={showAdd ? 'ghost' : 'accent'}>
            {showAdd ? 'Cancelar' : '+ Adicionar ativo à C20A'}
          </Btn>
          {showAdd && (
            <Card style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 10, fontWeight: 700 }}>
                ATIVOS DA CARTEIRA DISPONÍVEIS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {available.map(a => (
                  <div key={a.asset_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 9 }}>
                    <div>
                      <span style={{ fontWeight: 800 }}>{a.ticker}</span>
                      <span style={{ fontSize: 11, color: 'var(--tx3)', marginLeft: 8 }}>{a.name}</span>
                    </div>
                    <Btn size="sm" color="accent" onClick={() => handleAdd(a)} disabled={saving === a.asset_id}>
                      {saving === a.asset_id ? '...' : '+ Adicionar'}
                    </Btn>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Grid C20A */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {c20a.map(a => {
          const p = prices[a.ticker]
          const price = p?.price || a.avg_price
          const monthly = (a.estimated_monthly_dividend_per_share || 0) * a.quantity
          const targetMin = a.c20a_target_min || 500
          const targetMax = a.c20a_target_max || 1000
          const mid = (targetMin + targetMax) / 2
          const tq = a.estimated_monthly_dividend_per_share > 0
            ? Math.ceil(mid / a.estimated_monthly_dividend_per_share)
            : null
          const prog = tq ? Math.min((a.quantity / tq) * 100, 100) : 0
          const ok = monthly >= targetMin
          const magic = getMagicNumber(price, a.estimated_monthly_dividend_per_share)
          return (
            <Card key={a.asset_id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{a.ticker}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{a.name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {ok && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'rgba(34,197,94,.15)', color: 'var(--gr)' }}>✓ Meta</span>}
                  <button onClick={() => handleRemove(a)} disabled={saving === a.asset_id} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }} title="Remover da C20A">✕</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  ['Tenho', fmt.num(a.quantity, 0) + ' cotas'],
                  ['Meta', tq ? fmt.num(tq, 0) + ' cotas' : '—'],
                  ['Renda/mês', fmt.brl(monthly)],
                  ['Alvo', `${fmt.brl(targetMin)}–${fmt.brl(targetMax)}`],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '7px 10px' }}>
                    <div style={{ fontSize: 9, color: 'var(--tx3)' }}>{l}</div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: l === 'Renda/mês' && ok ? 'var(--gr)' : 'var(--tx)' }}>{v}</div>
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

        {/* Slots vazios */}
        {Array.from({ length: Math.max(0, 20 - c20a.length) }).map((_, i) => (
          <div key={i} onClick={() => setShowAdd(true)} style={{
            border: '2px dashed var(--bd)', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 140, color: 'var(--tx3)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'border-color .15s',
          }}>
            + Vaga disponível
          </div>
        ))}
      </div>
    </div>
  )
}

// ── WATCHLIST ─────────────────────────────────────────────
// Modal de detalhes do ativo
function AssetModal({ ticker, asset, prices, onClose, onNavigate }) {
  const p = prices[ticker]
  const indicators = [
    p?.pl != null    && { label: 'P/L',       value: `${Number(p.pl).toFixed(1)}x`,   ok: p.pl < 12,   bad: p.pl > 20 },
    p?.pvp != null   && { label: 'P/VP',      value: `${Number(p.pvp).toFixed(2)}x`,  ok: p.pvp < 1,   bad: p.pvp > 2 },
    p?.dy != null    && { label: 'DY 12m',    value: `${Number(p.dy).toFixed(1)}%`,   ok: p.dy > 6,    bad: p.dy < 3 },
    p?.high52 != null && { label: 'Máx 52s',  value: fmt.brl(p.high52), ok: false, bad: false },
    p?.low52 != null  && { label: 'Mín 52s',  value: fmt.brl(p.low52),  ok: false, bad: false },
    p?.change_pct != null && { label: 'Var. hoje', value: fmt.pct(p.change_pct), ok: p.change_pct > 0, bad: p.change_pct < 0 },
  ].filter(Boolean)

  // Score de atratividade
  const score = [p?.pl < 12, p?.pvp < 1.2, p?.dy > 6].filter(Boolean).length
  const scoreColor = score >= 3 ? 'var(--gr)' : score >= 2 ? 'var(--am)' : 'var(--tx3)'
  const scoreLabel = score >= 3 ? 'Muito Atraente' : score >= 2 ? 'Atenção' : 'Neutro'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontWeight: 900, fontSize: 22 }}>{ticker}</span>
              <Badge color={asset?.asset_class === 'fii' ? 'fii' : 'green'}>{CLASS_LABEL[asset?.asset_class] || '—'}</Badge>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{asset?.name}</div>
            {asset?.sector && <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{asset.sector}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 20, padding: 4 }}>✕</button>
        </div>

        {/* Preço */}
        {p && (
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 32, fontWeight: 900 }}>{fmt.brl(p.price)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: p.change_pct >= 0 ? 'var(--gr)' : 'var(--rd)' }}>
              {fmt.pct(p.change_pct)} hoje
            </span>
          </div>
        )}

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Score */}
          {indicators.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--tx2)' }}>Score de atratividade</span>
              <span style={{ fontWeight: 800, fontSize: 14, color: scoreColor }}>{score}/3 — {scoreLabel}</span>
            </div>
          )}

          {/* Indicadores */}
          {indicators.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Indicadores</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {indicators.map(({ label, value, ok, bad }) => (
                  <div key={label} style={{ background: 'var(--bg3)', borderRadius: 9, padding: '10px 12px', border: ok ? '1px solid rgba(34,197,94,.3)' : bad ? '1px solid rgba(239,68,68,.2)' : '1px solid var(--bd)' }}>
                    <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: ok ? 'var(--gr)' : bad ? 'var(--rd)' : 'var(--tx)' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regra de bolso */}
          {p?.pl != null && p?.pvp != null && (
            <div style={{ padding: '12px 14px', background: score >= 2 ? 'rgba(34,197,94,.05)' : 'rgba(245,158,11,.05)', borderRadius: 10, border: `1px solid ${score >= 2 ? 'rgba(34,197,94,.2)' : 'rgba(245,158,11,.2)'}` }}>
              <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.6 }}>
                {score >= 3 && '📈 Múltiplos atrativos em todas as dimensões — pode ser uma boa oportunidade de entrada.'}
                {score === 2 && '⚠ Atenção — alguns indicadores positivos, mas avalie o contexto setorial antes de comprar.'}
                {score < 2 && '⬤ Indicadores neutros ou elevados — monitore para pontos de entrada mais favoráveis.'}
              </div>
            </div>
          )}

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn color="accent" onClick={() => { onClose(); onNavigate && onNavigate('extrato') }}>
              + Registrar Compra
            </Btn>
            <Btn color="ghost" onClick={onClose}>Fechar</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Watchlist() {
  const { user, watchlist, prices, refreshPortfolio } = useApp()
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list' | 'card'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Busca + toggle */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <AssetSearch onSelect={async (a) => { await addToWatchlist(user.id, a.id); refreshPortfolio() }} placeholder="Adicionar ativo para acompanhar..." />
        </div>
        {/* Toggle card/lista */}
        <div style={{ display: 'flex', border: '1px solid var(--bd)', borderRadius: 9, overflow: 'hidden', flexShrink: 0 }}>
          {[['list', '☰'], ['card', '⊞']].map(([v, icon]) => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding: '8px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, background: viewMode === v ? 'var(--ac)' : 'var(--bg3)',
              color: viewMode === v ? 'white' : 'var(--tx3)',
            }}>{icon}</button>
          ))}
        </div>
      </div>

      {watchlist.length === 0 ? (
        <Empty icon="◎" message="Nenhum ativo na watchlist. Busque acima para adicionar." />
      ) : viewMode === 'card' ? (
        /* ── Vista Cards ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {watchlist.map(w => {
            const ticker = w.assets?.ticker
            const p = prices[ticker]
            const score = [p?.pl < 12, p?.pvp < 1.2, p?.dy > 6].filter(Boolean).length
            return (
              <Card key={w.id} onClick={() => setSelectedAsset(w)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{ticker}</div>
                    <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{w.assets?.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{p ? fmt.brl(p.price) : '—'}</div>
                    {p?.change_pct != null && (
                      <div style={{ fontSize: 11, color: p.change_pct >= 0 ? 'var(--gr)' : 'var(--rd)' }}>{fmt.pct(p.change_pct)}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <AttrBadge ticker={ticker} prices={prices} />
                  {score > 0 && <span style={{ fontSize: 10, color: 'var(--tx3)' }}>Score {score}/3 →</span>}
                  {!p && <span style={{ fontSize: 10, color: 'var(--tx3)' }}>ver detalhes →</span>}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        /* ── Vista Lista (tabela) ── */
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  {['Ativo', 'Cotação', 'Var. Hoje', 'DY', 'P/L', 'P/VP', 'Score', ''].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--tx3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bd)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {watchlist.map((w, i) => {
                  const ticker = w.assets?.ticker
                  const p = prices[ticker]
                  const score = [p?.pl < 12, p?.pvp < 1.2, p?.dy > 6].filter(Boolean).length
                  const scoreColor = score >= 3 ? 'var(--gr)' : score >= 2 ? 'var(--am)' : 'var(--tx3)'
                  return (
                    <tr key={w.id}
                      onClick={() => setSelectedAsset(w)}
                      style={{ borderBottom: '1px solid var(--bd)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)', cursor: 'pointer' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 800 }}>{ticker}</div>
                        <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{w.assets?.name}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800 }}>
                        {p ? fmt.brl(p.price) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: p?.change_pct >= 0 ? 'var(--gr)' : p?.change_pct < 0 ? 'var(--rd)' : 'var(--tx3)' }}>
                        {p?.change_pct != null ? fmt.pct(p.change_pct) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: p?.dy > 6 ? 'var(--gr)' : 'var(--tx2)' }}>
                        {p?.dy != null ? `${Number(p.dy).toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: p?.pl < 12 ? 'var(--gr)' : 'var(--tx2)' }}>
                        {p?.pl != null ? `${Number(p.pl).toFixed(1)}x` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: p?.pvp < 1.2 ? 'var(--gr)' : 'var(--tx2)' }}>
                        {p?.pvp != null ? `${Number(p.pvp).toFixed(2)}x` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: scoreColor }}>{score}/3</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <AttrBadge ticker={ticker} prices={prices} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--tx3)', borderTop: '1px solid var(--bd)' }}>
            {watchlist.length} ativo{watchlist.length !== 1 ? 's' : ''} · Clique para ver detalhes
          </div>
        </Card>
      )}

      {selectedAsset && (
        <AssetModal
          ticker={selectedAsset.assets?.ticker}
          asset={selectedAsset.assets}
          prices={prices}
          onClose={() => setSelectedAsset(null)}
        />
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
  const [editingId, setEditingId] = useState(null)
  const [filterTicker, setFilterTicker] = useState('')
  const [menuId, setMenuId] = useState(null)

  const year = new Date().getFullYear()
  const totalYear = dividends.filter(d => new Date(d.payment_date).getFullYear() === year).reduce((s, d) => s + d.total_amount, 0)
  const saldo = divBalances.reduce((s, d) => s + (d.available_balance || 0), 0)
  const avgMonthly = totalYear / (new Date().getMonth() + 1)

  // Agrupado por mês para gráfico
  const byMonth = {}
  dividends.filter(d => new Date(d.payment_date).getFullYear() === year).forEach(d => {
    const m = new Date(d.payment_date).getMonth()
    byMonth[m] = (byMonth[m] || 0) + d.total_amount
  })
  const maxMonth = Math.max(...Object.values(byMonth), 1)
  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  // Agrupado por ativo
  const byAsset = {}
  dividends.forEach(d => {
    const t = d.assets?.ticker || '?'
    if (!byAsset[t]) byAsset[t] = { ticker: t, name: d.assets?.name, total: 0, count: 0, last: d.payment_date }
    byAsset[t].total += d.total_amount
    byAsset[t].count += 1
    if (d.payment_date > byAsset[t].last) byAsset[t].last = d.payment_date
  })

  const filtered = filterTicker
    ? dividends.filter(d => d.assets?.ticker?.includes(filterTicker.toUpperCase()))
    : dividends

  const handleSave = async () => {
    if (!selectedAsset || !form.amount_per_share || !form.quantity_held) return
    setSaving(true)
    try {
      const qty = parseFloat(form.quantity_held)
      const aps = parseFloat(form.amount_per_share)
      const payload = { user_id: user.id, asset_id: selectedAsset.id, amount_per_share: aps, quantity_held: qty, total_amount: aps * qty, payment_date: form.payment_date, source: 'manual' }
      if (editingId) { await updateDividend(editingId, { amount_per_share: aps, quantity_held: qty, total_amount: aps * qty, payment_date: form.payment_date }) }
      else { await insertDividend(payload) }
      await refreshPortfolio()
      setTab('list'); setSelectedAsset(null); setEditingId(null)
      setForm({ amount_per_share: '', payment_date: new Date().toISOString().slice(0, 10), quantity_held: '' })
    } finally { setSaving(false) }
  }

  const handleEdit = (d) => {
    setEditingId(d.id)
    setSelectedAsset(d.assets)
    setForm({ amount_per_share: String(d.amount_per_share), payment_date: d.payment_date, quantity_held: String(d.quantity_held) })
    setTab('add'); setMenuId(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir este provento?')) return
    await deleteDividend(id); await refreshPortfolio(); setMenuId(null)
  }

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onClick={() => setMenuId(null)}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        <KPI label={`Total ${year}`} value={fmt.brl(totalYear)} sub="Proventos recebidos" color="var(--gr)" />
        <KPI label="Média Mensal" value={fmt.brl(avgMonthly)} sub={`Jan–${MONTHS[new Date().getMonth()]} ${year}`} />
        <KPI label="Saldo Disponível" value={fmt.brl(saldo)} sub="Para reinvestir" color="var(--am)" />
        <KPI label="Total Histórico" value={fmt.brl(dividends.reduce((s,d) => s+d.total_amount,0))} sub={`${dividends.length} lançamentos`} />
      </div>

      {/* Gráfico mensal */}
      {Object.keys(byMonth).length > 0 && (
        <Card>
          <div style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Proventos por Mês — {year}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {MONTHS.map((m, i) => {
              const val = byMonth[i] || 0
              const h = val ? Math.max((val / maxMonth) * 72, 4) : 0
              const isCurrentMonth = i === new Date().getMonth()
              return (
                <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  {val > 0 && <div style={{ fontSize: 8, color: 'var(--gr)', fontWeight: 700 }}>{fmt.brl(val).replace('R$ ','')}</div>}
                  <div style={{ width: '100%', height: h, borderRadius: '3px 3px 0 0', background: isCurrentMonth ? 'var(--ac)' : 'var(--gr)', opacity: val ? 1 : 0.1, minHeight: 3 }} />
                  <div style={{ fontSize: 8, color: isCurrentMonth ? 'var(--ac)' : 'var(--tx3)', fontWeight: isCurrentMonth ? 700 : 400 }}>{m}</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['list','Histórico'],['byAsset','Por Ativo'],['add', editingId ? '✎ Editar' : '+ Lançar']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--ac)' : 'var(--bg3)', color: tab === t ? 'white' : 'var(--tx2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
        ))}
        {editingId && <button onClick={() => { setEditingId(null); setSelectedAsset(null); setForm({ amount_per_share: '', payment_date: new Date().toISOString().slice(0, 10), quantity_held: '' }); setTab('list') }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--tx3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕ Cancelar edição</button>}
      </div>

      {/* Histórico */}
      {tab === 'list' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bd)' }}>
            <input value={filterTicker} onChange={e => setFilterTicker(e.target.value)} placeholder="Filtrar por ativo..." style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          {filtered.length === 0 ? <div style={{ padding: 24 }}><Empty icon="◇" message="Nenhum provento lançado ainda." /></div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: 'var(--bg3)' }}>{['Ativo','Data','Valor Total','Por Cota','Cotas','Saldo',''].map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--tx3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.sort((a,b) => b.payment_date.localeCompare(a.payment_date)).map((d, i) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--bd)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 800 }}>{d.assets?.ticker}<div style={{ fontSize: 10, color: 'var(--tx3)', fontWeight: 400 }}>{d.assets?.name}</div></td>
                      <td style={{ padding: '9px 12px', color: 'var(--tx2)', whiteSpace: 'nowrap' }}>{fmt.date(d.payment_date)}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: 'var(--gr)' }}>{fmt.brl(d.total_amount)}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--tx2)' }}>{fmt.brl(d.amount_per_share)}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--tx2)' }}>{fmt.num(d.quantity_held, 0)}</td>
                      <td style={{ padding: '9px 12px' }}><span style={{ color: (d.available_balance||0) > 0 ? 'var(--am)' : 'var(--tx3)', fontWeight: 700 }}>{fmt.brl(d.available_balance||0)}</span></td>
                      <td style={{ padding: '9px 12px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setMenuId(menuId === d.id ? null : d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', fontSize: 16, padding: '2px 6px' }}>···</button>
                        {menuId === d.id && (
                          <div style={{ position: 'fixed', right: 16, background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 10, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,.3)', minWidth: 120, overflow: 'hidden' }}>
                            <button onClick={() => handleEdit(d)} style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--tx)', cursor: 'pointer', fontSize: 13 }}>✎ Editar</button>
                            <button onClick={() => handleDelete(d.id)} style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--rd)', cursor: 'pointer', fontSize: 13 }}>✕ Excluir</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--tx3)', borderTop: '1px solid var(--bd)' }}>{filtered.length} lançamento{filtered.length !== 1 ? 's' : ''}</div>
        </Card>
      )}

      {/* Por Ativo */}
      {tab === 'byAsset' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: 'var(--bg3)' }}>{['Ativo','Total Recebido','Lançamentos','Último Pagamento','Média/Pagto'].map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--tx3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
              <tbody>
                {Object.values(byAsset).sort((a,b) => b.total - a.total).map((a, i) => (
                  <tr key={a.ticker} style={{ borderBottom: '1px solid var(--bd)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 800 }}>{a.ticker}<div style={{ fontSize: 10, color: 'var(--tx3)', fontWeight: 400 }}>{a.name}</div></td>
                    <td style={{ padding: '9px 12px', fontWeight: 800, color: 'var(--gr)' }}>{fmt.brl(a.total)}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--tx2)' }}>{a.count}×</td>
                    <td style={{ padding: '9px 12px', color: 'var(--tx2)' }}>{fmt.date(a.last)}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--tx2)' }}>{fmt.brl(a.total / a.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Formulário */}
      {tab === 'add' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>{editingId ? 'Editar Provento' : 'Lançar Provento'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!editingId && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>Ativo</div>
                <AssetSearch onSelect={a => setSelectedAsset(a)} placeholder="Buscar ativo..." />
                {selectedAsset && <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--bg3)', borderRadius: 8, fontSize: 12, color: 'var(--ac)', fontWeight: 700 }}>✓ {selectedAsset.ticker} — {selectedAsset.name}</div>}
              </div>
            )}
            {editingId && selectedAsset && (
              <div style={{ padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--ac)' }}>{selectedAsset.ticker} — {selectedAsset.name}</div>
            )}
            {[['Data de Pagamento','payment_date','date'],['Valor por Cota (R$)','amount_per_share','number'],['Cotas Detidas','quantity_held','number']].map(([label, key, type]) => (
              <div key={key}>
                <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>{label}</div>
                <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            ))}
            {form.amount_per_share && form.quantity_held && (
              <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,.1)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--gr)' }}>
                Total: {fmt.brl(parseFloat(form.amount_per_share) * parseFloat(form.quantity_held))}
              </div>
            )}
            <Btn color="green" onClick={handleSave} disabled={saving || !selectedAsset || !form.amount_per_share || !form.quantity_held}>
              {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Lançar Provento'}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  )
}

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
        nav_auto_hide: profile.nav_auto_hide ?? false,
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
        <div>
          <label style={{ fontSize: 11, color: 'var(--tx3)', display: 'block', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Menu Mobile</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[[false, '📌 Sempre visível'], [true, '↕ Recolhe ao rolar']].map(([v, l]) => (
              <button key={String(v)} onClick={() => upd('nav_auto_hide', v)} style={{
                flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                border: `2px solid ${(profile?.nav_auto_hide ?? false) === v ? 'var(--ac)' : 'var(--bd)'}`,
                background: 'var(--bg3)', color: 'var(--tx)',
                fontWeight: (profile?.nav_auto_hide ?? false) === v ? 800 : 400, fontSize: 12,
              }}>{l}</button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 8 }}>Só afeta dispositivos móveis</p>
        </div>
      </Card>

      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 18 }}>Perfil de Investidor</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Sua Idade" type="number" value={profile?.age || ''} onChange={e => upd('age', parseInt(e.target.value))} placeholder="Ex: 35" />
          <p style={{ fontSize: 11, color: 'var(--tx3)', marginTop: -8 }}>Usada para calcular o balanceamento ideal por idade</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
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
