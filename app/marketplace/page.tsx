'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { STATIC_CHALLENGES, enrollChallenge, formatAccountSize, isProChallenge, parseMeta } from '@/lib/challenges'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ChallengeCard } from '@/components/ChallengeCard'
import { PurchaseModal } from '@/components/PurchaseModal'
import { TierTabs } from '@/components/TierTabs'
import type { User } from '@supabase/supabase-js'
import type { Challenge } from '@/lib/challenges'
import type { TierKey } from '@/components/TierTabs'

const VALID_TIERS = new Set<TierKey>(['starter', '25k', '50k', '100k', '200k'])

const TIER_CHALLENGES: Record<TierKey, { standard: Challenge; pro: Challenge }> = {
  starter: { standard: STATIC_CHALLENGES[0], pro: STATIC_CHALLENGES[1] },
  '25k':   { standard: STATIC_CHALLENGES[2], pro: STATIC_CHALLENGES[6] },
  '50k':   { standard: STATIC_CHALLENGES[3], pro: STATIC_CHALLENGES[7] },
  '100k':  { standard: STATIC_CHALLENGES[4], pro: STATIC_CHALLENGES[8] },
  '200k':  { standard: STATIC_CHALLENGES[5], pro: STATIC_CHALLENGES[9] },
}

const TIERS = {
  5000:   { name: 'Bronze', roman: 'I',   color: '#b5531e', textDark: false, avgPayout: '$197',   proSquareGrad: 'linear-gradient(150deg,#e8a86a,#bf6322)', proSquareTextColor: '#2e1c0f' },
  10000:  { name: 'Bronze', roman: 'I',   color: '#b5531e', textDark: false, avgPayout: '$512',   proSquareGrad: 'linear-gradient(150deg,#e8a86a,#bf6322)', proSquareTextColor: '#2e1c0f' },
  25000:  { name: 'Silver', roman: 'II',  color: '#94a0b4', textDark: false, avgPayout: '$1,056', proAvgPayout: '$1,398', proSquareGrad: 'linear-gradient(150deg,#dde2ec,#9aa6b8)', proSquareTextColor: '#2a3040' },
  50000:  { name: 'Gold', roman: 'III', color: '#eaa31a', textDark: true, avgPayout: '$2,035', proAvgPayout: '$2,556', proSquareGrad: 'linear-gradient(150deg,#f3b948,#e0900a)', proSquareTextColor: '#241a05' },
  100000: { name: 'Platinum', roman: 'IV', color: '#8b5cf6', textDark: false, avgPayout: '$3,247', proAvgPayout: '$4,061', proSquareGrad: 'linear-gradient(150deg,#a98ef3,#7c50e6)', proSquareTextColor: '#241a3d' },
  200000: { name: 'Diamond', roman: 'V', color: '#19b4ed', textDark: true, avgPayout: '$7,122', proAvgPayout: '$7,874', proSquareGrad: 'linear-gradient(150deg,#5fd2f7,#16a6e0)', proSquareTextColor: '#0a2733' },
} as const

const DEFAULT_TIER = {
  name: 'Challenge',
  roman: '?',
  color: '#6b7280',
  textDark: false,
  avgPayout: '---',
  proSquareGrad: 'linear-gradient(150deg,#9ca3af,#6b7280)',
  proSquareTextColor: '#1f2937',
}

function MarketplaceFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )
}

export default function ChallengesPage() {
  return (
    <Suspense fallback={<MarketplaceFallback />}>
      <ChallengesContent />
    </Suspense>
  )
}

function ChallengesContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [user,      setUser]      = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)

  const rawTier    = searchParams?.get('tier') as TierKey | null
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
  const selectedMeta = selectedChallenge ? parseMeta(selectedChallenge) : null
  const selectedIsBronzePro = activeTier === 'starter' && selectedMeta?.account_size === 10000
  const selectedIsPro = selectedChallenge ? isProChallenge(selectedChallenge) || selectedIsBronzePro : false
  const selectedShowProStats = selectedChallenge ? isProChallenge(selectedChallenge) : false
  const selectedTier = (selectedMeta && TIERS[selectedMeta.account_size as keyof typeof TIERS]) ?? DEFAULT_TIER
  const selectedProfitTarget = selectedMeta?.profit_target ?? (selectedShowProStats ? 4 : 6)
  const selectedProfitSplit = selectedMeta?.profit_split ?? (selectedShowProStats ? 90 : 80)
  const selectedMinDays = selectedMeta?.min_trading_days ?? (selectedShowProStats ? 3 : 5)
  const selectedSpecs = selectedMeta ? [
    { label: 'Profit Target', value: `${selectedProfitTarget}%` },
    { label: 'Max Drawdown', value: `${selectedMeta.max_drawdown}%` },
    { label: 'Profit Split', value: `${selectedProfitSplit}%` },
    { label: 'Min. Trading Days', value: `${selectedMinDays} days` },
    { label: 'Drawdown Type', value: selectedShowProStats ? selectedMeta.drawdown_type : 'Intraday' },
  ] : []

  const handlePurchaseConfirm = async () => {
    // Enrollment already happened server-side inside /api/purchases/verify.
    toast.success('Enrolled! Head to your dashboard to track progress.')
  }

  return (
    <DashboardLayout userEmail={walletAddress ?? user?.email} userAvatar={user?.user_metadata?.avatar_url} userId={user?.id} userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Challenges</h2>
          <p className="text-text-secondary mt-1 text-sm">Choose your account size and start your funded trading challenge</p>
        </div>

        <div className="flex justify-center">
          <TierTabs active={activeTier} onChange={setActiveTier} />
        </div>

        <div className="flex gap-4 flex-wrap justify-center items-start select-none">
          <div style={{ width: 320, maxWidth: '100%' }}>
            <ChallengeCard challenge={standard} fromTier={activeTier} onSelect={setSelectedChallenge} />
          </div>
          <div style={{ width: 320, maxWidth: '100%' }}>
            <ChallengeCard challenge={pro} fromTier={activeTier} onSelect={setSelectedChallenge} />
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
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">{step}</div>
                <p className="font-semibold text-text-primary text-sm">{title}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedChallenge ? (
        <PurchaseModal
          open={Boolean(selectedChallenge)}
          onClose={() => setSelectedChallenge(null)}
          onSuccess={handlePurchaseConfirm}
          challengeId={selectedChallenge.id}
          challengeName={selectedChallenge.name}
          accountSize={selectedMeta ? formatAccountSize(selectedMeta.account_size) : selectedChallenge.name}
          tier={selectedTier}
          isPro={selectedIsPro}
          specs={selectedSpecs}
          originalPrice={selectedChallenge.price}
        />
      ) : null}
    </DashboardLayout>
  )
}
