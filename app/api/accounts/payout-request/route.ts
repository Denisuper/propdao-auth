import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

function bearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  return auth.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// POST — trader submits a payout request
export async function POST(request: NextRequest) {
  const admin = getAdmin()
  if (!admin) return NextResponse.json({ error: 'Server not configured.' }, { status: 500 })

  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })

  const userId = authData.user.id

  let body: { account_id?: string; wallet_address?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }

  const { account_id, wallet_address } = body
  if (!account_id) return NextResponse.json({ error: 'account_id required.' }, { status: 400 })
  if (!wallet_address?.trim()) return NextResponse.json({ error: 'Wallet address required.' }, { status: 400 })

  // Verify ownership and funded status
  const { data: uc } = await admin
    .from('user_challenges')
    .select('id, challenge_id, status')
    .eq('user_id', userId)
    .or(`account_id.eq.${account_id},account_id.eq.${account_id.toUpperCase()}`)
    .maybeSingle()

  if (!uc) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  if (uc.status !== 'funded') return NextResponse.json({ error: 'Only funded accounts can request payouts.' }, { status: 403 })

  // Get live state from prop_account_states
  const { data: state } = await admin
    .from('prop_account_states')
    .select('equity, starting_balance, open_positions')
    .eq('user_id', userId)
    .eq('account_id', account_id.toLowerCase())
    .maybeSingle()

  // Block payout if trader has open positions
  const openPositions = (state?.open_positions ?? []) as unknown[]
  if (openPositions.length > 0) {
    return NextResponse.json({ error: 'Close all open positions before requesting a payout.' }, { status: 400 })
  }

  const equity = Number(state?.equity ?? 0)
  const startBal = Number(state?.starting_balance ?? 0)
  // profit_split_pct is not stored in prop_account_states — derive from challenge
  const { data: challenge } = await admin.from('challenges').select('rules').eq('id', uc.challenge_id ?? '').maybeSingle()
  let splitPct = 90
  try { const rules = JSON.parse(challenge?.rules ?? '{}'); splitPct = Number(rules.profit_split ?? 90) } catch { /* use default */ }

  const profit = Math.max(0, equity - startBal)
  const payoutAmount = profit * (splitPct / 100)

  if (payoutAmount <= 0) return NextResponse.json({ error: 'No profit available to withdraw.' }, { status: 400 })

  // Block if there's already a pending request for this account
  const { data: existing } = await admin
    .from('payouts')
    .select('id')
    .eq('account_id', account_id.toLowerCase())
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'A payout request is already pending for this account.' }, { status: 409 })

  const { error } = await admin.from('payouts').insert({
    user_id: userId,
    account_id: account_id.toLowerCase(),
    challenge_id: uc.challenge_id ?? null,
    profit_amount: profit,
    payout_amount: payoutAmount,
    profit_split_pct: splitPct,
    wallet_address: wallet_address.trim(),
    status: 'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// GET — trader checks their payout requests for an account
export async function GET(request: NextRequest) {
  const admin = getAdmin()
  if (!admin) return NextResponse.json({ error: 'Server not configured.' }, { status: 500 })

  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })

  const accountId = new URL(request.url).searchParams.get('account_id')
  if (!accountId) return NextResponse.json({ error: 'account_id required.' }, { status: 400 })

  const { data: payouts } = await admin
    .from('payouts')
    .select('id, status, payout_amount, wallet_address, created_at, processed_at, notes')
    .eq('user_id', authData.user.id)
    .eq('account_id', accountId.toLowerCase())
    .order('created_at', { ascending: false })

  return NextResponse.json({ payouts: payouts ?? [] })
}
