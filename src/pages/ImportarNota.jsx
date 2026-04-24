import { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url'
import { useApp, fmt, CLASS_LABEL } from '../lib/context'
import { Card, Btn, Spinner, Badge } from '../components/ui'
import { ensureAsset, insertOperation, supabase } from '../lib/supabase'

// ── Parser de texto da nota Inter ────────────────────────
function parseInterNota(text) {
  const ops = []
  const simpleBr = (v) => parseFloat(String(v).replace(/\./, '').replace(',', '.'))

  // Número da nota
  const noteNumMatch = text.match(/Nr\.?\s*nota\s*(\d+)/)
  const noteNumber = noteNumMatch ? noteNumMatch[1] : null

  // Data do pregão
  const dateMatch = text.match(/Data\s*prega[oõ]\s*(\d{2}\/\d{2}\/\d{4})/)
  const pregaoDate = dateMatch
    ? dateMatch[1].split('/').reverse().join('-')
    : new Date().toISOString().slice(0, 10)

  // Padrão real do Inter (texto contínuo do PDF.js):
  // "Bovespa VIS C 1 79,15 79,15 D CI FII PVBI VBI Bovespa..."
  // Captura: [TIPO mercado] [C|V] [QTD] [PRECO] [TOTAL] D [DESC até próximo Bovespa]
  const raw = text.replace(/\s+/g, ' ')
  const pattern = /Bovespa \w+ (C|V) (\d+) (\d+,\d{2}) (\d+,\d{2}) D ([A-Z0-9 ]+?)(?= Bovespa| Líquido| Resumo|$)/g

  let m
  while ((m = pattern.exec(raw)) !== null) {
    const [, cv, qtyStr, priceStr, totalStr, descRaw] = m
    const quantity = parseInt(qtyStr)
    const unit_price = simpleBr(priceStr)
    const total_value = simpleBr(totalStr)
    if (!quantity || !unit_price || unit_price < 0.01) continue

    // Limpar prefixos de mercado da descrição
    const desc = descRaw.trim()
      .replace(/^(CI ER|CI ES|CI FI|CI|UNT N2|ON N2|FRA N2|ON N1|PN N1|UNT|ON|PN) /, '')
      .trim()

    if (!desc) continue
    ops.push({
      op_type: cv === 'C' ? 'buy' : 'sell',
      description: desc,
      quantity, unit_price, total_value,
      op_date: pregaoDate, broker: 'inter',
      _ticker: null, _resolved: false,
    })
  }

  return { ops, pregaoDate, noteNumber }
}

// ── Mapear nome da nota para ticker ───────────────────────
async function resolveTicker(description) {
  const desc = description.toUpperCase().trim()

  // 1. Busca exata no Supabase por nome
  const { data } = await supabase
    .from('assets')
    .select('id, ticker, name, asset_class')
    .ilike('name', `%${desc.split(' ').slice(-2).join(' ')}%`)
    .limit(3)
  if (data && data.length > 0) return data[0]

  // 2. Busca por cada palavra significativa
  const words = desc.split(' ').filter(w => w.length > 3)
  for (const word of words) {
    const { data: d2 } = await supabase
      .from('assets')
      .select('id, ticker, name, asset_class')
      .ilike('name', `%${word}%`)
      .limit(1)
    if (d2 && d2.length > 0) return d2[0]
  }

  // 3. Detectar ticker no texto (ex: "PVBI VBI" → PVBI11)
  const tickerMatch = desc.match(/\b([A-Z]{4}\d{2})\b/)
  if (tickerMatch) {
    const { data: d3 } = await supabase
      .from('assets')
      .select('id, ticker, name, asset_class')
      .eq('ticker', tickerMatch[1])
      .limit(1)
    if (d3 && d3.length > 0) return d3[0]
  }

  return null
}

// ── Componente principal ──────────────────────────────────
export default function ImportarNota({ onNavigate }) {
  const { user, refreshPortfolio } = useApp()
  const [step, setStep] = useState('upload')  // upload | review | importing | done
  const [ops, setOps] = useState([])
  const [pregaoDate, setPregaoDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [importCount, setImportCount] = useState(0)
  const [selected, setSelected] = useState({})
  const [filesInfo, setFilesInfo] = useState([])  // info dos arquivos processados
  const [manualTickers, setManualTickers] = useState({})  // index -> ticker manual
  const [duplicates, setDuplicates] = useState([])  // notas já importadas

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer()
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map(item => item.str).join(' ') + '\n'
      }
      return text
    } catch (e) {
      // Fallback texto puro
      try {
        const text = await file.text()
        if (text.includes('Bovespa') || text.includes('NOTA DE CORRETAGEM')) return text
      } catch { }
      throw new Error('Não foi possível ler o PDF: ' + e.message)
    }
  }

  const handleFiles = async (files) => {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (pdfs.length === 0) { setError('Selecione arquivos PDF válidos.'); return }
    setLoading(true); setError(null)
    const allOps = [], infos = [], dups = []
    let debugText = null

    // Verificar notas já importadas
    const { data: importedNotes } = await supabase
      .from('imported_notes')
      .select('note_number, note_date')
      .eq('user_id', user.id)
    const importedSet = new Set((importedNotes || []).map(n => n.note_number))

    for (const file of pdfs) {
      try {
        const fullText = await extractTextFromPDF(file)
        const { ops: parsed, pregaoDate: date, noteNumber } = parseInterNota(fullText)

        // Verificar duplicata
        if (noteNumber && importedSet.has(noteNumber)) {
          dups.push(file.name)
          infos.push({ name: file.name, noteNumber, error: `Nota #${noteNumber} já importada anteriormente` })
          continue
        }
        if (parsed.length === 0) { debugText = fullText.substring(0, 2000); infos.push({ name: file.name, error: 'Sem operações detectadas' }); continue }
        const resolved = await Promise.all(parsed.map(async op => {
          const asset = await resolveTicker(op.description)
          return { ...op, _asset: asset, _ticker: asset?.ticker || null, _resolved: !!asset }
        }))
        infos.push({ name: file.name, date, count: resolved.length, noteNumber })
        allOps.push(...resolved)
      } catch (e) { infos.push({ name: file.name, error: e.message }) }
    }

    if (allOps.length === 0) {
      setError(debugText ? 'Texto extraído (debug):\n\n' + debugText : 'Nenhuma operação encontrada.')
      setLoading(false); return
    }
    setDuplicates(dups); setFilesInfo(infos); setOps(allOps)
    setSelected(Object.fromEntries(allOps.map((_, i) => [i, true])))
    setStep('review'); setLoading(false)
  }

    const handleImport = async () => {
    setStep('importing')
    let count = 0
    // Registrar notas como importadas
    for (const info of filesInfo) {
      if (info.noteNumber && !info.error) {
        await supabase.from('imported_notes').upsert({
          user_id: user.id,
          note_number: info.noteNumber,
          note_date: info.date,
          broker: 'inter',
          ops_count: info.count,
        }, { onConflict: 'user_id,note_number,broker' }).then(() => {})
      }
    }
    for (let i = 0; i < ops.length; i++) {
      if (!selected[i]) continue
      let op = ops[i]
      // Usar ticker manual se fornecido e não resolvido automaticamente
      if (!op._resolved && manualTickers[i]) {
        const ticker = manualTickers[i].trim()
        let { data: existing } = await supabase.from('assets').select('id,ticker,name,asset_class').eq('ticker', ticker).single().catch(() => ({ data: null }))
        if (existing) op = { ...op, _asset: existing, _resolved: true }
      }
      if (!op._asset) continue
      try {
        const assetId = await ensureAsset({ ...op._asset, _fromBrapi: false })
        await insertOperation({
          user_id: user.id,
          asset_id: assetId || op._asset.id,
          op_type: op.op_type,
          quantity: op.quantity,
          unit_price: op.unit_price,
          total_value: op.total_value,
          dividends_used: 0,
          out_of_pocket: op.total_value,
          broker: op.broker,
          op_date: op.op_date,
          source: 'pdf_inter',
        })
        count++
      } catch (e) { console.error('Erro ao importar', op, e) }
    }
    await refreshPortfolio()
    setImportCount(count)
    setStep('done')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 700 }}>

      {/* Upload */}
      {step === 'upload' && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Importar Nota de Corretagem</div>
          <p style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 20, lineHeight: 1.6 }}>
            Suporte atual: <strong>Inter DTVM</strong> · Itaú (em breve)<br />
            O PDF é processado localmente — nenhum dado é enviado para servidores externos.
          </p>

          <label
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--ac)' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--bd)' }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--bd)'; e.dataTransfer.files.length && handleFiles(e.dataTransfer.files) }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '36px 24px', borderRadius: 12, border: '2px dashed var(--bd)',
              background: 'var(--bg3)', cursor: 'pointer', gap: 10, transition: 'border-color .15s',
            }}>
            <span style={{ fontSize: 36 }}>📄</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Clique ou arraste os PDFs aqui</span>
            <span style={{ fontSize: 12, color: 'var(--tx3)' }}>Múltiplas notas suportadas · Inter DTVM (.pdf)</span>
            <input type="file" accept=".pdf" multiple style={{ display: 'none' }}
              onChange={e => e.target.files?.length && handleFiles(e.target.files)} />
          </label>

          {loading && <div style={{ marginTop: 16 }}><Spinner /></div>}
          {error && <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', fontSize: 12, color: 'var(--rd)' }}>{error}</div>}
        </Card>
      )}

      {/* Review */}
      {step === 'review' && (
        <>
          <Card style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>
                  {filesInfo.length} nota{filesInfo.length !== 1 ? 's' : ''} processada{filesInfo.length !== 1 ? 's' : ''}
                </div>
                {filesInfo.map((f, i) => (
                  <div key={i} style={{ fontSize: 11, color: f.error ? 'var(--rd)' : 'var(--tx3)', marginTop: 2 }}>
                    {f.error ? `❌ ${f.name}: ${f.error}` : `✓ ${f.name} — ${f.count} operações`}
                  </div>
                ))}
                <div style={{ fontSize: 12, color: 'var(--ac)', marginTop: 6, fontWeight: 700 }}>
                  {ops.filter((_, i) => selected[i]).length} de {ops.length} operações selecionadas
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn size="sm" color="ghost" onClick={() => setStep('upload')}>← Voltar</Btn>
                <Btn size="sm" color="green" onClick={handleImport}
                  disabled={!ops.some((op, i) => selected[i] && op._resolved)}>
                  Importar Selecionadas
                </Btn>
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ops.map((op, i) => (
              <div key={i} onClick={() => setSelected(s => ({ ...s, [i]: !s[i] }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: 'var(--bg2)', borderRadius: 12, border: `1px solid ${selected[i] ? 'var(--ac)' : 'var(--bd)'}`,
                  cursor: 'pointer', opacity: op._resolved ? 1 : 0.6,
                }}>
                {/* Checkbox */}
                <div style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  border: `2px solid ${selected[i] ? 'var(--ac)' : 'var(--bd)'}`,
                  background: selected[i] ? 'var(--ac)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 11, fontWeight: 800,
                }}>
                  {selected[i] ? '✓' : ''}
                </div>

                {/* Tipo */}
                <span style={{
                  padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, flexShrink: 0,
                  background: op.op_type === 'buy' ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
                  color: op.op_type === 'buy' ? 'var(--gr)' : 'var(--rd)',
                }}>
                  {op.op_type === 'buy' ? '↑ Compra' : '↓ Venda'}
                </span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>
                    {op._ticker
                      ? <><span style={{ color: 'var(--ac)' }}>{op._ticker}</span> · <span style={{ fontWeight: 400, color: 'var(--tx3)', fontSize: 11 }}>{op.description}</span></>
                      : <span style={{ color: 'var(--am)' }}>⚠ {op.description}</span>
                    }
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                    {op.quantity} un. × {fmt.brl(op.unit_price)}
                  </div>
                  {!op._resolved && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }} onClick={e => e.stopPropagation()}>
                      <input
                        value={manualTickers[i] || ''}
                        onChange={e => setManualTickers(t => ({ ...t, [i]: e.target.value.toUpperCase() }))}
                        placeholder="Digite o ticker (ex: KNRI11)"
                        style={{ flex: 1, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--bd)', background: 'var(--bg2)', color: 'var(--tx)', fontSize: 12, fontFamily: 'inherit' }}
                      />
                      {manualTickers[i]?.length >= 4 && (
                        <button onClick={async (e) => {
                          e.stopPropagation()
                          const ticker = manualTickers[i].trim()
                          // Buscar ou criar o ativo
                          let { data: existing } = await supabase.from('assets').select('id,ticker,name,asset_class').eq('ticker', ticker).single()
                          if (!existing) {
                            const { data: created } = await supabase.from('assets').insert({ ticker, name: ticker, asset_class: ticker.endsWith('11') ? 'fii' : 'stock_br' }).select().single()
                            existing = created
                          }
                          if (existing) {
                            const newOps = [...ops]
                            newOps[i] = { ...newOps[i], _ticker: ticker, _asset: existing, _resolved: true }
                            setOps(newOps)
                          }
                        }} style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--ac)', color: 'white', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                          ✓
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Valor */}
                <div style={{ fontWeight: 800, fontSize: 13, flexShrink: 0, color: op.op_type === 'buy' ? 'var(--gr)' : 'var(--rd)' }}>
                  {fmt.brl(op.total_value)}
                </div>
              </div>
            ))}
          </div>

          {duplicates.length > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.3)', fontSize: 12, color: 'var(--ac)' }}>
              ⟳ {duplicates.length} nota{duplicates.length !== 1 ? 's' : ''} ignorada{duplicates.length !== 1 ? 's' : ''} por já ter sido importada anteriormente.
            </div>
          )}

      {ops.some(op => !op._resolved) && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', fontSize: 12, color: 'var(--am)' }}>
              ⚠ Alguns tickers não foram identificados automaticamente. Eles serão ignorados na importação.
              Você pode adicioná-los manualmente pelo Extrato depois.
            </div>
          )}
        </>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Spinner />
          <p style={{ marginTop: 16, color: 'var(--tx2)' }}>Importando operações...</p>
        </Card>
      )}

      {/* Done */}
      {step === 'done' && (
        <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>{importCount} operações importadas!</div>
          <p style={{ color: 'var(--tx3)', fontSize: 13, marginBottom: 24 }}>As posições foram atualizadas na sua carteira.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Btn color="accent" onClick={() => onNavigate?.('portfolio')}>Ver Carteira</Btn>
            <Btn color="ghost" onClick={() => { setStep('upload'); setOps([]); setError(null) }}>Importar outro PDF</Btn>
          </div>
        </Card>
      )}
    </div>
  )
}
