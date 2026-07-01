'use client'

import Link from 'next/link'
import type { Challenge } from '@/lib/challenges'
import { parseMeta, formatAccountSize, isProChallenge } from '@/lib/challenges'

interface TierStyle {
  name: string
  roman: string
  label: string
  color: string
  avgPayout: string
  proAvgPayout?: string
}

const TIERS: Record<number, TierStyle> = {
  5000:   { name: 'Bronze',   roman: 'I',   label: 'Try it first',          color: '#b5531e', avgPayout: '$197' },
  10000:  { name: 'Bronze',   roman: 'I',   label: 'Try it first',          color: '#b5531e', avgPayout: '$512' },
  25000:  { name: 'Silver',   roman: 'II',  label: 'Scale your edge',       color: '#94a0b4', avgPayout: '$1,056', proAvgPayout: '$1,398' },
  50000:  { name: 'Gold',     roman: 'III', label: 'Scale proven traders',  color: '#eaa31a', avgPayout: '$2,035', proAvgPayout: '$2,556' },
  100000: { name: 'Platinum', roman: 'IV',  label: 'Serious traders',       color: '#8b5cf6', avgPayout: '$3,247', proAvgPayout: '$4,061' },
  200000: { name: 'Diamond',  roman: 'V',   label: 'Elite access',          color: '#19b4ed', avgPayout: '$7,122', proAvgPayout: '$7,874' },
}

const DEFAULT_TIER: TierStyle = {
  name: 'Challenge',
  roman: '?',
  label: '',
  color: '#6b7280',
  avgPayout: '---',
}

interface Props {
  challenge: Challenge
  owned?: boolean
  fromTier?: string
  onSelect?: (challenge: Challenge) => void
}

type Spec = {
  label: string
  value: string
  oldValue?: string
  accent?: boolean
}

const GREEN = '#3ef278'
const GREEN_RGB = '62,242,120'
const NEUTRAL = '#94a0b4'
const NEUTRAL_RGB = '148,160,180'

function SpecRow({ spec, pro, tpl, accentColor, accentRgb }: { spec: Spec; pro: boolean; tpl?: number; accentColor: string; accentRgb: string }) {
  const borderTop = pro ? `1px solid rgba(${accentRgb},0.08)` : '1px solid rgba(148,160,180,0.05)'

  return (
    <div data-dc-tpl={tpl ? String(tpl) : undefined} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop }}>
      <span data-dc-tpl={tpl ? String(tpl + 1) : undefined} style={{ fontSize: 13, color: 'rgba(214,219,208,0.5)' }}>{spec.label}</span>
      {spec.oldValue ? (
        <span data-dc-tpl={tpl ? String(tpl + 2) : undefined} style={{ fontSize: 13, fontWeight: 600, display: 'flex', gap: 7, alignItems: 'baseline' }}>
          <span data-dc-tpl={tpl ? String(tpl + 3) : undefined} className="strike" style={{ color: 'rgba(214,219,208,0.25)' }}>{spec.oldValue}</span>
          <span data-dc-tpl={tpl ? String(tpl + 4) : undefined} style={{ color: accentColor }}>{spec.value}</span>
        </span>
      ) : (
        <span data-dc-tpl={tpl ? String(tpl + 2) : undefined} style={{ fontSize: 13, fontWeight: 600, color: spec.accent ? accentColor : '#d7dbd0' }}>{spec.value}</span>
      )}
    </div>
  )
}

