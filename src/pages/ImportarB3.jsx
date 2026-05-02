import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useApp, fmt } from '../lib/context'
import { Card, Btn, Spinner, Badge } from '../components/ui'
import { ensureAsset, insertOperation, insertDividend, supabase } from '../lib/supabase'

// ── Mapeamento de eventos corporativos B3 ─────────────────
// Cada evento: { tipo, op_type, afeta_posicao, observacao }
const B3_EVENTS = {
  // Compras reais
  'Transferência - Liquidação_Credito': { tipo: 'compra',      op: 'buy',  pos: true  },
  'Compra_Credito':                     { tipo: 'compra',      op: 'buy',  pos: true  },

  // Vendas reais
  'Transferência - Liquidação_Debito':  { tipo: 'venda',       op: 'sell', pos: true  },
  'Venda_Debito':                       { tipo: 'venda',       op: 'sell', pos: true  },

  // Eventos corporativos — afetam posição, custo zero
  'Desdobro_Credito':                   { tipo: 'desdobro',    op: 'buy',  pos: true,  custo_zero: true, label: 'Desdobro' },
  'Grupamento_Debito':                  { tipo: 'grupamento',  op: 'sell', pos: true,  custo_zero: true, label: 'Grupamento' },
  'Bonificação em Ativos_Credito':      { tipo: 'bonificacao', op: 'buy',  pos: true,  custo_zero: true, label: 'Bonificação' },
  'Bonificação em Ativos_Debito':       { tipo: 'ignorar',     op: null,   pos: false, label: 'Fração bonificação' },
  'Fração em Ativos_Debito':            { tipo: 'ignorar',     op: null,   pos: false, label: 'Fração (ignorar)' },
  'Fração em Ativos_Credito':           { tipo: 'ignorar',     op: null,   pos: false, label: 'Fração (ignorar)' },
  'Leilão de Fração_Credito':           { tipo: 'ignorar',     op: null,   pos: false, label: 'Leilão fração (monetização)' },
  'Leilão de Fração_Debito':            { tipo: 'ignorar',     op: null,   pos: false, label: 'Leilão fração (ignorar)' },
  'Transferência_Credito':              { tipo: 'ignorar',     op: null,   pos: false, label: 'Transferência custódia' },
  'Transferência_Debito':               { tipo: 'ignorar',     op: null,   pos: false, label: 'Transferência custódia' },
  'Atualização_Credito':                { tipo: 'revisar',     op: 'buy',  pos: true,  custo_zero: true, label: 'Atualização (revisar)' },
  'Atualização_Debito':                 { tipo: 'ignorar',     op: null,   pos: false, label: 'Atualização débito' },
  'Recibo de Subscrição_Credito':       { tipo: 'subscricao',  op: 'buy',  pos: true,  custo_zero: false, label: 'Subscrição' },
  'Direito de Subscrição_Credito':      { tipo: 'ignorar',     op: null,   pos: false, label: 'Direito subscrição' },
  'Direitos de Subscrição - Não Exercido_Debito': { tipo: 'ignorar', op: null, pos: false },
  'Cessão de Direitos_Credito':         { tipo: 'ignorar',     op: null,   pos: false  },
  'Cessão de Direitos - Solicitada_Debito': { tipo: 'ignorar', op: null,   pos: false  },
  'Desdobro_Debito':                    { tipo: 'ignorar',     op: null,   pos: false, label: 'Desdobro (saída custódia)' },

  // Proventos
  'Rendimento_Credito':                             { tipo: 'provento', label: 'Rendimento' },
  'Dividendo_Credito':                              { tipo: 'provento', label: 'Dividendo' },
  'Dividendos_Credito':                             { tipo: 'provento', label: 'Dividendo' },
  'Juros Sobre Capital Próprio_Credito':            { tipo: 'provento', label: 'JCP' },
  'Juros_Credito':                                  { tipo: 'provento', label: 'Juros' },
  'PAGAMENTO DE JUROS_Credito':                     { tipo: 'provento', label: 'Juros' },
  'Dividendo - Transferido_Credito':                { tipo: 'ignorar',  label: 'Dividendo transferido (duplo)' },
  'Juros Sobre Capital Próprio - Transferido_Credito': { tipo: 'ignorar', label: 'JCP transferido (duplo)' },
  'Dividendo - Transferido_Debito':                 { tipo: 'ignorar'  },
  'Juros Sobre Capital Próprio - Transferido_Debito': { tipo: 'ignorar' },

  // RF / Tesouro
  'Atualização_Credito_TD':             { tipo: 'ignorar', label: 'Atualização TD' },
  'VENCIMENTO/RESGATE SALDO EM CONTA_Credito': { tipo: 'ignorar' },
  'Restituição de Capital_Credito':     { tipo: 'ignorar' },
  'Resgate_Credito':                    { tipo: 'ignorar' },
}

