import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createConnection } from 'net';
import https from 'https';
import http from 'http';
import si from 'systeminformation';
import Database from 'better-sqlite3';

const BOTS_DATA = {
  polymarket: '/bots/polymarket/portfolio.db',
  tradingbot: '/bots/tradingbot/trading_bot.log',
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 4000;
const DATA_DIR = '/data';
const SETTINGS_FILE = `${DATA_DIR}/settings.json`;

app.use(express.json());

const DEFAULT_SERVICES = [
  // system
  { id: 'portainer',    name: 'Portainer',           url: 'http://100.111.111.111:9000',       icon: 'Box',           visible: true, category: 'system'    },
  { id: 'uptimekuma',   name: 'Uptime Kuma',         url: 'http://100.111.111.111:3001',       icon: 'Activity',      visible: true, category: 'system',    container: 'uptime-kuma'        },
  { id: 'ssh',          name: 'SSH',                 url: 'ssh://100.111.111.111',             icon: 'Terminal',      visible: true, category: 'system'    },
  // network
  { id: 'pihole',       name: 'Pi-hole',             url: 'http://100.111.111.111:8080/admin', icon: 'Shield',        visible: true, category: 'network'   },
  { id: 'nginx',        name: 'Nginx Proxy Manager', url: 'http://100.111.111.111:81',         icon: 'Globe',         visible: true, category: 'network',   container: 'nginx-proxy-manager' },
  // media
  { id: 'jellyfin',     name: 'Jellyfin',            url: 'http://100.111.111.111:8096',       icon: 'Play',          visible: true, category: 'media'     },
  { id: 'jellyseerr',   name: 'Jellyseerr',          url: 'http://100.111.111.111:5055',       icon: 'Star',          visible: true, category: 'media'     },
  { id: 'immich',       name: 'Immich',              url: 'http://100.111.111.111:2283',       icon: 'Image',         visible: true, category: 'media',     container: 'immich-server'       },
  // downloads
  { id: 'radarr',       name: 'Radarr',              url: 'http://100.111.111.111:7878',       icon: 'Film',          visible: true, category: 'downloads' },
  { id: 'sonarr',       name: 'Sonarr',              url: 'http://100.111.111.111:8989',       icon: 'Tv',            visible: true, category: 'downloads' },
  { id: 'lidarr',       name: 'Lidarr',              url: 'http://100.111.111.111:8686',       icon: 'Disc',          visible: true, category: 'downloads' },
  { id: 'prowlarr',     name: 'Prowlarr',            url: 'http://100.111.111.111:9696',       icon: 'Radio',         visible: true, category: 'downloads' },
  { id: 'qbittorrent',  name: 'qBittorrent',         url: 'http://100.111.111.111:8082',       icon: 'Download',      visible: true, category: 'downloads' },
  // music
  { id: 'navidrome',    name: 'Navidrome',           url: 'http://100.111.111.111:4533',       icon: 'Music',         visible: true, category: 'media',     container: 'navidrome'           },
  // storage
  { id: 'nextcloud',    name: 'Nextcloud',           url: 'http://100.111.111.111:8081',       icon: 'Cloud',         visible: true, category: 'storage'   },
  // ai
  { id: 'openwebui',    name: 'Open WebUI',          url: 'http://100.111.111.111:3000',       icon: 'MessageCircle', visible: true, category: 'ai',        container: 'open-webui'          },
  { id: 'ollama',       name: 'Ollama',              url: 'http://100.111.111.111:11434',      icon: 'Cpu',           visible: true, category: 'ai'        },
  { id: 'odysseus',     name: 'Odysseus',            url: 'http://100.111.111.111:7000',       icon: 'Layers',        visible: true, category: 'ai'        },
  // security
  { id: 'vaultwarden',  name: 'Vaultwarden',         url: 'https://100.111.111.111:8443',      icon: 'Lock',          visible: true, category: 'security'  },
  // monitoring
  { id: 'grafana',      name: 'Grafana',             url: 'http://100.111.111.111:3002',       icon: 'BarChart2',     visible: true, category: 'system'    },
  { id: 'prometheus',   name: 'Prometheus',          url: 'http://100.111.111.111:9090',       icon: 'TrendingUp',    visible: true, category: 'system'    },
  // games
  { id: 'crafty',       name: 'Minecraft (Crafty)',  url: 'https://100.111.111.111:8444',      icon: 'Gamepad2',      visible: true, category: 'games',     container: 'crafty'              },
  { id: 'skyfactory4',  name: 'SkyFactory 4',        url: 'tcp://100.111.111.111:25601',       icon: 'Gamepad2',      visible: true, category: 'games',     container: 'skyfactory4',        manage: 'mc' },
];

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadSettings() {
  try {
    if (existsSync(SETTINGS_FILE)) {
      return JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch {}
  return { services: DEFAULT_SERVICES };
}

function saveSettings(settings) {
  ensureDataDir();
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

function isLocalRequest(req) {
  const raw = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  return raw === '127.0.0.1' || raw === '::1' || raw.startsWith('192.168.');
}

app.get('/api/settings', (req, res) => {
  const settings = loadSettings();
  if (isLocalRequest(req)) {
    return res.json({
      ...settings,
      services: settings.services.map(s => ({
        ...s,
        url: s.url.replace(/100\.99\.141\.30/g, '192.168.1.105'),
      })),
    });
  }
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  saveSettings(req.body);
  res.json({ ok: true });
});

app.get('/api/system', async (_req, res) => {
  try {
    const [cpu, mem, disks, time] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.time(),
    ]);
    const rootDisk  = disks.find(d => d.mount === '/') || disks[0];
    const dataDisk  = disks.find(d => d.mount === '/mnt/data');
    res.json({
      cpu: Math.round(cpu.currentLoad),
      ram: {
        used: mem.active,
        total: mem.total,
        percent: Math.round((mem.active / mem.total) * 100),
      },
      disk: {
        root: rootDisk  ? { used: rootDisk.used,  size: rootDisk.size,  percent: Math.round(rootDisk.use)  } : null,
        data: dataDisk  ? { used: dataDisk.used,  size: dataDisk.size,  percent: Math.round(dataDisk.use)  } : null,
      },
      uptime: time.uptime,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/status', async (_req, res) => {
  const { services } = loadSettings();
  const results = {};
  await Promise.all(
    services.map(async (svc) => {
      const start = Date.now();
      try {
        const parsed = new URL(svc.url);
        if (parsed.protocol === 'https:') {
          await new Promise((resolve, reject) => {
            const req = https.request(
              { hostname: parsed.hostname, port: parsed.port || 443, path: parsed.pathname || '/', method: 'GET', timeout: 3000, rejectUnauthorized: false },
              (res) => { results[svc.id] = { up: res.statusCode < 500, ms: Date.now() - start, status: res.statusCode }; resolve(); }
            );
            req.once('error', reject);
            req.once('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.end();
          });
        } else if (parsed.protocol === 'ssh:') {
          const port = parsed.port ? parseInt(parsed.port) : 22;
          const host = parsed.hostname;
          await new Promise((resolve, reject) => {
            const socket = createConnection({ host, port, timeout: 3000 });
            socket.once('connect', () => { socket.destroy(); resolve(); });
            socket.once('error', reject);
            socket.once('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
          });
          results[svc.id] = { up: true, ms: Date.now() - start };
        } else if (parsed.protocol === 'tcp:') {
          const port = parsed.port ? parseInt(parsed.port) : 0;
          const host = parsed.hostname;
          await new Promise((resolve, reject) => {
            const socket = createConnection({ host, port, timeout: 3000 });
            socket.once('connect', () => { socket.destroy(); resolve(); });
            socket.once('error', reject);
            socket.once('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
          });
          results[svc.id] = { up: true, ms: Date.now() - start };
        } else {
          const r = await fetch(svc.url, { signal: AbortSignal.timeout(3000) });
          results[svc.id] = { up: r.status < 500, ms: Date.now() - start, status: r.status };
        }
      } catch {
        results[svc.id] = { up: false, ms: Date.now() - start };
      }
    })
  );
  res.json(results);
});

app.get('/api/bots/polymarket', (_req, res) => {
  const dbPath = BOTS_DATA.polymarket;
  if (!existsSync(dbPath)) {
    return res.json({ status: 'no_data', positions: [], trades: [], estimates: [], summary: null });
  }
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const positions = db.prepare('SELECT * FROM positions ORDER BY opened_at').all();
    const trades    = db.prepare('SELECT * FROM trades ORDER BY created_at DESC LIMIT 50').all();
    const estimates = db.prepare('SELECT * FROM estimates ORDER BY created_at DESC LIMIT 50').all();
    const pnl       = db.prepare("SELECT COALESCE(SUM(pnl_usdc),0) AS v FROM trades WHERE action='close'").get().v;
    const exposure  = db.prepare('SELECT COALESCE(SUM(stake_usdc),0) AS v FROM positions').get().v;
    const totalEst  = db.prepare('SELECT COUNT(*) AS v FROM estimates').get().v;
    const lastCycle = db.prepare('SELECT created_at FROM estimates ORDER BY created_at DESC LIMIT 1').get();
    db.close();
    res.json({
      status: 'ok',
      summary: {
        open_positions: positions.length,
        open_exposure_usdc: exposure,
        realised_pnl_usdc: pnl,
        total_estimates: totalEst,
        last_cycle_at: lastCycle?.created_at ?? null,
      },
      positions,
      trades,
      estimates,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/bots/tradingbot', (_req, res) => {
  const logPath = BOTS_DATA.tradingbot;
  if (!existsSync(logPath)) {
    return res.json({ status: 'no_data', summary: null, trades: [], recentLines: [] });
  }
  try {
    const lines = readFileSync(logPath, 'utf8').split('\n').filter(Boolean);

    // Parse status lines: price=... fast_ema=... slow_ema=... signal=... balance=$... equity=$... pos=...
    const statusRe = /price=([\d.]+)\s+fast_ema=([\d.]+)\s+slow_ema=([\d.]+)\s+signal=(\S+)\s+balance=\$([\d.]+)\s+equity=\$([\d.]+)\s+pos=(.+)/;
    // Parse CLOSED lines
    const closedRe = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*CLOSED\s+id=(\S+)\s+entry=([\d.]+)\s+exit=([\d.]+)\s+pnl=\$([+-]?[\d.]+)\s+\(([-+]?[\d.]+)%\)\s+reason=(\S+)/;
    // Parse OPENED lines
    const openedRe = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*OPENED\s+id=(\S+)\s+price=([\d.]+)\s+qty=([\d.]+) BTC\s+cost=\$([\d.]+)\s+SL=([\d.]+)\s+TP=([\d.]+)/;

    let lastStatus = null;
    const trades = [];
    const recentLines = lines.slice(-50);

    for (const line of lines) {
      const sm = line.match(statusRe);
      if (sm) {
        const ts = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)?.[1] ?? null;
        lastStatus = {
          ts,
          price: parseFloat(sm[1]),
          fast_ema: parseFloat(sm[2]),
          slow_ema: parseFloat(sm[3]),
          signal: sm[4],
          balance: parseFloat(sm[5]),
          equity: parseFloat(sm[6]),
          position: sm[7].trim(),
        };
      }
      const cm = line.match(closedRe);
      if (cm) {
        trades.push({
          type: 'close',
          ts: cm[1], id: cm[2],
          entry: parseFloat(cm[3]), exit: parseFloat(cm[4]),
          pnl: parseFloat(cm[5]), pnl_pct: parseFloat(cm[6]),
          reason: cm[7],
        });
      }
    }

    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const wins = trades.filter(t => t.pnl > 0).length;

    res.json({
      status: 'ok',
      summary: lastStatus ? {
        price: lastStatus.price,
        balance: lastStatus.balance,
        equity: lastStatus.equity,
        total_pnl: totalPnl,
        trades: trades.length,
        win_rate: trades.length ? wins / trades.length : 0,
        signal: lastStatus.signal,
        position: lastStatus.position,
        last_tick_at: lastStatus.ts,
      } : null,
      trades: trades.slice(-50).reverse(),
      recentLines,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/downloads', async (_req, res) => {
  try {
    const r = await fetch('http://100.111.111.111:8082/api/v2/torrents/info', {
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return res.json({ torrents: [] });
    const all = await r.json();
    const torrents = all.map(t => ({
      name: t.name,
      progress: Math.round(t.progress * 100),
      dlspeed: t.dlspeed,
      upspeed: t.upspeed,
      size: t.size,
      state: t.state,
      category: t.category,
      eta: t.eta,
    }));
    const dlSpeed = all.reduce((s, t) => s + t.dlspeed, 0);
    res.json({ torrents, dlSpeed });
  } catch {
    res.json({ torrents: [], dlSpeed: 0 });
  }
});

// ── Ollama ─────────────────────────────────────────────────────────────────
const OLLAMA = 'http://ollama:11434';

app.get('/api/ollama/models', async (_req, res) => {
  try {
    const [tags, ps] = await Promise.all([
      fetch(`${OLLAMA}/api/tags`).then(r => r.json()),
      fetch(`${OLLAMA}/api/ps`).then(r => r.json()).catch(() => ({ models: [] })),
    ]);
    res.json({ models: tags.models || [], running: ps.models || [] });
  } catch { res.json({ models: [], running: [] }); }
});

app.delete('/api/ollama/models/:name', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: decodeURIComponent(req.params.name) }),
    });
    res.status(r.ok ? 200 : 500).json({ ok: r.ok });
  } catch { res.status(500).json({ ok: false }); }
});

// SSE endpoint — streams Ollama pull progress to the client
app.post('/api/ollama/pull', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const upstream = await fetch(`${OLLAMA}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (line.trim()) { try { send(JSON.parse(line)); } catch {} }
      }
    }
    send({ status: 'success' });
  } catch (e) {
    send({ status: 'error', error: String(e) });
  }
  res.end();
});

// ── Battery ────────────────────────────────────────────────────────────────
app.get('/api/battery', (_req, res) => {
  try {
    const ps = '/sys/class/power_supply';
    let charging = false, percent = null;
    for (const e of readdirSync(ps)) {
      if (/^(AC|ADP|ACAD)/.test(e)) {
        try { charging = readFileSync(`${ps}/${e}/online`, 'utf8').trim() === '1'; } catch {}
      }
      if (e.startsWith('BAT')) {
        try { percent = parseInt(readFileSync(`${ps}/${e}/capacity`, 'utf8').trim()); } catch {}
      }
    }
    res.json({ charging, percent });
  } catch { res.json({ charging: null, percent: null }); }
});

// ── CPU temperature (added to /api/system) ─────────────────────────────────
app.get('/api/temp', async (_req, res) => {
  try {
    const t = await si.cpuTemperature();
    res.json({ cpu: t.main ?? null, cores: t.cores ?? [] });
  } catch { res.json({ cpu: null, cores: [] }); }
});

// ── Pi-hole v6 ─────────────────────────────────────────────────────────────
let piholeSession = null;
async function piholeAuth() {
  const r = await fetch('http://pihole/api/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.PIHOLE_PASSWORD }),
  });
  const d = await r.json();
  if (d.session?.valid) { piholeSession = d.session.sid; return true; }
  return false;
}
async function piholeGet(path) {
  if (!piholeSession) await piholeAuth();
  const r = await fetch(`http://pihole/api${path}`, { headers: { sid: piholeSession } });
  if (r.status === 401) { await piholeAuth(); return fetch(`http://pihole/api${path}`, { headers: { sid: piholeSession } }).then(x => x.json()); }
  return r.json();
}

app.get('/api/pihole', async (_req, res) => {
  try {
    const [summary, topDomains] = await Promise.all([
      piholeGet('/stats/summary'),
      piholeGet('/stats/top_domains?blocked=true&count=5'),
    ]);
    res.json({
      total: summary.queries?.total ?? 0,
      blocked: summary.queries?.blocked ?? 0,
      pct: summary.queries?.percent_blocked ?? 0,
      status: summary.gravity?.domains_being_blocked ?? 0,
      topBlocked: (topDomains.domains ?? []).slice(0, 5),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Docker ─────────────────────────────────────────────────────────────────
function dockerRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = { socketPath: '/var/run/docker.sock', path, method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, (r) => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => {
        const raw = Buffer.concat(chunks);
        try { resolve({ status: r.statusCode, body: JSON.parse(raw.toString()) }); }
        catch { resolve({ status: r.statusCode, body: raw.toString() }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function parseDockerLogs(buf) {
  const lines = [];
  let i = 0;
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i + 4);
    if (i + 8 + len > buf.length) break;
    lines.push(buf.slice(i + 8, i + 8 + len).toString('utf8').replace(/\n$/, ''));
    i += 8 + len;
  }
  return lines;
}

app.get('/api/docker/containers', async (_req, res) => {
  try {
    const { body } = await dockerRequest('GET', '/containers/json?all=true');
    const containers = body.map(c => ({
      id: c.Id.slice(0, 12),
      name: c.Names[0]?.replace(/^\//, ''),
      image: c.Image,
      status: c.Status,
      state: c.State,
    }));
    res.json(containers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/docker/:name/restart', async (req, res) => {
  try {
    const { status } = await dockerRequest('POST', `/containers/${req.params.name}/restart`);
    res.json({ ok: status === 204 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/docker/:name/stop', async (req, res) => {
  try {
    const { status } = await dockerRequest('POST', `/containers/${req.params.name}/stop`);
    res.json({ ok: status === 204 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/docker/:name/logs', async (req, res) => {
  try {
    const tail = req.query.tail || 120;
    const data = await new Promise((resolve, reject) => {
      const opts = { socketPath: '/var/run/docker.sock', path: `/containers/${req.params.name}/logs?stdout=true&stderr=true&tail=${tail}`, method: 'GET' };
      const r = http.request(opts, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      r.on('error', reject);
      r.end();
    });
    res.json({ lines: parseDockerLogs(data) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Minecraft server management ──────────────────────────────────────────────
const MC_SERVERS = {
  skyfactory4: { name: 'SkyFactory 4', container: 'skyfactory4', dataDir: '/mcservers/skyfactory4', rconHost: 'skyfactory4', rconPort: 25575 },
};

function readMcProperties(dataDir) {
  const text = readFileSync(`${dataDir}/server.properties`, 'utf8');
  const props = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    props[t.slice(0, idx)] = t.slice(idx + 1);
  }
  return props;
}

function writeMcProperties(dataDir, updates) {
  const path = `${dataDir}/server.properties`;
  const text = readFileSync(path, 'utf8');
  const seen = new Set();
  const lines = text.split('\n').map(line => {
    const idx = line.indexOf('=');
    if (idx === -1 || line.trim().startsWith('#')) return line;
    const key = line.slice(0, idx);
    if (Object.prototype.hasOwnProperty.call(updates, key)) { seen.add(key); return `${key}=${updates[key]}`; }
    return line;
  });
  for (const key of Object.keys(updates)) {
    if (!seen.has(key)) lines.push(`${key}=${updates[key]}`);
  }
  writeFileSync(path, lines.join('\n'));
}

function rconCommands(host, port, password, commands, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port, timeout: timeoutMs });
    let buf = Buffer.alloc(0);
    let settled = false;
    const AUTH_ID = 1;
    let cmdIndex = 0;
    const results = [];

    const finish = (fn, val) => { if (settled) return; settled = true; try { socket.destroy(); } catch {} fn(val); };

    function buildPacket(id, type, body) {
      const bodyBuf = Buffer.from(body + '\0\0', 'binary');
      const size = 4 + 4 + bodyBuf.length;
      const packet = Buffer.alloc(4 + size);
      packet.writeInt32LE(size, 0);
      packet.writeInt32LE(id, 4);
      packet.writeInt32LE(type, 8);
      bodyBuf.copy(packet, 12);
      return packet;
    }

    function sendNext() {
      if (cmdIndex >= commands.length) return finish(resolve, results);
      socket.write(buildPacket(100 + cmdIndex, 2, commands[cmdIndex]));
    }

    socket.once('connect', () => socket.write(buildPacket(AUTH_ID, 3, password)));

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 4) {
        const size = buf.readInt32LE(0);
        if (buf.length < 4 + size) break;
        const packet = buf.slice(4, 4 + size);
        buf = buf.slice(4 + size);
        const id = packet.readInt32LE(0);
        const type = packet.readInt32LE(4);
        const body = packet.slice(8, packet.length - 2).toString('binary');
        if (type === 2 && id === -1) return finish(reject, new Error('RCON auth failed'));
        if (type === 2 && id === AUTH_ID) sendNext();
        else if (type === 0 && id === 100 + cmdIndex) { results.push(body); cmdIndex++; sendNext(); }
      }
    });
    socket.once('error', (e) => finish(reject, e));
    socket.once('timeout', () => finish(reject, new Error('RCON timeout')));
  });
}

function rconCommand(host, port, password, command, timeoutMs) {
  return rconCommands(host, port, password, [command], timeoutMs).then(r => r[0] ?? '');
}

const BOOLEAN_GAMERULES = [
  'keepInventory', 'doDaylightCycle', 'doWeatherCycle', 'doMobSpawning', 'mobGriefing',
  'doFireTick', 'naturalRegeneration', 'doMobLoot', 'doTileDrops', 'commandBlockOutput',
  'announceAdvancements', 'showDeathMessages', 'doEntityDrops', 'reducedDebugInfo',
  'sendCommandFeedback', 'logAdminCommands', 'spectatorsGenerateChunks',
];
const NUMERIC_GAMERULES = ['randomTickSpeed', 'maxEntityCramming', 'maxCommandChainLength', 'spawnRadius'];
const ALL_GAMERULES = [...BOOLEAN_GAMERULES, ...NUMERIC_GAMERULES];

app.get('/api/mc/list', (_req, res) => {
  res.json(Object.entries(MC_SERVERS).map(([id, s]) => ({ id, name: s.name, container: s.container })));
});

// Maps our API field names <-> server.properties keys
const SETTINGS_MAP = {
  motd: 'motd',
  difficulty: 'difficulty',
  pvp: 'pvp',
  maxPlayers: 'max-players',
  viewDistance: 'view-distance',
  whitelist: 'white-list',
  gamemode: 'gamemode',
  hardcore: 'hardcore',
  forceGamemode: 'force-gamemode',
  allowFlight: 'allow-flight',
  spawnProtection: 'spawn-protection',
  spawnMonsters: 'spawn-monsters',
  spawnAnimals: 'spawn-animals',
  spawnNpcs: 'spawn-npcs',
  allowNether: 'allow-nether',
  generateStructures: 'generate-structures',
  maxWorldSize: 'max-world-size',
  playerIdleTimeout: 'player-idle-timeout',
  opPermissionLevel: 'op-permission-level',
  enableCommandBlock: 'enable-command-block',
};
const SETTINGS_BOOL = new Set([
  'pvp', 'whitelist', 'hardcore', 'forceGamemode', 'allowFlight', 'spawnMonsters',
  'spawnAnimals', 'spawnNpcs', 'allowNether', 'generateStructures', 'enableCommandBlock',
]);

app.get('/api/mc/:id/info', (req, res) => {
  const srv = MC_SERVERS[req.params.id];
  if (!srv) return res.status(404).json({ error: 'unknown server' });
  try {
    const props = readMcProperties(srv.dataDir);
    const defaults = {
      motd: '', difficulty: '1', maxPlayers: '20', viewDistance: '10', gamemode: '0',
      spawnProtection: '16', maxWorldSize: '29999984', playerIdleTimeout: '0', opPermissionLevel: '4',
      pvp: 'true', whitelist: 'false', hardcore: 'false', forceGamemode: 'false', allowFlight: 'false',
      spawnMonsters: 'true', spawnAnimals: 'true', spawnNpcs: 'true', allowNether: 'true',
      generateStructures: 'true', enableCommandBlock: 'false',
    };
    const out = {};
    for (const [field, key] of Object.entries(SETTINGS_MAP)) {
      const raw = props[key] ?? defaults[field];
      out[field] = SETTINGS_BOOL.has(field) ? raw === 'true' : raw;
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mc/:id/settings', async (req, res) => {
  const srv = MC_SERVERS[req.params.id];
  if (!srv) return res.status(404).json({ error: 'unknown server' });
  try {
    const body = req.body;
    const updates = {};
    for (const [field, key] of Object.entries(SETTINGS_MAP)) {
      if (body[field] !== undefined) updates[key] = String(body[field]);
    }
    writeMcProperties(srv.dataDir, updates);

    // Best-effort live apply via RCON for the settings that support it (rest need a restart)
    try {
      const props = readMcProperties(srv.dataDir);
      const pw = props['rcon.password'];
      const liveCmds = [];
      if (body.whitelist !== undefined) liveCmds.push(`whitelist ${body.whitelist ? 'on' : 'off'}`);
      if (body.difficulty !== undefined) {
        const names = ['peaceful', 'easy', 'normal', 'hard'];
        liveCmds.push(`difficulty ${names[Number(body.difficulty)] ?? body.difficulty}`);
      }
      if (body.gamemode !== undefined) {
        const names = ['survival', 'creative', 'adventure', 'spectator'];
        liveCmds.push(`defaultgamemode ${names[Number(body.gamemode)] ?? body.gamemode}`);
      }
      if (liveCmds.length) await rconCommands(srv.rconHost, srv.rconPort, pw, liveCmds);
    } catch {}

    res.json({ ok: true, requiresRestart: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/mc/:id/gamerules', async (req, res) => {
  const srv = MC_SERVERS[req.params.id];
  if (!srv) return res.status(404).json({ error: 'unknown server' });
  try {
    const props = readMcProperties(srv.dataDir);
    const outputs = await rconCommands(srv.rconHost, srv.rconPort, props['rcon.password'], ALL_GAMERULES.map(r => `gamerule ${r}`));
    const values = {};
    ALL_GAMERULES.forEach((rule, i) => {
      const m = /(?:is:?|=)\s*(\S+)\s*$/i.exec(outputs[i] || '');
      values[rule] = m ? m[1] : null;
    });
    res.json({ booleans: BOOLEAN_GAMERULES, numerics: NUMERIC_GAMERULES, values });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mc/:id/gamerules', async (req, res) => {
  const srv = MC_SERVERS[req.params.id];
  if (!srv) return res.status(404).json({ error: 'unknown server' });
  const { rule, value } = req.body;
  if (!rule || value === undefined || !ALL_GAMERULES.includes(rule)) return res.status(400).json({ error: 'bad request' });
  try {
    const props = readMcProperties(srv.dataDir);
    const output = await rconCommand(srv.rconHost, srv.rconPort, props['rcon.password'], `gamerule ${rule} ${value}`);
    res.json({ ok: true, output });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/mc/:id/whitelist', (req, res) => {
  const srv = MC_SERVERS[req.params.id];
  if (!srv) return res.status(404).json({ error: 'unknown server' });
  try {
    const list = JSON.parse(readFileSync(`${srv.dataDir}/whitelist.json`, 'utf8'));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mc/:id/whitelist', async (req, res) => {
  const srv = MC_SERVERS[req.params.id];
  if (!srv) return res.status(404).json({ error: 'unknown server' });
  const { username, action } = req.body;
  if (!username || !['add', 'remove'].includes(action)) return res.status(400).json({ error: 'bad request' });
  try {
    const props = readMcProperties(srv.dataDir);
    const output = await rconCommand(srv.rconHost, srv.rconPort, props['rcon.password'], `whitelist ${action} ${username}`);
    res.json({ ok: true, output });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mc/:id/command', async (req, res) => {
  const srv = MC_SERVERS[req.params.id];
  if (!srv) return res.status(404).json({ error: 'unknown server' });
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'bad request' });
  try {
    const props = readMcProperties(srv.dataDir);
    const output = await rconCommand(srv.rconHost, srv.rconPort, props['rcon.password'], command);
    res.json({ ok: true, output });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Arr queue ──────────────────────────────────────────────────────────────
const RADARR = { url: 'http://radarr:7878', key: process.env.RADARR_API_KEY };
const SONARR  = { url: 'http://sonarr:8989',  key: process.env.SONARR_API_KEY };
const LIDARR  = { url: 'http://lidarr:8686',  key: process.env.LIDARR_API_KEY };

app.get('/api/arr/queue', async (_req, res) => {
  try {
    const [rq, sq, lq] = await Promise.all([
      fetch(`${RADARR.url}/api/v3/queue?pageSize=20`, { headers: { 'X-Api-Key': RADARR.key } }).then(r => r.json()).catch(() => ({ records: [] })),
      fetch(`${SONARR.url}/api/v3/queue?pageSize=20`, { headers: { 'X-Api-Key': SONARR.key } }).then(r => r.json()).catch(() => ({ records: [] })),
      fetch(`${LIDARR.url}/api/v1/queue?pageSize=20`, { headers: { 'X-Api-Key': LIDARR.key } }).then(r => r.json()).catch(() => ({ records: [] })),
    ]);
    const map = r => ({
      title: r.title,
      status: r.status,
      trackedDownloadStatus: r.trackedDownloadStatus,
      sizeleft: r.sizeleft,
      size: r.size,
      timeleft: r.timeleft,
      type: r.movie ? 'movie' : r.album ? 'album' : 'episode',
    });
    res.json({
      radarr: (rq.records ?? []).map(map),
      sonarr: (sq.records ?? []).map(map),
      lidarr: (lq.records ?? []).map(map),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tailscale ──────────────────────────────────────────────────────────────
app.get('/api/tailscale', async (_req, res) => {
  try {
    const data = await new Promise((resolve, reject) => {
      const opts = { socketPath: '/var/run/tailscale/tailscaled.sock', path: '/localapi/v0/status', method: 'GET', headers: { Host: 'local-tailscaled.sock' } };
      const req = http.request(opts, (r) => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { reject(e); } });
      });
      req.on('error', reject);
      req.end();
    });
    const peers = Object.values(data.Peer ?? {}).map(p => ({
      name: p.HostName,
      ip: p.TailscaleIPs?.[0] ?? '',
      os: p.OS,
      online: p.Online,
      lastSeen: p.LastSeen,
    }));
    const self = {
      name: data.Self?.HostName || 'homelab',
      ip: data.Self?.TailscaleIPs?.[0],
      online: data.BackendState === 'Running' && !!data.Self?.Online,
    };
    res.json({ self, peers });
  } catch (e) {
    // tailscaled unreachable (socket down / service stopped) → report homelab itself as down
    // rather than a bare 500, so the dashboard can still show it offline.
    res.json({ self: { name: 'homelab', ip: null, online: false }, peers: [], error: e.message });
  }
});

// ── Clip Factory proxy → localhost:5757 ────────────────────────────────────
const CF_HOST = '192.168.1.105';
const CF_PORT = 5757;

function cfProxy(req, res, overridePath) {
  const target = overridePath || req.url.replace('/api/cf', '/api');
  const body = (req.method !== 'GET' && req.method !== 'HEAD' && req.body)
    ? JSON.stringify(req.body) : null;
  const headers = { ...req.headers, host: `${CF_HOST}:${CF_PORT}` };
  if (body) {
    headers['content-type']   = 'application/json';
    headers['content-length'] = Buffer.byteLength(body);
  }
  const opts = { hostname: CF_HOST, port: CF_PORT, path: target, method: req.method, headers };
  const upstream = http.request(opts, (upRes) => {
    res.writeHead(upRes.statusCode, upRes.headers);
    upRes.pipe(res);
  });
  upstream.on('error', () => res.status(502).json({ error: 'Clip Factory offline' }));
  if (body) upstream.write(body);
  upstream.end();
}

// SSE stream needs special handling (no body piping)
app.get('/api/cf/stream/:jid', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  req.socket.setTimeout(0);

  const opts = {
    hostname: CF_HOST, port: CF_PORT,
    path: `/api/stream/${req.params.jid}`, method: 'GET',
    headers: { 'Connection': 'keep-alive' },
  };
  const upstream = http.request(opts, (upRes) => { upRes.pipe(res); });
  upstream.on('socket', (socket) => socket.setTimeout(0));
  upstream.on('error', () => res.end());
  req.on('close', () => upstream.destroy());
  upstream.end();
});

// multipart file upload — pipe raw bytes, don't touch body
app.post('/api/cf/analyze', (req, res) => {
  const opts = {
    hostname: CF_HOST, port: CF_PORT, path: '/api/analyze',
    method: 'POST', headers: { ...req.headers, host: `${CF_HOST}:${CF_PORT}` },
  };
  const upstream = http.request(opts, (upRes) => { res.writeHead(upRes.statusCode, upRes.headers); upRes.pipe(res); });
  upstream.on('error', () => res.status(502).json({ error: 'Clip Factory offline' }));
  req.pipe(upstream);
});
app.all('/api/cf/*', (req, res) => cfProxy(req, res));

// ── Static ─────────────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'client/dist')));
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'client/dist/index.html')));

app.listen(PORT, () => console.log(`Dashboard on http://0.0.0.0:${PORT}`));
