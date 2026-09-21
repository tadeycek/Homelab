import { useEffect, useState, useCallback } from 'react'
import { PullControls } from '../App'

interface OllamaModel {
  name: string
  model: string
  size: number
  modified_at: string
  details: { family: string; parameter_size: string; quantization_level: string; format: string }
  capabilities?: string[]
}

function fmtSize(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB'
  return bytes + ' B'
}
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

const POPULAR: { group: string; models: { name: string; desc: string }[] }[] = [
  { group: 'Llama', models: [
    { name: 'llama3.2:1b',   desc: '1B · ultra fast' },
    { name: 'llama3.2',      desc: '3B · fast, general purpose' },
    { name: 'llama3.1:8b',   desc: '8B · strong reasoning' },
    { name: 'llama3.1:70b',  desc: '70B · very capable, needs ~40GB RAM' },
    { name: 'llama3.3:70b',  desc: '70B · latest Llama 3.3' },
  ]},
  { group: 'Mistral', models: [
    { name: 'mistral',       desc: '7B · great instruction following' },
    { name: 'mistral-nemo',  desc: '12B · Apache 2.0, long context' },
    { name: 'mixtral:8x7b',  desc: '47B MoE · fast, powerful' },
  ]},
  { group: 'Gemma', models: [
    { name: 'gemma3:1b',  desc: '1B · tiny, Google' },
    { name: 'gemma3:4b',  desc: '4B · efficient, Google' },
    { name: 'gemma3:12b', desc: '12B · capable, Google' },
    { name: 'gemma3:27b', desc: '27B · best Gemma 3' },
  ]},
  { group: 'Qwen', models: [
    { name: 'qwen2.5:3b',        desc: '3B · fast, multilingual' },
    { name: 'qwen2.5:7b',        desc: '7B · multilingual' },
    { name: 'qwen2.5:14b',       desc: '14B · strong multilingual' },
    { name: 'qwen2.5:32b',       desc: '32B · top Qwen' },
    { name: 'qwen2.5-coder:7b',  desc: '7B · coding specialist' },
    { name: 'qwen2.5-coder:32b', desc: '32B · best open coder' },
  ]},
  { group: 'DeepSeek', models: [
    { name: 'deepseek-r1:1.5b', desc: '1.5B · reasoning, tiny' },
    { name: 'deepseek-r1:7b',   desc: '7B · reasoning' },
    { name: 'deepseek-r1:14b',  desc: '14B · strong reasoning' },
    { name: 'deepseek-r1:32b',  desc: '32B · very strong reasoning' },
    { name: 'deepseek-coder-v2', desc: '16B MoE · excellent coder' },
  ]},
  { group: 'Phi / Small', models: [
    { name: 'phi4-mini',    desc: '3.8B · Microsoft, punches above weight' },
    { name: 'phi4',         desc: '14B · Microsoft flagship small model' },
    { name: 'smollm2:1.7b', desc: '1.7B · HuggingFace, very fast' },
    { name: 'tinyllama',    desc: '1.1B · minimal RAM, fast' },
  ]},
  { group: 'Code', models: [
    { name: 'codellama:7b',  desc: '7B · Meta code generation' },
    { name: 'codellama:13b', desc: '13B · stronger code' },
    { name: 'starcoder2:7b', desc: '7B · BigCode, 600+ languages' },
    { name: 'codegemma:7b',  desc: '7B · Google code model' },
  ]},
  { group: 'Vision', models: [
    { name: 'llava:7b',    desc: '7B · image + text' },
    { name: 'llava:13b',   desc: '13B · better vision' },
    { name: 'moondream',   desc: '1.8B · tiny vision model' },
    { name: 'minicpm-v',   desc: '8B · strong multimodal' },
  ]},
  { group: 'Embedding', models: [
    { name: 'nomic-embed-text',        desc: '137M · text embeddings' },
    { name: 'mxbai-embed-large',       desc: '335M · high quality embeddings' },
    { name: 'all-minilm',              desc: '23M · tiny, fast embeddings' },
    { name: 'snowflake-arctic-embed',  desc: '335M · retrieval optimized' },
  ]},
]

