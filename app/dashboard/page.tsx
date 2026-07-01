'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getUserChallenges, parseMeta, formatAccountSize, isProChallenge } from '@/lib/challenges'
import { DashboardLayout } from '@/components/DashboardLayout'
import type { User } from '@supabase/supabase-js'
import type { UserChallenge } from '@/lib/challenges'

const isFundedStatus = (s: string) => s === 'funded'
const isPassedStatus = (s: string) => s === 'completed' || s === 'passed'
const isFailedStatus = (s: string) => s === 'failed' || s === 'expired'

const STATUS_LABEL: Record<string, string> = {
  active:    'In Progress',
  completed: 'Passed',
  passed:    'Passed',
  funded:    'Funded',
  failed:    'Failed',
  expired:   'Failed',
}

const STATUS_CLS: Record<string, string> = {
  active:    'bg-primary/10 text-primary border border-primary/20',
  completed: 'bg-primary/10 text-primary border border-primary/20',
  passed:    'bg-primary/10 text-primary border border-primary/20',
  funded:    'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20',
  failed:    'bg-red-500/10 text-red-300 border border-red-400/20',
  expired:   'bg-red-500/10 text-red-300 border border-red-400/20',
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([])
  const [liveEquities, setLiveEquities] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [hideFailed, setHideFailed] = useState(false)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size-desc' | 'size-asc' | 'status'>('newest')

  useEffect(() => {
    let realtimeSub: ReturnType<typeof supabase.channel> | null = null

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/signin'); return }
      setUser(session.user)
      const ucs = await getUserChallenges(session.user.id).catch(() => [])

      const { data: states } = await supabase
        .from('prop_account_states')
        .select('account_id, user_id, status, equity, starting_balance, stage')
        .eq('user_id', session.user.id)

      const stateByAccountId = new Map((states ?? []).map((s) => [s.account_id.toLowerCase(), s]))

      // Seed live equities map
      const equityMap: Record<string, number> = {}
      for (const [id, s] of stateByAccountId) equityMap[id] = Number(s.equity)
      setLiveEquities(equityMap)

      const synced = await Promise.all(ucs.map(async (uc) => {
        const accountId = (uc.account_id ?? uc.id).toLowerCase()
        const liveState = stateByAccountId.get(accountId)
        if (!liveState) return uc
        const liveStatus = liveState.status
        if (uc.status !== 'active' || !liveStatus || liveStatus === 'active') {
          return { ...uc, account_state: liveState }
        }
        await supabase.from('user_challenges').update({ status: liveStatus }).eq('id', uc.id)
        return { ...uc, status: liveStatus, account_state: liveState }
      }))

      setUserChallenges(synced)
      setIsLoading(false)

      // Real-time subscription — patch equity whenever the terminal writes a new row
      const liveCh = 'prop_account_states_live'
      supabase.getChannels().forEach((ch) => { if (ch.topic === `realtime:${liveCh}`) supabase.removeChannel(ch) })
      realtimeSub = supabase
        .channel(liveCh)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'prop_account_states', filter: `user_id=eq.${session.user.id}` },
          (payload) => {
            const row = payload.new as { account_id: string; equity: number; status: string } | null
            if (!row?.account_id) return
            const key = row.account_id.toLowerCase()
            setLiveEquities((prev) => ({ ...prev, [key]: Number(row.equity) }))
            // Also sync status changes live
            if (row.status && row.status !== 'active') {
              setUserChallenges((prev) =>
                prev.map((uc) =>
                  (uc.account_id ?? uc.id).toLowerCase() === key && uc.status === 'active'
                    ? { ...uc, status: row.status }
                    : uc
                )
              )
            }
          }
        )
        .subscribe()
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push('/signin')
      else setUser(session.user)
    })
    return () => {
      subscription.unsubscribe()
      if (realtimeSub) supabase.removeChannel(realtimeSub)
    }
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

  const q = query.toLowerCase().trim()
  const searchableChallenges = hideFailed
    ? userChallenges.filter((uc) => !isFailedStatus(uc.status))
    : userChallenges
  const filteredChallenges = q
    ? searchableChallenges.filter((uc) => {
        const ch   = uc.challenge
        const meta = ch ? parseMeta(ch) : null
        const isPro = isProChallenge(ch)
        const size = meta ? formatAccountSize(meta.account_size).toLowerCase() : ''
        const name = (ch?.name ?? '').toLowerCase()
        const tier = meta ? (
          meta.account_size <= 10000 ? 'bronze' :
          meta.account_size === 25000 ? 'silver' :
          meta.account_size === 50000 ? 'gold' :
          meta.account_size === 100000 ? 'platinum' : 'diamond'
        ) : ''
        const status = uc.status.toLowerCase()
        const proLabel = isPro ? 'pro' : ''
        return [size, name, tier, status, proLabel].some(s => s.includes(q))
      })
    : searchableChallenges
  const visibleChallenges = [...filteredChallenges].sort((a, b) => {
    if (sortBy === 'status') return String(a.status).localeCompare(String(b.status))
    if (sortBy === 'oldest') return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    if (sortBy === 'size-desc' || sortBy === 'size-asc') {
      const aSize = a.challenge ? parseMeta(a.challenge)?.account_size ?? 0 : 0
      const bSize = b.challenge ? parseMeta(b.challenge)?.account_size ?? 0 : 0
      return sortBy === 'size-desc' ? bSize - aSize : aSize - bSize
    }
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  })
  const totalFailed = userChallenges.filter((uc) => isFailedStatus(uc.status)).length

  const active  = visibleChallenges.filter((uc) => uc.status === 'active')
  const funded  = visibleChallenges.filter((uc) => isFundedStatus(uc.status))
  const passed  = visibleChallenges.filter((uc) => isPassedStatus(uc.status))
  const failed  = visibleChallenges.filter((uc) => isFailedStatus(uc.status))

  return (
    <DashboardLayout userEmail={displayEmail} userAvatar={user?.user_metadata?.avatar_url} userId={user?.id} userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}>
      <div className="space-y-6">

        {/* Welcome banner */}
        <div className="propdao-pro-surface rounded-2xl p-8">
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-1">
            Welcome back
          </p>
          <h2 className="text-3xl font-bold mb-1">{displayName}</h2>
          <p className="text-text-secondary text-sm">{walletAddress ?? user?.email}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active',  value: active.length,  color: 'text-primary' },
            { label: 'Funded',  value: funded.length,  color: 'text-emerald-300' },
            { label: 'Failed',  value: failed.length,  color: 'text-red-500' },
          ].map((stat) => (
            <div key={stat.label} className="propdao-surface rounded-xl p-6">
              <p className={`text-3xl font-bold mb-1 ${stat.color}`}>{stat.value}</p>
              <p className="text-text-secondary text-sm">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Active challenges */}
        <div className="propdao-surface rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-primary">My Challenges</h3>
            <Link
              href="/marketplace"
              className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
            >
              Browse challenges →
            </Link>
          </div>

          {userChallenges.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 220 }}>
              <svg
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="rgba(214,219,208,0.42)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder='Search accounts'
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '9px 36px 9px 34px',
                  border: query ? '1.5px solid rgba(62,242,120,0.52)' : '1.5px solid rgba(62,242,120,0.12)',
                  borderRadius: 10,
                  fontSize: 13, color: '#d7dbd0',
                  background: 'rgba(12,14,17,0.48)',
                  outline: 'none',
                  boxShadow: query ? '0 0 0 3px rgba(62,242,120,0.08)' : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'rgba(62,242,120,0.08)', border: 'none', borderRadius: '50%',
                    width: 18, height: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(214,219,208,0.58)', fontSize: 11,
                  }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
              <button
                type="button"
                onClick={() => setHideFailed(v => !v)}
                disabled={totalFailed === 0}
                aria-pressed={hideFailed}
                style={{
                  flex: '0 0 auto',
                  padding: '9px 13px',
                  borderRadius: 10,
                  border: hideFailed ? '1.5px solid rgba(62,242,120,0.44)' : '1.5px solid rgba(214,219,208,0.14)',
                  background: hideFailed ? 'rgba(62,242,120,0.10)' : 'rgba(12,14,17,0.48)',
                  color: hideFailed ? '#3ef278' : 'rgba(214,219,208,0.72)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: totalFailed === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {hideFailed ? 'Failed hidden' : `Hide failed${totalFailed ? ` (${totalFailed})` : ''}`}
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Sort by</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  style={{
                    padding: '9px 32px 9px 11px',
                    borderRadius: 10,
                    border: '1.5px solid rgba(214,219,208,0.14)',
                    background: 'rgba(12,14,17,0.48)',
                    color: '#d7dbd0',
                    fontSize: 13,
                    fontWeight: 700,
                    outline: 'none',
                  }}
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="size-desc">Largest account</option>
                  <option value="size-asc">Smallest account</option>
                  <option value="status">Status</option>
                </select>
              </label>
            </div>
          )}

          {userChallenges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
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
                className="px-5 py-2 bg-primary hover:bg-primary-light text-[#111316] font-medium rounded-lg transition-colors text-sm"
              >
                Browse Challenges
              </Link>
            </div>
          ) : visibleChallenges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="font-medium text-text-primary mb-1">No accounts match &ldquo;{query}&rdquo;</p>
              <button onClick={() => setQuery('')} className="text-sm text-primary hover:text-primary-dark transition-colors mt-1">
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {[
                { label: 'Active',  dot: 'bg-primary',       items: active  },
                { label: 'Funded',  dot: 'bg-emerald-400',   items: funded  },
                { label: 'Failed',  dot: 'bg-red-400',       items: failed  },
              ].map(({ label, dot, items }) =>
                items.length > 0 && (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full ${dot}`} />
                      <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">{label}</span>
                      <span className="text-xs text-text-secondary">({items.length})</span>
                    </div>
                    <div className="divide-y divide-white/10">
                      {items.map((uc) => {
                        const ch = uc.challenge
                        const meta = ch ? parseMeta(ch) : null
                        const isPro = isProChallenge(ch)
                        const statusCls = STATUS_CLS[uc.status] ?? 'bg-gray-100 text-gray-600'
                        const statusLabel = STATUS_LABEL[uc.status] ?? uc.status
                        const isFailed  = isFailedStatus(uc.status)
                        const isFunded  = isFundedStatus(uc.status)
                        const accountKey = (uc.account_id ?? uc.id).toLowerCase()
                        const liveEquity = liveEquities[accountKey] ?? Number(uc.account_state?.equity)
                        const accountHref = `/dashboard/accounts/${uc.id}`
                        const inner = (
                          <>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`font-medium truncate ${isFailed ? 'text-text-secondary line-through decoration-red-400/60' : 'text-text-primary'}`}>
                                  {meta ? `${formatAccountSize(meta.account_size)} Challenge` : (ch?.name ?? 'Unknown challenge')}
                                </p>
                                {isPro && (
                                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 tracking-wide">
                                    PRO
                                  </span>
                                )}
                                {isFailed && (
                                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 tracking-wide">
                                    FAILED
                                  </span>
                                )}
                                {isFunded && (
                                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 tracking-wide">
                                    FUNDED
                                  </span>
                                )}
                              </div>
                              {meta && (
                                <p className="text-xs text-text-secondary mt-0.5">
                                  {meta.profit_target}% target · {meta.max_drawdown}% drawdown · {meta.profit_split}% split
                                </p>
                              )}
                              {uc.account_id && (
                                <p className="text-[11px] font-mono text-text-secondary/50 mt-0.5 tracking-wider">
                                  {uc.account_id}
                                  {Number.isFinite(liveEquity) && liveEquity > 0 && (
                                    <span className={`ml-2 font-semibold not-italic ${liveEquity >= Number(uc.account_state?.starting_balance ?? 0) ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                      ${liveEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCls}`}>
                                {statusLabel}
                              </span>
                            </div>
                          </>
                        )
                        return (
                          <div
                            key={uc.id}
                            className={`flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors ${isFailed ? 'hover:bg-red-500/5 opacity-70' : 'hover:bg-[rgba(62,242,120,0.06)]'}`}
                          >
                            <Link href={accountHref} className="flex-1 min-w-0 flex items-center justify-between gap-4">
                              {inner}
                            </Link>
                            <div className="flex items-center gap-3 shrink-0">
                              {isFunded && (
                                <Link
                                  href={`/dashboard/accounts/${uc.id}/payout`}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
                                >
                                  Request Payout
                                </Link>
                              )}
                              {uc.account_id && (
                                <a
                                  href={`http://localhost:3001/?account=${uc.account_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-text-secondary hover:text-primary transition-colors"
                                >
                                  Terminal &rarr;
                                </a>
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
