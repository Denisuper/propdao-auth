'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CheckoutWidget, ThirdwebProvider, useActiveAccount } from 'thirdweb/react'
import { createThirdwebClient, defineChain } from 'thirdweb'
import { createWallet } from 'thirdweb/wallets'

interface TierStyle {
  name: string
  roman: string
  color: string
  textDark: boolean
  proSquareGrad: string
  proSquareTextColor: string
  avgPayout?: string
  proAvgPayout?: string
}

interface PurchaseModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => Promise<void>
  challengeId: string
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
  '#5dba78', '#f0c040', '#5dba78', '#19b4ed',
  '#ff6b6b', '#c4b5fd', '#fde68a', '#d7dbd0',
]

const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const THIRDWEB_CLIENT_ID = '030c01020ac09244713cccdef3c2c5fa'
type EvmAddress = `0x${string}`
type AtomicCapabilityAccount = {
  getCapabilities?: (args: { chainId: number }) => Promise<Record<number, { atomic?: { status?: string } }>>
  sendCalls?: unknown
}
function normalizeDiscountCode(value: string) {
  return value.trim().toUpperCase()
}

function disableAtomicCallsForCheckout(account: AtomicCapabilityAccount | undefined) {
  if (!account) return undefined

  const originalGetCapabilities = account.getCapabilities
  const originalSendCalls = account.sendCalls

  Object.defineProperty(account, 'getCapabilities', {
    configurable: true,
    value: async ({ chainId }: { chainId: number }) => ({
      [chainId]: { atomic: { status: 'unsupported' } },
    }),
  })
  Object.defineProperty(account, 'sendCalls', {
    configurable: true,
    value: undefined,
  })

  return () => {
    Object.defineProperty(account, 'getCapabilities', {
      configurable: true,
      value: originalGetCapabilities,
    })
    Object.defineProperty(account, 'sendCalls', {
      configurable: true,
      value: originalSendCalls,
    })
  }
}
const SELLER_EVM_ADDRESS: EvmAddress = '0x926CcC923DBB4850096278651F0aED54C4005f1f'
const SOL_ADDRESS = '4i9Gsbe1nNA6HpZdJMcBSdtxjFW9SXWDyvT99kUGpNdu'
const TRX_ADDRESS = 'TXwAaybGjbEuXMB3CWsKUVMv24SFYRHWKh'

const thirdwebClient = createThirdwebClient({
  clientId: THIRDWEB_CLIENT_ID,
})

const walletOptions = [
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('me.rainbow'),
  createWallet('walletConnect'),
]

