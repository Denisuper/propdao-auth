'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getUserChallenges, parseMeta, formatAccountSize } from '@/lib/challenges'
import { DashboardLayout } from '@/components/DashboardLayout'
import type { User } from '@supabase/supabase-js'
import type { UserChallenge } from '@/lib/challenges'

const STATUS_LABEL: Record<string, string> = {
  active:    'In Progress',
  completed: 'Passed',
  passed:    'Passed',
  failed:    'Failed',
  expired:   'Failed',
}

const STATUS_CLS: Record<string, string> = {
  active:    'bg-primary/10 text-primary-dark',
  completed: 'bg-green-100  text-green-700',
  passed:    'bg-green-100  text-green-700',
  failed:    'bg-red-100    text-red-600',
  expired:   'bg-red-100    text-red-600',
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/signin'); return }
      setUser(session.user)
      const ucs = await getUserChallenges(session.user.id).catch(() => [])
      setUserChallenges(ucs)
      setIsLoading(false)
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/signin')
      else setUser(session.user)
    })
    return () => subscription.unsubscribe()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const walletAddress = user?.user_metadata?.wallet_address as string | undefined
  const displayName = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'
  const displayEmail = walletAddress ?? user?.email

  const active = userChallenges.filter((uc) => uc.status === 'active')
  const passed = userChallenges.filter((uc) => uc.status === 'completed' || uc.status === 'passed')
  const failed = userChallenges.filter((uc) => uc.status === 'failed'    || uc.status === 'expired')

  return (
    <DashboardLayout userEmail={displayEmail} userAvatar={user?.user_metadata?.avatar_url}>
      <div className="space-y-6">

        {/* Welcome banner */}
        <div className="bg-primary rounded-2xl p-8 text-white">
          <p className="text-primary-light text-xs font-semibold uppercase tracking-widest mb-1">
            Welcome back
          </p>
          <h2 className="text-3xl font-bold mb-1">{displayName}</h2>
          <p className="text-white/70 text-sm">{walletAddress ?? user?.email}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Active',  value: active.length, color: 'text-primary' },
            { label: 'Passed',  value: passed.length, color: 'text-green-600' },
            { label: 'Failed',  value: failed.length, color: 'text-red-500' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-border p-6">
              <p className={`text-3xl font-bold mb-1 ${stat.color}`}>{stat.value}</p>
              <p className="text-text-secondary text-sm">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Active challenges */}
        <div className="bg-white rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-text-primary">My Challenges</h3>
            <Link
              href="/marketplace"
              className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
            >
              Browse challenges →
            </Link>
          </div>

          {userChallenges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="font-semibold text-text-primary mb-1">No challenges yet</p>
              <p className="text-text-secondary text-sm mb-5">
                Head to challenges to enroll in your first challenge.
              </p>
              <Link
                href="/marketplace"
                className="px-5 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors text-sm"
              >
                Browse Challenges
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {[
                { label: 'Active',  dot: 'bg-primary',     items: active },
                { label: 'Passed',  dot: 'bg-green-500',   items: passed },
                { label: 'Failed',  dot: 'bg-red-400',     items: failed },
              ].map(({ label, dot, items }) =>
                items.length > 0 && (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full ${dot}`} />
                      <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">{label}</span>
                      <span className="text-xs text-text-secondary">({items.length})</span>
                    </div>
                    <div className="divide-y divide-border">
                      {items.map((uc) => {
                        const ch = uc.challenge
                        const meta = ch ? parseMeta(ch) : null
                        const statusCls = STATUS_CLS[uc.status] ?? 'bg-gray-100 text-gray-600'
                        const statusLabel = STATUS_LABEL[uc.status] ?? uc.status
                        return (
                          <div key={uc.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="font-medium text-text-primary truncate">
                                {meta ? `${formatAccountSize(meta.account_size)} Challenge` : (ch?.name ?? 'Unknown challenge')}
                              </p>
                              {meta && (
                                <p className="text-xs text-text-secondary mt-0.5">
                                  {meta.profit_target}% target · {meta.max_drawdown}% drawdown · {meta.profit_split}% split
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCls}`}>
                                {statusLabel}
                              </span>
                              {ch && (
                                <Link
                                  href={`/marketplace/${ch.id}`}
                                  className="text-xs text-text-secondary hover:text-primary transition-colors"
                                >
                                  View →
                                </Link>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}
