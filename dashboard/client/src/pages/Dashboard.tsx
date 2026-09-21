import { useEffect, useRef, useState, useCallback } from 'react'
import { RotateCcw, Square, ScrollText } from 'lucide-react'
import { Settings, StatusMap, SystemStats as Stats } from '../types'
import { PullControls } from '../App'
import LogsModal from '../components/LogsModal'
import { resolveServiceUrl } from '../utils/serviceUrl'

interface Torrent { name: string; progress: number; dlspeed: number; size: number; state: string }
interface DownloadsData { torrents: Torrent[]; dlSpeed: number }
interface PiholeData { total: number; blocked: number; pct: number; status: number; topBlocked: { domain: string; count: number }[] }
interface ArrItem { title: string; status: string; sizeleft: number; size: number; timeleft: string; type: string }
interface ArrQueue { radarr: ArrItem[]; sonarr: ArrItem[] }
interface TsPeer { name: string; ip: string; os: string; online: boolean; lastSeen: string }
interface TailscaleData { self: { name: string; ip: string; online: boolean }; peers: TsPeer[] }
interface Container { id: string; name: string; state: string; status: string }

function fmt(b: number) {
  if (b >= 1e12) return (b / 1e12).toFixed(1) + ' TB'
  if (b >= 1e9)  return (b / 1e9).toFixed(1) + ' GB'
  if (b >= 1e6)  return (b / 1e6).toFixed(1) + ' MB'
  return b + ' B'
}
function fmtSpeed(bps: number) {
  if (bps >= 1e6) return (bps / 1e6).toFixed(1) + ' MB/s'
  if (bps >= 1e3) return (bps / 1e3).toFixed(0) + ' KB/s'
  return bps + ' B/s'
}
function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const CATEGORY_ORDER = ['media','games','downloads','ai','storage','network','system','security','other']
const CATEGORY_LABEL: Record<string,string> = {
  media:'Media', games:'Games', downloads:'Downloads', ai:'AI', storage:'Storage',
  network:'Network', system:'System', security:'Security', other:'Other',
}
const CATEGORY_COLOR: Record<string,string> = {
  media:'#fb923c', games:'#22c55e', downloads:'#facc15', ai:'#4ade80', storage:'#60a5fa',
  network:'#38bdf8', system:'#a78bfa', security:'#f87171', other:'#71717a',
}

function MiniChart({ hist }: { hist: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth, h = c.clientHeight
    if (!w || !h) return
    c.width = w * dpr; c.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const max = Math.max(10, ...hist)
    ctx.beginPath()
    hist.forEach((v, i) => {
      const x = (i / (hist.length - 1)) * w
      const y = h - (v / max) * (h * 0.85) - 1
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    })
    ctx.strokeStyle = 'rgba(129,140,248,0.8)'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke()
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
    const grd = ctx.createLinearGradient(0, 0, 0, h)
    grd.addColorStop(0, 'rgba(129,140,248,0.2)'); grd.addColorStop(1, 'rgba(129,140,248,0)')
    ctx.fillStyle = grd; ctx.fill()
  }, [hist])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 8 }} />
}

