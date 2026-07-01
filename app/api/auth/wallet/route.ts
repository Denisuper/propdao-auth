import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recoverMessageAddress } from 'viem'
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit'

const FUTURE_SKEW_MS = 60 * 1000

function validateWalletMessage(message: string, address: string): { error: string | null; nonce: string | null } {
  if (message.length > 2048) return { error: 'Invalid message length', nonce: null }
  if (!message.startsWith('Welcome to PropDAO!')) return { error: 'Invalid message format', nonce: null }
  if (!message.includes('Sign this message to verify wallet ownership.')) return { error: 'Invalid message format', nonce: null }

  const addressMatch = message.match(/^Address:\s*(0x[a-fA-F0-9]{40})$/m)
  if (!addressMatch) return { error: 'Invalid message format', nonce: null }
  if (addressMatch[1].toLowerCase() !== address.toLowerCase()) {
    return { error: 'Address in message does not match claimed address', nonce: null }
  }

  // Support both old timestamp nonces and new hex nonces from /api/auth/nonce
  const nonceMatch = message.match(/^Nonce:\s*([a-f0-9]{32}|\d+)$/m)
  if (!nonceMatch) return { error: 'Invalid message format', nonce: null }
  const nonceValue = nonceMatch[1]

  // If it looks like a timestamp (all digits), apply the time-window check as a
  // fallback for clients that haven't migrated to server-issued nonces yet.
  if (/^\d+$/.test(nonceValue)) {
    const ts = Number(nonceValue)
    if (!Number.isFinite(ts)) return { error: 'Invalid nonce', nonce: null }
    if (Date.now() - ts > 5 * 60 * 1000) return { error: 'Challenge expired, please try again', nonce: null }
    if (ts - Date.now() > FUTURE_SKEW_MS) return { error: 'Challenge timestamp is invalid', nonce: null }
    return { error: null, nonce: null } // timestamp nonce — no DB lookup needed
  }

  return { error: null, nonce: nonceValue }
}

export async function POST(request: NextRequest) {
  try {
    // This endpoint creates a new auth user for
    // any address that doesn't have one yet — previously with no throttling
    // at all, so it could be hit repeatedly with freshly generated keypairs
    // to spam-create accounts. Signature verification below still requires a
    // real private key per address, but that alone doesn't bound request
    // volume.
    const rl = rateLimit(request, { limit: 20, windowMs: 60_000, keyPrefix: 'auth-wallet' })
    if (!rl.ok) return rateLimitResponse(rl)

    const { address, message, signature } = await request.json()

    if (!address || !message || !signature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }
    if (typeof message !== 'string' || typeof signature !== 'string' || signature.length > 256) {
      return NextResponse.json({ error: 'Invalid message or signature' }, { status: 400 })
    }

    const { error: messageError, nonce: hexNonce } = validateWalletMessage(message, address)
    if (messageError) {
      return NextResponse.json({ error: messageError }, { status: 400 })
    }

    // Recover the signer address and compare against the claimed address
    const recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    })
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Consume the server-issued hex nonce (one-time use). Clients still using
    // the old timestamp nonce get a null here and skip this check.
    if (hexNonce) {
      const now = new Date().toISOString()
      const { data: nonceRow, error: nonceErr } = await supabaseAdmin
        .from('auth_nonces')
        .select('used, expires_at')
        .eq('nonce', hexNonce)
        .maybeSingle()

      if (nonceErr || !nonceRow) {
        return NextResponse.json({ error: 'Invalid or unknown nonce.' }, { status: 400 })
      }
      if (nonceRow.used) {
        return NextResponse.json({ error: 'Nonce already used.' }, { status: 400 })
      }
      if (nonceRow.expires_at < now) {
        return NextResponse.json({ error: 'Nonce expired, please try again.' }, { status: 400 })
      }
      await supabaseAdmin.from('auth_nonces').update({ used: true }).eq('nonce', hexNonce)
    }

    // generateLink creates the user if they don't exist, never sends an email
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: `${address.toLowerCase()}@wallet.propdao.local`,
      options: {
        data: {
          wallet_address: address.toLowerCase(),
          auth_method: 'wallet',
        },
      },
    })

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to generate session' },
        { status: 500 }
      )
    }

    // Auto-migrate: if this wallet user has no challenges, find any other auth user
    // whose metadata.wallet_address matches and move their data over.
    // This handles the case where the user previously signed in with Google and
    // their data is stored under a different UUID.
    try {
      const walletUserId = data.user.id
      const { count } = await supabaseAdmin
        .from('user_challenges')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', walletUserId)

      if ((count ?? 0) === 0) {
        // Look for another user with this wallet address in their metadata
        const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
        const legacyUser = allUsers.find(
          (u) =>
            u.id !== walletUserId &&
            // Must be a non-wallet account (Google/email) — wallet accounts have deterministic emails
            !u.email?.endsWith('@wallet.propdao.local') &&
            // Must have this exact wallet address explicitly stored in their metadata by an admin or prior auth flow
            (u.user_metadata?.wallet_address ?? '').toLowerCase() === address.toLowerCase()
        )
        if (legacyUser) {
          await Promise.all([
            supabaseAdmin
              .from('user_challenges')
              .update({ user_id: walletUserId })
              .eq('user_id', legacyUser.id),
            supabaseAdmin
              .from('prop_account_states')
              .update({ user_id: walletUserId })
              .eq('user_id', legacyUser.id),
          ])
        }
      }
    } catch {
      // Migration failure is non-fatal — user still gets their session
    }

    return NextResponse.json({ hashed_token: data.properties.hashed_token })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
