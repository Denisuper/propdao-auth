'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface TierStyle {
  name: string
  roman: string
  color: string
  textDark: boolean
  proSquareGrad: string
  proSquareTextColor: string
}

interface PurchaseModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  challengeName: string
  accountSize: string
  tier: TierStyle
  isPro: boolean
  specs: { label: string; value: string }[]
}

type Step = 'review' | 'processing' | 'success'

export function PurchaseModal({
  open, onClose, onConfirm,
  challengeName, accountSize, tier, isPro, specs,
}: PurchaseModalProps) {
  const router  = useRouter()
  const [step,  setStep]  = useState<Step>('review')
  const [error, setError] = useState<string | null>(null)

  // Reset when reopened
  useEffect(() => {
    if (open) { setStep('review'); setError(null) }
  }, [open])

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const accentColor  = isPro ? tier.proSquareGrad  : tier.color
  const accentText   = isPro ? tier.proSquareTextColor : (tier.textDark ? '#1a1a1a' : '#fff')
  const displayName  = isPro ? `${tier.name} Pro` : tier.name

  const handleActivate = async () => {
    setError(null)
    setStep('processing')
    try {
      await onConfirm()
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('review')
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={(e) => { if (e.target === e.currentTarget && step !== 'processing') onClose() }}
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,28,20,0.55)', backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 420,
        background: '#fff', borderRadius: 20,
        boxShadow: '0 24px 80px rgba(20,30,20,0.18)',
        overflow: 'hidden',
      }}>

        {/* Accent stripe */}
        <div style={{ height: 5, background: isPro ? `linear-gradient(90deg,${tier.proSquareGrad})` : tier.color }} />

        {/* ── Step 1: Review ── */}
        {step === 'review' && (
          <div style={{ padding: '28px 28px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: isPro ? tier.color : tier.color, marginBottom: 4 }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: '#22361f' }}>
                  {accountSize}
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                    background: '#dcfce7', color: '#166534', letterSpacing: '0.5px',
                  }}>
                    FREE BETA ACCESS
                  </span>
                </div>
              </div>
              <div style={{
                width: 52, height: 52, borderRadius: 13, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isPro ? tier.proSquareGrad : tier.color,
                boxShadow: `0 4px 14px ${tier.color}55`,
              }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: accentText }}>{tier.roman}</span>
              </div>
            </div>

            {/* Order line */}
            <div style={{ background: '#f8f8f4', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#8b9088', fontWeight: 500 }}>Challenge</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#22361f' }}>{challengeName}</span>
              </div>
              {specs.slice(0, 3).map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #efefef' }}>
                  <span style={{ fontSize: 12, color: '#a3a8a0' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#22361f' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #efefef', borderBottom: '1px solid #efefef', marginBottom: 20 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#22361f' }}>Total due today</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#166534' }}>$0.00</span>
            </div>

            <p style={{ fontSize: 12, color: '#a3a8a0', lineHeight: 1.5, marginBottom: 20, textAlign: 'center' }}>
              Payments are coming soon. During beta, all challenges are free.
              Your access will be activated instantly.
            </p>

            {error && (
              <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 12, textAlign: 'center' }}>{error}</p>
            )}

            <button
              onClick={handleActivate}
              style={{
                width: '100%', padding: '14px 0',
                background: isPro ? tier.proSquareGrad : tier.color,
                color: accentText,
                fontWeight: 700, fontSize: 15, borderRadius: 12,
                border: 'none', cursor: 'pointer',
              }}
            >
              Activate Free Access →
            </button>

            <button
              onClick={onClose}
              style={{ width: '100%', padding: '10px 0', marginTop: 10, background: 'none', border: 'none', color: '#a3a8a0', fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Step 2: Processing ── */}
        {step === 'processing' && (
          <div style={{ padding: '60px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              border: `3px solid ${tier.color}30`,
              borderTopColor: tier.color,
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: '#22361f' }}>Activating access…</p>
            <p style={{ fontSize: 13, color: '#a3a8a0' }}>This only takes a moment</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ── Step 3: Success ── */}
        {step === 'success' && (
          <div style={{ padding: '48px 28px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {/* Checkmark circle */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: isPro ? tier.proSquareGrad : tier.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 24px ${tier.color}44`,
              marginBottom: 8,
            }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={accentText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div style={{ fontSize: 22, fontWeight: 800, color: '#22361f', letterSpacing: '-0.5px' }}>Access granted!</div>
            <div style={{ fontSize: 14, color: '#8b9088', textAlign: 'center', lineHeight: 1.5 }}>
              Your <strong style={{ color: '#22361f' }}>{displayName} {accountSize}</strong> challenge is now active.
              Head to your dashboard to get started.
            </div>

            <div style={{ width: '100%', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  width: '100%', padding: '14px 0',
                  background: isPro ? tier.proSquareGrad : tier.color,
                  color: accentText,
                  fontWeight: 700, fontSize: 15, borderRadius: 12,
                  border: 'none', cursor: 'pointer',
                }}
              >
                Go to Dashboard
              </button>
              <button
                onClick={onClose}
                style={{ width: '100%', padding: '10px 0', background: 'none', border: 'none', color: '#a3a8a0', fontSize: 13, cursor: 'pointer' }}
              >
                Stay on this page
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
