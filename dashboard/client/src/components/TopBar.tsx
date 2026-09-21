import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings, LayoutDashboard, Server, Bot } from 'lucide-react'

export default function TopBar() {
  const [time, setTime] = useState(new Date())
  const location = useLocation()

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <header style={{ borderBottom: '1px solid rgba(0,212,255,0.1)', background: 'rgba(10,14,26,0.9)', backdropFilter: 'blur(12px)' }}
      className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between">

      {/* Left: logo */}
      <div className="flex items-center gap-3">
        <div style={{ color: '#00d4ff' }}>
          <Server size={20} />
        </div>
        <span className="font-mono font-medium tracking-widest text-sm uppercase glow-cyan" style={{ color: '#00d4ff' }}>
          Homeserver
        </span>
      </div>

      {/* Center: nav */}
      <nav className="flex gap-1">
        <Link to="/"
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${location.pathname === '/'
            ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/20'
            : 'text-slate-400 hover:text-slate-200'}`}>
          <LayoutDashboard size={14} />
          Dashboard
        </Link>
        <Link to="/bots"
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${location.pathname === '/bots'
            ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/20'
            : 'text-slate-400 hover:text-slate-200'}`}>
          <Bot size={14} />
          Bots
        </Link>
        <Link to="/settings"
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${location.pathname === '/settings'
            ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/20'
            : 'text-slate-400 hover:text-slate-200'}`}>
          <Settings size={14} />
          Settings
        </Link>
      </nav>

      {/* Right: clock */}
      <div className="text-right">
        <div className="font-mono text-sm font-medium" style={{ color: '#00d4ff' }}>{fmt(time)}</div>
        <div className="font-mono text-xs text-slate-500">{fmtDate(time)}</div>
      </div>
    </header>
  )
}