function VitalCard({ label, pct, sub, chart, temp }: { label: string; pct: number; sub: string; chart?: number[]; temp?: number | null }) {
  const color = pct > 85 ? 'var(--red)' : pct > 65 ? 'var(--orange)' : 'var(--accent)'
  return (
    <div className="card" style={{ padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      {chart && <div style={{ position: 'absolute', inset: 0, opacity: .4, pointerEvents: 'none' }}><MiniChart hist={chart} /></div>}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span className="label">{label}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {temp != null && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: temp > 80 ? 'var(--red)' : 'var(--text-3)' }}>{temp}°C</span>}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color }}>{pct}%</span>
          </div>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.min(100,pct)}%`, background: color }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{sub}</div>
      </div>
    </div>
  )
}

function UptimeCard({ uptime }: { uptime: number }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <span className="label">Uptime</span>
      <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{fmtUptime(uptime)}</div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>since last boot</div>
    </div>
  )
}

function ServiceCard({
  name, url, accent, status, containerName, manage,
  onLogs, onRestart, onStop, onManage, restarting,
}: {
  name: string; url: string; accent: string
  status?: { up: boolean; ms: number }
  containerName?: string
  manage?: 'mc'
  onLogs?: () => void; onRestart?: () => void; onStop?: () => void; onManage?: () => void; restarting?: boolean
}) {
  let port = ''
  try { const u = new URL(url); port = u.port || (u.protocol === 'https:' ? '443' : '80') } catch {}
  const isUp = status?.up ?? null
  const dotClass = isUp === null ? 'unknown' : isUp ? 'up' : 'down'
  const latency = status ? (isUp ? `${status.ms}ms` : 'offline') : '—'
  const latencyColor = isUp === null ? 'var(--text-3)' : isUp ? 'var(--green)' : 'var(--red)'
  const handleOpen = () => { if (manage && onManage) onManage(); else window.open(resolveServiceUrl(url), '_blank') }

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10, cursor: 'pointer' }}
        onClick={handleOpen}>
        <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: `${accent}18`, border: `1px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: accent }}>
          {name[0].toUpperCase()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: latencyColor }}>{latency}</span>
          <span className={`status-dot ${dotClass}`} />
        </div>
      </div>
      <div style={{ cursor: 'pointer' }} onClick={handleOpen}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{name}</div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: 2 }}>{manage === 'mc' ? 'manage server' : `:${port}`}</div>
      </div>
      {containerName && (
        <div style={{ display: 'flex', gap: 4, marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <button onClick={onLogs} title="Logs" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '4px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-3)', cursor: 'pointer', fontSize: 10 }}>
            <ScrollText size={11} /> Logs
          </button>
          <button onClick={onRestart} disabled={restarting} title="Restart" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '4px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: restarting ? 'var(--text-3)' : 'var(--orange)', cursor: 'pointer', fontSize: 10 }}>
            <RotateCcw size={11} /> {restarting ? '…' : 'Restart'}
          </button>
          <button onClick={onStop} title="Stop" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '4px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--red)', cursor: 'pointer', fontSize: 10 }}>
            <Square size={11} /> Stop
          </button>
        </div>
      )}
    </div>
  )
}

