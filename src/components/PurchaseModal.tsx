'use client'

import { useEffect, useState, useCallback } from 'react'
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
  originalPrice: number
}

interface ConfettiPiece {
  id: number; x: number; color: string
  delay: number; duration: number; rot: number
  size: number; shape: 'rect' | 'circle'
}

const CONFETTI_COLORS = [
  '#92a872', '#f0c040', '#4ee08a', '#19b4ed',
  '#ff6b6b', '#c4b5fd', '#fde68a', '#ffffff',
]

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

const BADGES = [
  { icon: '💰', label: '90% of every dollar you make' },
  { icon: '⏰', label: 'No time limits — trade at your pace' },
  { icon: '⚡', label: 'Instant crypto payouts, day one' },
  { icon: '📈', label: 'Scale all the way to $200K' },
]

const NOTIFICATIONS = [
  { icon: '🔥', text: 'Miguel K. just activated a $50K challenge', sub: '2 min ago' },
  { icon: '💸', text: 'Sarah T. earned $2,340 this week', sub: 'Top earner' },
  { icon: '📊', text: "You're now #847 of 3,200+ funded traders", sub: 'PropDAO network' },
]

function playSuccessSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.15
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.32, t + 0.025)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc.start(t)
      osc.stop(t + 0.25)
    })
  } catch {
    // AudioContext not available
  }
}

type Step = 'review' | 'success'

