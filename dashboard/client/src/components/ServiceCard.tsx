import {
  Box, Shield, Globe, MessageCircle, Cpu, Play, Cloud, Image, Lock,
  Activity, HardDrive, Database, Wifi, Terminal, Server, Layers,
  Download, Film, Tv, Radio, Star, Search, ExternalLink, Gamepad2, Music, Disc,
  type LucideProps
} from 'lucide-react'
import { Service, ServiceStatus } from '../types'
import { resolveServiceUrl } from '../utils/serviceUrl'

type IconComponent = React.ComponentType<LucideProps>

const ICONS: Record<string, IconComponent> = {
  Box, Shield, Globe, MessageCircle, Cpu, Play, Cloud, Image, Lock,
  Activity, HardDrive, Database, Wifi, Terminal, Server, Layers,
  Download, Film, Tv, Radio, Star, Search, Gamepad2, Music, Disc,
}

export const CATEGORY_COLOR: Record<string, string> = {
  system:    '#7c3aed',
  network:   '#00d4ff',
  ai:        '#00ff88',
  media:     '#f59e0b',
  downloads: '#f97316',
  storage:   '#3b82f6',
  security:  '#ef4444',
  games:     '#22c55e',
  other:     '#64748b',
}

export default function ServiceCard({ service, status }: { service: Service; status?: ServiceStatus }) {
  const Icon: IconComponent = ICONS[service.icon] || Server
  const color = CATEGORY_COLOR[service.category] || '#00d4ff'
  const isUp = status?.up ?? null

  const statusColor = isUp === null ? '#64748b' : isUp ? (status!.ms > 500 ? '#ffcc00' : '#00ff88') : '#ff4444'
  const statusLabel = isUp === null ? 'checking' : isUp ? `${status!.ms}ms` : 'offline'

  return (
    <div
      onClick={() => window.open(resolveServiceUrl(service.url), '_blank')}
      className="card p-4 flex flex-col gap-3 cursor-pointer group relative overflow-hidden"
      style={{ '--cat-color': color } as React.CSSProperties}
    >
      {/* Top colored line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />

      {/* Icon + status dot */}
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon size={18} color={color} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor,
            boxShadow: isUp ? `0 0 6px ${statusColor}` : 'none' }} />
          <span className="font-mono text-xs" style={{ color: statusColor }}>{statusLabel}</span>
        </div>
      </div>

      {/* Name + port */}
      <div>
        <div className="font-semibold text-sm text-slate-100 group-hover:text-white transition-colors leading-tight">
          {service.name}
        </div>
        <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
          <span>{(() => { try { const u = new URL(service.url); return u.port || (u.protocol === 'https:' ? '443' : '80') } catch { return '–' } })()}</span>
          <ExternalLink size={9} className="opacity-0 group-hover:opacity-60 transition-opacity" />
        </div>
      </div>
    </div>
  )
}