// CoinMarketCap static image CDN — publicly accessible, no API key required
// IDs: ETH=1027, BNB=1839, SOL=5426, TRX=1958, USDC=3408, USDT=825, ARB=11841, MATIC=3890
const CMC = (id: number) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`

const TOKEN_LOGO_URLS: Record<string, string> = {
  ETH:  CMC(1027),
  POL:  CMC(3890),
  BNB:  CMC(1839),
  USDC: CMC(3408),
  USDT: CMC(825),
  SOL:  CMC(5426),
  TRX:  CMC(1958),
}

// EVM networks use ThirdWeb CheckoutWidget. Solana/Tron use manual send-to-address flow.
const NETWORKS = [
  { key: 'ethereum', label: 'Ethereum', chainId: 1,     address: SELLER_EVM_ADDRESS, tone: '#627EEA', manual: false },
  { key: 'base',     label: 'Base',     chainId: 8453,  address: SELLER_EVM_ADDRESS, tone: '#0052FF', manual: false },
  { key: 'arbitrum', label: 'Arbitrum', chainId: 42161, address: SELLER_EVM_ADDRESS, tone: '#28A0F0', manual: false },
  { key: 'polygon',  label: 'Polygon',  chainId: 137,   address: SELLER_EVM_ADDRESS, tone: '#8247E5', manual: false },
  { key: 'bnb',      label: 'BNB Chain',chainId: 56,    address: SELLER_EVM_ADDRESS, tone: '#F0B90B', manual: false },
  { key: 'solana',   label: 'Solana',   chainId: 0,     address: SOL_ADDRESS,        tone: '#9945FF', manual: true  },
  { key: 'tron',     label: 'Tron',     chainId: 0,     address: TRX_ADDRESS,        tone: '#EF0027', manual: true  },
] as const

// Checkout is USDC-only — one token per network, no picker needed.
// Solana USDC mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
// Tron has no widely-used USDC; keep USDT as its stablecoin.
const TOKENS = [
  { network: 'ethereum', options: [{ symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as EvmAddress }] },
  { network: 'base',     options: [{ symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as EvmAddress }] },
  { network: 'arbitrum', options: [{ symbol: 'USDC', name: 'USD Coin', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as EvmAddress }] },
  { network: 'polygon',  options: [{ symbol: 'USDC', name: 'USD Coin', address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359' as EvmAddress }] },
  { network: 'bnb',      options: [{ symbol: 'USDC', name: 'USD Coin', address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d' as EvmAddress }] },
  { network: 'solana',   options: [{ symbol: 'USDC', name: 'USD Coin' }] },
  { network: 'tron',     options: [{ symbol: 'USDT', name: 'Tether USD' }] },
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

function challengeImage(accountSize: string, displayName: string, accent: string) {
  const svg = `
    <svg width="960" height="540" viewBox="0 0 960 540" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="960" height="540" rx="42" fill="#111316"/>
      <path d="M0 0H960V540H0V0Z" fill="url(#g)"/>
      <path d="M80 390C190 265 286 318 392 206C509 82 649 92 862 190" stroke="${accent}" stroke-width="16" stroke-linecap="round" opacity=".9"/>
      <path d="M80 426C204 308 300 356 420 248C545 135 688 154 862 238" stroke="#d7dbd0" stroke-width="5" stroke-linecap="round" opacity=".24"/>
      <rect x="72" y="72" width="214" height="214" rx="34" fill="rgba(62,242,120,.08)" stroke="rgba(62,242,120,.18)"/>
      <text x="100" y="160" fill="#d7dbd0" font-family="Arial, sans-serif" font-size="42" font-weight="800">PROP</text>
      <text x="100" y="214" fill="${accent}" font-family="Arial, sans-serif" font-size="42" font-weight="800">DAO</text>
      <text x="72" y="354" fill="#d7dbd0" font-family="Arial, sans-serif" font-size="82" font-weight="900">${accountSize}</text>
      <text x="76" y="410" fill="rgba(62,242,120,.72)" font-family="Arial, sans-serif" font-size="32" font-weight="700">${displayName} Challenge</text>
      <text x="76" y="462" fill="rgba(62,242,120,.48)" font-family="Arial, sans-serif" font-size="24">Funded trader evaluation access</text>
      <defs>
        <radialGradient id="g" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(700 140) rotate(138) scale(640 420)">
          <stop stop-color="${accent}" stop-opacity=".34"/>
          <stop offset=".52" stop-color="${accent}" stop-opacity=".09"/>
          <stop offset="1" stop-color="#111316" stop-opacity="0"/>
        </radialGradient>
      </defs>
    </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function TokenLogo({ symbol, size = 18 }: { symbol: string; size?: number }) {
  const url = TOKEN_LOGO_URLS[symbol]
  if (!url) return null
  return <img src={url} alt={symbol} width={size} height={size} style={{ borderRadius: '50%', display: 'block' }} />
}

