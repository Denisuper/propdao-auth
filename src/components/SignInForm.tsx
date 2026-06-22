'use client'

import { GoogleAuthButton } from './GoogleAuthButton'
import { WalletAuthButton } from './WalletAuthButton'

export function SignInForm() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-secondary rounded-lg shadow-lg p-8 border border-border">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">PropDAO</h1>
          <p className="text-text-secondary text-sm">Sign in to continue</p>
        </div>

        <div className="space-y-3">
          <GoogleAuthButton />
          <WalletAuthButton />
        </div>

        <p className="text-xs text-text-secondary text-center mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
