import { supabase } from './supabase'
import type { Database } from '@/types/database'

export type Challenge = Database['public']['Tables']['challenges']['Row']
export type PropAccountState = Database['public']['Tables']['prop_account_states']['Row']
export type UserChallenge = Database['public']['Tables']['user_challenges']['Row'] & {
  challenge?: Challenge
  account_state?: PropAccountState | null
}

export interface ChallengeMeta {
  account_size: number
  profit_target: number
  max_drawdown: number
  profit_split: number
  min_trading_days: number
  min_trade_size: number
  drawdown_type: string
}

// ─── Static challenge definitions ────────────────────────────────────────────
// Fixed tiers — no DB seeding required. Only user_challenges needs the database.
// UUIDs are stable so challenge_id foreign keys stay consistent across deploys.

const make = (
  id: string,
  name: string,
  price: number,
  description: string,
  meta: ChallengeMeta,
): Challenge => ({
  id,
  name,
  difficulty: 'prop',
  duration: 0,
  price,
  description,
  rules: JSON.stringify(meta),
  created_at: '2024-01-01T00:00:00.000Z',
})

export const STATIC_CHALLENGES: readonly Challenge[] = [
  // ── Standard ──────────────────────────────────────────────────────────────
  make(
    'prop-5k-000000000-0000-0000-0000-000000000000',
    '$5K Challenge',
    20,
    'Starter funded challenge. Perfect entry point — pass the evaluation and receive a $5,000 live account with a 90% profit split.',
    { account_size: 5000, profit_target: 6, max_drawdown: 4, profit_split: 80, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'Intraday Trailing' },
  ),
  make(
    'prop-10k-00000000-0000-0000-0000-000000000001',
    '$10K Challenge',
    50,
    'Entry-level funded challenge. Pass the evaluation and receive a $10,000 live account with a 90% profit split.',
    { account_size: 10000, profit_target: 6, max_drawdown: 4, profit_split: 80, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'Intraday Trailing' },
  ),
  make(
    'prop-25k-00000000-0000-0000-0000-000000000002',
    '$25K Challenge',
    120,
    'Standard funded challenge. Trade a $25,000 account and keep 80% of every dollar you make.',
    { account_size: 25000, profit_target: 6, max_drawdown: 4, profit_split: 80, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'Intraday Trailing' },
  ),
  make(
    'prop-50k-00000000-0000-0000-0000-000000000003',
    '$50K Challenge',
    220,
    'Advanced funded challenge. Scale up to a $50,000 account with industry-leading conditions.',
    { account_size: 50000, profit_target: 6, max_drawdown: 4, profit_split: 80, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'Intraday Trailing' },
  ),
  make(
    'prop-100k-0000000-0000-0000-0000-000000000004',
    '$100K Challenge',
    380,
    'Professional-level evaluation. Prove your edge and receive a $100,000 funded account.',
    { account_size: 100000, profit_target: 6, max_drawdown: 4, profit_split: 80, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'Intraday Trailing' },
  ),
  make(
    'prop-200k-0000000-0000-0000-0000-000000000005',
    '$200K Challenge',
    700,
    'Elite-tier challenge with tighter drawdown rules. The highest-stakes evaluation PropDAO offers.',
    { account_size: 200000, profit_target: 6, max_drawdown: 3, profit_split: 80, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'Intraday Trailing' },
  ),
  // ── Pro (non-bronze only) ──────────────────────────────────────────────────
  make(
    'prop-25k-pro00000-0000-0000-0000-000000000006',
    '$25K Pro Challenge',
    150,
    'Pro-tier funded challenge. Lower targets, faster funding, and a 90% profit split from day one.',
    { account_size: 25000, profit_target: 4, max_drawdown: 4, profit_split: 90, min_trading_days: 3, min_trade_size: 0.5, drawdown_type: 'EOD' },
  ),
  make(
    'prop-50k-pro00000-0000-0000-0000-000000000007',
    '$50K Pro Challenge',
    320,
    'Pro-tier 50K evaluation with a 4% profit target, 3-day minimum, and full 90% split.',
    { account_size: 50000, profit_target: 4, max_drawdown: 4, profit_split: 90, min_trading_days: 3, min_trade_size: 0.5, drawdown_type: 'EOD' },
  ),
  make(
    'prop-100k-pro0000-0000-0000-0000-000000000008',
    '$100K Pro Challenge',
    540,
    'Pro-tier six-figure account. 4% target, instant EOD drawdown, 90% split.',
    { account_size: 100000, profit_target: 4, max_drawdown: 4, profit_split: 90, min_trading_days: 3, min_trade_size: 0.5, drawdown_type: 'EOD' },
  ),
  make(
    'prop-200k-pro0000-0000-0000-0000-000000000009',
    '$200K Pro Challenge',
    990,
    'Elite Pro challenge. The highest-stakes Pro evaluation with a 4% target and full 90% profit split.',
    { account_size: 200000, profit_target: 4, max_drawdown: 3, profit_split: 90, min_trading_days: 3, min_trade_size: 0.5, drawdown_type: 'EOD' },
  ),
]

// Maps a standard challenge ID → its Pro variant ID (non-bronze only)
export const PRO_CHALLENGE_MAP: Record<string, string> = {
  'prop-25k-00000000-0000-0000-0000-000000000002': 'prop-25k-pro00000-0000-0000-0000-000000000006',
  'prop-50k-00000000-0000-0000-0000-000000000003': 'prop-50k-pro00000-0000-0000-0000-000000000007',
  'prop-100k-0000000-0000-0000-0000-000000000004': 'prop-100k-pro0000-0000-0000-0000-000000000008',
  'prop-200k-0000000-0000-0000-0000-000000000005': 'prop-200k-pro0000-0000-0000-0000-000000000009',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseMeta(challenge: Challenge): ChallengeMeta | null {
  try {
    const data = JSON.parse(challenge.rules)
    if (data && typeof data === 'object' && 'account_size' in data) {
      return {
        ...(data as ChallengeMeta),
        drawdown_type: challenge.id.toLowerCase().includes('-pro') ? 'EOD' : 'Intraday Trailing',
      }
    }
    return null
  } catch {
    return null
  }
}

export function isProChallenge(challenge: Challenge | null | undefined): boolean {
  if (!challenge) return false
  const meta = parseMeta(challenge)
  return meta?.profit_target === 4 && meta?.profit_split === 90
}

export function formatAccountSize(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

// ─── Data layer ───────────────────────────────────────────────────────────────

export async function getChallenges(): Promise<Challenge[]> {
  return [...STATIC_CHALLENGES]
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  return STATIC_CHALLENGES.find((c) => c.id === id) ?? null
}

export async function getUserChallenges(userId: string): Promise<UserChallenge[]> {
  const { data, error } = await supabase
    .from('user_challenges')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const rows = data ?? []

  return rows.map((uc) => ({
    ...uc,
    challenge: STATIC_CHALLENGES.find((c) => c.id === uc.challenge_id),
  })) as UserChallenge[]
}

export async function hasChallenge(userId: string, challengeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_challenges')
    .select('id')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .maybeSingle()
  return !!data
}

export async function enrollChallenge(_userId: string, challengeId: string): Promise<UserChallenge> {
  // Enrollment happens server-side. The userId param is kept for call-site
  // compatibility but the server derives identity from the session token.
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Authentication required')

  const res = await fetch('/api/marketplace/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ challengeId }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Enrollment failed.')

  return (json as { account: UserChallenge }).account
}
