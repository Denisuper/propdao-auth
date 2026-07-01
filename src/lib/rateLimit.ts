/**
 * Simple in-memory rate limiter for API routes.
 *
 * Per-process (resets on deploy/restart in serverless) — basic abuse
 * protection, not a substitute for a shared store under real load. Ported
 * from propdao-next-terminal's src/lib/rateLimit.js, which this repo had no
 * equivalent of at all before this fix.
 */
import { NextRequest, NextResponse } from 'next/server'

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
const CLEANUP_EVERY_MS = 60_000
let lastCleanup = 0

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_EVERY_MS) return
  lastCleanup = now
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k)
  }
}

function firstHeaderValue(value: string | null): string {
  return String(value ?? '').split(',')[0].trim()
}

export function getClientIp(request: NextRequest): string {
  if (process.env.VERCEL) {
    const vercelForwarded = firstHeaderValue(request.headers.get('x-vercel-forwarded-for'))
    if (vercelForwarded) return vercelForwarded
  }

  if (process.env.NODE_ENV !== 'production') {
    const xf = firstHeaderValue(request.headers.get('x-forwarded-for'))
    if (xf) return xf
    const xr = firstHeaderValue(request.headers.get('x-real-ip'))
    if (xr) return xr
  }

  return 'unknown'
}

export interface RateLimitResult {
  ok: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfter: number
  ip: string
  key: string
}

export function rateLimit(
  request: NextRequest,
  { limit = 20, windowMs = 60_000, keyPrefix = 'api' }: { limit?: number; windowMs?: number; keyPrefix?: string } = {},
): RateLimitResult {
  const now = Date.now()
  cleanup(now)

  const ip = getClientIp(request)
  const key = `${keyPrefix}:${ip}`

  let b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count += 1

  const remaining = Math.max(0, limit - b.count)
  const retryAfterMs = Math.max(0, b.resetAt - now)

  return {
    ok: b.count <= limit,
    limit,
    remaining,
    resetAt: b.resetAt,
    retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    ip,
    key,
  }
}

export function rateLimitResponse(rl: RateLimitResult): NextResponse {
  const res = NextResponse.json(
    { error: 'Too many requests. Please slow down and try again later.' },
    { status: 429 },
  )
  res.headers.set('Retry-After', String(rl.retryAfter))
  res.headers.set('X-RateLimit-Limit', String(rl.limit))
  res.headers.set('X-RateLimit-Remaining', String(rl.remaining))
  res.headers.set('X-RateLimit-Reset', String(Math.floor(rl.resetAt / 1000)))
  return res
}
