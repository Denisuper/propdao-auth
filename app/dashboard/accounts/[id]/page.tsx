'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import { formatAccountSize, getUserChallenges, isProChallenge, parseMeta } from '@/lib/challenges'
import type { User } from '@supabase/supabase-js'
import type { UserChallenge } from '@/lib/challenges'
import type { Database, Json } from '@/types/database'

type DataRow = Record<string, unknown>
type AccountStateRow = Database['public']['Tables']['prop_account_states']['Row']
type TerminalData = {
  state: AccountStateRow | null
  metrics: DataRow | null
  trades: DataRow[]
  positions: DataRow[]
  pendingOrders: DataRow[]
  dailyPnl: DataRow[]
  equityCurve: DataRow[]
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
const moneyCents = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const empty = '—'

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const metricNumber = (row: DataRow | null, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = asNumber(row?.[key])
    if (value !== null) return value
  }
  return fallback
}

const metricString = (row: DataRow | null, keys: string[], fallback = empty) => {
  for (const key of keys) {
    const value = row?.[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return fallback
}

const jsonArray = (value: Json | unknown): DataRow[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is DataRow => item !== null && typeof item === 'object' && !Array.isArray(item))
}

const jsonObject = (value: Json | unknown): DataRow => {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as DataRow : {}
}

function tradePnl(trade: DataRow) {
  return metricNumber(trade, ['pnl', 'netPnl', 'grossPnl', 'profit'], 0)
}

function buildDailyPnl(trades: DataRow[], snapshots: DataRow[]) {
  const byDay = new Map<string, number>()
  for (const trade of trades) {
    const closedAt = asNumber(trade.closedAt) ?? asNumber(trade.closed_at)
    if (!closedAt) continue
    const day = new Date(closedAt).toISOString().slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + tradePnl(trade))
  }
  if (byDay.size > 0) {
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pnl]) => ({ date, pnl, daily_pnl: pnl }))
  }
  return snapshots
    .map((row) => ({
      date: asNumber(row.t) ? new Date(asNumber(row.t) as number).toISOString().slice(0, 10) : undefined,
      equity: asNumber(row.equity),
      balance: asNumber(row.equity),
      value: asNumber(row.equity),
      pnl: 0,
      daily_pnl: 0,
    }))
    .filter((row) => row.date)
}

function buildEquityCurve(state: AccountStateRow, trades: DataRow[], snapshots: DataRow[]) {
  if (snapshots.length > 1) {
    return snapshots
      .map((row) => ({
        t: asNumber(row.t),
        equity: asNumber(row.equity),
        balance: asNumber(row.equity),
        value: asNumber(row.equity),
      }))
      .filter((row) => row.t && row.equity !== null)
  }

  const starting = Number(state.starting_balance) || Number(state.balance) || 0
  let running = starting
  const sortedTrades = [...trades].sort((a, b) => {
    const aClosed = asNumber(a.closedAt) ?? asNumber(a.closed_at) ?? 0
    const bClosed = asNumber(b.closedAt) ?? asNumber(b.closed_at) ?? 0
    return aClosed - bClosed
  })
  const points: DataRow[] = [{ t: asNumber(jsonObject(state.extra).simStartedAt) ?? Date.now(), equity: starting, balance: starting, value: starting }]
  for (const trade of sortedTrades) {
    running += tradePnl(trade)
    points.push({
      t: asNumber(trade.closedAt) ?? asNumber(trade.closed_at) ?? Date.now(),
      equity: running,
      balance: running,
      value: running,
    })
  }
  points.push({ t: Date.now(), equity: Number(state.equity) || running, balance: Number(state.balance) || running, value: Number(state.equity) || running })
  return points
}

async function fetchTerminalData(account: UserChallenge): Promise<TerminalData> {
  const accountIds = [...new Set(
    [account.account_id, account.id]
      .filter(Boolean)
      .flatMap((id) => [String(id), String(id).toLowerCase(), String(id).toUpperCase()]),
  )]
  for (const accountId of accountIds) {
    const { data, error } = await supabase
      .from('prop_account_states')
      .select('*')
      .eq('user_id', account.user_id)
      .eq('account_id', accountId)
      .maybeSingle()
    if (!error && data) {
      const trades = jsonArray(data.trade_history)
      const positions = jsonArray(data.open_positions)
      const extra = jsonObject(data.extra)
      const pendingOrders = jsonArray(extra.pendingOrders)
      const snapshots = jsonArray(extra.equitySnapshots)
      return {
        state: data,
        metrics: data as unknown as DataRow,
        trades,
        positions,
        pendingOrders,
        dailyPnl: buildDailyPnl(trades, snapshots),
        equityCurve: buildEquityCurve(data, trades, snapshots),
      }
    }
  }

  return {
    state: null,
    metrics: null,
    trades: [],
    positions: [],
    pendingOrders: [],
    dailyPnl: [],
    equityCurve: [],
  }
}

