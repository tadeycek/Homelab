import { useEffect, useState, useCallback } from 'react'
import { BotData, BotPosition, BotTrade, BotEstimate, TradingBotData, TradingBotTrade } from '../types'

function fmt(usdc: number) { return `$${usdc.toFixed(2)}` }
function fmtPnl(n: number) { return `${n >= 0 ? '+' : ''}$${n.toFixed(2)}` }
function fmtPct(n: number) { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` }

function timeAgo(iso: string | null) {
  if (!iso) return 'never'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  const color = positive === null || positive === undefined
    ? 'var(--text)'
    : positive ? 'var(--green)' : 'var(--red)'
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="section-header" style={{ marginBottom: 12 }}>
        <span className="section-header title">{title}</span>
        <span className="section-header rule" />
      </div>
      <div className="card" style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

function NoData() {
  return <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No data yet — bot hasn't run a cycle.</div>
}

function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
        {children}
      </table>
    </div>
  )
}

const TH: React.CSSProperties = {
  padding: '0 10px 10px 0', textAlign: 'left', fontSize: 10, fontWeight: 600,
  letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-3)',
  borderBottom: '1px solid var(--border)',
}
const TD: React.CSSProperties = {
  padding: '10px 10px 10px 0', borderBottom: '1px solid var(--border)',
  color: 'var(--text-2)', fontFamily: 'var(--font-mono)',
}

// ── Polymarket ────────────────────────────────────────────────────────────────

function PolyPositions({ positions }: { positions: BotPosition[] }) {
  if (!positions.length) return <NoData />
  return (
    <ScrollTable>
      <thead><tr>
        <th style={TH}>Question</th>
        <th style={{ ...TH, textAlign: 'right' }}>Side</th>
        <th style={{ ...TH, textAlign: 'right' }}>Entry</th>
        <th style={{ ...TH, textAlign: 'right' }}>Stake</th>
        <th style={{ ...TH, textAlign: 'right' }}>Opened</th>
      </tr></thead>
      <tbody>{positions.map(p => (
        <tr key={p.condition_id}>
          <td style={{ ...TD, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
            <span title={p.question}>{p.question}</span>
          </td>
          <td style={{ ...TD, textAlign: 'right', color: p.side === 'YES' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{p.side}</td>
          <td style={{ ...TD, textAlign: 'right' }}>{(p.entry_price * 100).toFixed(1)}¢</td>
          <td style={{ ...TD, textAlign: 'right' }}>{fmt(p.stake_usdc)}</td>
          <td style={{ ...TD, textAlign: 'right', color: 'var(--text-3)' }}>{timeAgo(p.opened_at)}</td>
        </tr>
      ))}</tbody>
    </ScrollTable>
  )
}

function PolyTrades({ trades }: { trades: BotTrade[] }) {
  if (!trades.length) return <NoData />
  return (
    <ScrollTable>
      <thead><tr>
        <th style={TH}>Question</th>
        <th style={{ ...TH, textAlign: 'right' }}>Side</th>
        <th style={{ ...TH, textAlign: 'right' }}>Action</th>
        <th style={{ ...TH, textAlign: 'right' }}>Fill</th>
        <th style={{ ...TH, textAlign: 'right' }}>Stake</th>
        <th style={{ ...TH, textAlign: 'right' }}>P&amp;L</th>
        <th style={{ ...TH, textAlign: 'right' }}>When</th>
      </tr></thead>
      <tbody>{trades.map(t => (
        <tr key={t.id}>
          <td style={{ ...TD, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
            <span title={t.question}>{t.question}</span>
          </td>
          <td style={{ ...TD, textAlign: 'right', color: t.side === 'YES' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{t.side}</td>
          <td style={{ ...TD, textAlign: 'right', color: 'var(--accent)' }}>{t.action}</td>
          <td style={{ ...TD, textAlign: 'right' }}>{(t.fill_price * 100).toFixed(1)}¢</td>
          <td style={{ ...TD, textAlign: 'right' }}>{fmt(t.stake_usdc)}</td>
          <td style={{ ...TD, textAlign: 'right', color: t.pnl_usdc == null ? 'var(--text-3)' : t.pnl_usdc >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {t.pnl_usdc == null ? '—' : fmtPnl(t.pnl_usdc)}
          </td>
          <td style={{ ...TD, textAlign: 'right', color: 'var(--text-3)' }}>{timeAgo(t.created_at)}</td>
        </tr>
      ))}</tbody>
    </ScrollTable>
  )
}

function PolyEstimates({ estimates }: { estimates: BotEstimate[] }) {
  if (!estimates.length) return <NoData />
  return (
    <ScrollTable>
      <thead><tr>
        <th style={TH}>Question</th>
        <th style={{ ...TH, textAlign: 'right' }}>Market</th>
        <th style={{ ...TH, textAlign: 'right' }}>P(YES)</th>
        <th style={{ ...TH, textAlign: 'right' }}>Edge</th>
        <th style={{ ...TH, textAlign: 'right' }}>Conf</th>
        <th style={{ ...TH, textAlign: 'right' }}>Outcome</th>
        <th style={{ ...TH, textAlign: 'right' }}>When</th>
      </tr></thead>
      <tbody>{estimates.map(e => {
        const edge = e.edge ?? 0
        return (
          <tr key={e.id}>
            <td style={{ ...TD, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' }}>
              <span title={e.question}>{e.question}</span>
            </td>
            <td style={{ ...TD, textAlign: 'right' }}>{e.market_price != null ? `${(e.market_price * 100).toFixed(1)}¢` : '—'}</td>
            <td style={{ ...TD, textAlign: 'right' }}>{(e.p_true * 100).toFixed(1)}¢</td>
            <td style={{ ...TD, textAlign: 'right', color: edge >= 0.08 ? 'var(--green)' : edge >= 0 ? 'var(--text-2)' : 'var(--red)', fontWeight: 600 }}>
              {edge >= 0 ? '+' : ''}{(edge * 100).toFixed(1)}¢
            </td>
            <td style={{ ...TD, textAlign: 'right' }}>{(e.confidence * 100).toFixed(0)}%</td>
            <td style={{ ...TD, textAlign: 'right', color: e.outcome == null ? 'var(--text-3)' : 'var(--orange)' }}>
              {e.outcome == null ? 'pending' : e.outcome === 1 ? 'YES' : 'NO'}
            </td>
            <td style={{ ...TD, textAlign: 'right', color: 'var(--text-3)' }}>{timeAgo(e.created_at)}</td>
          </tr>
        )
      })}</tbody>
    </ScrollTable>
  )
}

function PolymarketPanel({ data }: { data: BotData | null }) {
  if (!data || data.status === 'no_data' || !data.summary) return <NoData />
  const s = data.summary
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 20 }}>
        <StatCard label="Realised P&L" value={fmtPnl(s.realised_pnl_usdc)} sub="paper USDC" positive={s.realised_pnl_usdc >= 0} />
        <StatCard label="Open Exposure" value={fmt(s.open_exposure_usdc)} sub={`${s.open_positions} positions`} />
        <StatCard label="Markets Analysed" value={String(s.total_estimates)} sub="LLM estimates" />
        <StatCard label="Last Cycle" value={timeAgo(s.last_cycle_at)} sub={s.last_cycle_at ? new Date(s.last_cycle_at).toLocaleTimeString('en-GB') : '—'} />
      </div>
      <Panel title="Open Positions"><PolyPositions positions={data.positions} /></Panel>
      <Panel title="Trades"><PolyTrades trades={data.trades} /></Panel>
      <Panel title="LLM Estimates"><PolyEstimates estimates={data.estimates} /></Panel>
    </>
  )
}

// ── TradingBot ────────────────────────────────────────────────────────────────

function TbTrades({ trades }: { trades: TradingBotTrade[] }) {
  if (!trades.length) return <NoData />
  return (
    <ScrollTable>
      <thead><tr>
        <th style={TH}>ID</th>
        <th style={{ ...TH, textAlign: 'right' }}>Entry</th>
        <th style={{ ...TH, textAlign: 'right' }}>Exit</th>
        <th style={{ ...TH, textAlign: 'right' }}>P&amp;L</th>
        <th style={{ ...TH, textAlign: 'right' }}>%</th>
        <th style={TH}>Reason</th>
        <th style={{ ...TH, textAlign: 'right' }}>When</th>
      </tr></thead>
      <tbody>{trades.map((t, i) => (
        <tr key={i}>
          <td style={{ ...TD, color: 'var(--text-3)', fontSize: 11 }}>{t.id}</td>
          <td style={{ ...TD, textAlign: 'right' }}>${t.entry.toLocaleString()}</td>
          <td style={{ ...TD, textAlign: 'right' }}>${t.exit.toLocaleString()}</td>
          <td style={{ ...TD, textAlign: 'right', color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{fmtPnl(t.pnl)}</td>
          <td style={{ ...TD, textAlign: 'right', color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPct(t.pnl_pct)}</td>
          <td style={{ ...TD, color: 'var(--text-3)' }}>{t.reason}</td>
          <td style={{ ...TD, textAlign: 'right', color: 'var(--text-3)' }}>{timeAgo(t.ts)}</td>
        </tr>
      ))}</tbody>
    </ScrollTable>
  )
}

function TradingBotPanel({ data }: { data: TradingBotData | null }) {
  if (!data || data.status === 'no_data' || !data.summary) return <NoData />
  const s = data.summary
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 20 }}>
        <StatCard label="Total P&L" value={fmtPnl(s.total_pnl)} sub="paper USDT" positive={s.total_pnl >= 0} />
        <StatCard label="Equity" value={fmt(s.equity)} sub={`balance ${fmt(s.balance)}`} />
        <StatCard label="Win Rate" value={`${(s.win_rate * 100).toFixed(1)}%`} sub={`${s.trades} closed trades`} />
        <StatCard label="BTC Price" value={`$${s.price.toLocaleString()}`} sub={`signal: ${s.signal}`} />
      </div>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Position</span>
        <span style={{
          fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)',
          color: s.position === 'FLAT' ? 'var(--text-3)' : 'var(--green)',
        }}>{s.position}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>last tick {timeAgo(s.last_tick_at)}</span>
      </div>

      <Panel title="Closed Trades"><TbTrades trades={data.trades} /></Panel>
      <Panel title="Recent Log">
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          <pre style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
            {data.recentLines.slice(-20).join('\n')}
          </pre>
        </div>
      </Panel>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Bots() {
  const [tab, setTab] = useState<'polymarket' | 'tradingbot'>('polymarket')
  const [polyData, setPolyData] = useState<BotData | null>(null)
  const [tradingData, setTradingData] = useState<TradingBotData | null>(null)

  const fetchAll = useCallback(async () => {
    const [p, t] = await Promise.all([
      fetch('/api/bots/polymarket').then(r => r.json()).catch(() => null),
      fetch('/api/bots/tradingbot').then(r => r.json()).catch(() => null),
    ])
    setPolyData(p); setTradingData(t)
  }, [])

  useEffect(() => {
    fetchAll()
    const timer = setInterval(fetchAll, 30_000)
    return () => clearInterval(timer)
  }, [fetchAll])

  const TABS = [
    { id: 'polymarket' as const, label: 'Polymarket', sub: 'prediction markets · 30m' },
    { id: 'tradingbot' as const, label: 'Trading Bot', sub: 'BTC/USDT EMA · 1m tick' },
  ]

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Bots</h2>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 20 }}>
        {TABS.map(({ id, label, sub }) => (
          <button key={id} onClick={() => setTab(id)} className="card" style={{
            padding: '12px 16px', cursor: 'pointer', textAlign: 'left', border: `1px solid ${tab === id ? 'var(--accent)' : 'var(--border)'}`,
            background: tab === id ? 'rgba(129,140,248,0.08)' : 'var(--card)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: tab === id ? 'var(--accent)' : 'var(--text)' }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{sub}</div>
          </button>
        ))}
      </div>

      {tab === 'polymarket' && <PolymarketPanel data={polyData} />}
      {tab === 'tradingbot' && <TradingBotPanel data={tradingData} />}
    </div>
  )
}
