'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getChallenge, hasChallenge, enrollChallenge, parseMeta, formatAccountSize } from '@/lib/challenges'
import { DashboardLayout } from '@/components/DashboardLayout'
import { PurchaseModal } from '@/components/PurchaseModal'
import type { Challenge, ChallengeMeta } from '@/lib/challenges'
import type { User } from '@supabase/supabase-js'

// ─── Tier config — mirrors ChallengeCard exactly ──────────────────────────────

interface TierStyle {
  name: string
  roman: string
  label: string
  color: string
  textDark: boolean
  badge: string
  avgPayout: string
  proAvgPayout?: string
  proGradBorder: string
  proBgGrad: string
  proShadow: string
  proGlow: string
  proNameColor: string
  proTextMuted: string
  proSubtextColor: string
  proSquareGrad: string
  proSquareShadow: string
  proSquareTextColor: string
}

const TIERS: Record<number, TierStyle> = {
  5000: {
    name: 'Bronze', roman: 'I', label: 'Try it first',
    color: '#b5531e', textDark: false, badge: 'bg-orange-100 text-orange-800',
    avgPayout: '$197',
    proGradBorder: 'linear-gradient(160deg,#d98a4a 0%,#a55320 45%,#3a2616 100%)',
    proBgGrad: 'linear-gradient(165deg,#33231a 0%,#23160d 60%,#1b1009 100%)',
    proShadow: '0 24px 60px rgba(45,30,18,0.30),0 0 0 1px rgba(181,83,30,0.12)',
    proGlow: 'rgba(217,138,74,0.20)',
    proNameColor: '#e3a268', proTextMuted: '#a8917f', proSubtextColor: '#94806f',
    proSquareGrad: 'linear-gradient(150deg,#e8a86a,#bf6322)',
    proSquareShadow: '0 8px 22px rgba(181,83,30,0.42)',
    proSquareTextColor: '#2e1c0f',
  },
  10000: {
    name: 'Bronze', roman: 'I', label: 'Try it first',
    color: '#b5531e', textDark: false, badge: 'bg-orange-100 text-orange-800',
    avgPayout: '$512',
    proGradBorder: 'linear-gradient(160deg,#d98a4a 0%,#a55320 45%,#3a2616 100%)',
    proBgGrad: 'linear-gradient(165deg,#33231a 0%,#23160d 60%,#1b1009 100%)',
    proShadow: '0 24px 60px rgba(45,30,18,0.30),0 0 0 1px rgba(181,83,30,0.12)',
    proGlow: 'rgba(217,138,74,0.20)',
    proNameColor: '#e3a268', proTextMuted: '#a8917f', proSubtextColor: '#94806f',
    proSquareGrad: 'linear-gradient(150deg,#e8a86a,#bf6322)',
    proSquareShadow: '0 8px 22px rgba(181,83,30,0.42)',
    proSquareTextColor: '#2e1c0f',
  },
  25000: {
    name: 'Silver', roman: 'II', label: 'Scale your edge',
    color: '#94a0b4', textDark: false, badge: 'bg-slate-100 text-slate-700',
    avgPayout: '$1,056', proAvgPayout: '$1,398',
    proGradBorder: 'linear-gradient(160deg,#cdd4e0 0%,#8a93a8 45%,#39414f 100%)',
    proBgGrad: 'linear-gradient(165deg,#262d3d 0%,#1a2030 60%,#141927 100%)',
    proShadow: '0 24px 60px rgba(25,30,45,0.30),0 0 0 1px rgba(148,160,180,0.12)',
    proGlow: 'rgba(180,192,212,0.20)',
    proNameColor: '#cdd4e0', proTextMuted: '#94a0b4', proSubtextColor: '#7e8aa0',
    proSquareGrad: 'linear-gradient(150deg,#dde2ec,#9aa6b8)',
    proSquareShadow: '0 8px 22px rgba(120,135,165,0.40)',
    proSquareTextColor: '#2a3040',
  },
  50000: {
    name: 'Gold', roman: 'III', label: 'Scale proven traders',
    color: '#eaa31a', textDark: true, badge: 'bg-amber-100 text-amber-800',
    avgPayout: '$2,035', proAvgPayout: '$2,556',
    proGradBorder: 'linear-gradient(160deg,#f0b53a 0%,#d98c0a 45%,#3a6b4a 100%)',
    proBgGrad: 'linear-gradient(165deg,#193324 0%,#11241a 60%,#0d1e15 100%)',
    proShadow: '0 24px 60px rgba(20,40,25,0.30),0 0 0 1px rgba(234,163,26,0.10)',
    proGlow: 'rgba(234,163,26,0.22)',
    proNameColor: '#f3b948', proTextMuted: '#8ea295', proSubtextColor: '#7b8f82',
    proSquareGrad: 'linear-gradient(150deg,#f3b948,#e0900a)',
    proSquareShadow: '0 8px 22px rgba(234,163,26,0.45)',
    proSquareTextColor: '#241a05',
  },
  100000: {
    name: 'Platinum', roman: 'IV', label: 'Serious traders',
    color: '#8b5cf6', textDark: false, badge: 'bg-violet-100 text-violet-800',
    avgPayout: '$3,247', proAvgPayout: '$4,061',
    proGradBorder: 'linear-gradient(160deg,#b9a3f5 0%,#7c50e6 45%,#332a52 100%)',
    proBgGrad: 'linear-gradient(165deg,#2b2447 0%,#1d1734 60%,#161029 100%)',
    proShadow: '0 24px 60px rgba(35,28,60,0.32),0 0 0 1px rgba(139,92,246,0.14)',
    proGlow: 'rgba(155,126,240,0.24)',
    proNameColor: '#c2aef7', proTextMuted: '#9b90b8', proSubtextColor: '#857a9c',
    proSquareGrad: 'linear-gradient(150deg,#a98ef3,#7c50e6)',
    proSquareShadow: '0 8px 22px rgba(124,80,230,0.45)',
    proSquareTextColor: '#241a3d',
  },
  200000: {
    name: 'Diamond', roman: 'V', label: 'Elite access',
    color: '#19b4ed', textDark: true, badge: 'bg-sky-100 text-sky-800',
    avgPayout: '$7,122', proAvgPayout: '$7,874',
    proGradBorder: 'linear-gradient(160deg,#6fd9f8 0%,#16a6e0 45%,#1f3a4a 100%)',
    proBgGrad: 'linear-gradient(165deg,#15303d 0%,#0e2330 60%,#0a1a24 100%)',
    proShadow: '0 24px 60px rgba(15,35,48,0.32),0 0 0 1px rgba(25,180,237,0.14)',
    proGlow: 'rgba(46,197,246,0.24)',
    proNameColor: '#7fdcf8', proTextMuted: '#86a4b2', proSubtextColor: '#74909e',
    proSquareGrad: 'linear-gradient(150deg,#5fd2f7,#16a6e0)',
    proSquareShadow: '0 8px 22px rgba(25,180,237,0.45)',
    proSquareTextColor: '#0a2733',
  },
}

