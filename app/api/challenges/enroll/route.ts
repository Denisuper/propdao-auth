import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STATIC_CHALLENGES } from '@/lib/challenges'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

function generateAccountId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const suffix = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `PROP-${suffix}`
}

function freeBetaEnrollmentEnabled() {
  const raw = String(process.env.PROPDAO_FREE_BETA_ENROLLMENT ?? '').trim().toLowerCase()
  return raw === 'true' || raw === '1' || raw === 'yes'
}

function bearerToken(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function getAuthAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 20, windowMs: 60_000, keyPrefix: 'challenge-enroll' })
  if (!rl.ok) return rateLimitResponse(rl)

  const admin = getAuthAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Server enrollment is not configured.' }, { status: 500 })
  }

  const token = bearerToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

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

  const challengeId = typeof (body as { challengeId?: unknown })?.challengeId === 'string'
    ? (body as { challengeId: string }).challengeId
    : ''
  const challenge = STATIC_CHALLENGES.find((c) => c.id === challengeId)
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 })
  }

  if (challenge.price > 0 && !freeBetaEnrollmentEnabled()) {
    return NextResponse.json(
      { error: 'Checkout is required before this challenge can be added.' },
      { status: 402 },
    )
  }

  const userId = authData.user.id
  const existing = await admin
    .from('user_challenges')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .maybeSingle()

  if (existing.error) {
    return NextResponse.json({ error: 'Failed to verify challenge ownership.' }, { status: 500 })
  }
  if (existing.data) {
    return NextResponse.json({ account: existing.data })
  }

  const inserted = await admin
    .from('user_challenges')
    .insert({
      user_id: userId,
      challenge_id: challengeId,
      status: 'active',
      account_id: generateAccountId(),
      purchase_date: new Date().toISOString(),
    })
    .select()
    .single()

  if (inserted.error) {
    if (inserted.error.code === '23505') {
      const reread = await admin
        .from('user_challenges')
        .select('*')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .maybeSingle()
      if (reread.data) return NextResponse.json({ account: reread.data })
    }
    return NextResponse.json({ error: 'Failed to enroll.' }, { status: 500 })
  }

  return NextResponse.json({ account: inserted.data })
}
