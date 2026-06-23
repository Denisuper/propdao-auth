'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Challenge } from '@/lib/challenges'
import { parseMeta, formatAccountSize } from '@/lib/challenges'

interface TierStyle {
  name: string
  roman: string
  label: string
  color: string
  textDark: boolean
  badge: string
  popular?: boolean
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
    popular: true, avgPayout: '$1,056', proAvgPayout: '$1,398',
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

interface Props {
  challenge: Challenge
  owned?: boolean
  isPro?: boolean
  fromTier?: string
}

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export function ChallengeCard({ challenge, owned, isPro, fromTier }: Props) {
  const [isHovered, setIsHovered] = useState(false)

  const meta = parseMeta(challenge)
  const tier = (meta && TIERS[meta.account_size]) ?? DEFAULT_TIER
  const displayName = isPro ? `${tier.name} Pro` : tier.name

  const isBronze      = meta ? meta.account_size <= 10000 : false
  const showProStats  = isPro && !isBronze

  const profitTarget   = showProStats ? 4  : (meta?.profit_target   ?? 6)
  const profitSplit    = showProStats ? 90 : 80
  const minTradingDays = showProStats ? 3  : (meta?.min_trading_days ?? 5)
  const price          = isPro ? Math.round(challenge.price * 1.4) : challenge.price

  const textMain      = isPro ? '#ffffff' : '#22361f'
  const textMuted     = isPro ? tier.proTextMuted : '#8b9088'
  const subtextColor  = isPro ? tier.proSubtextColor : '#a3a8a0'
  const rowBorder     = isPro ? '1px solid rgba(255,255,255,0.09)' : '1px solid #efefef'
  const ctaColor      = showProStats ? '#4ee08a' : isPro ? tier.proNameColor : '#22361f'
  const displayPayout = isPro ? (tier.proAvgPayout ?? tier.avgPayout) : tier.avgPayout
  const payoutColor   = isPro ? '#4ee08a' : '#22361f'

  type Spec = { label: string; value: string; oldValue?: string }
  const specs: Spec[] = meta ? [
    { label: 'Profit Target',                            value: `${profitTarget}%`,                                 oldValue: showProStats ? `${meta.profit_target}%`                                   : undefined },
    { label: 'Max Drawdown',                             value: `${meta.max_drawdown}%` },
    { label: 'Profit Split',                             value: `${profitSplit}%`,                                  oldValue: showProStats ? '80%'                                                      : undefined },
    { label: 'Min. Trading Days / Min. Profit to Count', value: `${minTradingDays} days / ${meta.min_trade_size}%`, oldValue: showProStats ? `${meta.min_trading_days} days / ${meta.min_trade_size}%` : undefined },
    { label: 'Drawdown Type',                            value: showProStats ? meta.drawdown_type : 'Intraday' },
  ] : []

  /* ── Hidden bonus badge (reveals on hover) ── */
  const bonusBadge = (
    <div style={{
      position: 'absolute', top: 10, left: 14, zIndex: 5,
      opacity: isHovered ? 1 : 0,
      transform: isHovered ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(-8px)',
      transition: `opacity 0.22s ease, transform 0.35s ${SPRING}`,
      pointerEvents: 'none',
    }}>
      <span style={{
        display: 'inline-block', fontSize: 10, fontWeight: 800,
        padding: '4px 9px', borderRadius: 999,
        background: '#dcfce7', color: '#166534', letterSpacing: '0.5px',
        boxShadow: '0 2px 8px rgba(22,101,52,0.22)',
      }}>
        🎁 FREE BETA ACCESS
      </span>
    </div>
  )

  const cardBody = (
    <>
      {/* Accent stripe */}
      <div style={{ height: 5, background: isPro ? `linear-gradient(90deg,${tier.proNameColor},${tier.color})` : tier.color }} />

      <div style={{ padding: '30px 30px 28px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Price */}
        <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-1.5px', color: textMain, lineHeight: 1 }}>
          {price === 0 ? 'Free' : `$${price}`}
        </div>

        {/* Tier header + square */}
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

        {/* Spec rows */}
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', flex: 1 }}>
          {specs.map(({ label, value, oldValue }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: rowBorder }}>
              <span style={{ fontSize: 14, color: textMuted, maxWidth: 140 }}>{label}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', paddingLeft: 8 }}>
                {oldValue && (
                  <span style={{ fontSize: 15, fontWeight: 700, textDecoration: 'line-through', color: isPro ? '#5e7568' : '#8b9088' }}>
                    {oldValue}
                  </span>
                )}
                <span style={{ fontSize: 15, fontWeight: 700, color: oldValue ? '#4ee08a' : textMain }}>
                  {value}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 18, paddingTop: 24, borderTop: rowBorder, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          {owned ? (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tier.badge}`}>
              Enrolled
            </span>
          ) : (
            <>
              <div className="btn-in">
                <div style={{ fontSize: 16, fontWeight: 700, color: ctaColor }}>Start Trading →</div>
                <div style={{ fontSize: 13, color: subtextColor, marginTop: 8 }}>Takes 2 min to set up</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: subtextColor, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>Avg. Payout</div>
                <div style={{ fontSize: 21, fontWeight: 800, color: payoutColor, letterSpacing: '-0.5px', marginTop: 3 }}>{displayPayout}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )

  if (isPro) {
    return (
      <Link
        href={`/marketplace/${challenge.id}?variant=pro${fromTier ? `&from=${fromTier}` : ''}`}
        className="block h-full"
        style={{
          textDecoration: 'none',
          display: 'block',
          transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
          transition: `transform 300ms ${SPRING}`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={{
          borderRadius: 18, padding: 1.5,
          background: tier.proGradBorder,
          boxShadow: isHovered
            ? `${tier.proShadow}, 0 28px 70px ${tier.proGlow}`
            : tier.proShadow,
          height: '100%', boxSizing: 'border-box',
          transition: 'box-shadow 300ms ease',
        }}>
          <div style={{
            background: tier.proBgGrad, borderRadius: 16.5,
            overflow: 'hidden', position: 'relative',
            height: '100%', display: 'flex', flexDirection: 'column',
          }}>
            {bonusBadge}
            {/* Ambient glow */}
            <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, pointerEvents: 'none', background: `radial-gradient(circle,${tier.proGlow},transparent 70%)` }} />
            {/* Most Popular ribbon — Silver Pro only */}
            {tier.popular && (
              <div style={{ position: 'absolute', top: 24, right: -52, width: 190, transform: 'rotate(45deg)', background: `linear-gradient(90deg,#dde2ec,#9aa6b8)`, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', textAlign: 'center', padding: '6px 0', zIndex: 3 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '1px', color: '#2a3040' }}>MOST POPULAR</span>
              </div>
            )}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1 }}>
              {cardBody}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/marketplace/${challenge.id}${fromTier ? `?from=${fromTier}` : ''}`}
      className="block h-full"
      style={{
        textDecoration: 'none',
        display: 'block',
        transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
        transition: `transform 300ms ${SPRING}`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        background: isHovered ? '#F5F5DC' : '#ffffff',
        border: isHovered ? `1.5px solid ${tier.color}` : '1px solid #ececec',
        borderRadius: 18,
        boxShadow: isHovered
          ? `0 16px 48px rgba(30,40,30,0.13), 0 0 0 1px ${tier.color}33`
          : '0 10px 30px rgba(30,40,30,0.06)',
        overflow: 'hidden', height: '100%',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
        transition: `background 300ms ease, border-color 300ms ease, box-shadow 300ms ease`,
      }}>
        {bonusBadge}
        {cardBody}
      </div>
    </Link>
  )
}