export function PurchaseModal({
  open, onClose, onConfirm,
  challengeName, accountSize, tier, isPro, specs, originalPrice,
}: PurchaseModalProps) {
  const router = useRouter()
  const [step,         setStep]         = useState<Step>('review')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [confetti,     setConfetti]     = useState<ConfettiPiece[]>([])

  // Reset when reopened
  useEffect(() => {
    if (open) { setStep('review'); setError(null); setIsProcessing(false); setConfetti([]) }
  }, [open])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Spawn confetti when success
  useEffect(() => {
    if (step !== 'success') return
    const pieces: ConfettiPiece[] = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x:        5 + Math.random() * 90,
      color:    CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay:    Math.floor(Math.random() * 900),
      duration: 1300 + Math.floor(Math.random() * 900),
      rot:      180 + Math.floor(Math.random() * 540),
      size:     6 + Math.floor(Math.random() * 7),
      shape:    Math.random() > 0.4 ? 'rect' : 'circle',
    }))
    setConfetti(pieces)
  }, [step])

  const handleActivate = useCallback(async () => {
    setError(null)
    setIsProcessing(true)
    try {
      await new Promise(r => setTimeout(r, 1200))
      await onConfirm()
      playSuccessSound()
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsProcessing(false)
    }
  }, [onConfirm])

  if (!open) return null

  const accentBg   = isPro ? tier.proSquareGrad : tier.color
  const accentText = isPro ? tier.proSquareTextColor : (tier.textDark ? '#1a1a1a' : '#fff')
  const displayName = isPro ? `${tier.name} Pro` : tier.name

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>

      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(20,28,20,0.6)', backdropFilter: 'blur(5px)' }}
        onClick={() => { if (!isProcessing) onClose() }}
      />

      {/* Confetti pieces */}
      {confetti.map(p => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: `${p.x}%`,
            top: -20,
            width: p.size,
            height: p.shape === 'rect' ? p.size * 1.8 : p.size,
            borderRadius: p.shape === 'circle' ? '50%' : 3,
            background: p.color,
            zIndex: 55,
            pointerEvents: 'none',
            animationName: 'confetti-fall',
            animationDuration: `${p.duration}ms`,
            animationDelay: `${p.delay}ms`,
            animationTimingFunction: 'ease-in',
            animationFillMode: 'both',
            ['--rot' as string]: `${p.rot}deg`,
          } as React.CSSProperties}
        />
      ))}

      {/* Modal card */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 420,
        background: '#fff', borderRadius: 22,
        boxShadow: '0 28px 90px rgba(20,30,20,0.20)',
        overflow: 'hidden',
        maxHeight: '92vh', overflowY: 'auto',
      }}>

        {/* Accent stripe */}
        <div style={{ height: 5, background: isPro ? `linear-gradient(90deg,${tier.proSquareGrad})` : tier.color }} />

        {/* ── REVIEW ── */}
        {step === 'review' && (
          <div style={{ padding: '28px 28px 24px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: tier.color, marginBottom: 4 }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: '#22361f' }}>
                  {accountSize}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#dcfce7', color: '#166534', letterSpacing: '0.5px' }}>
                    FREE BETA ACCESS
                  </span>
                </div>
              </div>
              <div style={{
                width: 52, height: 52, borderRadius: 13, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: accentBg, boxShadow: `0 4px 14px ${tier.color}55`,
              }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: accentText }}>{tier.roman}</span>
              </div>
            </div>

            {/* Order summary */}
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
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#c4c4b8', textDecoration: 'line-through' }}>${originalPrice}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#166534' }}>$0.00</span>
              </div>
            </div>

            <p style={{ fontSize: 12, color: '#a3a8a0', lineHeight: 1.5, marginBottom: 20, textAlign: 'center' }}>
              Payments are coming soon. During beta, all challenges are free.
              Your access will be activated instantly.
            </p>

            {error && (
              <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 12, textAlign: 'center' }}>{error}</p>
            )}

            {/* CTA — shows spinner while processing */}
            <button
              onClick={handleActivate}
              disabled={isProcessing}
              style={{
                width: '100%', padding: '15px 0',
                background: accentBg, color: accentText,
                fontWeight: 700, fontSize: 15, borderRadius: 12,
                border: 'none', cursor: isProcessing ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                opacity: isProcessing ? 0.9 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isProcessing ? (
                <>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: `2.5px solid ${accentText}40`,
                    borderTopColor: accentText,
                    display: 'inline-block',
                    animationName: 'spin',
                    animationDuration: '0.7s',
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite',
                  }} />
                  Setting up your account…
                </>
              ) : (
                'Start Your Challenge →'
              )}
            </button>

            <button
              onClick={onClose}
              disabled={isProcessing}
              style={{ width: '100%', padding: '10px 0', marginTop: 10, background: 'none', border: 'none', color: '#a3a8a0', fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── SUCCESS CELEBRATION ── */}
        {step === 'success' && (
          <div style={{
            padding: '40px 28px 32px',
            animationName: 'slide-up-content',
            animationDuration: '0.45s',
            animationTimingFunction: SPRING,
            animationFillMode: 'both',
          }}>

            {/* Success icon — bounces in */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: accentBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 10px 32px ${tier.color}55`,
                animationName: 'bounce-in',
                animationDuration: '0.55s',
                animationDelay: '0.15s',
                animationTimingFunction: SPRING,
                animationFillMode: 'both',
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={accentText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <div style={{
              textAlign: 'center', marginBottom: 6,
              animationName: 'slide-up-content',
              animationDuration: '0.4s',
              animationDelay: '0.3s',
              animationTimingFunction: 'ease-out',
              animationFillMode: 'both',
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#22361f', letterSpacing: '-0.5px' }}>
                Challenge Activated! 🎉
              </div>
              <div style={{ fontSize: 14, color: '#8b9088', marginTop: 6, lineHeight: 1.5 }}>
                Your <strong style={{ color: '#22361f' }}>{displayName} {accountSize}</strong> is live and ready to trade.
              </div>
            </div>

            {/* 4 benefit badges */}
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BADGES.map((b, i) => (
                <div
                  key={b.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 10,
                    background: i % 2 === 0 ? '#f0fdf4' : '#f8fff0',
                    border: '1px solid #d1fae5',
                    animationName: 'badge-slide-in',
                    animationDuration: '0.4s',
                    animationDelay: `${0.5 + i * 0.1}s`,
                    animationTimingFunction: SPRING,
                    animationFillMode: 'both',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{b.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>{b.label}</span>
                  <span style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="10 3 5 9 2 6" />
                    </svg>
                  </span>
                </div>
              ))}
            </div>

            {/* Social proof notifications */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {NOTIFICATIONS.map((n, i) => (
                <div
                  key={n.text}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 10,
                    background: '#fafafa', border: '1px solid #efefef',
                    animationName: 'notif-slide-in',
                    animationDuration: '0.4s',
                    animationDelay: `${1.0 + i * 0.15}s`,
                    animationTimingFunction: SPRING,
                    animationFillMode: 'both',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{n.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#22361f', lineHeight: 1.3 }}>{n.text}</div>
                    <div style={{ fontSize: 11, color: '#a3a8a0', marginTop: 1 }}>{n.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  width: '100%', padding: '14px 0',
                  background: accentBg, color: accentText,
                  fontWeight: 700, fontSize: 15, borderRadius: 12,
                  border: 'none', cursor: 'pointer',
                  animationName: 'slide-up-content',
                  animationDuration: '0.4s',
                  animationDelay: '1.5s',
                  animationTimingFunction: 'ease-out',
                  animationFillMode: 'both',
                }}
              >
                Go to Dashboard →
              </button>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '10px 0', background: 'none',
                  border: 'none', color: '#a3a8a0', fontSize: 13, cursor: 'pointer',
                  animationName: 'slide-up-content',
                  animationDuration: '0.4s',
                  animationDelay: '1.6s',
                  animationTimingFunction: 'ease-out',
                  animationFillMode: 'both',
                }}
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
