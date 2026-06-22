import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recoverMessageAddress } from 'viem'

const CHALLENGE_WINDOW_MS = 5 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const { address, message, signature } = await request.json()

    if (!address || !message || !signature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate the nonce timestamp is within the allowed window
    const match = message.match(/Nonce: (\d+)/)
    if (!match) {
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 })
    }
    if (Date.now() - parseInt(match[1]) > CHALLENGE_WINDOW_MS) {
      return NextResponse.json({ error: 'Challenge expired, please try again' }, { status: 400 })
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

    return NextResponse.json({ hashed_token: data.properties.hashed_token })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