export default function Models({ pull }: { pull: PullControls }) {
  const { pulling, pullName, setPullName, pullPct, pullStatus, pullDone, startPull, cancelPull } = pull
  const [models, setModels] = useState<OllamaModel[]>([])
  const [running, setRunning] = useState<OllamaModel[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const fetchModels = useCallback(async () => {
    try {
      const d = await fetch('/api/ollama/models').then(r => r.json())
      setModels(d.models || [])
      setRunning(d.running || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchModels()
    const t = setInterval(fetchModels, 15_000)
    return () => clearInterval(t)
  }, [fetchModels])

  useEffect(() => { if (pullDone === 'success') fetchModels() }, [pullDone, fetchModels])

  async function deleteModel(name: string) {
    setDeleting(name)
    await fetch(`/api/ollama/models/${encodeURIComponent(name)}`, { method: 'DELETE' })
    setDeleting(null); setConfirmDelete(null); fetchModels()
  }

  const runningNames = new Set(running.map(m => m.name))

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Ollama Models</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{models.length} installed · {running.length} loaded in memory</p>
        </div>
        <button onClick={fetchModels} style={{
          background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--text-2)', padding: '6px 12px', cursor: 'pointer', fontSize: 12,
        }}>Refresh</button>
      </div>

      {/* Pull panel */}
      <div className="card" style={{ padding: '16px', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Pull model</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: pulling || pullDone ? 12 : 0 }}>
          <input
            className="clean-input"
            style={{ flex: 1 }}
            placeholder="e.g. llama3.2, mistral:7b"
            value={pullName}
            onChange={e => setPullName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startPull(pullName)}
            disabled={pulling}
          />
          <button onClick={() => pulling ? cancelPull() : startPull(pullName)} style={{
            padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: pulling ? 'rgba(248,113,113,0.15)' : 'var(--accent)',
            color: pulling ? 'var(--red)' : 'white',
            fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
          }}>
            {pulling ? 'Cancel' : 'Pull'}
          </button>
        </div>

        {(pulling || pullDone) && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: pullDone === 'error' ? 'var(--red)' : pullDone === 'success' ? 'var(--green)' : 'var(--text-3)' }}>
                {pullDone === 'success' ? '✓ done' : pullDone === 'error' ? '✕ error' : pullStatus || 'connecting…'}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>{pullPct}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{
                width: `${pullPct}%`,
                background: pullDone === 'error' ? 'var(--red)' : pullDone === 'success' ? 'var(--green)' : 'var(--accent)',
              }} />
            </div>
          </div>
        )}

        {/* Popular model list */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div className="label" style={{ marginBottom: 12 }}>Popular models</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {POPULAR.map(group => (
              <div key={group.group}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 7 }}>{group.group}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {group.models.map(m => {
                    const installed = models.some(im => im.name === m.name || im.name === m.name + ':latest')
                    return (
                      <button key={m.name}
                        onClick={() => { if (!installed) { setPullName(m.name); startPull(m.name) } }}
                        disabled={pulling || installed}
                        title={m.desc}
                        style={{
                          padding: '4px 10px', borderRadius: 5, cursor: installed ? 'default' : pulling ? 'not-allowed' : 'pointer',
                          border: `1px solid ${installed ? 'rgba(74,222,128,0.25)' : 'var(--border)'}`,
                          background: installed ? 'rgba(74,222,128,0.07)' : 'transparent',
                          color: installed ? 'var(--green)' : 'var(--text-3)',
                          fontSize: 11, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap',
                          transition: 'border-color .15s, color .15s',
                        }}>
                        {installed ? '✓ ' : ''}{m.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Installed models */}
      <div className="section-header" style={{ marginBottom: 14 }}>
        <span className="section-header title">Installed</span>
        <span className="section-header rule" />
        <span className="section-header count">{models.length}</span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading…</div>
      ) : models.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No models installed. Pull one above.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {models.map(m => {
            const isRunning = runningNames.has(m.name)
            const isDeleting = deleting === m.name
            const isConfirm = confirmDelete === m.name
            const isEmbed = m.capabilities?.includes('embedding')

            return (
              <div key={m.name} className="card" style={{ padding: '14px 16px', borderColor: isRunning ? 'rgba(74,222,128,0.3)' : 'var(--border)' }}>
                {/* Name + badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{m.name}</div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    {isRunning && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: 'rgba(74,222,128,0.1)', color: 'var(--green)', fontSize: 10, fontWeight: 600 }}>
                        <span className="status-dot up" style={{ width: 5, height: 5 }} />loaded
                      </span>
                    )}
                    {isEmbed && (
                      <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(129,140,248,0.1)', color: 'var(--accent)', fontSize: 10, fontWeight: 600 }}>embed</span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 14 }}>
                  {[
                    ['Family', m.details.family],
                    ['Params', m.details.parameter_size],
                    ['Quant', m.details.quantization_level],
                    ['Format', m.details.format],
                    ['Size', fmtSize(m.size)],
                    ['Modified', timeAgo(m.modified_at)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="label">{k}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>

                {/* Delete */}
                {isConfirm ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--red)' }}>Delete?</span>
                    <button onClick={() => deleteModel(m.name)} disabled={isDeleting} style={{
                      padding: '4px 12px', borderRadius: 5, border: '1px solid rgba(248,113,113,0.3)',
                      background: 'rgba(248,113,113,0.1)', color: 'var(--red)', fontSize: 11, cursor: 'pointer',
                    }}>{isDeleting ? 'Deleting…' : 'Confirm'}</button>
                    <button onClick={() => setConfirmDelete(null)} style={{
                      padding: '4px 12px', borderRadius: 5, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text-3)', fontSize: 11, cursor: 'pointer',
                    }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(m.name)} style={{
                    padding: '4px 12px', borderRadius: 5, border: '1px solid rgba(248,113,113,0.15)',
                    background: 'transparent', color: 'var(--text-3)', fontSize: 11, cursor: 'pointer',
                    transition: 'color .15s, border-color .15s',
                  }}>Delete</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