function buildMetrics(account: UserChallenge, data: TerminalData) {
  const challenge = account.challenge
  const meta = challenge ? parseMeta(challenge) : null
  const row = data.metrics
  const state = data.state
  const size = metricNumber(row, ['starting_balance'], meta?.account_size ?? 25000)
  const targetPct = metricNumber(row, ['profit_target_pct'], meta?.profit_target ?? 6)
  const maxDrawdownPct = metricNumber(row, ['max_drawdown_pct'], meta?.max_drawdown ?? 4)
  const targetAmount = size * (targetPct / 100)
  // For funded accounts, max DD is HWM-based (trailing); for eval it's fixed to starting size.
  // maxDrawdownAmount here is just used for the progress bar denominator — computed after hwm/ddAnchor below.
  const tradingDayThreshold = size * 0.005
  const tradingDayTarget = meta?.min_trading_days ?? 5
  const isFailed = account.status === 'failed' || account.status === 'expired'
  const isPassed = account.status === 'passed' || account.status === 'completed'
  const balance = metricNumber(row, ['balance', 'current_balance'], size)
  const equity = metricNumber(row, ['equity', 'current_equity'], balance)
  const realized = data.trades.reduce((sum, trade) => sum + tradePnl(trade), 0)
  const unrealized = metricNumber(row, ['unrealized_pnl', 'unrealizedPnl'], equity - balance)
  const todayKey = new Date().toISOString().slice(0, 10)
  const todayFromTrades = data.trades.reduce((sum, trade) => {
    const closedAt = asNumber(trade.closedAt) ?? asNumber(trade.closed_at)
    if (!closedAt || new Date(closedAt).toISOString().slice(0, 10) !== todayKey) return sum
    return sum + tradePnl(trade)
  }, 0)
  const todaysPnl = metricNumber(row, ['today_pnl', 'todays_pnl', 'daily_pnl'], todayFromTrades)
  const netReturn = ((equity - size) / size) * 100
  const startedAt = asNumber(jsonObject(state?.extra).simStartedAt) ?? new Date(account.purchase_date || account.created_at).getTime()
  const daysActive = metricNumber(row, ['day_count'], Math.max(1, Math.floor((Date.now() - startedAt) / 86400000)))
  const progress = isPassed || state?.stage === 'Funded'
    ? 100
    : isFailed || state?.status === 'failed'
      ? 0
      : Math.min(100, Math.max(0, ((equity - size) / targetAmount) * 100))
  const trades = metricNumber(row, ['total_trades', 'trades'], data.trades.length)
  const wins = data.trades.filter((trade) => tradePnl(trade) > 0)
  const losses = data.trades.filter((trade) => tradePnl(trade) < 0)
  const tradePnls = data.trades.map(tradePnl)
  const grossWins = wins.reduce((sum, trade) => sum + tradePnl(trade), 0)
  const grossLosses = losses.reduce((sum, trade) => sum + tradePnl(trade), 0)
  const bestDayFromRows = data.dailyPnl.reduce((best, row) => Math.max(best, metricNumber(row, ['pnl', 'daily_pnl'], 0)), 0)
  const worstDayFromRows = data.dailyPnl.reduce((worst, row) => Math.min(worst, metricNumber(row, ['pnl', 'daily_pnl'], 0)), 0)
  const avgDaily = data.dailyPnl.length
    ? data.dailyPnl.reduce((sum, row) => sum + metricNumber(row, ['pnl', 'daily_pnl'], 0), 0) / data.dailyPnl.length
    : 0
  const sortedDaily = data.dailyPnl.map((row) => metricNumber(row, ['pnl', 'daily_pnl'], 0)).sort((a, b) => a - b)
  const medianDaily = sortedDaily.length
    ? sortedDaily[Math.floor(sortedDaily.length / 2)]
    : 0
  const holdTimes = data.trades
    .map((trade) => {
      const openedAt = asNumber(trade.openedAt) ?? asNumber(trade.opened_at)
      const closedAt = asNumber(trade.closedAt) ?? asNumber(trade.closed_at)
      return openedAt && closedAt && closedAt > openedAt ? closedAt - openedAt : null
    })
    .filter((value): value is number => value !== null)
  const avgHoldMs = holdTimes.length ? holdTimes.reduce((sum, value) => sum + value, 0) / holdTimes.length : 0
  const buyCount = data.trades.filter((trade) => metricString(trade, ['side'], '').toUpperCase() === 'BUY').length
  const sellCount = data.trades.filter((trade) => metricString(trade, ['side'], '').toUpperCase() === 'SELL').length
  const winRate = data.trades.length ? (wins.length / data.trades.length) * 100 : metricNumber(row, ['win_rate', 'winRate'], 0)
  const targetRemaining = Math.max(0, targetAmount - Math.max(0, equity - size))
  const drawdownMode = metricString(row, ['drawdown_mode', 'drawdownMode'], meta?.drawdown_type === 'EOD' ? 'eod' : 'intraday')
  const rawHwm = metricNumber(row, ['drawdown_hwm', 'peak_equity', 'peakEquity'], size)
  const peakEquity = Math.max(rawHwm, equity, balance, size)
  const ddAnchor = drawdownMode === 'eod' ? Math.max(rawHwm, size) : peakEquity
  const maxDrawdownAmount = ddAnchor * (maxDrawdownPct / 100)
  const ddFloor = ddAnchor * (1 - maxDrawdownPct / 100)
  const drawdownUsed = Math.max(0, ddAnchor - equity)
  const drawdownRemaining = metricNumber(row, ['max_drawdown_remaining', 'drawdown_remaining'], Math.max(0, equity - ddFloor))
  const qualifiedTradingDays = data.dailyPnl.filter((row) => metricNumber(row, ['pnl', 'daily_pnl'], 0) >= tradingDayThreshold).length
  return {
    hasMetrics: !!row,
    size,
    targetPct,
    targetAmount,
    maxDrawdownPct,
    maxDrawdownAmount,
    drawdownMode,
    balance,
    equity,
    realized,
    unrealized,
    todaysPnl,
    netReturn,
    daysActive,
    progress,
    qualifiedTradingDays,
    tradingDayTarget,
    tradingDayThreshold,
    tradingDayProgress: Math.min(100, (qualifiedTradingDays / Math.max(1, tradingDayTarget)) * 100),
    targetRemaining,
    drawdownRemaining,
    peakEquity,
    trades,
    winRate: Number(winRate.toFixed(2)),
    profitFactor: losses.length ? Math.abs(grossWins / grossLosses) : metricNumber(row, ['profit_factor', 'profitFactor'], 0),
    averageWin: wins.length ? grossWins / wins.length : metricNumber(row, ['average_win', 'avg_win'], 0),
    averageLoss: losses.length ? grossLosses / losses.length : metricNumber(row, ['average_loss', 'avg_loss'], 0),
    riskRewardRatio: wins.length && losses.length ? Math.abs((grossWins / wins.length) / (grossLosses / losses.length)) : metricNumber(row, ['risk_reward_ratio', 'risk_reward'], 0),
    expectancy: data.trades.length ? realized / data.trades.length : metricNumber(row, ['expectancy'], 0),
    averageHoldTime: avgHoldMs ? `${Math.max(1, Math.round(avgHoldMs / 60000))}m` : metricString(row, ['average_hold_time', 'avg_hold_time']),
    longShort: data.trades.length ? `${buyCount} / ${sellCount}` : metricString(row, ['long_vs_short', 'long_short']),
    bestDay: metricNumber(row, ['best_day', 'best_day_pnl'], bestDayFromRows),
    worstDay: metricNumber(row, ['worst_day', 'worst_day_pnl'], worstDayFromRows),
    largestWinningDayPct: metricNumber(row, ['largest_winning_day_pct'], (bestDayFromRows / size) * 100),
    largestLosingDayPct: metricNumber(row, ['largest_losing_day_pct'], (worstDayFromRows / size) * 100),
    consistencyScore: metricNumber(row, ['consistency_score'], data.dailyPnl.length ? Math.round((data.dailyPnl.filter((row) => metricNumber(row, ['pnl', 'daily_pnl'], 0) >= 0).length / data.dailyPnl.length) * 100) : 0),
    consecutiveGreenDays: metricNumber(row, ['consecutive_green_days'], data.dailyPnl.filter((row) => metricNumber(row, ['pnl', 'daily_pnl'], 0) > 0).length),
    consecutiveRedDays: metricNumber(row, ['consecutive_red_days'], data.dailyPnl.filter((row) => metricNumber(row, ['pnl', 'daily_pnl'], 0) < 0).length),
    currentStreak: metricString(row, ['current_streak']),
    averageDailyReturn: metricNumber(row, ['average_daily_return'], (avgDaily / size) * 100),
    medianDailyReturn: metricNumber(row, ['median_daily_return'], (medianDaily / size) * 100),
    largestLosingTrade: metricNumber(row, ['largest_losing_trade'], tradePnls.length ? Math.min(...tradePnls) : 0),
    largestWinningTrade: metricNumber(row, ['largest_winning_trade'], tradePnls.length ? Math.max(...tradePnls) : 0),
    // Trade history has no stored stop-loss, so "risk" is approximated as the margin
    // committed per trade (notional / leverage) relative to account size — how much
    // capital was on the line, not a hypothetical stop-based loss.
    averageRiskPerTrade: metricNumber(row, ['average_risk_per_trade'], data.trades.length
      ? (data.trades.reduce((sum, trade) => {
          const notional = Math.abs(metricNumber(trade, ['entry'], 0) * metricNumber(trade, ['qty'], 0))
          const leverage = metricNumber(trade, ['leverage'], 1) || 1
          return sum + notional / leverage
        }, 0) / data.trades.length / size) * 100
      : 0),
    averageLeverage: metricNumber(row, ['average_leverage'], data.trades.length ? data.trades.reduce((sum, trade) => sum + metricNumber(trade, ['leverage'], 0), 0) / data.trades.length : 0),
    maxLeverageUsed: metricNumber(row, ['max_leverage_used'], Math.max(0, ...data.trades.map((trade) => metricNumber(trade, ['leverage'], 0)), ...data.positions.map((pos) => metricNumber(pos, ['leverage'], 0)))),
    currentExposure: metricNumber(row, ['current_exposure'], data.positions.reduce((sum, pos) => sum + Math.abs(metricNumber(pos, ['entry'], 0) * metricNumber(pos, ['qty'], 0)), 0)),
    // Margin currently committed to open positions (notional / leverage) as a share
    // of equity — genuinely 0% when flat, not a hardcoded fallback.
    marginUsage: metricNumber(row, ['margin_usage'], equity > 0 && data.positions.length
      ? (data.positions.reduce((sum, pos) => {
          const notional = Math.abs(metricNumber(pos, ['entry'], 0) * metricNumber(pos, ['qty'], 0))
          const leverage = metricNumber(pos, ['leverage'], 1) || 1
          return sum + notional / leverage
        }, 0) / equity) * 100
      : 0),
    liquidationBuffer: metricNumber(row, ['liquidation_buffer'], 0),
    pendingOrders: metricNumber(row, ['pending_orders'], data.pendingOrders.length),
    openRisk: metricNumber(row, ['open_risk'], data.positions.reduce((sum, pos) => sum + Math.abs(metricNumber(pos, ['sl'], 0) * metricNumber(pos, ['qty'], 0)), 0)),
    totalExposure: metricNumber(row, ['total_exposure'], data.positions.reduce((sum, pos) => sum + Math.abs(metricNumber(pos, ['entry'], 0) * metricNumber(pos, ['qty'], 0)), 0)),
    largestPosition: data.positions.length ? metricString(data.positions[0], ['symbol'], empty) : metricString(row, ['largest_position']),
    averageEntry: data.positions.length ? money(data.positions.reduce((sum, pos) => sum + metricNumber(pos, ['entry'], 0), 0) / data.positions.length) : metricString(row, ['average_entry']),
    currentFees: metricNumber(row, ['current_fees'], 0),
    fundingPaid: metricNumber(row, ['funding_paid'], 0),
    fundingReceived: metricNumber(row, ['funding_received'], 0),
  }
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[rgba(214,219,208,0.08)] bg-[rgba(10,11,13,0.76)] p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">{label}</p>
      <p className="mt-2 text-xl font-bold text-text-primary">{value}</p>
      {sub && <p className="mt-1 text-xs text-text-secondary">{sub}</p>}
    </div>
  )
}

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-[rgba(214,219,208,0.08)] bg-[rgba(8,9,11,0.72)] p-5 ${className}`}>
      <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[rgb(62,242,120)]">{title}</h2>
      {children}
    </section>
  )
}

function ProgressBar({ value, tone = 'green' }: { value: number; tone?: 'green' | 'red' | 'gray' }) {
  const color = tone === 'red' ? '#ef4444' : tone === 'gray' ? '#8b949e' : 'rgb(62,242,120)'
  const segments = 20
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * segments)
  return (
    <div className="grid w-full gap-px" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}>
      {Array.from({ length: segments }, (_, i) => (
        <div
          key={i}
          className="h-1.5 border border-white/10 bg-[rgba(214,219,208,0.045)]"
          style={{ background: i < filled ? color : 'rgba(214,219,208,0.045)' }}
        />
      ))}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/5 py-2 first:border-t-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  )
}

function CalendarGrid({ rows }: { rows: DataRow[] }) {
  const today = new Date()
  const rowByDate = new Map(
    rows
      .map((row) => [typeof row.date === 'string' ? row.date : '', row] as const)
      .filter(([date]) => date),
  )
  const cells = Array.from({ length: 35 }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (34 - i))
    return { date, row: rowByDate.get(date.toISOString().slice(0, 10)) }
  })
  return (
    <div>
      <div className="mb-3 grid grid-cols-7 gap-2 text-center text-[10px] font-bold uppercase tracking-widest text-text-secondary">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map(({ date, row }, i) => {
          const pnl = asNumber(row?.pnl) ?? asNumber(row?.daily_pnl) ?? 0
          const isToday = date.toDateString() === today.toDateString()
          const tone = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : 'flat'
          const bg = tone === 'positive'
            ? `linear-gradient(145deg, rgba(62,242,120,${Math.min(0.42, 0.10 + Math.abs(pnl) / 10000)}), rgba(62,242,120,0.05))`
            : tone === 'negative'
              ? `linear-gradient(145deg, rgba(239,68,68,${Math.min(0.40, 0.10 + Math.abs(pnl) / 10000)}), rgba(239,68,68,0.04))`
              : 'linear-gradient(145deg, rgba(214,219,208,0.055), rgba(214,219,208,0.018))'
          return (
            <div
              key={i}
              className={`min-h-16 rounded-lg border p-2 transition-colors ${
                isToday ? 'border-primary/45 shadow-[0_0_0_1px_rgba(62,242,120,0.18)]' : 'border-white/5'
              }`}
              style={{ background: bg }}
              title={`${date.toLocaleDateString()} ${moneyCents(pnl)}`}
            >
              <div className="flex h-full flex-col justify-between">
                <span className="text-[11px] font-bold text-text-secondary">{date.getDate()}</span>
                <span className={`truncate text-[11px] font-bold ${pnl > 0 ? 'text-primary' : pnl < 0 ? 'text-red-300' : 'text-text-secondary'}`}>
                  {pnl === 0 ? '-' : moneyCents(pnl)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {rows.length === 0 && (
        <p className="mt-4 text-sm text-text-secondary">No history yet.</p>
      )}
    </div>
  )
}

export default function AccountTerminalPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [account, setAccount] = useState<UserChallenge | null>(null)
  const [terminalData, setTerminalData] = useState<TerminalData>({ state: null, metrics: null, trades: [], positions: [], pendingOrders: [], dailyPnl: [], equityCurve: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)
  const [existingPayout, setExistingPayout] = useState<{ status: string; payout_amount: number; created_at: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/signin'); return }
      setUser(session.user)
      setSessionToken(session.access_token)
      const accounts = await getUserChallenges(session.user.id).catch(() => [])
      let found = accounts.find((item) => item.id === params.id || item.account_id === params.id)
      if (!found) { router.push('/dashboard'); return }
      setAccount(found)
      const data = await fetchTerminalData(found)
      // Treat as failed if either user_challenges or prop_account_states says failed
      const isFailed = found.status === 'failed' || found.status === 'expired' || data.state?.status === 'failed'
      if (isFailed && found.status === 'active') {
        await supabase.from('user_challenges').update({ status: 'failed' }).eq('id', found.id)
        found = { ...found, status: 'failed' }
      }
      if (isFailed && data.state && (data.positions.length > 0 || data.pendingOrders.length > 0)) {
        await supabase
          .from('prop_account_states')
          .update({ open_positions: [], extra: { ...(typeof data.state.extra === 'object' && data.state.extra !== null && !Array.isArray(data.state.extra) ? data.state.extra : {}), pendingOrders: [] } })
          .eq('account_id', data.state.account_id)
          .eq('user_id', data.state.user_id)
        data.positions = []
        data.pendingOrders = []
      }
      setTerminalData(data)
      // Load existing payout request if funded
      const isFundedNow = found.status === 'funded' || data.state?.stage === 'Funded'
      if (isFundedNow && found.account_id) {
        const pr = await fetch(
          `/api/accounts/payout-request?account_id=${encodeURIComponent(found.account_id)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        ).then((r) => r.json()).catch(() => null)
        if (pr?.payouts?.[0]) setExistingPayout(pr.payouts[0])
      }
      setIsLoading(false)
    }
    load()
  }, [params.id, router])

  const metrics = useMemo(() => account ? buildMetrics(account, terminalData) : null, [account, terminalData])
  const challenge = account?.challenge
  const meta = challenge ? parseMeta(challenge) : null
  const isPro = isProChallenge(challenge)
  const walletAddress = user?.user_metadata?.wallet_address as string | undefined
  const displayEmail = walletAddress ?? user?.email

  if (isLoading || !account || !metrics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const liveStatus = terminalData.state?.status ?? account.status
  const isPermanentlyFailed = account.status === 'failed' || account.status === 'expired' || liveStatus === 'failed'
  const isFunded = !isPermanentlyFailed && (liveStatus === 'funded' || terminalData.state?.stage === 'Funded' || upgradeSuccess)
  const status = isPermanentlyFailed
    ? 'Failed'
    : isFunded
      ? 'Funded'
      : liveStatus === 'completed' || liveStatus === 'passed'
        ? 'Passed'
        : liveStatus.charAt(0).toUpperCase() + liveStatus.slice(1)
  const phase = isFunded || status === 'Passed' ? 'Funded' : 'Phase 1'
  const canUpgrade = !isPermanentlyFailed && !isFunded && metrics.progress >= 100

  const handleUpgradeFunded = async () => {
    if (!sessionToken || !account.account_id) return
    setUpgrading(true)
    setUpgradeError(null)
    try {
      const res = await fetch('/api/accounts/upgrade-funded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ accountId: account.account_id }),
      })
      const data = await res.json() as { error?: string; success?: boolean }
      if (!res.ok) throw new Error(data.error ?? 'Upgrade failed.')
      setUpgradeSuccess(true)
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : 'Upgrade failed.')
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <DashboardLayout userEmail={displayEmail} userAvatar={user?.user_metadata?.avatar_url} userId={user?.id} userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]} accountBalance={money(metrics.equity)}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-primary">
              Back to accounts
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-text-primary">
              {meta ? formatAccountSize(meta.account_size) : 'PropDAO'} {isPro ? 'Pro ' : ''}Risk
            </h1>
            <p className="mt-2 font-mono text-xs text-text-secondary">{account.account_id ?? account.id}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="rounded-xl border border-[rgba(62,242,120,0.18)] bg-[rgba(62,242,120,0.06)] px-4 py-3 text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Equity</p>
              <p className="text-3xl font-black text-text-primary">{money(metrics.equity)}</p>
            </div>
            {canUpgrade && (
              <button
                type="button"
                onClick={handleUpgradeFunded}
                disabled={upgrading}
                className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {upgrading ? 'Upgrading…' : 'Upgrade to Funded'}
              </button>
            )}
            {upgradeSuccess && (
              <p className="text-sm font-bold text-emerald-300">Account upgraded to Funded!</p>
            )}
            {upgradeError && (
              <p className="text-sm text-red-300">{upgradeError}</p>
            )}
          </div>
        </div>

        {isPermanentlyFailed && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 shrink-0 text-red-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p className="font-bold text-red-300 text-sm">This account has failed</p>
                <p className="mt-1 text-xs text-red-300/70">The drawdown limit was breached. This challenge cannot be restarted or recovered. All open positions have been liquidated. You may purchase a new challenge to start again.</p>
              </div>
            </div>
          </div>
        )}

        {!metrics.hasMetrics && !isPermanentlyFailed && (
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-4 py-3 text-sm text-amber-100/80">
            No trading activity yet. Balance defaults to the challenge size until your first trade.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
          <MetricCard label="Balance" value={money(metrics.balance)} />
          <MetricCard label="Equity" value={money(metrics.equity)} />
          <MetricCard label="Today's PnL" value={money(metrics.todaysPnl)} sub={pct((metrics.todaysPnl / metrics.size) * 100)} />
          <MetricCard label="Remaining DD" value={money(metrics.drawdownRemaining)} sub={`${metrics.maxDrawdownPct}% max`} />
          {!isFunded && <MetricCard label="Profit Target" value={money(metrics.targetRemaining)} sub={`${metrics.targetPct}% target`} />}
          <MetricCard label="Win Rate" value={`${metrics.winRate}%`} />
          <MetricCard label="Total Trades" value={String(metrics.trades)} />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Section title="Challenge Summary">
            <StatRow label="Challenge Phase" value={phase} />
            <StatRow label="Challenge Progress" value={`${metrics.progress}% complete`} />
            <StatRow label="Days Active" value={`${metrics.daysActive} days`} />
            <StatRow label="Account Size" value={formatAccountSize(metrics.size)} />
            <StatRow label="Status" value={status} />
            <StatRow label="Time Remaining" value="No expiry" />
            <div className="mt-5 border-t border-white/5 pt-4">
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Trading Days</p>
                  <p className="mt-1 text-xl font-black text-text-primary">{metrics.qualifiedTradingDays} / {metrics.tradingDayTarget}</p>
                </div>
                <span className="text-xs text-text-secondary">{money(metrics.tradingDayThreshold)} daily PnL minimum</span>
              </div>
              <ProgressBar value={metrics.tradingDayProgress} tone="green" />
            </div>
          </Section>
          {isFunded ? (
            <Section title="Funded Account">
              <p className="mb-4 text-xs text-emerald-300/80">
                {metrics.drawdownMode === 'eod'
                  ? 'Profit target achieved. Drawdown is managed by the EOD balance.'
                  : 'Profit target achieved. Drawdown now trails your peak balance.'}
              </p>
              <StatRow label="Balance" value={money(metrics.balance)} />
              <StatRow label="Equity" value={money(metrics.equity)} />
              <StatRow label="Net Return" value={pct(metrics.netReturn)} />
              <StatRow label={metrics.drawdownMode === 'eod' ? 'EOD Anchor' : 'Peak Balance'} value={money(metrics.peakEquity)} />

              <div className="mt-5 border-t border-white/5 pt-5">
                <Link
                  href={`/dashboard/accounts/${account.id}/payout`}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  Request Payout →
                </Link>
              </div>
            </Section>
          ) : (
            <Section title="Profit Target Progress">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <span className="text-3xl font-black text-text-primary">{metrics.progress.toFixed(1)}%</span>
                  <p className="mt-1 text-xs text-text-secondary">{money(metrics.targetAmount - metrics.targetRemaining)} / {money(metrics.targetAmount)}</p>
                </div>
                <span className="text-sm text-text-secondary">{money(metrics.targetRemaining)} left</span>
              </div>
              <ProgressBar value={metrics.progress} />
              <div className="mt-5">
                <StatRow label="Balance" value={money(metrics.balance)} />
                <StatRow label="Equity" value={money(metrics.equity)} />
                <StatRow label="Net Return" value={pct(metrics.netReturn)} />
              </div>
            </Section>
          )}
          <Section title="Max DD">
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-text-secondary">Drawdown remaining</span>
              <span className="font-bold text-text-primary">{money(metrics.drawdownRemaining)}</span>
            </div>
            <ProgressBar value={(metrics.drawdownRemaining / metrics.maxDrawdownAmount) * 100} tone="red" />
            <p className="mt-3 text-xs text-text-secondary">{money(metrics.maxDrawdownAmount - metrics.drawdownRemaining)} used of {money(metrics.maxDrawdownAmount)}</p>
            <StatRow label="Max Drawdown" value={money(metrics.maxDrawdownAmount)} />
            <StatRow label="Drawdown Type" value={meta?.drawdown_type ?? 'Intraday Trailing'} />
          </Section>
        </div>

        <div className="grid gap-5">
          <Section title="Daily PnL Calendar"><CalendarGrid rows={terminalData.dailyPnl} /></Section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Trading Statistics">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <StatRow label="Win Rate" value={`${metrics.winRate}%`} />
              <StatRow label="Profit Factor" value={metrics.profitFactor.toFixed(2)} />
              <StatRow label="Average Win" value={money(metrics.averageWin)} />
              <StatRow label="Average Loss" value={money(metrics.averageLoss)} />
              <StatRow label="Risk Reward Ratio" value={metrics.riskRewardRatio ? metrics.riskRewardRatio.toFixed(2) : empty} />
              <StatRow label="Expectancy" value={money(metrics.expectancy)} />
              <StatRow label="Average Hold Time" value={metrics.averageHoldTime} />
              <StatRow label="Long vs Short" value={metrics.longShort} />
              <StatRow label="Best Day" value={money(metrics.bestDay)} />
              <StatRow label="Worst Day" value={money(metrics.worstDay)} />
            </div>
          </Section>
          <Section title="Consistency">
            <StatRow label="Largest Winning Day %" value={pct(metrics.largestWinningDayPct)} />
            <StatRow label="Largest Losing Day %" value={pct(metrics.largestLosingDayPct)} />
            <StatRow label="Consistency Score" value={metrics.consistencyScore ? `${metrics.consistencyScore} / 100` : empty} />
            <StatRow label="Consecutive Green Days" value={String(metrics.consecutiveGreenDays)} />
            <StatRow label="Consecutive Red Days" value={String(metrics.consecutiveRedDays)} />
            <StatRow label="Current Streak" value={metrics.currentStreak} />
            <StatRow label="Average Daily Return" value={pct(metrics.averageDailyReturn)} />
            <StatRow label="Median Daily Return" value={pct(metrics.medianDailyReturn)} />
          </Section>
        </div>

        <div className="grid gap-5">
          <Section title="Risk Metrics">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <StatRow label="Largest Losing Trade" value={money(metrics.largestLosingTrade)} />
              <StatRow label="Largest Winning Trade" value={money(metrics.largestWinningTrade)} />
              <StatRow label="Average Risk per Trade" value={pct(metrics.averageRiskPerTrade)} />
              <StatRow label="Average Leverage" value={metrics.averageLeverage ? `${metrics.averageLeverage}x` : empty} />
              <StatRow label="Max Leverage Used" value={metrics.maxLeverageUsed ? `${metrics.maxLeverageUsed}x` : empty} />
              <StatRow label="Current Exposure" value={money(metrics.currentExposure)} />
              <StatRow label="Margin Usage" value={pct(metrics.marginUsage)} />
              <StatRow label="Liquidation Buffer" value={pct(metrics.liquidationBuffer)} />
            </div>
          </Section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Open Positions">
            {terminalData.positions.length > 0 || metrics.pendingOrders > 0 || metrics.openRisk > 0 ? (
              <>
                <StatRow label="Open Positions" value={String(terminalData.positions.length)} />
                <StatRow label="Pending Orders" value={String(metrics.pendingOrders)} />
                <StatRow label="Open Risk" value={money(metrics.openRisk)} />
                <StatRow label="Total Exposure" value={money(metrics.totalExposure)} />
                <StatRow label="Largest Position" value={metrics.largestPosition} />
                <StatRow label="Average Entry" value={metrics.averageEntry} />
                <StatRow label="Current Fees" value={money(metrics.currentFees)} />
                <StatRow label="Funding Paid / Received" value={`${money(metrics.fundingPaid)} / ${money(metrics.fundingReceived)}`} />
              </>
            ) : (
              <p className="text-sm text-text-secondary">No open positions.</p>
            )}
          </Section>
          <Section title="Trade History">
            {terminalData.trades.length > 0 ? (
              <div className="max-h-80 overflow-y-auto pr-2">
                {terminalData.trades.map((trade, i) => {
                  const asset = metricString(trade, ['symbol', 'asset', 'market'], `Trade ${i + 1}`)
                  const direction = metricString(trade, ['direction', 'side'], '')
                  const pnl = metricNumber(trade, ['pnl', 'realized_pnl', 'profit'], 0)
                  return <StatRow key={String(trade.id ?? i)} label={`${asset}${direction ? ` ${direction}` : ''}`} value={money(pnl)} />
                })}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No trade history yet.</p>
            )}
          </Section>
        </div>
      </div>
    </DashboardLayout>
  )
}
