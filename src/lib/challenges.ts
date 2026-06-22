import { supabase } from './supabase'
import type { Database } from '@/types/database'

export type Challenge = Database['public']['Tables']['challenges']['Row']
export type UserChallenge = Database['public']['Tables']['user_challenges']['Row'] & {
  challenge?: Challenge
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
  make(
    'prop-5k-000000000-0000-0000-0000-000000000000',
    '$5K Challenge',
    0,
    'Starter funded challenge. Perfect entry point — pass the evaluation and receive a $5,000 live account with a 90% profit split.',
    { account_size: 5000, profit_target: 6, max_drawdown: 4, profit_split: 90, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'Intraday Trailing' },
  ),
  make(
    'prop-10k-00000000-0000-0000-0000-000000000001',
    '$10K Challenge',
    0,
    'Entry-level funded challenge. Pass the evaluation and receive a $10,000 live account with a 90% profit split.',
    { account_size: 10000, profit_target: 6, max_drawdown: 4, profit_split: 90, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'EOD' },
  ),
  make(
    'prop-25k-00000000-0000-0000-0000-000000000002',
    '$25K Challenge',
    0,
    'Standard funded challenge. Trade a $25,000 account and keep 90% of every dollar you make.',
    { account_size: 25000, profit_target: 6, max_drawdown: 4, profit_split: 90, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'EOD' },
  ),
  make(
    'prop-50k-00000000-0000-0000-0000-000000000003',
    '$50K Challenge',
    0,
    'Advanced funded challenge. Scale up to a $50,000 account with industry-leading conditions.',
    { account_size: 50000, profit_target: 6, max_drawdown: 4, profit_split: 90, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'EOD' },
  ),
  make(
    'prop-100k-0000000-0000-0000-0000-000000000004',
    '$100K Challenge',
    0,
    'Professional-level evaluation. Prove your edge and receive a $100,000 funded account.',
    { account_size: 100000, profit_target: 6, max_drawdown: 4, profit_split: 90, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'EOD' },
  ),
  make(
    'prop-200k-0000000-0000-0000-0000-000000000005',
    '$200K Challenge',
    0,
    'Elite-tier challenge with tighter drawdown rules. The highest-stakes evaluation PropDAO offers.',
    { account_size: 200000, profit_target: 6, max_drawdown: 3, profit_split: 90, min_trading_days: 5, min_trade_size: 0.5, drawdown_type: 'EOD' },
  ),
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseMeta(challenge: Challenge): ChallengeMeta | null {
  try {
    const data = JSON.parse(challenge.rules)
    if (data && typeof data === 'object' && 'account_size' in data) {
      return data as ChallengeMeta
    }
    return null
  } catch {
    return null
  }
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

  return (data ?? []).map((uc) => ({
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

export async function enrollChallenge(userId: string, challengeId: string): Promise<UserChallenge> {
  const challenge = STATIC_CHALLENGES.find((c) => c.id === challengeId)

  // Upsert the challenge row first so any FK constraint on user_challenges is satisfied.
  // Silently ignore errors — if RLS blocks it and no FK constraint exists, it still works.
  if (challenge) {
    await supabase.from('challenges').upsert(
      {
        id: challenge.id,
        name: challenge.name,
        difficulty: challenge.difficulty,
        duration: challenge.duration,
        price: challenge.price,
        description: challenge.description,
        rules: challenge.rules,
      },
      { onConflict: 'id' },
    )
  }

  const { data, error } = await supabase
    .from('user_challenges')
    .insert({
      user_id: userId,
      challenge_id: challengeId,
      status: 'active',
      purchase_date: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return {
    ...(data as UserChallenge),
    challenge,
  }
}
