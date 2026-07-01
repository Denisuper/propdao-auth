import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createThirdwebClient, defineChain, NATIVE_TOKEN_ADDRESS } from 'thirdweb'
import * as Bridge from 'thirdweb/bridge'
import { convertCryptoToFiat } from 'thirdweb/pay'
import { STATIC_CHALLENGES } from '@/lib/challenges'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'
import type { Database } from '@/types/database'

export const runtime = 'nodejs'

const SELLER_ADDRESS = '0x926CcC923DBB4850096278651F0aED54C4005f1f'.toLowerCase()
const REF_COOKIE = 'pdao_ref'
const REF_RE = /^[A-Z0-9_-]{3,30}$/
const NATIVE_TOKEN_ADDRESSES = new Set([
  NATIVE_TOKEN_ADDRESS.toLowerCase(),
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
])

function normalizeDiscountCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function bearerToken(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? ''
  return auth.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function generateAccountId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const suffix = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `PROP-${suffix}`
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 10, windowMs: 60_000, keyPrefix: 'purchase-verify' })
  if (!rl.ok) return rateLimitResponse(rl)

  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })

  const { data: authData, error: authError } = await admin.auth.getUser(token)
  if (authError || !authData.user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { transactionHash, chainId, challengeId, discountCode } = body as {
    transactionHash?: string
    chainId?: number
    challengeId?: string
    discountCode?: string
  }

  if (!transactionHash || !chainId || !challengeId) {
    return NextResponse.json({ error: 'Missing transactionHash, chainId, or challengeId.' }, { status: 400 })
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
    return NextResponse.json({ error: 'Invalid transaction hash format.' }, { status: 400 })
  }

  const challenge = STATIC_CHALLENGES.find((c) => c.id === challengeId)
  if (!challenge) {
    return NextResponse.json({ error: 'Challenge not found.' }, { status: 404 })
  }

  // The client priced the checkout using /api/marketplace/validate-discount before
  // payment; re-derive and atomically redeem the same code here — this is the
  // authoritative price the on-chain payment is checked against below.
  let requiredPrice = challenge.price
  const rawCode = normalizeDiscountCode(discountCode)
  if (rawCode) {
    // `use_discount_code` isn't in the generated Database type (schema was added
    // via direct migration, not `supabase gen types`) — call it untyped.
    const { data: rpcResult, error: rpcErr } = await (admin as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc('use_discount_code', {
      p_code:         rawCode,
      p_user_id:      authData.user.id,
      p_challenge_id: challengeId,
      p_price:        challenge.price,
    })
    if (rpcErr) {
      return NextResponse.json({ error: 'Could not apply discount code.' }, { status: 500 })
    }
    const result = rpcResult as { ok: boolean; error?: string; final_price?: number }
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Invalid discount code.' }, { status: 400 })
    }
    requiredPrice = result.final_price ?? requiredPrice
  }

  // Verify the payment on-chain via ThirdWeb Bridge
  const thirdwebClientId = process.env.THIRDWEB_SECRET_KEY
    ? undefined
    : process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID
  const thirdwebClient = createThirdwebClient(
    process.env.THIRDWEB_SECRET_KEY
      ? { secretKey: process.env.THIRDWEB_SECRET_KEY }
      : { clientId: thirdwebClientId ?? '030c01020ac09244713cccdef3c2c5fa' },
  )

  let paymentVerified = false
  try {
    const status = await Bridge.status({
      client: thirdwebClient,
      transactionHash: transactionHash as `0x${string}`,
      chainId: Number(chainId),
    })

    if (status.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: `Payment not confirmed — status: ${status.status}. Try again in a moment.` },
        { status: 402 },
      )
    }

    // Confirm funds went to our seller address
    const receiver = 'receiver' in status ? String(status.receiver).toLowerCase() : ''
    if (receiver && receiver !== SELLER_ADDRESS) {
      return NextResponse.json({ error: 'Payment recipient mismatch.' }, { status: 402 })
    }

    // Confirm the settled destination value covers the challenge price.
    // The client-side quote is display-only; this is the source of truth.
    if ('destinationAmount' in status && status.destinationAmount !== undefined) {
      const destinationToken = 'destinationToken' in status ? status.destinationToken : undefined
      const decimals = destinationToken?.decimals ?? 6
      const tokenAmount = Number(status.destinationAmount) / 10 ** decimals
      const tokenAddress = String(status.destinationTokenAddress ?? '').toLowerCase()
      const destinationChainId = 'destinationChainId' in status ? Number(status.destinationChainId) : Number(chainId)
      const amountUsd = (await convertCryptoToFiat({
        client: thirdwebClient,
        fromTokenAddress: (NATIVE_TOKEN_ADDRESSES.has(tokenAddress)
          ? NATIVE_TOKEN_ADDRESS
          : status.destinationTokenAddress) as `0x${string}`,
        fromAmount: tokenAmount,
        chain: defineChain(destinationChainId),
        to: 'USD',
      })).result
      if (amountUsd < requiredPrice * 0.99) {
        return NextResponse.json(
          { error: `Underpayment: received $${amountUsd.toFixed(2)}, expected $${requiredPrice}.` },
          { status: 402 },
        )
      }
    }

    paymentVerified = true
  } catch (err) {
    // ThirdWeb may not yet have the tx indexed — allow a short window after broadcast
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Payment verification failed: ${msg}` },
      { status: 502 },
    )
  }

  if (!paymentVerified) {
    return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 402 })
  }

  // Idempotency: if already enrolled, return existing row
  const userId = authData.user.id
  const existing = await admin
    .from('user_challenges')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .maybeSingle()

  if (existing.error) {
    return NextResponse.json({ error: 'Database error.' }, { status: 500 })
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
    return NextResponse.json({ error: 'Failed to activate challenge.' }, { status: 500 })
  }

  const refCode = request.cookies.get(REF_COOKIE)?.value?.trim().toUpperCase()
  if (refCode && REF_RE.test(refCode) && requiredPrice > 0) {
    const { data: affiliate } = await admin
      .from('affiliates')
      .select('id, commission_pct')
      .ilike('ref_code', refCode)
      .eq('status', 'active')
      .maybeSingle()

    if (affiliate) {
      const commissionAmt = Math.round(requiredPrice * (Number(affiliate.commission_pct) / 100) * 100) / 100
      const { error: referralError } = await admin
        .from('referrals')
        .insert({
          affiliate_id: affiliate.id,
          referred_user_id: userId,
          challenge_id: challengeId,
          user_challenge_id: inserted.data.id,
          sale_amount: requiredPrice,
          commission_amt: commissionAmt,
          status: 'pending',
        })

      if (!referralError) {
        const current = await admin
          .from('affiliates')
          .select('total_earned')
          .eq('id', affiliate.id)
          .maybeSingle()
        const nextTotal = Math.round(((Number(current.data?.total_earned) || 0) + commissionAmt) * 100) / 100
        await admin.from('affiliates').update({ total_earned: nextTotal }).eq('id', affiliate.id)
      }
    }
  }

  return NextResponse.json({ account: inserted.data })
}
