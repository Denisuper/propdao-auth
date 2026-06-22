'use client'

import { ReactNode, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut } from '@/lib/auth'
import { toast } from 'sonner'

interface DashboardLayoutProps {
  children: ReactNode
  userEmail?: string
  userAvatar?: string | null
}

const NAV = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/marketplace',
    label: 'Challenges',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
]

export function DashboardLayout({ children, userEmail, userAvatar }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await signOut()
      toast.success('Signed out')
      router.push('/signin')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign out')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo + nav */}
            <div className="flex items-center gap-6">
              <span className="text-lg font-bold text-text-primary select-none">PropDAO</span>
              <nav className="hidden sm:flex items-center gap-1">
                {NAV.map(({ href, label, icon }) => {
                  const active =
                    href === '/dashboard'
                      ? pathname === '/dashboard'
                      : !!pathname?.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? 'bg-secondary text-text-primary'
                          : 'text-text-secondary hover:text-text-primary hover:bg-secondary/60'
                      }`}
                    >
                      {icon}
                      {label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* User + sign-out */}
            <div className="flex items-center gap-3">
              {userAvatar && (
                <img src={userAvatar} alt="" className="w-7 h-7 rounded-full" />
              )}
              <span className="hidden md:block text-sm text-text-secondary truncate max-w-[180px]">
                {userEmail}
              </span>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSigningOut ? '…' : 'Sign out'}
              </button>
            </div>
          </div>

          {/* Mobile bottom nav */}
          <nav className="flex sm:hidden items-center gap-1 pb-2">
            {NAV.map(({ href, label, icon }) => {
              const active =
                href === '/dashboard'
                  ? pathname === '/dashboard'
                  : !!pathname?.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-secondary text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {icon}
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