const DEFAULT_TIER: TierStyle = {
  name: 'Challenge', roman: '?', label: '',
  color: '#6b7280', textDark: false, badge: 'bg-gray-100 text-gray-700',
  avgPayout: '—',
  proGradBorder: 'linear-gradient(160deg,#9ca3af 0%,#6b7280 45%,#374151 100%)',
  proBgGrad: 'linear-gradient(165deg,#1f2937 0%,#111827 60%,#0f172a 100%)',
  proShadow: '0 24px 60px rgba(0,0,0,0.30)',
  proGlow: 'rgba(107,114,128,0.20)',
  proNameColor: '#9ca3af', proTextMuted: '#9ca3af', proSubtextColor: '#6b7280',
  proSquareGrad: 'linear-gradient(150deg,#9ca3af,#6b7280)',
  proSquareShadow: '0 8px 22px rgba(107,114,128,0.40)',
  proSquareTextColor: '#1f2937',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChallengeDetailPage() {
  const router       = useRouter()
  const params       = useParams()
  const searchParams = useSearchParams()
  const id           = params?.id as string
  const isPro        = searchParams?.get('variant') === 'pro'
  const fromTier     = searchParams?.get('from')
  const backHref     = fromTier ? `/marketplace?tier=${fromTier}` : '/marketplace'

  const [user,        setUser]        = useState<User | null>(null)
  const [challenge,   setChallenge]   = useState<Challenge | null>(null)
  const [meta,        setMeta]        = useState<ChallengeMeta | null>(null)
  const [owned,        setOwned]        = useState(false)
  const [isLoading,    setIsLoading]    = useState(true)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [btnHovered,   setBtnHovered]   = useState(false)

  useEffect(() => {
    if (!id) return
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/signin'); return }
      setUser(session.user)

      const [ch, alreadyOwned] = await Promise.all([
        getChallenge(id),
        hasChallenge(session.user.id, id),
      ])

      if (!ch) { router.push('/marketplace'); return }
      setChallenge(ch)
      setMeta(parseMeta(ch))
      setOwned(alreadyOwned)
      setIsLoading(false)
    }
    init()
  }, [router, id])

  const handleEnroll = async () => {
    if (!user || !challenge) return
    await enrollChallenge(user.id, challenge.id)
    setOwned(true)
    toast.success('Enrolled! Head to your dashboard to track progress.')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!challenge) return null

  const walletAddress = user?.user_metadata?.wallet_address as string | undefined
  const tier          = (meta && TIERS[meta.account_size]) ?? DEFAULT_TIER

  // Mirror ChallengeCard's pro stat overrides
  const isBronze       = meta ? meta.account_size <= 10000 : false
  const showProStats   = isPro && !isBronze
  const profitTarget   = showProStats ? 4  : (meta?.profit_target   ?? 6)
  const profitSplit    = showProStats ? 90 : 80
  const minTradingDays = showProStats ? 3  : (meta?.min_trading_days ?? 5)
  const price          = isPro ? Math.round(challenge.price * 1.4) : challenge.price
  const displayPayout  = isPro ? (tier.proAvgPayout ?? tier.avgPayout) : tier.avgPayout
  const displayName    = isPro ? `${tier.name} Pro` : tier.name

  // Colour tokens — switch between standard (light) and pro (dark)
  const textMain     = isPro ? '#ffffff'          : '#22361f'
  const textMuted    = isPro ? tier.proTextMuted  : '#8b9088'
  const subtextColor = isPro ? tier.proSubtextColor : '#a3a8a0'
  const rowBorder    = isPro ? '1px solid rgba(255,255,255,0.09)' : '1px solid #efefef'
  const payoutColor  = isPro ? '#4ee08a' : '#22361f'
  const ctaColor     = showProStats ? '#4ee08a' : isPro ? tier.proNameColor : '#22361f'
  const rulesBg      = isPro ? 'rgba(255,255,255,0.05)' : '#f8f8f4'

  type Spec = { label: string; value: string; oldValue?: string; highlight?: boolean }
  const specs: Spec[] = meta ? [
    { label: 'Profit Target',     value: `${profitTarget}%`,                                  oldValue: showProStats ? `${meta.profit_target}%`       : undefined },
    { label: 'Avg. Payout',       value: displayPayout,                                       highlight: true },
    { label: 'Max Drawdown',      value: `${meta.max_drawdown}%` },
    { label: 'Profit Split',      value: `${profitSplit}%`,                                   oldValue: showProStats ? '80%'                           : undefined },
    { label: 'Min. Trading Days', value: `${minTradingDays} days`,                            oldValue: showProStats ? `${meta.min_trading_days} days` : undefined },
    { label: 'Min. Profit to Count as Trading Day', value: `${meta.min_trade_size}%` },
    { label: 'Drawdown Type',     value: showProStats ? meta.drawdown_type : 'Intraday' },
  ] : []

  const rules = [
    `Reach a ${profitTarget}% profit target on your account`,
    `Stay within the ${meta?.max_drawdown ?? 4}% maximum drawdown at all times`,
    `Trade on a minimum of ${minTradingDays} separate calendar days`,
    `A day only counts as a trading day if you close at least ${meta?.min_trade_size ?? 0.5}% profit`,
    `Upon passing, receive ${profitSplit}% of all profits generated`,
    'No prohibited strategies (grid, martingale, tick scalping)',
    'No time limit — complete the challenge at your own pace',
  ]

  const cardInner = (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Ambient glow for pro */}
      {isPro && (
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, pointerEvents: 'none', background: `radial-gradient(circle,${tier.proGlow},transparent 70%)` }} />
      )}

      {/* Accent stripe */}
      <div style={{ height: 5, background: isPro ? `linear-gradient(90deg,${tier.proNameColor},${tier.color})` : tier.color }} />

      <div style={{ padding: '30px 30px 28px', position: 'relative' }}>

        {/* Price */}
        <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-1.5px', color: textMain, lineHeight: 1 }}>
          {price === 0 ? 'Free' : `$${price}`}
        </div>

        {/* Tier header + roman numeral square */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 22 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '1px', color: isPro ? tier.proNameColor : tier.color }}>
              {displayName.toUpperCase()}
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1px', color: textMain, lineHeight: 1.05, marginTop: 4 }}>
              {meta ? formatAccountSize(meta.account_size) : challenge.name}
            </div>
            <div style={{ fontSize: 14, color: textMuted, marginTop: 6 }}>{tier.label}</div>
          </div>
          <div style={{
            width: 62, height: 62, borderRadius: 16, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isPro ? tier.proSquareGrad : tier.color,
            boxShadow: isPro ? tier.proSquareShadow : `0 4px 14px ${tier.color}55`,
          }}>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '1px', color: isPro ? tier.proSquareTextColor : (tier.textDark ? '#1a1a1a' : '#ffffff') }}>
              {tier.roman}
            </span>
          </div>
        </div>

        {/* Description */}
        {challenge.description && (
          <p style={{ fontSize: 14, color: textMuted, lineHeight: 1.6, marginTop: 18 }}>
            {challenge.description}
          </p>
        )}

        {/* Spec rows */}
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column' }}>
          {specs.map(({ label, value, oldValue, highlight }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: rowBorder }}>
              <span style={{ fontSize: 14, color: textMuted }}>{label}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                {oldValue && (
                  <span style={{ fontSize: 15, fontWeight: 700, textDecoration: 'line-through', color: isPro ? '#5e7568' : '#8b9088' }}>
                    {oldValue}
                  </span>
                )}
                <span style={{ fontSize: 15, fontWeight: 700, color: highlight ? payoutColor : oldValue ? '#4ee08a' : textMain }}>
                  {value}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Rules */}
        <div style={{ marginTop: 24, background: rulesBg, borderRadius: 12, padding: '20px 20px 16px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: textMuted, marginBottom: 14 }}>
            Challenge Rules
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map((rule, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: textMuted, lineHeight: 1.5 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                  background: isPro ? tier.proSquareGrad : tier.color,
                  color: isPro ? tier.proSquareTextColor : (tier.textDark ? '#1a1a1a' : '#fff'),
                  fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>
                  {i + 1}
                </span>
                {rule}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: rowBorder }}>
          <button
            onClick={() => setModalOpen(true)}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            className="btn-in"
            style={{
              width: '100%',
              padding: '14px 0',
              background: isPro ? tier.proSquareGrad : tier.color,
              color: isPro ? tier.proSquareTextColor : (tier.textDark ? '#1a1a1a' : '#fff'),
              fontWeight: 700, borderRadius: 12, fontSize: 15,
              border: 'none', cursor: 'pointer',
              transform: btnHovered ? 'scale(1.03) translateY(-2px)' : 'scale(1) translateY(0)',
              boxShadow: btnHovered
                ? `0 12px 32px ${tier.color}66, 0 4px 12px ${tier.color}44`
                : `0 4px 14px ${tier.color}33`,
              transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 300ms ease',
            }}
          >
            {`Get ${meta ? formatAccountSize(meta.account_size) : 'Challenge'} — $${price}`}
          </button>
        </div>

      </div>
    </div>
  )

  return (
    <DashboardLayout
      userEmail={walletAddress ?? user?.email}
      userAvatar={user?.user_metadata?.avatar_url}
    >
      <div className="max-w-xl mx-auto space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-text-secondary">
          <Link href={backHref} className="hover:text-primary transition-colors">Challenges</Link>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-text-primary font-medium">{displayName} — {meta ? formatAccountSize(meta.account_size) : challenge.name}</span>
        </nav>

        {/* Card */}
        {isPro ? (
          // Pro: gradient border wrapper + dark background
          <div style={{ borderRadius: 18, padding: 1.5, background: tier.proGradBorder, boxShadow: tier.proShadow, overflow: 'hidden' }}>
            <div style={{ background: tier.proBgGrad, borderRadius: 16.5, overflow: 'hidden', position: 'relative' }}>
              {cardInner}
            </div>
          </div>
        ) : (
          // Standard: plain white card
          <div style={{ background: '#ffffff', border: '1px solid #ececec', borderRadius: 18, boxShadow: '0 10px 30px rgba(30,40,30,0.06)', overflow: 'hidden' }}>
            {cardInner}
          </div>
        )}

      </div>

      <PurchaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleEnroll}
        challengeName={challenge.name}
        accountSize={meta ? formatAccountSize(meta.account_size) : challenge.name}
        tier={tier}
        isPro={isPro}
        specs={specs}
        originalPrice={price}
      />
    </DashboardLayout>
  )
}
