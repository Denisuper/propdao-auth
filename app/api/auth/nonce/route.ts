import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const NONCE_TTL_S = 300 // 5 minutes

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { limit: 20, windowMs: 60_000, keyPrefix: 'auth-nonce' })
  if (!rl.ok) return rateLimitResponse(rl)

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { error } = await supabase.from('auth_nonces').insert({
    nonce,
    expires_at: new Date(Date.now() + NONCE_TTL_S * 1000).toISOString(),
    used: false,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to issue nonce.' }, { status: 500 })
  }

  return NextResponse.json({ nonce })
}
