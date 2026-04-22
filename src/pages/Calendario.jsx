import { useState, useEffect } from 'react'
import { useApp, fmt } from '../lib/context'
import { Card, Spinner, Empty } from '../components/ui'
import { getOperations, supabase } from '../lib/supabase'

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// Agrupa eventos por data YYYY-MM-DD
function groupByDate(ops, divs) {
  const map = {}
  const add = (date, event) => {
    if (!map[date]) map[date] = []
    map[date].push(event)
  }
  ops.forEach(o => {
    add(o.op_date, {
      type: o.op_type === 'buy' ? 'compra' : 'venda',
      ticker: o.assets?.ticker || '?',
      qty: o.quantity,
      value: o.total_value,
      color: o.op_type === 'buy' ? 'var(--gr)' : 'var(--rd)',
      icon: o.op_type === 'buy' ? '↑' : '↓',
    })
  })
  divs.forEach(d => {
    add(d.payment_date, {
      type: 'provento',
      ticker: d.assets?.ticker || '?',
      qty: d.quantity_held,
      value: d.total_amount,
      color: 'var(--ac2)',
      icon: '◇',
    })
  })
  return map
}

// ── Dot badges por tipo ──────────────────────────────────
function EventDots({ events }) {
  const types = [...new Set(events.map(e => e.type))]
  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', marginTop: 3 }}>
      {types.map(t => (
        <div key={t} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: t === 'compra' ? 'var(--gr)' : t === 'venda' ? 'var(--rd)' : 'var(--ac2)',
        }} />
      ))}
    </div>
  )
}

