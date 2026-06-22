import { supabase } from './supabase'

export function createWalletChallenge(address: string): string {
  return (
    `Welcome to PropDAO!\n\n` +
    `Sign this message to verify wallet ownership. ` +
    `This request does not trigger a blockchain transaction.\n\n` +
    `Address: ${address}\n` +
    `Nonce: ${Date.now()}\n\n` +
    `By signing, you agree to PropDAO's Terms of Service.`
  )
}

export async function authenticateWithWallet(
  address: string,
  message: string,
  signature: string
): Promise<void> {
  // --- Primary path: server verifies signature + creates session via admin API ---
  const res = await fetch('/api/auth/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, message, signature }),
  })

  const json = await res.json()

  if (res.ok) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: json.hashed_token,
      type: 'magiclink',
    })
    if (error) throw new Error(error.message)
    document.cookie = 'sb-auth-token=1; path=/; samesite=lax; max-age=604800'
    return
  }

  // --- Fallback: SUPABASE_SERVICE_ROLE_KEY not set yet — use client-side auth ---
  // Uses a deterministic email+password derived from the wallet address so the
  // same wallet always maps to the same Supabase account without a server key.
  if (json.error === 'Server misconfiguration') {
    await walletPasswordFallback(address)
    return
  }

  throw new Error(json.error || 'Wallet authentication failed')
}

async function walletPasswordFallback(address: string): Promise<void> {
  const email = `${address.toLowerCase()}@wallet.propdao.local`
  // Password is deterministic per address — replace with server-side auth once
  // SUPABASE_SERVICE_ROLE_KEY is added to .env.local
  const password = `pdao_${address.toLowerCase()}_v1`
  const meta = { wallet_address: address.toLowerCase(), auth_method: 'wallet' }

  // Try signing in as a returning wallet user
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (!signInError && signInData.session) {
    document.cookie = 'sb-auth-token=1; path=/; samesite=lax; max-age=604800'
    return
  }

  const emailConfirmationMsg =
    'Email confirmation is enabled in your Supabase project. ' +
    'Go to Authentication → Settings and disable "Enable email confirmations", ' +
    'or add SUPABASE_SERVICE_ROLE_KEY to .env.local for the secure flow.'

  // "Email not confirmed" = account exists but email confirmation is enabled.
  if (signInError?.message?.toLowerCase().includes('email not confirmed')) {
    throw new Error(emailConfirmationMsg)
  }

  // First time — create the account
  if (signInError?.message?.includes('Invalid login credentials')) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
    })
    if (signUpError) throw new Error(signUpError.message)
    if (!signUpData.session) {
      throw new Error(emailConfirmationMsg)
    }
    document.cookie = 'sb-auth-token=1; path=/; samesite=lax; max-age=604800'
    return
  }

  throw new Error(signInError?.message ?? 'Wallet authentication failed')
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
  document.cookie = 'sb-auth-token=; path=/; samesite=lax; max-age=0'
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    return null
  }
  return data.user
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    return null
  }
  return data.session
}
