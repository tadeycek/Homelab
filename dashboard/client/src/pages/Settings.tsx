import { useEffect, useState } from 'react'
import { Settings, Service } from '../types'

const ICON_OPTIONS = [
  'Box','Shield','Globe','MessageCircle','Cpu','Play','Cloud','Image',
  'Lock','Activity','HardDrive','Database','Wifi','Terminal','Server','Layers',
  'Download','Film','Tv','Radio','Star','Search','BarChart2','TrendingUp',
]
const CATEGORIES = ['system','network','ai','media','downloads','storage','security','other']

const DEFAULTS: Service[] = [
  { id: 'portainer',   name: 'Portainer',           url: 'http://100.111.111.111:9000',       icon: 'Box',           visible: true, category: 'system'    },
  { id: 'uptimekuma',  name: 'Uptime Kuma',         url: 'http://100.111.111.111:3001',       icon: 'Activity',      visible: true, category: 'system'    },
  { id: 'ssh',         name: 'SSH',                 url: 'ssh://100.111.111.111',             icon: 'Terminal',      visible: true, category: 'system'    },
  { id: 'grafana',     name: 'Grafana',             url: 'http://100.111.111.111:3002',       icon: 'BarChart2',     visible: true, category: 'system'    },
  { id: 'prometheus',  name: 'Prometheus',          url: 'http://100.111.111.111:9090',       icon: 'TrendingUp',    visible: true, category: 'system'    },
  { id: 'pihole',      name: 'Pi-hole',             url: 'http://100.111.111.111:8080/admin', icon: 'Shield',        visible: true, category: 'network'   },
  { id: 'nginx',       name: 'Nginx Proxy Manager', url: 'http://100.111.111.111:81',         icon: 'Globe',         visible: true, category: 'network'   },
  { id: 'jellyfin',    name: 'Jellyfin',            url: 'http://100.111.111.111:8096',       icon: 'Play',          visible: true, category: 'media'     },
  { id: 'jellyseerr',  name: 'Jellyseerr',          url: 'http://100.111.111.111:5055',       icon: 'Star',          visible: true, category: 'media'     },
  { id: 'immich',      name: 'Immich',              url: 'http://100.111.111.111:2283',       icon: 'Image',         visible: true, category: 'media'     },
  { id: 'radarr',      name: 'Radarr',              url: 'http://100.111.111.111:7878',       icon: 'Film',          visible: true, category: 'downloads' },
  { id: 'sonarr',      name: 'Sonarr',              url: 'http://100.111.111.111:8989',       icon: 'Tv',            visible: true, category: 'downloads' },
  { id: 'prowlarr',    name: 'Prowlarr',            url: 'http://100.111.111.111:9696',       icon: 'Radio',         visible: true, category: 'downloads' },
  { id: 'qbittorrent', name: 'qBittorrent',         url: 'http://100.111.111.111:8082',       icon: 'Download',      visible: true, category: 'downloads' },
  { id: 'nextcloud',   name: 'Nextcloud',           url: 'http://100.111.111.111:8081',       icon: 'Cloud',         visible: true, category: 'storage'   },
  { id: 'openwebui',   name: 'Open WebUI',          url: 'http://100.111.111.111:3000',       icon: 'MessageCircle', visible: true, category: 'ai'        },
  { id: 'ollama',      name: 'Ollama',              url: 'http://100.111.111.111:11434',      icon: 'Cpu',           visible: true, category: 'ai'        },
  { id: 'odysseus',    name: 'Odysseus',            url: 'http://100.111.111.111:7000',       icon: 'Layers',        visible: true, category: 'ai'        },
  { id: 'vaultwarden', name: 'Vaultwarden',         url: 'https://100.111.111.111:8443',      icon: 'Lock',          visible: true, category: 'security'  },
]

export default function SettingsPage() {
  const [services, setServices] = useState<Service[]>([])
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((d: Settings) => { setServices(d.services); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function update(id: string, field: keyof Service, value: string | boolean) {
    setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }
  function remove(id: string) { setServices(prev => prev.filter(s => s.id !== id)) }
  function addNew() {
    const id = `custom_${Date.now()}`
    setServices(prev => [...prev, { id, name: 'New Service', url: 'http://100.111.111.111:8000', icon: 'Server', visible: true, category: 'other' }])
  }
  async function save() {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ services }) })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  function reset() { if (confirm('Reset all services to defaults?')) setServices(DEFAULTS) }

  if (loading) return <div style={{ padding: 24, fontSize: 13, color: 'var(--text-3)' }}>Loading…</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Services</h2>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>manage visible dashboard services</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={reset} style={{
            padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontWeight: 500,
          }}>
            Reset
          </button>
          <button onClick={save} style={{
            padding: '7px 18px', borderRadius: 6, border: 'none',
            background: saved ? 'rgba(74,222,128,0.15)' : 'var(--accent)',
            color: saved ? 'var(--green)' : 'white',
            fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 500,
          }}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Service cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {services.map((svc) => (
          <div key={svc.id} className="card" style={{ padding: '16px', opacity: svc.visible ? 1 : 0.45, transition: 'opacity .2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <button onClick={() => update(svc.id, 'visible', !svc.visible)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: svc.visible ? 'var(--green)' : 'var(--text-3)',
                fontSize: 12, fontFamily: 'var(--font-ui)', fontWeight: 500,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                {svc.visible ? 'Visible' : 'Hidden'}
              </button>
              <button onClick={() => remove(svc.id)} style={{
                background: 'transparent', border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 5, color: 'var(--red)', width: 26, height: 26, cursor: 'pointer', fontSize: 12,
              }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div className="label" style={{ marginBottom: 5 }}>Name</div>
                <input className="clean-input" value={svc.name} onChange={e => update(svc.id, 'name', e.target.value)} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 5 }}>URL</div>
                <input className="clean-input" value={svc.url} onChange={e => update(svc.id, 'url', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>Icon</div>
                  <select className="clean-input" value={svc.icon} onChange={e => update(svc.id, 'icon', e.target.value)}>
                    {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 5 }}>Group</div>
                  <select className="clean-input" value={svc.category} onChange={e => update(svc.id, 'category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button onClick={addNew} className="card" style={{
          padding: '20px', border: '1px dashed rgba(255,255,255,0.1)',
          background: 'transparent', color: 'var(--text-3)', cursor: 'pointer',
          fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, minHeight: 80,
        }}>
          + Add Service
        </button>
      </div>
    </div>
  )
}