function CheckoutExperience({
  accountSize,
  challengeName,
  displayName,
  originalPrice,
  discountCode,
  challengeId,
  onPaymentVerified,
}: {
  accountSize: string
  challengeName: string
  displayName: string
  originalPrice: number
  discountCode: string
  challengeId: string
  onPaymentVerified: () => Promise<void>
}) {
  const [queryClient] = useState(() => new QueryClient())
  const activeAccount = useActiveAccount()
  // Checkout runs on Ethereum only — no network or token picker.
  const selectedNetwork = NETWORKS[0]
  // Checkout is USDC-only (USDT on Tron, which has no widely-used USDC) — one
  // token per network, so there's nothing for the user to pick.
  const tokenGroup = TOKENS.find((group) => group.network === selectedNetwork.key) ?? TOKENS[0]
  const stableToken = tokenGroup.options[0]
  const stableTokenAddress = 'address' in stableToken ? stableToken.address as EvmAddress : undefined
  const payablePrice = originalPrice
  const selected = {
    key: `${selectedNetwork.key}-${payablePrice}`,
    chainId: selectedNetwork.chainId,
    tone: selectedNetwork.tone,
  }
  const selectedChainId = selected.chainId

  useEffect(() => {
    return disableAtomicCallsForCheckout(activeAccount as AtomicCapabilityAccount | undefined)
  }, [activeAccount])

  // Called by ThirdWeb CheckoutWidget on successful EVM payment.
  // We verify the tx server-side before enrolling so the client can't skip payment.
  function handleEvmSuccess(data: { statuses: Array<Record<string, unknown>> }) {
    void (async () => {
      const firstStatus = data.statuses?.[0] as { transactions?: Array<{ chainId: number; transactionHash: string }> } | undefined
      const txHash = firstStatus?.transactions?.[0]?.transactionHash
      const txChainId = firstStatus?.transactions?.[0]?.chainId ?? selectedChainId

      if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
        throw new Error('Payment data missing — please contact support with your transaction ID.')
      }

      const { supabase } = await import('@/lib/supabase')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) { await onPaymentVerified(); return }

      const res = await fetch('/api/purchases/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transactionHash: txHash, chainId: txChainId, challengeId, discountCode: normalizeDiscountCode(discountCode) }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(json.error ?? 'Payment verification failed')
      }
      await onPaymentVerified()
    })()
  }

  const image = challengeImage(accountSize, displayName, selectedNetwork.tone)
  const productName = `${accountSize} ${displayName} Evaluation`
  const description = `${challengeName}: funded trading challenge access, instant account activation after checkout, crypto-native payouts, and clear drawdown rules.`
  const checkoutAmount = String(payablePrice)

  const [copied, setCopied] = useState<string | null>(null)
  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {selectedNetwork.manual ? (
        /* Solana / Tron — manual send-to-address flow, always priced in the network's stablecoin */
        <div style={{ borderRadius: 14, border: '1px solid #1e2720', background: '#0a0d09', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ lineHeight: 0 }}><TokenLogo symbol={stableToken.symbol} size={22} /></span>
            <div>
              <div style={{ color: '#d7dbd0', fontWeight: 800, fontSize: 15 }}>Send {stableToken.symbol} on {selectedNetwork.label}</div>
              <div style={{ color: '#9aa393', fontSize: 12, marginTop: 2 }}>Exact amount · {stableToken.name}</div>
            </div>
          </div>

          <div style={{ background: '#111612', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#8f9888', marginBottom: 6 }}>Amount to send</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: selectedNetwork.tone, letterSpacing: '-0.5px' }}>
              ${payablePrice} <span style={{ fontSize: 16, color: '#9aa393', fontWeight: 600 }}>{stableToken.symbol}</span>
            </div>
          </div>

          <div style={{ background: '#111612', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#8f9888', marginBottom: 6 }}>Send to address</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 11, color: '#d7dbd0', wordBreak: 'break-all', lineHeight: 1.5 }}>{selectedNetwork.address}</div>
              <button
                type="button"
                onClick={() => copyToClipboard(selectedNetwork.address, 'address')}
                style={{ flexShrink: 0, background: copied === 'address' ? `${selectedNetwork.tone}30` : '#1a2019', border: `1px solid ${copied === 'address' ? selectedNetwork.tone : '#293027'}`, borderRadius: 7, padding: '6px 10px', color: copied === 'address' ? selectedNetwork.tone : '#9aa393', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {copied === 'address' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div style={{ background: '#1a1200', border: '1px solid #3d2e00', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>⚠️</span>
            <div style={{ fontSize: 12, color: '#c9a227', lineHeight: 1.5 }}>
              After sending, email <strong>support@propdao.io</strong> with your transaction ID and challenge name to activate your account.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1e2720', boxShadow: '0 2px 16px rgba(0,0,0,0.4)', maxWidth: 420, margin: '0 auto' }}>
          <QueryClientProvider client={queryClient}>
            <CheckoutWidget
              key={selected.key}
              client={thirdwebClient}
              currency="USD"
              chain={defineChain(selected.chainId)}
              showThirdwebBranding={false}
              amount={checkoutAmount}
              tokenAddress={stableTokenAddress}
              seller={selectedNetwork.address as EvmAddress}
              name={productName}
              description={description}
              image={image}
              buttonLabel={`Pay ${payablePrice} USDC`}
              theme="dark"
              paymentMethods={['crypto', 'card']}
              connectOptions={{
                wallets: walletOptions,
                connectModal: {
                  size: 'compact',
                  title: 'Connect wallet',
                },
              }}
              onSuccess={handleEvmSuccess}
            />
          </QueryClientProvider>
        </div>
      )}

    </div>
  )
}

export function PurchaseModal({
  open, onClose, onSuccess,
  challengeId, challengeName, accountSize, tier, isPro, specs, originalPrice,
}: PurchaseModalProps) {
  const router = useRouter()
  const [step,         setStep]         = useState<Step>('review')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [confetti,     setConfetti]     = useState<ConfettiPiece[]>([])
  const [discountCode, setDiscountCode] = useState('')
  const [discount, setDiscount] = useState<{ code: string; finalPrice: number; label: string } | null>(null)
  const [discountError, setDiscountError] = useState('')
  const [discountChecking, setDiscountChecking] = useState(false)

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setStep('review')
      setError(null)
      setIsProcessing(false)
      setConfetti([])
      setDiscountCode('')
      setDiscount(null)
      setDiscountError('')
    })
  }, [open])

  // Price the discount server-side (same rules /api/purchases/verify enforces at
  // payment time) so the crypto checkout charges the real discounted amount up
  // front instead of always billing full price.
  useEffect(() => {
    const code = discountCode.trim()
    if (!code) {
      setDiscount(null)
      setDiscountError('')
      setDiscountChecking(false)
      return
    }

    let cancelled = false
    setDiscountChecking(true)
    const timer = setTimeout(() => {
      fetch('/api/marketplace/validate-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, challengeId }),
      })
        .then((res) => res.json())
        .then((data: { valid: boolean; finalPrice?: number; label?: string; error?: string }) => {
          if (cancelled) return
          if (data.valid && data.finalPrice != null) {
            setDiscount({ code: code.toUpperCase(), finalPrice: data.finalPrice, label: data.label ?? '' })
            setDiscountError('')
          } else {
            setDiscount(null)
            setDiscountError(data.error ?? 'Invalid discount code.')
          }
        })
        .catch(() => {
          if (!cancelled) { setDiscount(null); setDiscountError('Could not check that code — try again.') }
        })
        .finally(() => { if (!cancelled) setDiscountChecking(false) })
    }, 400)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [discountCode, challengeId])

  const payablePrice = discount ? discount.finalPrice : originalPrice

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (step !== 'success') return
    queueMicrotask(() => {
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
    })
  }, [step])

  const handleActivate = useCallback(async () => {
    setError(null)
    setIsProcessing(true)
    try {
      await onSuccess()
      playSuccessSound()
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsProcessing(false)
    }
  }, [onSuccess])

  if (!open) return null

  const accentBg    = isPro ? tier.proSquareGrad : tier.color
  const accentText  = isPro ? tier.proSquareTextColor : (tier.textDark ? '#1a1a1a' : '#d7dbd0')
  const displayName = isPro ? `${tier.name} Pro` : tier.name
  const displayPayout = isPro
    ? (tier.proAvgPayout ?? tier.avgPayout ?? '$1,800')
    : (tier.avgPayout ?? '$1,800')
  const FEATURES = [
    {
      label: 'Keep 90% of every dollar you make',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5dba78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="5" x2="5" y2="19"/>
          <circle cx="6.5" cy="6.5" r="2.5"/>
          <circle cx="17.5" cy="17.5" r="2.5"/>
        </svg>
      ),
    },
    {
      label: 'No time limits — trade at your pace',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5dba78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4z"/>
          <path d="M12 12c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z"/>
        </svg>
      ),
    },
    {
      label: 'Instant crypto payouts, day one',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5dba78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
    },
    {
      label: `${displayPayout} average payout per trader`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5dba78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          <circle cx="16" cy="14" r="1" fill="#5dba78"/>
        </svg>
      ),
    },
  ]

  return (
    <ThirdwebProvider>
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>

      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(10,11,13,0.6)', backdropFilter: 'blur(5px)' }}
        onClick={() => { if (!isProcessing && step !== 'success') onClose() }}
      />

      {/* Confetti */}
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
        position: 'relative', width: '100%', maxWidth: 540,
        background: '#0d100c', borderRadius: 22,
        boxShadow: '0 28px 90px rgba(10,11,13,0.20)',
        overflow: 'hidden',
        maxHeight: '92vh', overflowY: 'auto',
      }}>

        {/* Accent stripe */}
        <div style={{ height: 5, background: isPro ? `linear-gradient(90deg,${tier.proSquareGrad})` : tier.color }} />

        {/* ── REVIEW ── */}
        {step === 'review' && (
          <div style={{ padding: '28px 28px 24px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: tier.color, marginBottom: 4 }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: '#d7dbd0' }}>
                  {accountSize}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, background: 'rgba(62,242,120,0.12)', color: '#8ef5ad', letterSpacing: '0.5px' }}>
                    CRYPTO CHECKOUT
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

            <div style={{ background: '#10130f', border: '1px solid #293027', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#8f9888', fontWeight: 500 }}>Challenge</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#d7dbd0' }}>{challengeName}</span>
              </div>
              {specs.slice(0, 3).map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #242b23' }}>
                  <span style={{ fontSize: 12, color: '#858d80' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#d7dbd0' }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #242b23', borderBottom: '1px solid #242b23', marginBottom: 20 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#d7dbd0' }}>Total due</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                {discount ? (
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#858d80', textDecoration: 'line-through' }}>${originalPrice}</span>
                ) : null}
                <span style={{ fontSize: 22, fontWeight: 800, color: '#5dba78' }}>{payablePrice}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#8f9888' }}>USDC</span>
              </div>
            </div>

            <input
              value={discountCode}
              onChange={(event) => setDiscountCode(event.target.value)}
              placeholder="Code"
              autoCapitalize="characters"
              aria-label="Discount code"
              style={{
                width: '100%',
                marginBottom: 8,
                border: `1px solid ${discount ? '#5dba78' : '#293027'}`,
                background: '#10130f',
                color: '#d7dbd0',
                borderRadius: 10,
                padding: '11px 12px',
                fontSize: 14,
                fontWeight: 700,
                outline: 'none',
                textTransform: 'uppercase',
              }}
            />

            {discount ? (
              <p style={{ fontSize: 12, color: '#5dba78', fontWeight: 700, marginBottom: 18, textAlign: 'center' }}>{discount.label} applied</p>
            ) : discountError ? (
              <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 18, textAlign: 'center' }}>{discountError}</p>
            ) : (
              <p style={{ fontSize: 12, color: '#858d80', lineHeight: 1.5, marginBottom: 18, textAlign: 'center' }}>
                {discountChecking ? 'Checking code...' : ' '}
              </p>
            )}

            {error && (
              <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 12, textAlign: 'center' }}>{error}</p>
            )}

            <CheckoutExperience
              accountSize={accountSize}
              challengeName={challengeName}
              displayName={displayName}
              originalPrice={payablePrice}
              discountCode={discountCode}
              challengeId={challengeId}
              onPaymentVerified={handleActivate}
            />


            <button
              onClick={onClose}
              disabled={isProcessing}
              style={{ width: '100%', padding: '10px 0', marginTop: 10, background: 'none', border: 'none', color: '#858d80', fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── CHALLENGE ACTIVATED ── */}
        {step === 'success' && (
          <div style={{
            padding: '40px 24px 32px',
            animationName: 'slide-up-content',
            animationDuration: '0.4s',
            animationTimingFunction: SPRING,
            animationFillMode: 'both',
          }}>

            {/* Checkmark with pulse ring */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 22, position: 'relative', height: 88 }}>
              {/* Ring — absolutely centered via margin auto, no transform needed */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                margin: 'auto',
                width: 80, height: 80, borderRadius: '50%',
                border: '2px solid #5dba78',
                animationName: 'ringPulse',
                animationDuration: '1.6s',
                animationTimingFunction: 'ease-out',
                animationIterationCount: 'infinite',
                animationDelay: '0.4s',
                pointerEvents: 'none',
              }} />
              {/* Checkmark — flex-centered, popCheck only scales */}
              <div style={{
                position: 'relative', zIndex: 1,
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #5dba78 0%, #1f8f45 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 28px rgba(62,242,120,0.50)',
                animationName: 'popCheck',
                animationDuration: '0.55s',
                animationDelay: '0.1s',
                animationTimingFunction: SPRING,
                animationFillMode: 'both',
              }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#d7dbd0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            {/* Label */}
            <div style={{
              textAlign: 'center', marginBottom: 8,
              animationName: 'slide-up-content', animationDuration: '0.35s',
              animationDelay: '0.35s', animationTimingFunction: 'ease-out', animationFillMode: 'both',
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2.5px', color: '#5dba78', textTransform: 'uppercase' }}>
                Challenge Activated
              </span>
            </div>

            {/* Heading */}
            <div style={{
              textAlign: 'center', marginBottom: 8,
              animationName: 'slide-up-content', animationDuration: '0.35s',
              animationDelay: '0.42s', animationTimingFunction: 'ease-out', animationFillMode: 'both',
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#202329', letterSpacing: '-0.5px', lineHeight: 1.15 }}>
                You&apos;re cleared to trade.
              </div>
            </div>

            {/* Subtext */}
            <div style={{
              textAlign: 'center', marginBottom: 24,
              animationName: 'slide-up-content', animationDuration: '0.35s',
              animationDelay: '0.49s', animationTimingFunction: 'ease-out', animationFillMode: 'both',
            }}>
              <span style={{ fontSize: 14, color: '#8f9888', lineHeight: 1.5 }}>
                Your{' '}
                <strong style={{ color: '#202329', fontWeight: 700 }}>{displayName} {accountSize}</strong>
                {' '}account is live and funded.
              </span>
            </div>

            {/* Feature rows */}
            <div style={{
              background: '#11150f', borderRadius: 14, overflow: 'hidden', marginBottom: 20,
              animationName: 'slide-up-content', animationDuration: '0.35s',
              animationDelay: '0.55s', animationTimingFunction: 'ease-out', animationFillMode: 'both',
            }}>
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 18px',
                    borderTop: i > 0 ? '1px solid rgba(62,242,120,0.07)' : 'none',
                    animationName: 'featureRow',
                    animationDuration: '0.35s',
                    animationDelay: `${0.62 + i * 0.08}s`,
                    animationTimingFunction: SPRING,
                    animationFillMode: 'both',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: 'rgba(62,242,120,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {f.icon}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#5dba78', lineHeight: 1.4, flex: 1 }}>
                    {f.label}
                  </span>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(62,242,120,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#5dba78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="10 3 5 9 2 6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                width: '100%', padding: '15px 0',
                background: 'linear-gradient(135deg, #5dba78 0%, #1f8f45 100%)',
                color: '#d7dbd0',
                fontWeight: 700, fontSize: 15, borderRadius: 12,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 6px 20px rgba(156,163,173,0.40)',
                animationName: 'slide-up-content',
                animationDuration: '0.35s',
                animationDelay: '1.0s',
                animationTimingFunction: 'ease-out',
                animationFillMode: 'both',
              }}
            >
              Open trading dashboard
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

          </div>
        )}

      </div>
    </div>
    </ThirdwebProvider>
  )
}
