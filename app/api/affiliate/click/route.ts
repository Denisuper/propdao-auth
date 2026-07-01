import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

const REF_COOKIE = 'pdao_ref'
const REF_MAX_AGE = 60 * 60 * 24 * 30
const REF_RE = /^[A-Z0-9_-]{3,30}$/

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function ipHash(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || request.headers.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(ip).digest('hex')
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 30, windowMs: 60_000, keyPrefix: 'affiliate-click' })
  if (!rl.ok) return rateLimitResponse(rl)

  let body: { refCode?: unknown } = {}
  try {
    body = await request.json()
  } catch {}

  const refCode = String(body.refCode ?? request.cookies.get(REF_COOKIE)?.value ?? '')
    .trim()
    .toUpperCase()

  if (!REF_RE.test(refCode)) {
    return NextResponse.json({ ok: false, error: 'Invalid referral code.' }, { status: 400 })
  }

  const admin = getAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: 'Server not configured.' }, { status: 500 })

  const { data: affiliate } = await admin
    .from('affiliates')
    .select('id')
    .ilike('ref_code', refCode)
    .eq('status', 'active')
    .maybeSingle()

  if (!affiliate) {
    return NextResponse.json({ ok: false, error: 'Referral code not found.' }, { status: 404 })
  }

  await admin.from('affiliate_clicks').insert({
    ref_code: refCode,
    ip_hash: ipHash(request),
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.set(REF_COOKIE, refCode, {
    path: '/',
    sameSite: 'lax',
    maxAge: REF_MAX_AGE,
  })
  return response
}
