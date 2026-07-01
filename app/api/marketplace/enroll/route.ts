import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STATIC_CHALLENGES } from '@/lib/challenges'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

function getAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function bearerToken(request: NextRequest) {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
}

function generateAccountId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `PROP-${Array.from(bytes, (b) => chars[b % chars.length]).join('')}`
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 10, windowMs: 60_000, keyPrefix: 'marketplace-enroll' })
  if (!rl.ok) return rateLimitResponse(rl)

  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const admin = getAdmin()
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
  }
  const user = authData.user

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const challengeId = typeof body.challengeId === 'string' ? body.challengeId : ''
  const challenge = STATIC_CHALLENGES.find((c) => c.id === challengeId)
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 })
  }

  // Payment gate — paid challenges require verified checkout via /api/purchases/verify.
  // Do not relax this without a confirmed on-chain receipt check.
  const freeBeta = process.env.PROPDAO_FREE_BETA_ENROLLMENT === 'true'
  if (challenge.price > 0 && !freeBeta) {
    return NextResponse.json(
      { error: 'Payment required. Complete checkout before enrolling.' },
      { status: 402 },
    )
  }

  // Idempotent — return existing row if already enrolled
  const { data: existing } = await admin
    .from('user_challenges')
    .select('*')
    .eq('user_id', user.id)
    .eq('challenge_id', challengeId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ account: { ...existing, challenge } })
  }

  // Sync challenge catalog row (FK dependency) using service role
  await admin.from('challenges').upsert(
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

  const { data, error } = await admin
    .from('user_challenges')
    .insert({
      user_id: user.id,
      challenge_id: challengeId,
      status: 'active',
      account_id: generateAccountId(),
      purchase_date: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    // Race condition: another request enrolled simultaneously
    if (error.code === '23505') {
      const { data: reread } = await admin
        .from('user_challenges')
        .select('*')
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId)
        .maybeSingle()
      if (reread) return NextResponse.json({ account: { ...reread, challenge } })
    }
    return NextResponse.json({ error: 'Enrollment failed.' }, { status: 500 })
  }

  return NextResponse.json({ account: { ...data, challenge } })
}
