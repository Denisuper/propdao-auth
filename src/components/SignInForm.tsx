'use client'

import { GoogleAuthButton } from './GoogleAuthButton'
import { WalletAuthButton } from './WalletAuthButton'

interface SignInFormProps {
  appName?: string
  tagline?: string
}

export function SignInForm({ appName = 'PropDAO', tagline = 'Sign in to continue' }: SignInFormProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="propdao-auth-card rounded-lg p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 h-2 w-2 rounded-full bg-primary shadow-[0_0_18px_rgba(62,242,120,0.38)]" />
          <h1 className="text-3xl font-bold text-text-primary mb-2">{appName}</h1>
          <p className="text-text-secondary text-sm">{tagline}</p>
        </div>

        <div className="space-y-3">
          <GoogleAuthButton />
          <WalletAuthButton />
        </div>

        <p className="text-xs text-text-secondary text-center mt-6 leading-relaxed">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
