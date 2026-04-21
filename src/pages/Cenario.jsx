import { useState, useEffect } from 'react'
import { useApp, fmt } from '../lib/context'
import { Card, KPI, Spinner } from '../components/ui'
import { fetchNews } from '../lib/prices'

export default function Cenario() {
  const { macro } = useApp()
  const [news, setNews] = useState([])
  const [loadingNews, setLoadingNews] = useState(true)

  useEffect(() => {
    fetchNews()
      .then(n => { setNews(Array.isArray(n) ? n : []); setLoadingNews(false) })
      .catch(() => { setNews([]); setLoadingNews(false) })
  }, [])

  const selicReal = macro?.selic && macro?.ipca12 ? macro.selic - macro.ipca12 : null
  const copomChanged = macro?.selicMetaChange && macro.selicMetaChange !== 0
  const copomDate = macro?.selicMetaDate ? new Date(macro.selicMetaDate.split('/').reverse().join('-')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPIs macro */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {macro?.selicMeta != null && <KPI label="Selic Meta" value={`${fmt.num(macro.selicMeta, 2)}%`} sub="Decisão Copom" color="var(--ac2)" />}
        {macro?.selic != null && <KPI label="Selic Over" value={`${fmt.num(macro.selic, 2)}%`} sub="a.a. efetiva" color="var(--ac)" />}
        {macro?.cdi != null && <KPI label="CDI a.a." value={`${fmt.num(macro.cdi, 2)}%`} sub="Anualizado" color="#a78bfa" />}
        {macro?.ipca12 != null && <KPI label="IPCA 12m" value={`${fmt.num(macro.ipca12, 2)}%`} sub="Acumulado" color="var(--am)" />}
        {selicReal != null && <KPI label="Selic Real" value={`${fmt.num(selicReal, 2)}%`} sub="Selic − IPCA" color={selicReal > 4 ? 'var(--gr)' : 'var(--am)'} />}
        {macro?.dolar != null && <KPI label="Dólar" value={fmt.brl(macro.dolar)} sub="USD/BRL PTAX" />}
      </div>

      {/* Decisão Copom */}
      {copomChanged && (
        <Card style={{
          background: macro.selicMetaChange > 0 ? 'rgba(239,68,68,.05)' : 'rgba(34,197,94,.05)',
          border: `1px solid ${macro.selicMetaChange > 0 ? 'rgba(239,68,68,.3)' : 'rgba(34,197,94,.3)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{macro.selicMetaChange > 0 ? '📈' : '📉'}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: macro.selicMetaChange > 0 ? 'var(--rd)' : 'var(--gr)' }}>
                Copom {macro.selicMetaChange > 0 ? 'elevou' : 'reduziu'} a Selic Meta em {Math.abs(macro.selicMetaChange).toFixed(2)}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>
                De {macro.selicMetaPrev?.toFixed(2)}% → {macro.selicMeta?.toFixed(2)}% a.a.
                {copomDate && ` · ${copomDate}`}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Análise */}
      {selicReal != null && (
        <Card style={{
          background: selicReal > 5 ? 'rgba(34,197,94,.05)' : 'rgba(245,158,11,.05)',
          border: `1px solid ${selicReal > 5 ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.3)'}`,
        }}>
          <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6 }}>
            {selicReal > 5
              ? `📈 Renda fixa atraente — Selic real de ${fmt.num(selicReal, 2)}% está acima de 5%. Momento favorável para posições em RF.`
              : `⚠ Selic real de ${fmt.num(selicReal, 2)}% — avalie se a rentabilidade real compensa frente à inflação.`}
          </div>
        </Card>
      )}

      {/* Notícias BCB */}
      <Card>
        <div style={{ fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 14 }}>
          Comunicados do Banco Central
        </div>
        {loadingNews ? (
          <Spinner />
        ) : news.length === 0 ? (
          <div style={{ color: 'var(--tx3)', fontSize: 13, padding: '8px 0' }}>
            Feed indisponível no momento.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {news.map((n, i) => (
              <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{
                display: 'block', padding: '12px 0',
                borderBottom: i < news.length - 1 ? '1px solid var(--bd)' : 'none',
                textDecoration: 'none', color: 'var(--tx)',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
                  {n.source} · {n.date ? new Date(n.date).toLocaleDateString('pt-BR') : ''}
                </div>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