// ── Day detail popup ─────────────────────────────────────
function DayModal({ date, events, onClose }) {
  const d = new Date(date + 'T00:00:00')
  const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 16, width: '100%', maxWidth: 440, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
        <div style={{ padding: '18px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)', textTransform: 'capitalize' }}>{label}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg3)', borderRadius: 10, borderLeft: `3px solid ${e.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, color: e.color, fontWeight: 800 }}>{e.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{e.ticker}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'capitalize' }}>{e.type} · {fmt.num(e.qty, 0)} {e.type === 'provento' ? 'cotas' : 'un.'}</div>
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: e.color }}>{fmt.brl(e.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Vista: Grade Mensal ───────────────────────────────────
function CalendarGrid({ year, month, eventMap, onDayClick }) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const cells = []

  // Espaços em branco antes do dia 1
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      {/* Cabeçalho dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DAYS_PT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--tx3)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '.04em' }}>{d}</div>
        ))}
      </div>
      {/* Células */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const events = eventMap[dateKey] || []
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          const hasEvents = events.length > 0
          return (
            <div key={day} onClick={() => hasEvents && onDayClick(dateKey, events)}
              style={{
                minHeight: 54, padding: '6px 4px 4px', borderRadius: 8, textAlign: 'center',
                background: isToday ? 'rgba(59,130,246,.15)' : hasEvents ? 'var(--bg3)' : 'transparent',
                border: isToday ? '1px solid var(--ac)' : hasEvents ? '1px solid var(--bd)' : '1px solid transparent',
                cursor: hasEvents ? 'pointer' : 'default',
                transition: 'background .1s',
              }}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 400, color: isToday ? 'var(--ac)' : 'var(--tx2)' }}>{day}</div>
              {hasEvents && <EventDots events={events} />}
              {hasEvents && (
                <div style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 2 }}>{events.length} ev.</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vista: Linha do Tempo ─────────────────────────────────
function Timeline({ year, month, eventMap, onDayClick }) {
  const entries = Object.entries(eventMap)
    .filter(([date]) => {
      const d = new Date(date + 'T00:00:00')
      return d.getFullYear() === year && d.getMonth() === month
    })
    .sort(([a], [b]) => a.localeCompare(b))

  if (entries.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--tx3)', fontSize: 13 }}>
      Nenhum evento neste mês
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {entries.map(([date, events], idx) => {
        const d = new Date(date + 'T00:00:00')
        const dayLabel = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
        const totalValue = events.reduce((s, e) => s + e.value, 0)
        return (
          <div key={date} style={{ display: 'flex', gap: 0 }}>
            {/* Linha vertical */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ac)', border: '2px solid var(--bg2)', zIndex: 1, marginTop: 18 }} />
              {idx < entries.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--bd)', marginTop: 4 }} />}
            </div>
            {/* Conteúdo */}
            <div style={{ flex: 1, paddingBottom: 16 }} onClick={() => onDayClick(date, events)}>
              <div style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 700, textTransform: 'capitalize', marginBottom: 6, marginTop: 14, cursor: 'pointer' }}>
                {dayLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {events.map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 9, borderLeft: `3px solid ${e.color}`, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: e.color, fontWeight: 800 }}>{e.icon}</span>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>{e.ticker}</span>
                        <span style={{ fontSize: 11, color: 'var(--tx3)', marginLeft: 6, textTransform: 'capitalize' }}>{e.type} · {fmt.num(e.qty, 0)} {e.type === 'provento' ? 'cotas' : 'un.'}</span>
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 13, color: e.color }}>{fmt.brl(e.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────
export default function Calendario() {
  const { user } = useApp()
  const [ops, setOps] = useState([])
  const [divs, setDivs] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('grid')   // 'grid' | 'timeline'
  const [selectedModal, setSelectedModal] = useState(null)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  useEffect(() => {
    if (!user) return
    Promise.allSettled([
      getOperations(user.id),
      supabase.from('dividends').select('*, assets(ticker, name)').eq('user_id', user.id).then(r => r.data || []),
    ]).then(([opsR, divsR]) => {
      setOps(opsR.status === 'fulfilled' ? opsR.value : [])
      setDivs(divsR.status === 'fulfilled' ? divsR.value : [])
      setLoading(false)
    })
  }, [user])

  const eventMap = groupByDate(ops, divs)

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()) }

  // Totais do mês
  const monthEvents = Object.entries(eventMap).filter(([date]) => {
    const d = new Date(date + 'T00:00:00')
    return d.getFullYear() === year && d.getMonth() === month
  }).flatMap(([, evs]) => evs)

  const totalCompras  = monthEvents.filter(e => e.type === 'compra').reduce((s, e) => s + e.value, 0)
  const totalVendas   = monthEvents.filter(e => e.type === 'venda').reduce((s, e) => s + e.value, 0)
  const totalProventos = monthEvents.filter(e => e.type === 'provento').reduce((s, e) => s + e.value, 0)

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header — navegação e toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Navegação de mês */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={{ background: 'var(--bg3)', border: '1px solid var(--bd)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--tx)', fontSize: 16 }}>‹</button>
          <div style={{ fontWeight: 800, fontSize: 15, minWidth: 160, textAlign: 'center' }}>
            {MONTHS_PT[month]} {year}
          </div>
          <button onClick={nextMonth} style={{ background: 'var(--bg3)', border: '1px solid var(--bd)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--tx)', fontSize: 16 }}>›</button>
        </div>

        <button onClick={goToday} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Hoje
        </button>

        {/* Toggle view */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 0, border: '1px solid var(--bd)', borderRadius: 9, overflow: 'hidden' }}>
          {[['grid', '⊞ Grade'], ['timeline', '☰ Linha do Tempo']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '7px 14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: view === v ? 700 : 400,
              background: view === v ? 'var(--ac)' : 'var(--bg3)',
              color: view === v ? 'white' : 'var(--tx3)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Resumo do mês */}
      {(totalCompras > 0 || totalVendas > 0 || totalProventos > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {totalCompras > 0 && <div style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', fontSize: 12 }}>↑ Compras: <strong style={{ color: 'var(--gr)' }}>{fmt.brl(totalCompras)}</strong></div>}
          {totalVendas > 0 && <div style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', fontSize: 12 }}>↓ Vendas: <strong style={{ color: 'var(--rd)' }}>{fmt.brl(totalVendas)}</strong></div>}
          {totalProventos > 0 && <div style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.3)', fontSize: 12 }}>◇ Proventos: <strong style={{ color: 'var(--ac2)' }}>{fmt.brl(totalProventos)}</strong></div>}
        </div>
      )}

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--tx3)' }}>
        {[['var(--gr)', '↑ Compra'], ['var(--rd)', '↓ Venda'], ['var(--ac2)', '◇ Provento']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
            {l}
          </div>
        ))}
      </div>

      {/* Vista */}
      <Card>
        {view === 'grid'
          ? <CalendarGrid year={year} month={month} eventMap={eventMap} onDayClick={(date, events) => setSelectedModal({ date, events })} />
          : <Timeline year={year} month={month} eventMap={eventMap} onDayClick={(date, events) => setSelectedModal({ date, events })} />
        }
      </Card>

      {/* Modal de detalhe do dia */}
      {selectedModal && (
        <DayModal date={selectedModal.date} events={selectedModal.events} onClose={() => setSelectedModal(null)} />
      )}
    </div>
  )
}
