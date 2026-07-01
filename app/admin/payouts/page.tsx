'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface PayoutRequest {
  id: string
  user_id: string
  user_email: string
  account_id: string
  challenge_id: string | null
  profit_amount: number
  payout_amount: number
  profit_split_pct: number
  wallet_address: string | null
  status: string
  notes: string | null
  created_at: string
  processed_at: string | null
  live_equity: number | null
  live_profit: number | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending:  { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)',  label: 'Pending'  },
  paid:     { bg: 'rgba(14,203,129,0.12)',  color: '#0ecb81', border: 'rgba(14,203,129,0.3)', label: 'Paid'     },
  rejected: { bg: 'rgba(246,70,93,0.12)',   color: '#f6465d', border: 'rgba(246,70,93,0.25)', label: 'Rejected' },
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (s: string) => new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function AdminPayoutsPage() {
  const [requests, setRequests] = useState<PayoutRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({})
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid' | 'rejected'>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Not authenticated.'); return }
      const res = await fetch('/api/admin/payouts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'Failed to load')
      }
      const d = await res.json()
      setRequests(d.payouts ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const handleAction = useCallback(async (payoutId: string, status: 'paid' | 'rejected') => {
    setProcessing(payoutId)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ payout_id: payoutId, status, notes: notesInputs[payoutId] ?? undefined }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error((d as { error?: string }).error ?? 'Failed')
      setSuccessMsg(status === 'paid' ? 'Marked as paid.' : 'Request rejected.')
      setTimeout(() => setSuccessMsg(null), 3000)
      await loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setProcessing(null)
    }
  }, [notesInputs, loadData])

  const filtered = filterStatus === 'all' ? requests : requests.filter((r) => r.status === filterStatus)
  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div style={{ minHeight: '100vh', background: '#060d18', color: '#e8edf4', padding: '40px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Payout Requests</h1>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: '#6a7d9c' }}>
              Funded traders submit these — review and mark as paid once sent.
            </p>
          </div>
          {pendingCount > 0 && (
            <div style={{ padding: '6px 14px', borderRadius: 999, background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>
              {pendingCount} pending
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {(['all', 'pending', 'paid', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filterStatus === s ? 'rgba(36,105,255,0.18)' : 'transparent',
                color: filterStatus === s ? '#7aabff' : '#6a7d9c',
                textTransform: 'capitalize',
              }}
            >{s === 'all' ? `All (${requests.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${requests.filter(r => r.status === s).length})`}</button>
          ))}
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 6, background: 'rgba(246,70,93,0.12)', border: '1px solid rgba(246,70,93,0.3)', color: '#f6465d', fontSize: 13 }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 6, background: 'rgba(14,203,129,0.12)', border: '1px solid rgba(14,203,129,0.3)', color: '#0ecb81', fontSize: 13 }}>
            {successMsg}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#6a7d9c' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#6a7d9c' }}>
            {filterStatus === 'all' ? 'No payout requests yet.' : `No ${filterStatus} requests.`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((req) => {
              const st = STATUS_STYLE[req.status] ?? STATUS_STYLE.pending
              const isPending = req.status === 'pending'
              return (
                <div key={req.id} style={{ borderRadius: 10, border: `1px solid ${isPending ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)'}`, background: isPending ? 'rgba(245,158,11,0.03)' : 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>

                  {/* Top row */}
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#c0d4f5' }}>{req.account_id}</span>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, background: st.bg, color: st.color, border: `1px solid ${st.border}`, fontWeight: 700 }}>{st.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6a7d9c', marginTop: 3 }}>{req.user_email}</div>
                      <div style={{ fontSize: 11, color: '#5a6d8c', marginTop: 2 }}>Requested {fmtDate(req.created_at)}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 20, textAlign: 'right' }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#6a7d9c', marginBottom: 2 }}>Profit at request</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0ecb81' }}>{fmt(req.profit_amount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#6a7d9c', marginBottom: 2 }}>Payout ({req.profit_split_pct}%)</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#7aabff' }}>{fmt(req.payout_amount)}</div>
                      </div>
                      {req.live_profit !== null && (
                        <div>
                          <div style={{ fontSize: 11, color: '#6a7d9c', marginBottom: 2 }}>Live profit</div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: req.live_profit > req.profit_amount ? '#0ecb81' : '#e8edf4' }}>{fmt(req.live_profit)}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Wallet + actions */}
                  <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 11, color: '#5a6d8c', marginBottom: 3 }}>Send to wallet</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#c0d4f5', wordBreak: 'break-all' }}>
                        {req.wallet_address ?? <span style={{ color: '#5a6d8c', fontStyle: 'italic' }}>No address provided</span>}
                      </div>
                      {req.notes && (
                        <div style={{ fontSize: 11, color: '#8fa4c4', marginTop: 4 }}>Note: {req.notes}</div>
                      )}
                      {req.processed_at && (
                        <div style={{ fontSize: 11, color: '#5a6d8c', marginTop: 2 }}>Processed {fmtDate(req.processed_at)}</div>
                      )}
                    </div>

                    {isPending && (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, color: '#6a7d9c', display: 'block', marginBottom: 3 }}>Admin note (optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Sent via USDC Base"
                            value={notesInputs[req.id] ?? ''}
                            onChange={(e) => setNotesInputs((p) => ({ ...p, [req.id]: e.target.value }))}
                            style={{
                              padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(36,105,255,0.2)',
                              background: 'rgba(255,255,255,0.04)', color: '#e8edf4', fontSize: 12,
                              width: 200,
                            }}
                          />
                        </div>
                        <button
                          onClick={() => void handleAction(req.id, 'paid')}
                          disabled={processing === req.id}
                          style={{
                            padding: '7px 16px', borderRadius: 6, border: '1px solid #0ecb81',
                            background: 'rgba(14,203,129,0.12)', color: '#0ecb81',
                            fontWeight: 700, fontSize: 12, cursor: processing === req.id ? 'not-allowed' : 'pointer',
                            opacity: processing === req.id ? 0.6 : 1, whiteSpace: 'nowrap',
                          }}
                        >
                          {processing === req.id ? '…' : 'Mark Paid'}
                        </button>
                        <button
                          onClick={() => void handleAction(req.id, 'rejected')}
                          disabled={processing === req.id}
                          style={{
                            padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(246,70,93,0.3)',
                            background: 'rgba(246,70,93,0.08)', color: '#f6465d',
                            fontWeight: 700, fontSize: 12, cursor: processing === req.id ? 'not-allowed' : 'pointer',
                            opacity: processing === req.id ? 0.6 : 1,
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