export function ChallengeCard({ challenge, owned, fromTier, onSelect }: Props) {
  const meta = parseMeta(challenge)
  const isBronzeProCard = fromTier === 'starter' && meta?.account_size === 10000
  const pro = isProChallenge(challenge) || isBronzeProCard
  const greenCard = pro
  const accentColor = greenCard ? GREEN : NEUTRAL
  const accentRgb = greenCard ? GREEN_RGB : NEUTRAL_RGB
  const tier = (meta && TIERS[meta.account_size]) ?? DEFAULT_TIER
  const accountSize = meta ? formatAccountSize(meta.account_size) : challenge.name
  const showProStats = isProChallenge(challenge)
  const profitTarget = meta?.profit_target ?? (showProStats ? 4 : 6)
  const profitSplit = meta?.profit_split ?? (showProStats ? 90 : 80)
  const minTradingDays = meta?.min_trading_days ?? (showProStats ? 3 : 5)
  const minTradeSize = meta?.min_trade_size ?? 0.5
  const drawdownType = showProStats ? (meta?.drawdown_type ?? 'EOD') : 'Intraday'
  const displayName = pro ? `${tier.name} Pro` : tier.name
  const payout = pro ? (tier.proAvgPayout ?? tier.avgPayout) : tier.avgPayout
  const href = pro
    ? `/marketplace/${challenge.id}?variant=pro${fromTier ? `&from=${fromTier}` : ''}`
    : `/marketplace/${challenge.id}${fromTier ? `?from=${fromTier}` : ''}`

  const specs: Spec[] = [
    { label: 'Profit Target', value: `${profitTarget}%`, oldValue: showProStats ? '6%' : undefined },
    { label: 'Max Drawdown', value: `${meta?.max_drawdown ?? 4}%` },
    { label: 'Profit Split', value: `${profitSplit}%`, oldValue: showProStats ? '80%' : undefined, accent: true },
    {
      label: 'Min. Days',
      value: `${minTradingDays} days @ ${minTradeSize}%`,
      oldValue: showProStats ? `5 days @ ${minTradeSize}%` : undefined,
    },
    { label: 'Drawdown Type', value: drawdownType, accent: showProStats },
  ]
  const proTpls = [266, 271, 274, 279, 284]

  const card = (
      <div
        className={pro ? 'card-pro' : 'card-standard'}
        data-dc-tpl={pro ? '249' : undefined}
        style={{
          position: 'relative',
          width: 320,
          background: greenCard ? `rgba(${accentRgb},0.04)` : 'rgba(148,160,180,0.03)',
          border: greenCard ? `1px solid rgba(${accentRgb},0.22)` : '1px solid rgba(148,160,180,0.07)',
          borderRadius: 20,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: pro ? 'borderGlow 4s ease-in-out infinite' : undefined,
          cursor: 'pointer',
        }}
      >
        {pro && tier.name === 'Silver' ? (
          <div data-dc-tpl="250" style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: accentColor, color: '#111316', fontSize: 10, fontWeight: 700, padding: '4px 16px', borderRadius: '0 0 10px 10px', whiteSpace: 'nowrap', letterSpacing: '0.8px', textTransform: 'uppercase', zIndex: 2 }}>
            Most Popular
          </div>
        ) : null}

        <div data-dc-tpl={pro ? '251' : undefined} style={{ height: 3, background: greenCard ? `linear-gradient(90deg,${accentColor},rgba(${accentRgb},0.2))` : `linear-gradient(90deg,${tier.color},${tier.color}33)` }} />

        {pro ? (
          <div data-dc-tpl="252" style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, background: `radial-gradient(circle,rgba(${accentRgb},0.10),transparent 70%)`, pointerEvents: 'none', animation: 'glowPulse 4s ease-in-out infinite' }} />
        ) : null}

        <div data-dc-tpl={pro ? '253' : undefined} style={{ padding: pro && tier.name === 'Silver' ? '30px 24px 24px' : '26px 24px 24px', display: 'flex', flexDirection: 'column', gap: 0, flex: 1, position: 'relative' }}>
          <div data-dc-tpl={pro ? '254' : undefined} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div data-dc-tpl={pro ? '255' : undefined}>
              <div data-dc-tpl={pro ? '256' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div data-dc-tpl={pro ? '257' : undefined} style={{ fontSize: 11, fontWeight: 600, color: greenCard ? accentColor : tier.color, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  {displayName}
                </div>
              </div>
              <div data-dc-tpl={pro ? '258' : undefined} style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-1.5px', color: '#d7dbd0', lineHeight: 1 }}>
                ${challenge.price}
              </div>
              <div data-dc-tpl={pro ? '259' : undefined} style={{ fontSize: 13, color: 'rgba(214,219,208,0.38)', marginTop: 5 }}>
                One-time challenge fee
              </div>
            </div>
            <div data-dc-tpl={pro ? '260' : undefined} style={{ width: 52, height: 52, borderRadius: 14, background: greenCard ? `rgba(${accentRgb},0.12)` : 'rgba(148,160,180,0.04)', border: greenCard ? `1px solid rgba(${accentRgb},0.3)` : `1px solid ${tier.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: greenCard ? `rgba(${accentRgb},0.15) 0px 0px 18px` : undefined }}>
              <span data-dc-tpl={pro ? '261' : undefined} style={{ fontSize: 18, fontWeight: 700, color: greenCard ? accentColor : tier.color, letterSpacing: 1 }}>
                {tier.roman}
              </span>
            </div>
          </div>

          <div data-dc-tpl={pro ? '262' : undefined} style={{ marginTop: 6 }}>
            <div data-dc-tpl={pro ? '263' : undefined} style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.8px', color: '#d7dbd0', lineHeight: 1.1 }}>
              {accountSize}
            </div>
            <div data-dc-tpl={pro ? '264' : undefined} style={{ fontSize: 13, color: 'rgba(214,219,208,0.4)', marginTop: 3 }}>
              {tier.label}
            </div>
          </div>

          <div data-dc-tpl={pro ? '265' : undefined} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
            {specs.map((spec, index) => (
              <SpecRow key={spec.label} spec={spec} pro={pro} tpl={pro ? proTpls[index] : undefined} accentColor={accentColor} accentRgb={accentRgb} />
            ))}
          </div>

          <div data-dc-tpl={pro ? '287' : undefined} style={{ marginTop: 20, paddingTop: 18, borderTop: greenCard ? `1px solid rgba(${accentRgb},0.1)` : '1px solid rgba(148,160,180,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <div data-dc-tpl={pro ? '288' : undefined}>
              <button data-dc-tpl={pro ? '289' : undefined} type="button" style={{ background: greenCard ? accentColor : 'rgba(148,160,180,0.07)', color: greenCard ? '#111316' : '#d7dbd0', fontSize: 13.5, fontWeight: pro ? 700 : 600, padding: '10px 18px', borderRadius: 100, border: greenCard ? 'none' : '1px solid rgba(148,160,180,0.1)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {owned ? 'Enrolled' : 'Start Trading'}
              </button>
              <div data-dc-tpl={pro ? '290' : undefined} style={{ fontSize: 12, color: 'rgba(214,219,208,0.3)', marginTop: 8 }}>
                Takes 2 min to set up
              </div>
            </div>
            <div data-dc-tpl={pro ? '291' : undefined} style={{ textAlign: 'right', flex: '0 0 auto' }}>
              <div data-dc-tpl={pro ? '292' : undefined} style={{ fontSize: 11, color: 'rgba(214,219,208,0.35)', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                Avg. Payout
              </div>
              <div data-dc-tpl={pro ? '293' : undefined} style={{ fontSize: 19, fontWeight: 700, color: greenCard ? accentColor : '#d7dbd0', letterSpacing: '-0.5px', marginTop: 2 }}>
                {payout}
              </div>
            </div>
          </div>
        </div>
      </div>
  )

  if (onSelect) {
    return (
      <div
        role="button"
        tabIndex={0}
        className="challenge-card-link"
        aria-label={`Buy ${challenge.name}`}
        onClick={() => onSelect(challenge)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect(challenge)
          }
        }}
        style={{ background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}
      >
        {card}
      </div>
    )
  }

  return (
    <Link href={href} className="challenge-card-link" aria-label={`View ${challenge.name}`}>
      {card}
    </Link>
  )
}
