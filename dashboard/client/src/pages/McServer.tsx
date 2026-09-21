import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, RotateCcw, Square, Send, UserPlus, UserMinus, Save, ScrollText } from 'lucide-react'

interface McInfo {
  motd: string
  difficulty: string
  pvp: boolean
  maxPlayers: string
  viewDistance: string
  whitelist: boolean
  gamemode: string
  hardcore: boolean
  forceGamemode: boolean
  allowFlight: boolean
  spawnProtection: string
  spawnMonsters: boolean
  spawnAnimals: boolean
  spawnNpcs: boolean
  allowNether: boolean
  generateStructures: boolean
  maxWorldSize: string
  playerIdleTimeout: string
  opPermissionLevel: string
  enableCommandBlock: boolean
}
interface WhitelistEntry { uuid: string; name: string }
interface Gamerules { booleans: string[]; numerics: string[]; values: Record<string, string | null> }

const DIFFICULTIES = [
  { v: '0', label: 'Peaceful' }, { v: '1', label: 'Easy' }, { v: '2', label: 'Normal' }, { v: '3', label: 'Hard' },
]
const GAMEMODES = [
  { v: '0', label: 'Survival' }, { v: '1', label: 'Creative' }, { v: '2', label: 'Adventure' }, { v: '3', label: 'Spectator' },
]

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-ui)',
}
const btn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px',
  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12,
}
const fieldLabel: React.CSSProperties = { fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }
const subHeader: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '14px 0 8px' }

const GAMERULE_LABEL: Record<string, string> = {
  keepInventory: 'Keep Inventory', doDaylightCycle: 'Daylight Cycle', doWeatherCycle: 'Weather Cycle',
  doMobSpawning: 'Mob Spawning', mobGriefing: 'Mob Griefing', doFireTick: 'Fire Spread',
  naturalRegeneration: 'Natural Regen', doMobLoot: 'Mob Loot', doTileDrops: 'Block Drops',
  commandBlockOutput: 'Command Block Output', announceAdvancements: 'Announce Advancements',
  showDeathMessages: 'Death Messages', doEntityDrops: 'Entity Drops', reducedDebugInfo: 'Reduced Debug Info',
  sendCommandFeedback: 'Command Feedback', logAdminCommands: 'Log Admin Commands',
  spectatorsGenerateChunks: 'Spectators Generate Chunks',
  randomTickSpeed: 'Random Tick Speed', maxEntityCramming: 'Max Entity Cramming',
  maxCommandChainLength: 'Max Command Chain', spawnRadius: 'Spawn Radius',
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /> {label}
    </label>
  )
}

