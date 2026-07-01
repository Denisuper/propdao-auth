'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/signin'); return }
      const adminIds = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim())
      if (!adminIds.includes(session.user.id)) { router.replace('/dashboard'); return }
      setChecking(false)
    })
  }, [router])

  if (checking) return null

  return (
    <div style={{ minHeight: '100vh', background: '#060d18', color: '#e8edf4', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Link href="/dashboard" style={{ fontWeight: 700, fontSize: 15, color: '#e8edf4', textDecoration: 'none' }}>PropDAO</Link>
            <nav style={{ display: 'flex', gap: 4 }}>
              <Link
                href="/admin/payouts"
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  background: pathname?.startsWith('/admin/payouts') ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color: pathname?.startsWith('/admin/payouts') ? '#f59e0b' : '#8fa4c4',
                }}
              >
                Payouts
              </Link>
            </nav>
          </div>
          <Link href="/dashboard" style={{ fontSize: 12, color: '#6a7d9c', textDecoration: 'none' }}>← Dashboard</Link>
        </div>
      </header>
      {children}
    </div>
  )
}