const TICKER_MAP = {
  'MXRF12':'MXRF11','MXRF13':'MXRF11','JURO12':'JURO11','KDIF12':'KDIF11',
  'KNCR12':'KNCR11','XPLG12':'XPLG11','RBRP12':'RBRP11','RBRR12':'RBRR11',
  'IFRA12':'IFRA11','CPTI12':'CPTI11','ITSA2':'ITSA4',
}

// ── Extrair ticker do Produto ─────────────────────────────
function extractTicker(produto) {
  const s = String(produto).trim()
  if (s.includes('Tesouro Selic')) { const m = s.match(/(\d{4})/); return m ? `TESOURO_SELIC_${m[1]}` : 'TESOURO_SELIC' }
  if (s.includes('Tesouro IPCA+') && s.includes('Juros')) { const m = s.match(/(\d{4})/); return m ? `TESOURO_IPCA_JUR_${m[1]}` : 'TESOURO_IPCA_JUR' }
  if (s.includes('Tesouro IPCA+')) { const m = s.match(/(\d{4})/); return m ? `TESOURO_IPCA_${m[1]}` : 'TESOURO_IPCA' }
  if (s.includes('Tesouro Prefixado') && s.includes('Juros')) { const m = s.match(/(\d{4})/); return m ? `TESOURO_PRE_JUR_${m[1]}` : 'TESOURO_PRE_JUR' }
  if (s.includes('Tesouro Prefixado')) { const m = s.match(/(\d{4})/); return m ? `TESOURO_PRE_${m[1]}` : 'TESOURO_PRE' }
  if (s.includes('Educa+')) { const m = s.match(/(\d{4})/); return m ? `TESOURO_EDUCA_${m[1]}` : 'TESOURO_EDUCA' }
  if (s.includes('CDB')) return 'CDB_INTER'
  if (s.includes('LCI')) return 'LCI_INTER'
  const m = s.match(/^([A-Z0-9]{4,6}[0-9])\s*[-–]/)
  if (m) return m[1]
  const m2 = s.match(/^([A-Z]{4}[0-9]{1,2})\b/)
  if (m2) return m2[1]
  return null
}