export default function McServer({ id, name, onBack }: { id: string; name: string; onBack: () => void }) {
  const [form, setForm] = useState<McInfo | null>(null)
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([])
  const [newPlayer, setNewPlayer] = useState('')
  const [logLines, setLogLines] = useState<string[]>([])
  const [command, setCommand] = useState('')
  const [commandLog, setCommandLog] = useState<{ cmd: string; out: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [containerState, setContainerState] = useState<{ status: string; state: string } | null>(null)
  const [gamerules, setGamerules] = useState<Gamerules | null>(null)
  const [rulesSaving, setRulesSaving] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchInfo = useCallback(async () => {
    const d = await fetch(`/api/mc/${id}/info`).then(r => r.json()).catch(() => null)
    if (d && !d.error) setForm(d)
  }, [id])

  const fetchWhitelist = useCallback(async () => {
    const d = await fetch(`/api/mc/${id}/whitelist`).then(r => r.json()).catch(() => [])
    if (Array.isArray(d)) setWhitelist(d)
  }, [id])

  const fetchGamerules = useCallback(async () => {
    const d = await fetch(`/api/mc/${id}/gamerules`).then(r => r.json()).catch(() => null)
    if (d && !d.error) setGamerules(d)
  }, [id])

  const fetchLogs = useCallback(async () => {
    const d = await fetch(`/api/docker/${id}/logs?tail=200`).then(r => r.json()).catch(() => null)
    if (d?.lines) { setLogLines(d.lines); setTimeout(() => bottomRef.current?.scrollIntoView(), 30) }
  }, [id])

  const fetchContainer = useCallback(async () => {
    const list = await fetch('/api/docker/containers').then(r => r.json()).catch(() => [])
    const c = Array.isArray(list) ? list.find((x: any) => x.name === id) : null
    setContainerState(c ? { status: c.status, state: c.state } : null)
  }, [id])

  useEffect(() => {
    fetchInfo(); fetchWhitelist(); fetchGamerules(); fetchLogs(); fetchContainer()
    const t1 = setInterval(fetchLogs, 5000)
    const t2 = setInterval(fetchContainer, 8000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [fetchInfo, fetchWhitelist, fetchGamerules, fetchLogs, fetchContainer])

  async function saveSettings() {
    if (!form) return
    setSaving(true); setSaveMsg('')
    try {
      await fetch(`/api/mc/${id}/settings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      setSaveMsg('Saved. Some changes need a server restart to fully apply.')
      fetchInfo()
    } catch { setSaveMsg('Failed to save.') }
    setSaving(false)
  }

  async function setGamerule(rule: string, value: string) {
    setRulesSaving(rule)
    await fetch(`/api/mc/${id}/gamerules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rule, value }),
    }).catch(() => {})
    setGamerules(prev => prev ? { ...prev, values: { ...prev.values, [rule]: value } } : prev)
    setRulesSaving(null)
  }

  async function sendCommand(cmd?: string) {
    const toSend = cmd ?? command
    if (!toSend.trim()) return
    setCommand('')
    const d = await fetch(`/api/mc/${id}/command`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: toSend }),
    }).then(r => r.json()).catch(() => ({ output: 'request failed' }))
    setCommandLog(prev => [...prev.slice(-49), { cmd: toSend, out: d.output ?? d.error ?? '' }])
  }

  async function addToWhitelist() {
    if (!newPlayer.trim()) return
    await fetch(`/api/mc/${id}/whitelist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newPlayer.trim(), action: 'add' }),
    }).catch(() => {})
    setNewPlayer('')
    setTimeout(fetchWhitelist, 500)
  }
  async function removeFromWhitelist(username: string) {
    await fetch(`/api/mc/${id}/whitelist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, action: 'remove' }),
    }).catch(() => {})
    setTimeout(fetchWhitelist, 500)
  }

  async function restart() {
    await fetch(`/api/docker/${id}/restart`, { method: 'POST' }).catch(() => {})
    setTimeout(fetchContainer, 2000)
  }
  async function stop() {
    if (!confirm(`Stop ${name}?`)) return
    await fetch(`/api/docker/${id}/stop`, { method: 'POST' }).catch(() => {})
    setTimeout(fetchContainer, 2000)
  }

  const isUp = containerState?.state === 'running'
  const set = (patch: Partial<McInfo>) => setForm(f => f ? { ...f, ...patch } : f)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ ...btn, padding: '7px 10px' }}><ArrowLeft size={14} /> Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{name}</h2>
        <span className={`status-dot ${isUp ? 'up' : 'down'}`} />
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{containerState?.status ?? '—'}</span>
        <button onClick={restart} style={{ ...btn, color: 'var(--orange)' }}><RotateCcw size={13} /> Restart</button>
        <button onClick={stop} style={{ ...btn, color: 'var(--red)' }}><Square size={13} /> Stop</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Settings */}
        <div className="card" style={{ padding: '16px' }}>
          <div className="label">Settings</div>
          {form ? (
            <div>
              <div style={subHeader}>General</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={fieldLabel}>MOTD</label>
                  <input style={input} value={form.motd} onChange={e => set({ motd: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={fieldLabel}>Difficulty</label>
                    <select style={input} value={form.difficulty} onChange={e => set({ difficulty: e.target.value })}>
                      {DIFFICULTIES.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabel}>Max Players</label>
                    <input style={input} type="number" value={form.maxPlayers} onChange={e => set({ maxPlayers: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={fieldLabel}>View Distance</label>
                    <input style={input} type="number" value={form.viewDistance} onChange={e => set({ viewDistance: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Player Idle Timeout (min)</label>
                    <input style={input} type="number" value={form.playerIdleTimeout} onChange={e => set({ playerIdleTimeout: e.target.value })} />
                  </div>
                </div>
                <Toggle label="PvP enabled" checked={form.pvp} onChange={v => set({ pvp: v })} />
              </div>

              <div style={subHeader}>Game Mode</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={fieldLabel}>Default Game Mode</label>
                    <select style={input} value={form.gamemode} onChange={e => set({ gamemode: e.target.value })}>
                      {GAMEMODES.map(g => <option key={g.v} value={g.v}>{g.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={fieldLabel}>Op Permission Level</label>
                    <select style={input} value={form.opPermissionLevel} onChange={e => set({ opPermissionLevel: e.target.value })}>
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <Toggle label="Hardcore" checked={form.hardcore} onChange={v => set({ hardcore: v })} />
                  <Toggle label="Force Game Mode" checked={form.forceGamemode} onChange={v => set({ forceGamemode: v })} />
                  <Toggle label="Allow Flight" checked={form.allowFlight} onChange={v => set({ allowFlight: v })} />
                  <Toggle label="Enable Command Blocks" checked={form.enableCommandBlock} onChange={v => set({ enableCommandBlock: v })} />
                </div>
              </div>

              <div style={subHeader}>World & Spawning</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={fieldLabel}>Spawn Protection Radius</label>
                    <input style={input} type="number" value={form.spawnProtection} onChange={e => set({ spawnProtection: e.target.value })} />
                  </div>
                  <div>
                    <label style={fieldLabel}>Max World Size</label>
                    <input style={input} type="number" value={form.maxWorldSize} onChange={e => set({ maxWorldSize: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <Toggle label="Spawn Monsters" checked={form.spawnMonsters} onChange={v => set({ spawnMonsters: v })} />
                  <Toggle label="Spawn Animals" checked={form.spawnAnimals} onChange={v => set({ spawnAnimals: v })} />
                  <Toggle label="Spawn NPCs (villagers)" checked={form.spawnNpcs} onChange={v => set({ spawnNpcs: v })} />
                  <Toggle label="Allow Nether" checked={form.allowNether} onChange={v => set({ allowNether: v })} />
                  <Toggle label="Generate Structures" checked={form.generateStructures} onChange={v => set({ generateStructures: v })} />
                </div>
              </div>

              <div style={subHeader}>Access</div>
              <Toggle label="Whitelist enabled" checked={form.whitelist} onChange={v => set({ whitelist: v })} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                <button onClick={saveSettings} disabled={saving} style={{ ...btn, color: 'var(--green)', borderColor: 'var(--green)' }}>
                  <Save size={13} /> {saving ? 'Saving…' : 'Save Settings'}
                </button>
                {saveMsg && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{saveMsg}</span>}
              </div>
            </div>
          ) : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Whitelist */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="label" style={{ marginBottom: 12 }}>Whitelist ({whitelist.length})</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input style={input} placeholder="Minecraft username" value={newPlayer}
                onChange={e => setNewPlayer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addToWhitelist()} />
              <button onClick={addToWhitelist} style={{ ...btn, color: 'var(--green)' }}><UserPlus size={13} /> Add</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
              {whitelist.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No whitelisted players.</span>}
              {whitelist.map(p => (
                <div key={p.uuid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{p.name}</span>
                  <button onClick={() => removeFromWhitelist(p.name)} title="Remove" style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', display: 'flex' }}>
                    <UserMinus size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Game Rules */}
          <div className="card" style={{ padding: '16px' }}>
            <div className="label" style={{ marginBottom: 4 }}>Game Rules</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>Applied instantly, no restart needed.</div>
            {gamerules ? (
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {gamerules.booleans.map(rule => (
                    <label key={rule} style={{ fontSize: 12, color: rulesSaving === rule ? 'var(--text-3)' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={gamerules.values[rule] === 'true'}
                        onChange={e => setGamerule(rule, String(e.target.checked))}
                      />
                      {GAMERULE_LABEL[rule] ?? rule}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {gamerules.numerics.map(rule => (
                    <div key={rule}>
                      <label style={fieldLabel}>{GAMERULE_LABEL[rule] ?? rule}</label>
                      <input
                        style={input}
                        type="number"
                        defaultValue={gamerules.values[rule] ?? ''}
                        onBlur={e => e.target.value !== '' && setGamerule(rule, e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading…</span>}
          </div>
        </div>
      </div>

      {/* Console */}
      <div className="card" style={{ padding: '16px', marginTop: 12 }}>
        <div className="label" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><ScrollText size={13} /> Console</div>
        <div style={{ background: '#0a0a0c', borderRadius: 6, padding: '10px 12px', height: 220, overflowY: 'auto', marginBottom: 10 }}>
          <pre style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#c8d3d5', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {logLines.join('\n')}
          </pre>
          {commandLog.map((c, i) => (
            <div key={i} style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <div style={{ color: 'var(--accent)' }}>&gt; {c.cmd}</div>
              {c.out && <div style={{ color: '#c8d3d5', whiteSpace: 'pre-wrap' }}>{c.out}</div>}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={input} placeholder="Type a command to run on the server (e.g. say hello, list, time set day)"
            value={command} onChange={e => setCommand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendCommand()} />
          <button onClick={() => sendCommand()} style={{ ...btn, color: 'var(--accent)' }}><Send size={13} /> Send</button>
        </div>
      </div>
    </div>
  )
}
