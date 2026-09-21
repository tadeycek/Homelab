export interface Service {
  id: string
  name: string
  url: string
  icon: string
  visible: boolean
  category: string
  container?: string
  manage?: 'mc'
}

export interface ServiceStatus {
  up: boolean
  ms: number
  status?: number
}

export interface StatusMap {
  [id: string]: ServiceStatus
}

export interface SystemStats {
  cpu: number
  ram: { used: number; total: number; percent: number }
  disk: {
    root: { used: number; size: number; percent: number } | null
    data: { used: number; size: number; percent: number } | null
  }
  uptime: number
}

export interface Settings {
  services: Service[]
}

export interface BotSummary {
  open_positions: number
  open_exposure_usdc: number
  realised_pnl_usdc: number
  total_estimates: number
  last_cycle_at: string | null
}

export interface BotPosition {
  condition_id: string
  question: string
  side: string
  token_id: string
  entry_price: number
  shares: number
  stake_usdc: number
  order_id: string
  opened_at: string
}

export interface BotTrade {
  id: number
  condition_id: string
  question: string
  side: string
  fill_price: number
  shares: number
  stake_usdc: number
  action: string
  pnl_usdc: number | null
  created_at: string
}

export interface BotEstimate {
  id: number
  condition_id: string
  question: string
  p_true: number
  confidence: number
  rationale: string | null
  market_price: number | null
  edge: number | null
  outcome: number | null
  created_at: string
}

export interface BotData {
  status: string
  summary: BotSummary | null
  positions: BotPosition[]
  trades: BotTrade[]
  estimates: BotEstimate[]
}

export interface TradingBotTrade {
  type: string
  ts: string
  id: string
  entry: number
  exit: number
  pnl: number
  pnl_pct: number
  reason: string
}

export interface TradingBotSummary {
  price: number
  balance: number
  equity: number
  total_pnl: number
  trades: number
  win_rate: number
  signal: string
  position: string
  last_tick_at: string | null
}

export interface TradingBotData {
  status: string
  summary: TradingBotSummary | null
  trades: TradingBotTrade[]
  recentLines: string[]
}