function PiholePanel({ data }: { data: PiholeData | null }) {
  if (!data) return null
  return (
    <div className="card" style={{ padding: '14px 16px', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="label">Pi-hole</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: 'rgba(74,222,128,0.1)', color: 'var(--green)' }}>active</span>
        </div>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>
          {(data.pct ?? 0).toFixed(1)}% blocked
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: data.topBlocked.length ? 10 : 0 }}>
        {[
          ['Queries', data.total.toLocaleString()],
          ['Blocked', data.blocked.toLocaleString()],
          ['Lists', data.status.toLocaleString()],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="label">{k}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)', marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>
      {data.topBlocked.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <div className="label" style={{ marginBottom: 6 }}>Top blocked</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.topBlocked.map((d: any) => (
              <div key={d.domain} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{d.domain}</span>
                <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ArrPanel({ data }: { data: ArrQueue | null }) {
  if (!data) return null
  const all = [...data.radarr.map(i => ({ ...i, src: 'Radarr' })), ...data.sonarr.map(i => ({ ...i, src: 'Sonarr' }))]
  if (!all.length) return null
  return (
    <div className="card" style={{ padding: '14px 16px', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="label">Arr Queue</span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>{all.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {all.slice(0, 5).map((item, i) => {
          const pct = item.size > 0 ? Math.round(((item.size - item.sizeleft) / item.size) * 100) : 0
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{item.title}</span>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{item.src}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{pct}%</span>
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%`, background: '#60a5fa' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TailscalePanel({ data }: { data: TailscaleData | null }) {
  if (!data) return null
  const self = data.self
  return (
    <div className="card" style={{ padding: '14px 16px', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="label">Tailscale</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {self && (
          <div key="self" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`status-dot ${self.online ? 'up' : 'down'}`} />
            <span style={{ fontSize: 12, color: self.online ? 'var(--text)' : 'var(--text-3)', flex: 1, fontWeight: 600 }}>{self.name || 'homelab'} (this device)</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{self.online ? 'up' : 'down'}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{self.ip ?? '—'}</span>
          </div>
        )}
        {(data.peers ?? []).map(p => (
          <div key={p.ip} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`status-dot ${p.online ? 'up' : 'down'}`} />
            <span style={{ fontSize: 12, color: p.online ? 'var(--text)' : 'var(--text-3)', flex: 1 }}>{p.name}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{p.os}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{p.ip}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard({ pull, onManageMc }: { pull: PullControls; onManageMc?: (id: string, name: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus]     = useState<StatusMap>({})
  const [stats, setStats]       = useState<Stats | null>(null)
  const [downloads, setDownloads] = useState<DownloadsData | null>(null)
  const [cpuHist, setCpuHist]   = useState<number[]>(Array(48).fill(2))
  const [cpuTemp, setCpuTemp]   = useState<number | null>(null)
  const [pihole, setPihole]     = useState<PiholeData | null>(null)
  const [arrQueue, setArrQueue] = useState<ArrQueue | null>(null)
  const [tailscale, setTailscale] = useState<TailscaleData | null>(null)
  const [containers, setContainers] = useState<Container[]>([])
  const [restarting, setRestarting] = useState<string | null>(null)
  const [logsTarget, setLogsTarget] = useState<{ name: string; container: string } | null>(null)

  const fetchAll = useCallback(async () => {
    const [s, st, dl, ph, arr, ts, ct] = await Promise.all([
      fetch('/api/settings').then(r => r.json()).catch(() => null),
      fetch('/api/status').then(r => r.json()).catch(() => ({})),
      fetch('/api/downloads').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/pihole').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/arr/queue').then(r => r.json()).catch(() => null),
      fetch('/api/tailscale').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/docker/containers').then(r => r.ok ? r.json() : []).catch(() => []),
    ])
    if (s) setSettings(s)
    setStatus(st); setDownloads(dl); setPihole(ph); setArrQueue(arr); setTailscale(ts)
    if (Array.isArray(ct)) setContainers(ct)
  }, [])

  const fetchStats = useCallback(async () => {
    const [s, t] = await Promise.all([
      fetch('/api/system').then(r => r.json()).catch(() => null),
      fetch('/api/temp').then(r => r.json()).catch(() => null),
    ])
    if (s) { setStats(s); setCpuHist(prev => [...prev.slice(1), s.cpu]) }
    if (t) setCpuTemp(t.cpu)
  }, [])

  useEffect(() => {
    fetchAll(); fetchStats()
    const t1 = setInterval(fetchAll, 15_000)
    const t2 = setInterval(fetchStats, 10_000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [fetchAll, fetchStats])

  async function restartContainer(containerName: string) {
    setRestarting(containerName)
    await fetch(`/api/docker/${encodeURIComponent(containerName)}/restart`, { method: 'POST' }).catch(() => {})
    setRestarting(null)
    setTimeout(fetchAll, 2000)
  }
  async function stopContainer(containerName: string) {
    if (!confirm(`Stop ${containerName}?`)) return
    await fetch(`/api/docker/${encodeURIComponent(containerName)}/stop`, { method: 'POST' }).catch(() => {})
    setTimeout(fetchAll, 2000)
  }

  const containerMap = new Map(containers.map(c => [c.name, c]))
  const visible = settings?.services.filter(s => s.visible) ?? []
  const activeTorrents = downloads?.torrents.filter(t => t.state !== 'stalledUP' && t.state !== 'uploading') ?? []
  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, services: visible.filter(s => s.category === cat) }))
    .filter(g => g.services.length > 0)
  const totalOnline = visible.filter(s => status[s.id]?.up).length

  return (
    <div>
      {/* Vitals */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats ? <>
          <VitalCard label="CPU" pct={stats.cpu} sub="i7-11800H" chart={cpuHist} temp={cpuTemp} />
          <VitalCard label="RAM" pct={stats.ram.percent} sub={`${fmt(stats.ram.used)} / ${fmt(stats.ram.total)}`} />
          {stats.disk.root && <VitalCard label="SSD" pct={stats.disk.root.percent} sub={`${fmt(stats.disk.root.used)} / ${fmt(stats.disk.root.size)}`} />}
          {stats.disk.data && <VitalCard label="Data" pct={stats.disk.data.percent} sub={`${fmt(stats.disk.data.used)} / ${fmt(stats.disk.data.size)}`} />}
          <UptimeCard uptime={stats.uptime} />
        </> : [...Array(5)].map((_, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', opacity: .4 }}>
            <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 12 }} />
            <div className="progress-track"><div className="progress-fill" style={{ width: '30%', background: 'var(--accent)' }} /></div>
          </div>
        ))}
      </div>

      {/* Pi-hole */}
      <PiholePanel data={pihole} />

      {/* Active downloads + Arr queue */}
      {activeTorrents.length > 0 && (
        <div className="card" style={{ marginTop: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="label">Torrents</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: 'rgba(251,146,60,0.12)', color: 'var(--orange)' }}>{activeTorrents.length}</span>
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--orange)' }}>{fmtSpeed(downloads?.dlSpeed ?? 0)}</span>
          </div>
          {activeTorrents.slice(0, 1).map((t, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>{t.name}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', flexShrink: 0 }}>{t.progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${t.progress}%`, background: 'var(--orange)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)', animation: 'flow 1.8s linear infinite' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ArrPanel data={arrQueue} />

      {/* Model pull */}
      {(pull.pulling || pull.pullDone) && (
        <div className="card" style={{ marginTop: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="label">Model Pull</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99, background: 'rgba(74,222,128,0.1)', color: 'var(--green)' }}>Ollama</span>
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: pull.pullDone === 'error' ? 'var(--red)' : 'var(--green)' }}>
              {pull.pullDone === 'success' ? '✓ done' : pull.pullDone === 'error' ? '✕ error' : `${pull.pullPct}%`}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{pull.pullName}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{pull.pullStatus}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pull.pullPct}%`, background: pull.pullDone === 'error' ? 'var(--red)' : 'var(--green)' }} />
          </div>
        </div>
      )}

      {/* Tailscale */}
      <TailscalePanel data={tailscale} />

      {/* Services */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Services</h2>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{totalOnline} / {visible.length} online</span>
        </div>

        {grouped.map(({ cat, services }) => {
          const accent = CATEGORY_COLOR[cat] || '#71717a'
          return (
            <div key={cat} style={{ marginBottom: 24 }}>
              <div className="section-header">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                <span className="section-header title">{CATEGORY_LABEL[cat] || cat}</span>
                <span className="section-header rule" />
                <span className="section-header count">{services.length}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {services.map(svc => {
                  const cname = svc.container ?? svc.id
                  const container = containerMap.get(cname)
                  return (
                    <ServiceCard
                      key={svc.id}
                      name={svc.name}
                      url={svc.url}
                      accent={accent}
                      status={status[svc.id]}
                      containerName={container ? cname : undefined}
                      manage={svc.manage}
                      restarting={restarting === cname}
                      onLogs={() => setLogsTarget({ name: svc.name, container: cname })}
                      onRestart={() => restartContainer(cname)}
                      onStop={() => stopContainer(cname)}
                      onManage={svc.manage === 'mc' ? () => onManageMc?.(cname, svc.name) : undefined}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {logsTarget && (
        <LogsModal
          serviceName={logsTarget.name}
          containerName={logsTarget.container}
          onClose={() => setLogsTarget(null)}
        />
      )}
    </div>
  )
}
