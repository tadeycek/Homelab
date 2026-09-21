import { useEffect, useRef, useState } from 'react'
import { X, RefreshCw } from 'lucide-react'

interface Props {
  containerName: string
  serviceName: string
  onClose: () => void
}

export default function LogsModal({ containerName, serviceName, onClose }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchLogs = async () => {
    setLoading(true); setError(null)
    try {
      const d = await fetch(`/api/docker/${encodeURIComponent(containerName)}/logs?tail=150`).then(r => r.json())
      if (d.error) { setError(d.error); return }
      setLines(d.lines ?? [])
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchLogs() }, [containerName])

  useEffect(() => {
    const t = setInterval(fetchLogs, 8_000)
    return () => clearInterval(t)
  }, [containerName])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0 0' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 900, height: '70vh', background: 'var(--card)', border: '1px solid var(--border)', borderBottom: 'none', borderRadius: '10px 10px 0 0', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{serviceName}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{containerName}</span>
            {loading && <span className="spinner" />}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fetchLogs} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={14} />
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Log output */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', background: '#0a0a0c' }}>
          {error ? (
            <div style={{ color: 'var(--red)', fontSize: 12 }}>Error: {error}</div>
          ) : lines.length === 0 && !loading ? (
            <div style={{ color: 'var(--text-3)', fontSize: 12 }}>No logs.</div>
          ) : (
            <pre style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#c8d3d5', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {lines.join('\n')}
            </pre>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
