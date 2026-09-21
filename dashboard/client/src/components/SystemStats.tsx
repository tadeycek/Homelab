import { SystemStats as Stats } from '../types'

function fmt(bytes: number) {
  if (bytes >= 1e12) return (bytes / 1e12).toFixed(1) + ' TB'
  if (bytes >= 1e9)  return (bytes / 1e9).toFixed(1)  + ' GB'
  if (bytes >= 1e6)  return (bytes / 1e6).toFixed(1)  + ' MB'
  return bytes + ' B'
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function StatBar({ label, percent, value }: { label: string; percent: number; value: string }) {
  const color = percent > 85 ? '#ff4444' : percent > 65 ? '#ffcc00' : '#00d4ff'
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="font-mono text-xs" style={{ color }}>{percent}%</span>
      </div>
      <div className="stat-bar">
        <div className="stat-bar-fill" style={{ width: `${percent}%`, background: color }} />
      </div>
      <div className="font-mono text-xs text-slate-500 mt-1">{value}</div>
    </div>
  )
}

export default function SystemStats({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="card p-4 mb-6 flex gap-6 animate-pulse">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex-1 h-12 rounded bg-white/5" />
        ))}
      </div>
    )
  }

  return (
    <div className="card p-4 mb-6">
      <div className="flex gap-6 items-start flex-wrap">
        <StatBar label="CPU" percent={stats.cpu} value={`${stats.cpu}% load`} />

        <StatBar label="RAM"
          percent={stats.ram.percent}
          value={`${fmt(stats.ram.used)} / ${fmt(stats.ram.total)}`} />

        {stats.disk.root && (
          <StatBar label="SSD (/)"
            percent={stats.disk.root.percent}
            value={`${fmt(stats.disk.root.used)} / ${fmt(stats.disk.root.size)}`} />
        )}

        {stats.disk.data && (
          <StatBar label="Data (/mnt/data)"
            percent={stats.disk.data.percent}
            value={`${fmt(stats.disk.data.used)} / ${fmt(stats.disk.data.size)}`} />
        )}

        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Uptime</div>
          <div className="font-mono text-sm" style={{ color: '#00d4ff' }}>{fmtUptime(stats.uptime)}</div>
          <div className="font-mono text-xs text-slate-500 mt-1">since last boot</div>
        </div>
      </div>
    </div>
  )
}
