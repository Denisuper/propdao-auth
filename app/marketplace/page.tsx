'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { STATIC_CHALLENGES } from '@/lib/challenges'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ChallengeCard } from '@/components/ChallengeCard'
import { TierTabs } from '@/components/TierTabs'
import type { User } from '@supabase/supabase-js'
import type { Challenge } from '@/lib/challenges'
import type { TierKey } from '@/components/TierTabs'

const VALID_TIERS = new Set<TierKey>(['starter', '25k', '50k', '100k', '200k'])

const TIER_CHALLENGES: Record<TierKey, { standard: Challenge; pro: Challenge }> = {
  starter: { standard: STATIC_CHALLENGES[0], pro: STATIC_CHALLENGES[1] },
  '25k':   { standard: STATIC_CHALLENGES[2], pro: STATIC_CHALLENGES[2] },
  '50k':   { standard: STATIC_CHALLENGES[3], pro: STATIC_CHALLENGES[3] },
  '100k':  { standard: STATIC_CHALLENGES[4], pro: STATIC_CHALLENGES[4] },
  '200k':  { standard: STATIC_CHALLENGES[5], pro: STATIC_CHALLENGES[5] },
}

export default function ChallengesPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [user,      setUser]      = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const rawTier   = searchParams?.get('tier') as TierKey | null
  const activeTier: TierKey = (rawTier && VALID_TIERS.has(rawTier)) ? rawTier : '25k'

  const setActiveTier = (tier: TierKey) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('tier', tier)
    router.replace(`/marketplace?${params.toString()}`)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/signin'); return }
      setUser(session.user)
      setIsLoading(false)
    }
    init()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const walletAddress = user?.user_metadata?.wallet_address as string | undefined
  const { standard, pro } = TIER_CHALLENGES[activeTier]

  return (
    <DashboardLayout userEmail={walletAddress ?? user?.email} userAvatar={user?.user_metadata?.avatar_url}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Challenges</h2>
          <p className="text-text-secondary mt-1 text-sm">Choose your account size and start your funded trading challenge</p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-text-secondary">
          <span>✓ Instant crypto payouts</span>
          <span>✓ No time limits</span>
          <span>✓ 3,000+ funded traders</span>
        </div>

        <TierTabs active={activeTier} onChange={setActiveTier} />

        {/* Card pair */}
        <div className="flex gap-5 flex-wrap justify-center items-center select-none">
          <div className="flex-1 min-w-64 max-w-xs">
            <ChallengeCard challenge={standard} fromTier={activeTier} />
          </div>
          <div className="flex-1 min-w-64 max-w-xs scale-[1.04]">
            <ChallengeCard challenge={pro} isPro fromTier={activeTier} />
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-text-secondary mb-6">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { step: '1', title: 'Pass your challenge', body: 'Hit the profit target without breaking the drawdown rule.' },
              { step: '2', title: 'Trade profitably',    body: 'Prove your edge on a live funded account and collect payouts.' },
              { step: '3', title: 'Scale anytime',       body: "Upgrade to a bigger account whenever you're ready." },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-text-primary shrink-0">{step}</div>
                <p className="font-semibold text-text-primary text-sm">{title}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
