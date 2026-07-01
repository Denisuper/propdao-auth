/**
 * app/api/marketplace/validate-discount/route.ts
 *
 * POST { code, challengeId }
 * → { valid, originalPrice, finalPrice, label, error? }
 *
 * Read-only — never increments uses_count or touches discount_uses.
 * The actual atomic redemption happens at payment time in /api/purchases/verify.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STATIC_CHALLENGES } from '@/lib/challenges'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// Untyped client: `discounts`/`discount_uses` aren't in the generated Database
// type yet (schema was added via direct migration, not `supabase gen types`).
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 10, windowMs: 60_000, keyPrefix: 'validate-discount' })
  if (!rl.ok) return rateLimitResponse(rl)

  let body: { code?: string; challengeId?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request.' }, { status: 400 })
  }

  const code        = String(body?.code ?? '').trim().toUpperCase()
  const challengeId = String(body?.challengeId ?? '').trim()

  if (!code || code.length > 30) {
    return NextResponse.json({ valid: false, error: 'Enter a discount code.' })
  }

  const challenge = STATIC_CHALLENGES.find((c) => c.id === challengeId)
  if (!challenge) {
    return NextResponse.json({ valid: false, error: 'Challenge not found.' })
  }

  const admin = getAdmin()
  const now   = new Date().toISOString()

  const { data: discount } = await admin
    .from('discounts')
    .select('id, type, value, active, max_uses, uses_count, min_challenge_price, challenge_ids, valid_from, valid_until')
    .eq('code', code)
    .maybeSingle()

  if (!discount || !discount.active) {
    return NextResponse.json({ valid: false, error: 'Invalid or expired discount code.' })
  }
  if (discount.valid_from && now < discount.valid_from) {
    return NextResponse.json({ valid: false, error: 'This code is not yet active.' })
  }
  if (discount.valid_until && now > discount.valid_until) {
    return NextResponse.json({ valid: false, error: 'This code has expired.' })
  }
  if (discount.max_uses != null && discount.uses_count >= discount.max_uses) {
    return NextResponse.json({ valid: false, error: 'This code has reached its limit.' })
  }
  if (discount.min_challenge_price != null && challenge.price < discount.min_challenge_price) {
    return NextResponse.json({ valid: false, error: 'This code does not apply to this challenge.' })
  }
  if (discount.challenge_ids != null && !discount.challenge_ids.includes(challengeId)) {
    return NextResponse.json({ valid: false, error: 'This code does not apply to this challenge.' })
  }

  const originalPrice = challenge.price
  const finalPrice = discount.type === 'pct'
    ? Math.max(0, Math.round(originalPrice * (1 - discount.value / 100) * 100) / 100)
    : Math.max(0, Math.round((originalPrice - discount.value) * 100) / 100)

  const label = discount.type === 'pct'
    ? `${discount.value}% off`
    : `$${discount.value.toFixed(2)} off`

  return NextResponse.json({ valid: true, originalPrice, finalPrice, label })
}
