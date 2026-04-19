import { useState, useRef, useEffect } from 'react'
import { fmt, CLASS_LABEL, CLASS_COLOR, getAttractiveBadge } from '../lib/context'
import { searchAssets } from '../lib/supabase'

// ── Card ──────────────────────────────────────────────────
export function Card({ children, style = {}, className = '' }) {
  return (
    <div className={className} style={{
      background: 'var(--bg2)', border: '1px solid var(--bd)',
      borderRadius: 14, padding: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      ...style
    }}>
      {children}
    </div>
  )
}

// ── Stat KPI ──────────────────────────────────────────────
export function KPI({ label, value, sub, color }) {
  return (
    <Card>
      <div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--tx)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 4 }}>{sub}</div>}
    </Card>
  )
}

// ── Button ────────────────────────────────────────────────
export function Btn({ children, onClick, color = 'accent', size = 'md', disabled = false, style = {} }) {
  const bg = { accent: 'var(--ac)', green: 'var(--gr)', ghost: 'var(--bg3)', danger: 'var(--rd)' }
  const tc = ['accent', 'green', 'danger'].includes(color) ? 'white' : 'var(--tx2)'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: size === 'sm' ? '5px 12px' : size === 'lg' ? '12px 24px' : '8px 16px',
      borderRadius: 9, border: '1px solid var(--bd)',
      background: bg[color] || bg.accent, color: tc,
      fontWeight: 700, fontSize: size === 'sm' ? 12 : 14,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
      fontFamily: 'inherit', transition: 'opacity .15s', ...style
    }}>
      {children}
    </button>
  )
}

// ── Badge ─────────────────────────────────────────────────
export function Badge({ children, color = 'accent', size = 'sm' }) {
  const styles = {
    accent: { background: 'rgba(59,130,246,.15)', color: 'var(--ac)' },
    green: { background: 'rgba(34,197,94,.15)', color: 'var(--gr)' },
    red: { background: 'rgba(239,68,68,.15)', color: 'var(--rd)' },
    amber: { background: 'rgba(245,158,11,.15)', color: 'var(--am)' },
    purple: { background: 'rgba(99,102,241,.15)', color: 'var(--ac2)' },
    fii: { background: 'rgba(245,158,11,.15)', color: 'var(--am)' },
    crypto: { background: 'rgba(251,146,60,.15)', color: '#fb923c' },
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 999, fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600, ...(styles[color] || styles.accent)
    }}>
      {children}
    </span>
  )
}

// ── Attractive Badge ──────────────────────────────────────
export function AttrBadge({ ticker, prices }) {
  const b = getAttractiveBadge(ticker, prices)
  if (!b) return null
  return (
    <span title={b.reasons.join(' · ')} style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
      borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: 'help',
      background: b.level === 'strong' ? 'rgba(34,197,94,.2)' : 'rgba(245,158,11,.2)',
      color: b.level === 'strong' ? 'var(--gr)' : 'var(--am)',
      border: `1px solid ${b.level === 'strong' ? 'rgba(34,197,94,.4)' : 'rgba(245,158,11,.4)'}`,
    }}>
      ✦ {b.level === 'strong' ? 'ATRAENTE' : 'ATENÇÃO'}
    </span>
  )
}

// ── Mini Donut ────────────────────────────────────────────
export function MiniDonut({ data, size = 110 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return null
  const r = 38, cx = size / 2, cy = size / 2, sw = 14, circ = 2 * Math.PI * r
  let off = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const pct = d.value / total, dash = circ * pct, rot = off * 360 - 90
        off += pct
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color}
          strokeWidth={sw} strokeDasharray={`${dash} ${circ - dash}`}
          transform={`rotate(${rot} ${cx} ${cy})`} opacity={0.85} />
      })}
      <circle cx={cx} cy={cy} r={r - sw / 2 - 2} fill="var(--bg2)" />
    </svg>
  )
}

// ── Balance Bar ───────────────────────────────────────────
export function BalBar({ label, current, target, color }) {
  const ok = Math.abs(current - target) <= 5
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: ok ? 'var(--gr)' : 'var(--am)' }}>
          {current.toFixed(1)}% / meta {target.toFixed(0)}%
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--bg4)', borderRadius: 3, position: 'relative' }}>
        <div style={{ height: '100%', width: `${Math.min(current, 100)}%`, background: color, borderRadius: 3 }} />
        <div style={{ position: 'absolute', top: -3, left: `${Math.min(target, 100)}%`, width: 2, height: 11, background: 'var(--tx3)', borderRadius: 1 }} />
      </div>
    </div>
  )
}

// ── Asset Autocomplete ────────────────────────────────────
export function AssetSearch({ onSelect, placeholder = 'Buscar ativo...' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const data = await searchAssets(query)
      setResults(data || [])
      setOpen(true)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 14px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 13 }}
      />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 10, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,.3)', overflow: 'hidden', marginTop: 4 }}>
          {results.map(a => (
            <div key={a.id} onClick={() => { onSelect(a); setQuery(a.ticker); setOpen(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bd)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--tx)' }}>{a.ticker}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--tx3)' }}>{a.name}</span>
              </div>
              <Badge color={a.asset_class === 'fii' ? 'fii' : a.asset_class === 'crypto' ? 'crypto' : 'green'}>
                {CLASS_LABEL[a.asset_class]}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────
export function Input({ label, type = 'text', value, onChange, placeholder, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && <label style={{ fontSize: 11, color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ padding: '9px 13px', borderRadius: 9, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit', ...style }} />
    </div>
  )
}

// ── Loading spinner ───────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--bd)', borderTop: '3px solid var(--ac)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Page section header ───────────────────────────────────
export function SectionHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--tx)', letterSpacing: '-0.02em' }}>{title}</h2>
      {action}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────
export function Empty({ icon = '◈', message, action }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', color: 'var(--tx3)', gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 40, opacity: 0.4 }}>{icon}</div>
      <p style={{ fontSize: 14, maxWidth: 280 }}>{message}</p>
      {action}
    </div>
  )
}
