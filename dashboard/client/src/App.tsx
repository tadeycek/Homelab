import { useEffect, useRef, useState, useCallback } from 'react'
import { LayoutDashboard, Bot, Cpu, Settings as SettingsIcon, Scissors } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Bots from './pages/Bots'
import Settings from './pages/Settings'
import Models from './pages/Models'
import Clips from './pages/Clips'
import McServer from './pages/McServer'

type Screen = 'dashboard' | 'bots' | 'models' | 'settings' | 'clips'

export interface PullState {
  pulling: boolean
  pullName: string
  pullPct: number
  pullStatus: string
  pullDone: 'success' | 'error' | null
}

export interface PullControls extends PullState {
  startPull: (name: string) => void
  cancelPull: () => void
  setPullName: (n: string) => void
}

const NAV = [
  { id: 'dashboard' as Screen, label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'bots'      as Screen, label: 'Bots',      Icon: Bot              },
  { id: 'models'    as Screen, label: 'Models',    Icon: Cpu              },
  { id: 'clips'     as Screen, label: 'Clips',     Icon: Scissors         },
  { id: 'settings'  as Screen, label: 'Settings',  Icon: SettingsIcon     },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [mcServer, setMcServer] = useState<{ id: string; name: string } | null>(null)
  const [now, setNow] = useState(new Date())
  const [battery, setBattery] = useState<{ charging: boolean | null; percent: number | null }>({ charging: null, percent: null })

  const [pullName, setPullName] = useState('')
  const [pulling, setPulling] = useState(false)
  const [pullPct, setPullPct] = useState(0)
  const [pullStatus, setPullStatus] = useState('')
  const [pullDone, setPullDone] = useState<'success' | 'error' | null>(null)
  const abortRef = useRef<(() => void) | null>(null)

  const startPull = useCallback(async (name: string) => {
    if (pulling) return
    const target = name.trim()
    if (!target) return
    setPullName(target); setPulling(true); setPullDone(null)
    setPullStatus('connecting…'); setPullPct(0)

    let aborted = false
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    abortRef.current = () => { aborted = true; reader?.cancel() }

    try {
      const res = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: target }),
      })
      reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done || aborted) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n\n')
        buf = lines.pop() ?? ''
        for (const chunk of lines) {
          const raw = chunk.replace(/^data: /, '').trim()
          if (!raw) continue
          try {
            const msg = JSON.parse(raw)
            setPullStatus(msg.status || '')
            if (msg.total && msg.completed) setPullPct(Math.round((msg.completed / msg.total) * 100))
            if (msg.status === 'success') { setPullDone('success'); setPullPct(100) }
            if (msg.status === 'error') setPullDone('error')
          } catch {}
        }
      }
    } catch { if (!aborted) setPullDone('error') }

    setPulling(false)
    if (!aborted) setTimeout(() => { setPullDone(null); setPullStatus(''); setPullPct(0) }, 4000)
  }, [pulling])

  const cancelPull = useCallback(() => { abortRef.current?.(); setPulling(false) }, [])
  const pullControls: PullControls = { pulling, pullName, pullPct, pullStatus, pullDone, startPull, cancelPull, setPullName }

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000)
    const fetchBattery = () => fetch('/api/battery').then(r => r.json()).then(setBattery).catch(() => {})
    fetchBattery()
    const battTick = setInterval(fetchBattery, 30_000)
    return () => { clearInterval(tick); clearInterval(battTick) }
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: 'var(--bg)', fontFamily: 'var(--font-ui)' }}>
      <div style={{ minHeight: '100%', maxWidth: 1440, margin: '0 auto', padding: '0 16px 80px' }}>

        {/* Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 0',
          background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
          // needed so the absolutely-positioned nav centers relative to the header
          isolation: 'isolate',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'var(--accent)', display: 'grid',
              gridTemplateColumns: '1fr 1fr', gap: 3, padding: 6,
            }}>
              {[.9, .35, .35, .9].map((o, i) => (
                <div key={i} style={{ background: `rgba(255,255,255,${o})`, borderRadius: 1 }} />
              ))}
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-.01em' }}>homeserver</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
              background: 'rgba(74,222,128,0.1)', color: 'var(--green)', letterSpacing: '.04em',
            }}>online</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex" style={{ gap: 2, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            {NAV.map(({ id, label }) => (
              <button key={id} className={`nav-btn${screen === id ? ' active' : ''}`} onClick={() => setScreen(id)}>
                {label}
              </button>
            ))}
          </nav>

          {/* Battery + Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {battery.percent !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ position: 'relative', width: 22, height: 11, border: '1px solid', borderColor: battery.percent < 20 ? 'var(--red)' : 'var(--text-3)', borderRadius: 2 }}>
                  <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 3, height: 5, background: 'var(--text-3)', borderRadius: '0 1px 1px 0' }} />
                  <div style={{ position: 'absolute', inset: 2, right: 2, borderRadius: 1, background: battery.percent < 20 ? 'var(--red)' : battery.charging ? 'var(--green)' : 'var(--text-2)', width: `calc(${battery.percent}% - 4px)`, transition: 'width .5s' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: battery.percent < 20 ? 'var(--red)' : battery.charging ? 'var(--green)' : 'var(--text-3)' }}>
                  {battery.charging ? '⚡' : ''}{battery.percent}%
                </span>
              </div>
            )}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-3)' }}>
              {timeStr}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div style={{ paddingTop: 20 }}>
          {mcServer ? (
            <McServer id={mcServer.id} name={mcServer.name} onBack={() => setMcServer(null)} />
          ) : <>
            {screen === 'dashboard' && <Dashboard pull={pullControls} onManageMc={(id, name) => setMcServer({ id, name })} />}
            {screen === 'bots'      && <Bots />}
            {screen === 'models'    && <Models pull={pullControls} />}
            {screen === 'clips'     && <Clips />}
            {screen === 'settings'  && <Settings />}
          </>}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="flex md:hidden" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: 'rgba(17,17,19,0.96)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
      }}>
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} className={`mobile-nav-btn${screen === id ? ' active' : ''}`} onClick={() => setScreen(id)}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
