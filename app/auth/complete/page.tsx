'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AuthCompleteInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type') as 'magiclink' | 'signup' | null

    // OTP / magic-link flow.
    if (tokenHash && type) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
        if (error) { router.replace('/signin?error=authentication_failed'); return }
        document.cookie = 'sb-auth-token=1; path=/; samesite=lax; max-age=604800'
        router.replace('/dashboard')
      })
      return
    }

    // PKCE OAuth flow.
    // (detectSessionInUrl: true is the default). Calling exchangeCodeForSession here
    // would be a double-call: the verifier is already consumed and removed from
    // localStorage, causing AuthPKCECodeVerifierMissingError. Just wait for the
    // SIGNED_IN event that fires once the auto-exchange completes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        document.cookie = 'sb-auth-token=1; path=/; samesite=lax; max-age=604800'
        router.replace('/dashboard')
      }
    })

    // Fallback: if neither event fires within 8 s, something went wrong.
    const timeout = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.replace('/signin?error=authentication_failed')
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <AuthCompleteInner />
    </Suspense>
  )
}
