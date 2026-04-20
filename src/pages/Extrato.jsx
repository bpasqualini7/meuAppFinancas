import { useState, useEffect } from 'react'
import { useApp, fmt, CLASS_LABEL } from '../lib/context'
import { Card, Btn, Badge, AssetSearch, Input, Spinner, Empty } from '../components/ui'
import { insertOperation, ensureAsset, getOperations, supabase } from '../lib/supabase'

// ── Op Form (compra ou venda) ─────────────────────────────
function OpForm({ onSave, onCancel }) {
  const { user } = useApp()
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [form, setForm] = useState({
    op_type: 'buy', qty: '', price: '',
    date: new Date().toISOString().slice(0, 10),
    broker: 'manual', divUsed: '',
  })
  const [saving, setSaving] = useState(false)
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handle = async () => {
    if (!selectedAsset || !form.qty || !form.price) return
    setSaving(true)
    try {
      const assetId = await ensureAsset(selectedAsset)
      if (!assetId) { alert('Erro ao registrar ativo.'); setSaving(false); return }
      const totalValue = parseFloat(form.qty) * parseFloat(form.price)
      const divUsed = parseFloat(form.divUsed) || 0
      await insertOperation({
        user_id: user.id, asset_id: assetId,
        op_type: form.op_type,
        quantity: parseFloat(form.qty),
        unit_price: parseFloat(form.price),
        total_value: totalValue,
        dividends_used: form.op_type === 'buy' ? divUsed : 0,
        out_of_pocket: form.op_type === 'buy' ? totalValue - divUsed : 0,
        broker: form.broker, op_date: form.date, source: 'manual',
      })
      onSave()
    } finally { setSaving(false) }
  }

  const total = parseFloat(form.qty || 0) * parseFloat(form.price || 0)

  return (
    <Card style={{ marginBottom: 16 }}>
      {/* Tipo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['buy', '↑ Compra', 'var(--gr)'], ['sell', '↓ Venda', 'var(--rd)']].map(([t, l, c]) => (
          <button key={t} onClick={() => upd('op_type', t)} style={{
            flex: 1, padding: '8px 0', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
            fontWeight: 700, fontSize: 13,
            border: `2px solid ${form.op_type === t ? c : 'var(--bd)'}`,
            background: form.op_type === t ? `${c}22` : 'var(--bg3)',
            color: form.op_type === t ? c : 'var(--tx3)',
          }}>{l}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Ativo */}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Ativo</label>
          <AssetSearch onSelect={setSelectedAsset} placeholder="Buscar por ticker..." />
          {selectedAsset && (
            <div style={{ marginTop: 5, fontSize: 12, color: 'var(--ac)' }}>
              ✓ {selectedAsset.ticker} — {selectedAsset.name} · <span style={{ color: 'var(--tx3)' }}>{CLASS_LABEL[selectedAsset.asset_class]}</span>
            </div>
          )}
        </div>

        <Input label="Quantidade" type="number" value={form.qty} onChange={e => upd('qty', e.target.value)} placeholder="0" />
        <Input label="Preço unitário (R$)" type="number" value={form.price} onChange={e => upd('price', e.target.value)} placeholder="0,00" />
        <Input label="Data" type="date" value={form.date} onChange={e => upd('date', e.target.value)} />

        <div>
          <label style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Corretora</label>
          <select value={form.broker} onChange={e => upd('broker', e.target.value)}
            style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit' }}>
            {['manual','inter','itau','xp','btg','rico','clear','nuinvest','avenue','binance'].map(b => (
              <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
            ))}
          </select>
        </div>

        {form.op_type === 'buy' && (
          <Input label="Proventos usados (R$) — reduz PMP" type="number" value={form.divUsed} onChange={e => upd('divUsed', e.target.value)} placeholder="0,00" />
        )}
      </div>

      {total > 0 && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg3)', borderRadius: 9, fontSize: 12 }}>
          Total: <strong>{fmt.brl(total)}</strong>
          {form.op_type === 'buy' && form.divUsed && (
            <span style={{ marginLeft: 12, color: 'var(--gr)' }}>Do bolso: <strong>{fmt.brl(total - parseFloat(form.divUsed || 0))}</strong></span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Btn onClick={handle} color={form.op_type === 'buy' ? 'green' : 'danger'} disabled={saving || !selectedAsset || !form.qty || !form.price}>
          {saving ? 'Salvando...' : form.op_type === 'buy' ? 'Registrar Compra' : 'Registrar Venda'}
        </Btn>
        <Btn onClick={onCancel} color="ghost">Cancelar</Btn>
      </div>
    </Card>
  )
}

// ── Op Menu (3 pontinhos) ─────────────────────────────────
function OpMenu({ op, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer',
        fontSize: 16, padding: '2px 6px', borderRadius: 6,
      }}>⋯</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{ position: 'absolute', right: 0, top: '100%', background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 10, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,.3)', minWidth: 130, overflow: 'hidden' }}>
            <button onClick={() => { setOpen(false); onEdit(op) }} style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--tx)', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: 'inherit' }}>
              ✎ Editar
            </button>
            <button onClick={() => { setOpen(false); onDelete(op) }} style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: 'var(--rd)', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: 'inherit' }}>
              ✕ Excluir
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────
function EditModal({ op, onSave, onClose }) {
  const [form, setForm] = useState({
    qty: op.quantity, price: op.unit_price,
    date: op.op_date, broker: op.broker || 'manual',
    divUsed: op.dividends_used || '',
  })
  const [saving, setSaving] = useState(false)
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handle = async () => {
    setSaving(true)
    try {
      const totalValue = parseFloat(form.qty) * parseFloat(form.price)
      const divUsed = parseFloat(form.divUsed) || 0
      const { error } = await supabase.from('operations').update({
        quantity: parseFloat(form.qty),
        unit_price: parseFloat(form.price),
        total_value: totalValue,
        dividends_used: divUsed,
        out_of_pocket: totalValue - divUsed,
        broker: form.broker,
        op_date: form.date,
      }).eq('id', op.id)
      if (error) throw error
      onSave()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontWeight: 800, fontSize: 15 }}>Editar Operação</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Quantidade" type="number" value={form.qty} onChange={e => upd('qty', e.target.value)} />
          <Input label="Preço (R$)" type="number" value={form.price} onChange={e => upd('price', e.target.value)} />
          <Input label="Data" type="date" value={form.date} onChange={e => upd('date', e.target.value)} />
          <div>
            <label style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Corretora</label>
            <select value={form.broker} onChange={e => upd('broker', e.target.value)}
              style={{ width: '100%', padding: '9px 13px', borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit' }}>
              {['manual','inter','itau','xp','btg','rico','clear','nuinvest','avenue','binance'].map(b => (
                <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
              ))}
            </select>
          </div>
          {op.op_type === 'buy' && (
            <div style={{ gridColumn: '1/-1' }}>
              <Input label="Proventos usados (R$)" type="number" value={form.divUsed} onChange={e => upd('divUsed', e.target.value)} placeholder="0,00" />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <Btn onClick={handle} color="accent" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Btn>
          <Btn onClick={onClose} color="ghost">Cancelar</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Extrato Principal ─────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Data (mais recente)' },
  { value: 'date_asc',  label: 'Data (mais antiga)' },
  { value: 'ticker',    label: 'Ativo (A-Z)' },
  { value: 'type',      label: 'Tipo (compra/venda)' },
  { value: 'value_desc',label: 'Valor (maior)' },
  { value: 'value_asc', label: 'Valor (menor)' },
]

export default function Extrato({ onNavigate }) {
  const { user, refreshPortfolio } = useApp()
  const [ops, setOps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editOp, setEditOp] = useState(null)

  // Filtros
  const [filterType, setFilterType] = useState('all')    // all | buy | sell
  const [filterTicker, setFilterTicker] = useState('')
  const [filterBroker, setFilterBroker] = useState('all')
  const [filterClass, setFilterClass] = useState('all')
  const [sortBy, setSortBy] = useState('date_desc')

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getOperations(user.id)
      setOps(data || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [user])

  const handleSave = async () => {
    setShowForm(false); setEditOp(null)
    await load(); await refreshPortfolio()
  }

  const handleDelete = async (op) => {
    if (!confirm(`Excluir operação de ${op.op_type === 'buy' ? 'compra' : 'venda'} de ${op.assets?.ticker}?`)) return
    const { error } = await supabase.from('operations').delete().eq('id', op.id)
    if (!error) { await load(); await refreshPortfolio() }
  }

  // Derived
  const brokers = ['all', ...new Set(ops.map(o => o.broker).filter(Boolean))]
  const classes = ['all', ...new Set(ops.map(o => o.assets?.asset_class).filter(Boolean))]

  const filtered = ops
    .filter(o => filterType === 'all' || o.op_type === filterType)
    .filter(o => !filterTicker || o.assets?.ticker?.toUpperCase().includes(filterTicker.toUpperCase()))
    .filter(o => filterBroker === 'all' || o.broker === filterBroker)
    .filter(o => filterClass === 'all' || o.assets?.asset_class === filterClass)
    .sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.op_date) - new Date(a.op_date)
      if (sortBy === 'date_asc')  return new Date(a.op_date) - new Date(b.op_date)
      if (sortBy === 'ticker')    return (a.assets?.ticker || '').localeCompare(b.assets?.ticker || '')
      if (sortBy === 'type')      return a.op_type.localeCompare(b.op_type)
      if (sortBy === 'value_desc') return b.total_value - a.total_value
      if (sortBy === 'value_asc')  return a.total_value - b.total_value
      return 0
    })

  const totalCompras = filtered.filter(o => o.op_type === 'buy').reduce((s, o) => s + o.total_value, 0)
  const totalVendas  = filtered.filter(o => o.op_type === 'sell').reduce((s, o) => s + o.total_value, 0)

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Topo */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn onClick={() => setShowForm(s => !s)} color={showForm ? 'ghost' : 'accent'}>
          {showForm ? '✕ Cancelar' : '+ Nova Operação'}
        </Btn>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--gr)' }}>↑ Compras: <strong>{fmt.brl(totalCompras)}</strong></span>
          <span style={{ fontSize: 12, color: 'var(--rd)' }}>↓ Vendas: <strong>{fmt.brl(totalVendas)}</strong></span>
        </div>
      </div>

      {/* Form */}
      {showForm && <OpForm onSave={handleSave} onCancel={() => setShowForm(false)} />}

      {/* Filtros + Ordenação */}
      <Card style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Busca por ticker */}
          <input
            value={filterTicker}
            onChange={e => setFilterTicker(e.target.value)}
            placeholder="Filtrar por ativo..."
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 12, fontFamily: 'inherit', width: 160 }}
          />

          {/* Tipo */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[['all','Todos'],['buy','Compras'],['sell','Vendas']].map(([v, l]) => (
              <button key={v} onClick={() => setFilterType(v)} style={{
                padding: '6px 12px', borderRadius: 7, border: `1px solid ${filterType === v ? 'var(--ac)' : 'var(--bd)'}`,
                background: filterType === v ? 'rgba(59,130,246,.15)' : 'var(--bg3)',
                color: filterType === v ? 'var(--ac)' : 'var(--tx3)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: filterType === v ? 700 : 400,
              }}>{l}</button>
            ))}
          </div>

          {/* Classe */}
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 12, fontFamily: 'inherit' }}>
            <option value="all">Todas as classes</option>
            {classes.filter(c => c !== 'all').map(c => <option key={c} value={c}>{CLASS_LABEL[c] || c}</option>)}
          </select>

          {/* Corretora */}
          <select value={filterBroker} onChange={e => setFilterBroker(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 12, fontFamily: 'inherit' }}>
            <option value="all">Todas as corretoras</option>
            {brokers.filter(b => b !== 'all').map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
          </select>

          {/* Ordenação */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 12, fontFamily: 'inherit', marginLeft: 'auto' }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </Card>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <Empty icon="↕" message="Nenhuma operação encontrada." action={<Btn onClick={() => setShowForm(true)}>+ Nova Operação</Btn>} />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  {['Tipo','Ativo','Classe','Data','Qtd','Preço Unit.','Total','Proventos','Corretora',''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--tx3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bd)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((op, i) => {
                  const isBuy = op.op_type === 'buy'
                  return (
                    <tr key={op.id} style={{ borderBottom: '1px solid var(--bd)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: isBuy ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
                          color: isBuy ? 'var(--gr)' : 'var(--rd)',
                        }}>
                          {isBuy ? '↑ Compra' : '↓ Venda'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 800 }}>{op.assets?.ticker || '—'}</div>
                        <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{op.assets?.name}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{CLASS_LABEL[op.assets?.asset_class] || '—'}</span>
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--tx2)' }}>{fmt.date(op.op_date)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{fmt.num(op.quantity, 0)}</td>
                      <td style={{ padding: '10px 12px' }}>{fmt.brl(op.unit_price)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: isBuy ? 'var(--gr)' : 'var(--rd)' }}>{fmt.brl(op.total_value)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--ac2)' }}>{op.dividends_used ? fmt.brl(op.dividends_used) : '—'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--tx3)', textTransform: 'capitalize' }}>{op.broker || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <OpMenu op={op} onEdit={setEditOp} onDelete={handleDelete} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--tx3)', borderTop: '1px solid var(--bd)' }}>
            {filtered.length} operação{filtered.length !== 1 ? 'ões' : ''}
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      {editOp && <EditModal op={editOp} onSave={handleSave} onClose={() => setEditOp(null)} />}
    </div>
  )
}
