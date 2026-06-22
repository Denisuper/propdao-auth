import { SignInForm } from '@/components/SignInForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In - PropDAO',
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-dark to-primary flex items-center justify-center px-4 py-8">
      <SignInForm />
    </div>
  )
}
