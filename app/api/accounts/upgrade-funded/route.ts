import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

function bearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: NextRequest) {
  const admin = getAdmin()
  if (!admin) return NextResponse.json({ error: 'Server not configured.' }, { status: 500 })

  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const accountId = typeof (body as { accountId?: unknown })?.accountId === 'string'
    ? (body as { accountId: string }).accountId
    : ''
  if (!accountId) return NextResponse.json({ error: 'Account ID required.' }, { status: 400 })

  const userId = authData.user.id

  // Verify ownership in user_challenges (account_id stored uppercase)
  const { data: uc, error: ucErr } = await admin
    .from('user_challenges')
    .select('*')
    .eq('user_id', userId)
    .or(`account_id.eq.${accountId},account_id.eq.${accountId.toUpperCase()}`)
    .maybeSingle()

  if (ucErr || !uc) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  if (uc.status === 'failed' || uc.status === 'expired') {
    return NextResponse.json({ error: 'This account has failed and cannot be upgraded.' }, { status: 403 })
  }
  if (uc.status === 'funded') {
    return NextResponse.json({ error: 'Account is already funded.' }, { status: 409 })
  }

  // Read live state from prop_account_states (account_id stored lowercase)
  const accountIdLower = accountId.toLowerCase()
  const { data: state } = await admin
    .from('prop_account_states')
    .select('equity, starting_balance, profit_target_pct, stage, status')
    .eq('user_id', userId)
    .eq('account_id', accountIdLower)
    .maybeSingle()

  if (state) {
    if (state.stage !== 'Funded') {
      const equity = Number(state.equity) || 0
      const startBal = Number(state.starting_balance) || 0
      const targetPct = Number(state.profit_target_pct) || 6
      if (startBal > 0 && targetPct > 0) {
        const profitPct = ((equity - startBal) / startBal) * 100
        if (profitPct < targetPct) {
          return NextResponse.json({
            error: `Profit target not yet met. Current: ${profitPct.toFixed(2)}%, Required: ${targetPct}%`,
          }, { status: 403 })
        }
      }
      // Mark as funded in prop_account_states
      await admin
        .from('prop_account_states')
        .update({ stage: 'Funded', status: 'funded' })
        .eq('user_id', userId)
        .eq('account_id', accountIdLower)
    }
  }

  // Update user_challenges status
  await admin
    .from('user_challenges')
    .update({ status: 'funded' })
    .eq('id', uc.id)

  return NextResponse.json({ success: true })
}