// ── Parse do xlsx B3 ──────────────────────────────────────
function parseB3Xlsx(data) {
  const wb = XLSX.read(data, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { raw: false })

  const ops = [], provents = [], pendentes = []

  rows.forEach((row, i) => {
    const es  = String(row['Entrada/Saída'] || '').trim()
    const mov = String(row['Movimentação'] || '').trim()
    const prod = String(row['Produto'] || '').trim()
    const inst = String(row['Instituição'] || '').trim()
    const qtyRaw = row['Quantidade']
    const priceRaw = row['Preço unitário']
    const valRaw = row['Valor da Operação']

    // Ignorar Clear (futuros/opções)
    if (inst.includes('CLEAR')) return
    // Ignorar derivativos
    if (['Futuro','Opção de Compra','Opção de Venda'].some(k => prod.includes(k))) return

    const ticker = extractTicker(prod)
    if (!ticker) return

    const tickerNorm = TICKER_MAP[ticker] || ticker
    const qty = parseFloat(String(qtyRaw || '0').replace(',', '.')) || 0
    const price = parseFloat(String(priceRaw || '0').replace(',', '.')) || 0
    const valor = parseFloat(String(valRaw || '0').replace(',', '.')) || 0

    // Converter data
    let date = String(row['Data'] || '').trim()
    if (date.includes('/')) {
      const [d, m, y] = date.split('/')
      date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
    if (!date || date === 'undefined') return

    const key = `${mov}_${es}`
    const event = B3_EVENTS[key]
    const tipo = event?.tipo || 'ignorar'

    if (tipo === 'ignorar') return

    if (tipo === 'provento') {
      if (valor > 0 && qty > 0) {
        provents.push({
          ticker: tickerNorm, date, qty, price, valor,
          label: event?.label || mov, produto: prod,
        })
      }
      return
    }

    if (tipo === 'revisar') {
      // "Atualização" com quantidade — colocar em fila de revisão
      pendentes.push({
        ticker: tickerNorm, date, qty, price, valor,
        mov, es, produto: prod,
        sugestao: qty > 0 ? 'buy' : null,
        label: event?.label || mov,
      })
      return
    }

    // Compra, venda, desdobro, bonificacao, grupamento, subscricao
    if (event?.op && qty > 0) {
      const custo_zero = event.custo_zero || false
      ops.push({
        ticker: tickerNorm, date,
        op_type: event.op,
        qty,
        unit_price: custo_zero ? 0 : price,
        total_value: custo_zero ? 0 : valor,
        label: event.label || tipo,
        produto: prod,
        is_corporate: custo_zero,
      })
    }
  })

  return { ops, provents, pendentes }
}

// ── Cores por tipo ────────────────────────────────────────
const TIPO_STYLE = {
  buy:  { bg: 'rgba(34,197,94,.12)',  color: 'var(--gr)', label: '▲ Compra' },
  sell: { bg: 'rgba(239,68,68,.12)', color: 'var(--rd)', label: '▼ Venda' },
}

// ── Componente principal ──────────────────────────────────
export default function ImportarB3({ onNavigate }) {
  const { user } = useApp()
  const [step, setStep] = useState('upload') // upload | preview | pendentes | done
  const [parsed, setParsed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState(null)
  const [pendentesResolvidos, setPendentesResolvidos] = useState({})
  const [dragOver, setDragOver] = useState(false)

  const processFile = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const { ops, provents, pendentes } = parseB3Xlsx(data)
        setParsed({ ops, provents, pendentes, fileName: file.name })
        setStep(pendentes.length > 0 ? 'pendentes' : 'preview')
      } catch (err) {
        alert('Erro ao processar arquivo: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  const resolvePendente = (i, action) => {
    setPendentesResolvidos(prev => ({ ...prev, [i]: action }))
  }

  const goToPreview = () => setStep('preview')

  const handleImport = async () => {
    if (!user || !parsed) return
    setLoading(true)
    let importedOps = 0, importedDivs = 0, errors = 0

    try {
      // Adicionar pendentes resolvidos
      const allOps = [...parsed.ops]
      parsed.pendentes.forEach((p, i) => {
        const action = pendentesResolvidos[i]
        if (action === 'buy' || action === 'sell') {
          allOps.push({ ...p, op_type: action, qty: p.qty, unit_price: p.price, total_value: p.valor, is_corporate: p.price === 0 })
        }
      })

      // Garantir assets
      const allTickers = [...new Set([...allOps.map(o => o.ticker), ...parsed.provents.map(p => p.ticker)])]
      setProgress(`Criando ${allTickers.length} ativos...`)
      for (const ticker of allTickers) {
        await ensureAsset(ticker, ticker)
      }

      // Inserir operações
      setProgress('Importando operações...')
      for (const op of allOps) {
        try {
          const asset = await ensureAsset(op.ticker, op.produto || op.ticker)
          await supabase.from('operations').insert({
            user_id: user.id,
            asset_id: asset.id,
            op_date: op.date,
            op_type: op.op_type,
            quantity: op.qty,
            unit_price: op.unit_price || 0,
            total_value: op.total_value || 0,
            dividends_used: 0,
            out_of_pocket: op.total_value || 0,
            broker: 'b3',
            source: 'cei_b3',
            notes: op.label || null,
          })
          importedOps++
        } catch { errors++ }
      }

      // Inserir proventos
      setProgress('Importando proventos...')
      for (const prov of parsed.provents) {
        try {
          const asset = await ensureAsset(prov.ticker, prov.produto || prov.ticker)
          const aps = prov.qty > 0 ? prov.valor / prov.qty : 0
          await supabase.from('dividends').insert({
            user_id: user.id,
            asset_id: asset.id,
            payment_date: prov.date,
            amount_per_share: aps,
            quantity_held: prov.qty,
            total_amount: prov.valor,
            available_balance: prov.valor,
            source: 'cei_b3',
          })
          importedDivs++
        } catch { errors++ }
      }

      setResult({ importedOps, importedDivs, errors })
      setStep('done')
    } catch (err) {
      alert('Erro na importação: ' + err.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Importar via B3 CEI</h2>
        <p style={{ fontSize: 13, color: 'var(--tx3)', lineHeight: 1.6 }}>
          Exporte o extrato de movimentações em <strong>xlsx</strong> direto do site da B3
          (<code>investidor.b3.com.br → Extratos → Movimentação</code>) e importe aqui.
          O sistema reconhece compras, vendas, proventos, desdobros, bonificações e grupamentos automaticamente.
        </p>
      </div>

      {/* Tutorial */}
      <Card style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.2)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ac)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          Como exportar do CEI B3
        </div>
        {[
          ['1', 'Acesse', 'investidor.b3.com.br e faça login com gov.br'],
          ['2', 'Navegue', 'Menu → Extratos e Informativos → Movimentação'],
          ['3', 'Configure', 'Selecione o período desejado e todas as instituições'],
          ['4', 'Exporte', 'Clique em "Exportar" e escolha o formato Excel (.xlsx)'],
          ['5', 'Importe', 'Arraste o arquivo abaixo ou clique para selecionar'],
        ].map(([n, bold, text]) => (
          <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--ac)', color: 'white', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
            <div style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--tx)' }}>{bold}:</strong> {text}
            </div>
          </div>
        ))}
      </Card>

      {/* Upload */}
      {step === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          style={{ border: `2px dashed ${dragOver ? 'var(--ac)' : 'var(--bd)'}`, borderRadius: 14, padding: 40, textAlign: 'center', background: dragOver ? 'rgba(99,102,241,.06)' : 'var(--bg2)', cursor: 'pointer', transition: 'all .2s' }}
          onClick={() => document.getElementById('b3-file-input').click()}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Arraste o arquivo xlsx da B3 aqui</div>
          <div style={{ fontSize: 12, color: 'var(--tx3)' }}>ou clique para selecionar</div>
          <input id="b3-file-input" type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}

      {/* Pendentes — eventos que precisam de revisão */}
      {step === 'pendentes' && parsed && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--am)', fontWeight: 700, marginBottom: 12 }}>
            ⚠ {parsed.pendentes.length} evento{parsed.pendentes.length > 1 ? 's' : ''} precisam de revisão manual
          </div>
          {parsed.pendentes.map((p, i) => (
            <Card key={i} style={{ marginBottom: 8, border: `1px solid ${pendentesResolvidos[i] ? 'var(--bd)' : 'rgba(245,158,11,.3)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{p.ticker}</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(245,158,11,.15)', color: 'var(--am)', fontWeight: 700 }}>{p.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
                    {p.date} · {p.qty} cotas{p.valor > 0 ? ` · ${fmt.brl(p.valor)}` : ' · sem valor'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{p.produto}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    ['buy', '▲ Entrada', 'var(--gr)', 'rgba(34,197,94,.12)'],
                    ['sell', '▼ Saída', 'var(--rd)', 'rgba(239,68,68,.12)'],
                    ['skip', '✕ Ignorar', 'var(--tx3)', 'var(--bg3)'],
                  ].map(([action, label, color, bg]) => (
                    <button key={action} onClick={() => resolvePendente(i, action)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${pendentesResolvidos[i] === action ? color : 'var(--bd)'}`, background: pendentesResolvidos[i] === action ? bg : 'transparent', color: pendentesResolvidos[i] === action ? color : 'var(--tx3)', fontFamily: 'inherit', fontSize: 12, fontWeight: pendentesResolvidos[i] === action ? 700 : 400, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          ))}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Btn color="accent" onClick={goToPreview}
              disabled={parsed.pendentes.some((_, i) => !pendentesResolvidos[i])}>
              Continuar →
            </Btn>
            <div style={{ fontSize: 11, color: 'var(--tx3)', alignSelf: 'center' }}>
              {parsed.pendentes.filter((_, i) => pendentesResolvidos[i]).length}/{parsed.pendentes.length} resolvidos
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && parsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Resumo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 10 }}>
            {[
              ['Arquivo', parsed.fileName.slice(0, 20), 'var(--tx3)'],
              ['Operações', parsed.ops.length + (Object.values(pendentesResolvidos).filter(v => v !== 'skip').length), 'var(--ac)'],
              ['Proventos', parsed.provents.length, 'var(--ac2)'],
              ['Revisados', Object.values(pendentesResolvidos).filter(v => v !== 'skip').length, 'var(--am)'],
            ].map(([l, v, c]) => (
              <Card key={l} style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 3 }}>{l}</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: c }}>{v}</div>
              </Card>
            ))}
          </div>

          {/* Amostra operações */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', fontSize: 11, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Prévia — Operações ({parsed.ops.length})
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {parsed.ops.map((op, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--bd)', fontSize: 12 }}>
                  <span style={{ fontWeight: 800, minWidth: 70 }}>{op.ticker}</span>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: op.op_type === 'buy' ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', color: op.op_type === 'buy' ? 'var(--gr)' : 'var(--rd)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {op.op_type === 'buy' ? '▲' : '▼'} {op.label || (op.op_type === 'buy' ? 'Compra' : 'Venda')}
                  </span>
                  <span style={{ color: 'var(--tx3)', minWidth: 88 }}>{op.date}</span>
                  <span style={{ fontWeight: 700 }}>{op.qty} cotas</span>
                  <span style={{ color: 'var(--tx2)', marginLeft: 'auto' }}>{op.total_value > 0 ? fmt.brl(op.total_value) : 'R$ 0,00'}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Amostra proventos */}
          {parsed.provents.length > 0 && (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', fontSize: 11, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Prévia — Proventos ({parsed.provents.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {parsed.provents.slice(0, 30).map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: '1px solid var(--bd)', fontSize: 12 }}>
                    <span style={{ fontWeight: 800, minWidth: 70 }}>{p.ticker}</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(168,85,247,.12)', color: 'var(--ac2)', fontWeight: 700 }}>{p.label}</span>
                    <span style={{ color: 'var(--tx3)', minWidth: 88 }}>{p.date}</span>
                    <span style={{ color: 'var(--ac2)', fontWeight: 700, marginLeft: 'auto' }}>{fmt.brl(p.valor)}</span>
                  </div>
                ))}
                {parsed.provents.length > 30 && <div style={{ padding: '8px 14px', color: 'var(--tx3)', fontSize: 11 }}>... e mais {parsed.provents.length - 30} proventos</div>}
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Btn color="accent" onClick={handleImport} disabled={loading}>
              {loading ? <><Spinner size={14} /> {progress}</> : `✓ Importar ${parsed.ops.length + Object.values(pendentesResolvidos).filter(v=>v!=='skip').length} operações + ${parsed.provents.length} proventos`}
            </Btn>
            <Btn color="ghost" onClick={() => { setParsed(null); setStep('upload') }}>Cancelar</Btn>
          </div>
        </div>
      )}

      {/* Done */}
      {step === 'done' && result && (
        <Card style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Importação concluída!</div>
          <div style={{ fontSize: 13, color: 'var(--tx3)', lineHeight: 2 }}>
            {result.importedOps} operações importadas<br />
            {result.importedDivs} proventos importados<br />
            {result.errors > 0 && <span style={{ color: 'var(--rd)' }}>{result.errors} erros ignorados</span>}
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Btn color="accent" onClick={() => onNavigate?.('portfolio')}>Ver Carteira</Btn>
            <Btn color="ghost" onClick={() => { setParsed(null); setStep('upload'); setResult(null) }}>Importar mais</Btn>
          </div>
        </Card>
      )}
    </div>
  )
}
