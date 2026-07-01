'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import { getUserChallenges, parseMeta, formatAccountSize, isProChallenge } from '@/lib/challenges'
import type { User } from '@supabase/supabase-js'

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

interface PayoutRecord {
  id: string
  status: string
  payout_amount: number
  profit_amount: number
  wallet_address: string | null
  created_at: string
  processed_at: string | null
  notes: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  pending:  { label: 'Pending Review',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  icon: '⏳' },
  paid:     { label: 'Paid',            color: '#0ecb81', bg: 'rgba(14,203,129,0.1)',  border: 'rgba(14,203,129,0.25)', icon: '✓'  },
  rejected: { label: 'Rejected',        color: '#f6465d', bg: 'rgba(246,70,93,0.1)',   border: 'rgba(246,70,93,0.2)',   icon: '✕'  },
}

export default function PayoutRequestPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [user, setUser] = useState<User | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountName, setAccountName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [profit, setProfit] = useState(0)
  const [equity, setEquity] = useState(0)
  const [startingBalance, setStartingBalance] = useState(0)
  const [splitPct, setSplitPct] = useState(90)
  const [isFunded, setIsFunded] = useState(false)
  const [hasOpenPositions, setHasOpenPositions] = useState(false)

  const [existingRequests, setExistingRequests] = useState<PayoutRecord[]>([])
  const [walletAddress, setWalletAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const loadPayouts = useCallback(async (accId: string, token: string) => {
    const res = await fetch(`/api/accounts/payout-request?account_id=${encodeURIComponent(accId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null)
    if (!res?.ok) return
    const d = await res.json()
    setExistingRequests(d.payouts ?? [])
  }, [])

  useEffect(() => {
    let realtimeSub: ReturnType<typeof supabase.channel> | null = null

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/signin'); return }
      setUser(session.user)
      setSessionToken(session.access_token)

      const accounts = await getUserChallenges(session.user.id).catch(() => [])
      const account = accounts.find((a) => a.id === params.id || a.account_id === params.id)
      if (!account) { router.push('/dashboard'); return }

      const meta = account.challenge ? parseMeta(account.challenge) : null
      const size = meta?.account_size ?? 0
      const isPro = isProChallenge(account.challenge)
      const label = meta ? `${formatAccountSize(size)}${isPro ? ' Pro' : ''} Challenge` : (account.challenge?.name ?? 'Challenge')
      setAccountName(label)
      const rawAccId = account.account_id ?? account.id
      const accId = rawAccId.toLowerCase()
      setAccountId(accId)
      setSplitPct(meta?.profit_split ?? 90)

      // prop_account_states stores account_id in lowercase
      const { data: state } = await supabase
        .from('prop_account_states')
        .select('equity, starting_balance, stage, status, account_id, open_positions')
        .eq('user_id', session.user.id)
        .or(`account_id.eq.${rawAccId},account_id.eq.${accId}`)
        .maybeSingle()

      const sb = Number(state?.starting_balance ?? size)
      // profit_split_pct is not a DB column — derive from challenge meta
      const sp = Number(meta?.profit_split ?? 90)
      const funded = account.status === 'funded' || state?.stage === 'Funded' || state?.status === 'funded'

      const applyState = (eq: number, openPos?: unknown[]) => {
        setEquity(eq)
        setStartingBalance(sb)
        setProfit(Math.max(0, eq - sb))
        setSplitPct(sp)
        if (openPos !== undefined) setHasOpenPositions(openPos.length > 0)
      }

      applyState(Number(state?.equity ?? size), (state?.open_positions as unknown[] | null) ?? [])
      setIsFunded(funded)

      if (!funded) { router.push(`/dashboard/accounts/${params.id}`); return }

      await loadPayouts(accId, session.access_token)
      setLoading(false)

      // Live subscription — equity updates as the terminal trades
      // Use the actual stored account_id (from the fetched row) for the filter so case matches exactly
      const storedAccId = (state as { account_id?: string } | null)?.account_id ?? accId
      const channelName = `payout_live_${accId}`
      supabase.getChannels().forEach((ch) => { if (ch.topic === `realtime:${channelName}`) supabase.removeChannel(ch) })
      realtimeSub = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'prop_account_states', filter: `account_id=eq.${storedAccId}` },
          (payload) => {
            const row = payload.new as { equity?: number; open_positions?: unknown[] } | null
            if (row?.equity != null) applyState(Number(row.equity), row.open_positions ?? [])
          }
        )
        .subscribe()
    }

    load()
    return () => { if (realtimeSub) supabase.removeChannel(realtimeSub) }
  }, [params.id, router, loadPayouts])

  const handleSubmit = async () => {
    if (!walletAddress.trim() || !sessionToken || !accountId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/accounts/payout-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ account_id: accountId, wallet_address: walletAddress.trim() }),
      })
      const d = await res.json() as { error?: string }
      if (!res.ok) throw new Error(d.error ?? 'Request failed.')
      setSubmitted(true)
      await loadPayouts(accountId.toLowerCase(), sessionToken)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Request failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const payoutAmount = profit * (splitPct / 100)
  const pendingRequest = existingRequests.find((r) => r.status === 'pending')
  const hasPending = !!pendingRequest

  const walletDisplay = user?.user_metadata?.wallet_address as string | undefined

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <DashboardLayout
      userEmail={walletDisplay ?? user?.email}
      userAvatar={user?.user_metadata?.avatar_url}
      userId={user?.id}
      userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
    >
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Back */}
        <Link href={`/dashboard/accounts/${params.id}`} className="text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-primary">
          ← Back to Account
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary mt-3">Request Payout</h1>
          <p className="text-sm text-text-secondary mt-1">{accountName} · <span className="font-mono">{accountId}</span></p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Equity', value: money(equity) },
            { label: 'Net Profit', value: money(profit) },
            { label: `Your Share (${splitPct}%)`, value: money(payoutAmount) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-text-secondary mb-1">{label}</p>
              <p className="text-lg font-black text-text-primary">{value}</p>
            </div>
          ))}
        </div>

        {/* Existing requests */}
        {existingRequests.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-sm font-bold text-text-primary">Payout History</h2>
            </div>
            <div className="divide-y divide-white/5">
              {existingRequests.map((req) => {
                const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending
                return (
                  <div key={req.id} className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 700 }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        Requested {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      {req.wallet_address && (
                        <p className="text-[11px] font-mono text-text-secondary/60 mt-1 break-all">{req.wallet_address}</p>
                      )}
                      {req.notes && (
                        <p className="text-xs text-text-secondary/70 mt-1 italic">{req.notes}</p>
                      )}
                      {req.processed_at && (
                        <p className="text-xs text-text-secondary/50 mt-1">
                          Processed {new Date(req.processed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-text-primary">{money(req.payout_amount)}</p>
                      <p className="text-[11px] text-text-secondary mt-0.5">of {money(req.profit_amount)} profit</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Request form or status */}
        {hasOpenPositions ? (
          <div className="rounded-xl border border-red-400/20 bg-red-500/5 px-6 py-6 text-center">
            <p className="text-2xl mb-2">⚠️</p>
            <p className="font-bold text-red-300 mb-1">Open Positions Detected</p>
            <p className="text-sm text-text-secondary">Close all open positions in the terminal before requesting a payout.</p>
          </div>
        ) : hasPending ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 px-6 py-6 text-center">
            <p className="text-2xl mb-2">⏳</p>
            <p className="font-bold text-amber-300 mb-1">Payout Request Pending</p>
            <p className="text-sm text-text-secondary">Your request is being reviewed. We'll process it shortly and send {money(payoutAmount)} to your wallet.</p>
          </div>
        ) : submitted ? (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-6 py-6 text-center">
            <p className="text-2xl mb-2">✓</p>
            <p className="font-bold text-emerald-300 mb-1">Request Submitted</p>
            <p className="text-sm text-text-secondary">We received your payout request for {money(payoutAmount)}. You'll receive it shortly.</p>
          </div>
        ) : profit <= 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-8 text-center">
            <p className="text-text-secondary text-sm">No profit available to withdraw yet. Keep trading!</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-sm font-bold text-text-primary">New Payout Request</h2>
              <p className="text-xs text-text-secondary mt-0.5">Enter the wallet address you want your {money(payoutAmount)} sent to.</p>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                  Wallet Address
                </label>
                <input
                  type="text"
                  placeholder="0x… or Solana address"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-mono text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition"
                />
              </div>

              {/* Payout breakdown */}
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Starting Balance</span>
                  <span className="text-text-primary font-medium">{money(startingBalance)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Current Equity</span>
                  <span className="text-text-primary font-medium">{money(equity)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Net Profit</span>
                  <span className="text-emerald-300 font-medium">{money(profit)}</span>
                </div>
                <div className="border-t border-white/5 pt-2 flex justify-between text-sm font-bold">
                  <span className="text-text-secondary">Your {splitPct}% Share</span>
                  <span className="text-primary">{money(payoutAmount)}</span>
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-red-300">{submitError}</p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !walletAddress.trim()}
                className="w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Submitting…' : `Request ${money(payoutAmount)}`}
              </button>

              <p className="text-[11px] text-text-secondary/50 text-center">
                Requests are typically processed within 1–2 business days.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
