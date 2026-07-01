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

  throw new Error(json.error || 'Wallet authentication failed')
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

export async function updateUsername(name: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
  if (error) throw new Error(error.message)
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
