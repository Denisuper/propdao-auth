import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function bearerToken(req: NextRequest) {
  return req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
}

function isAdmin(userId: string) {
  return (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).includes(userId)
}

// GET — list all payout requests (pending first, then recent paid)
export async function GET(request: NextRequest) {
  const admin = getAdmin()
  if (!admin) return NextResponse.json({ error: 'Server not configured.' }, { status: 500 })

  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user || !isAdmin(authData.user.id)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { data: payouts, error } = await admin
    .from('payouts')
    .select('*')
    .order('status', { ascending: true }) // pending before paid alphabetically
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with user emails and live equity
  const userIds = [...new Set((payouts ?? []).map((p) => p.user_id as string).filter(Boolean))]
  const userMap: Record<string, string> = {}
  for (const uid of userIds) {
    const { data: u } = await admin.auth.admin.getUserById(uid)
    if (u?.user) userMap[uid] = u.user.email ?? uid
  }

  // Fetch live equity for funded accounts
  const accountIds = [...new Set((payouts ?? []).map((p) => (p.account_id as string).toLowerCase()))]
  const { data: states } = accountIds.length
    ? await admin
        .from('prop_account_states')
        .select('account_id, equity, starting_balance')
        .in('account_id', accountIds)
    : { data: [] }

  const stateMap: Record<string, { equity: number; starting_balance: number }> = {}
  for (const s of states ?? []) {
    stateMap[(s.account_id as string).toLowerCase()] = {
      equity: Number(s.equity),
      starting_balance: Number(s.starting_balance),
    }
  }

  const enriched = (payouts ?? []).map((p) => ({
    ...p,
    user_email: userMap[p.user_id as string] ?? p.user_id,
    live_equity: stateMap[(p.account_id as string).toLowerCase()]?.equity ?? null,
    live_profit: stateMap[(p.account_id as string).toLowerCase()]
      ? Math.max(0, stateMap[(p.account_id as string).toLowerCase()].equity - stateMap[(p.account_id as string).toLowerCase()].starting_balance)
      : null,
  }))

  return NextResponse.json({ payouts: enriched })
}

// POST — mark a payout as paid or rejected, optionally add notes
export async function POST(request: NextRequest) {
  const admin = getAdmin()
  if (!admin) return NextResponse.json({ error: 'Server not configured.' }, { status: 500 })

  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user || !isAdmin(authData.user.id)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  let body: { payout_id: string; status: 'paid' | 'rejected'; notes?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }

  if (!body.payout_id || !['paid', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'payout_id and status (paid|rejected) required.' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    status: body.status,
    processed_at: new Date().toISOString(),
  }
  if (body.notes !== undefined) update.notes = body.notes

  const { error } = await admin.from('payouts').update(update).eq('id', body.payout_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
