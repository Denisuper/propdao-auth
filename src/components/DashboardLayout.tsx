'use client'

import { ReactNode, useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut, updateUsername } from '@/lib/auth'
import { toast } from 'sonner'

interface DashboardLayoutProps {
  children: ReactNode
  userEmail?: string
  userAvatar?: string | null
  userId?: string
  userName?: string
  accountBalance?: string
}

const NAV = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/marketplace',
    label: 'Challenges',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
]

function useIsAdmin(userId?: string) {
  if (!userId) return false
  const ids = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return ids.includes(userId)
}

export function DashboardLayout({ children, userEmail, userAvatar, userId, userName, accountBalance }: DashboardLayoutProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const isAdmin  = useIsAdmin(userId)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [editingName,  setEditingName]  = useState(false)
  const [nameInput,    setNameInput]    = useState(userName ?? '')
  const [displayName,  setDisplayName]  = useState(userName ?? '')
  const [isSaving,     setIsSaving]     = useState(false)
  const menuRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync if parent prop changes (e.g. after page re-renders with fresh user data)
  useEffect(() => {
    if (!userName) return
    const syncName = () => {
      setDisplayName(userName)
      setNameInput(userName)
    }
    queueMicrotask(syncName)
  }, [userName])

  // Focus input when edit mode opens
  useEffect(() => {
    if (editingName) inputRef.current?.focus()
  }, [editingName])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setEditingName(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const accountId = userId
    ? `USR-${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
    : null

  const handleSaveName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === displayName) { setEditingName(false); return }
    setIsSaving(true)
    try {
      await updateUsername(trimmed)
      setDisplayName(trimmed)
      setEditingName(false)
      toast.success('Username updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update username')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      setMenuOpen(false)
      await signOut()
      toast.success('Signed out')
      router.push('/signin')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign out')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="propdao-auth-shell min-h-screen bg-background">
      <header className="propdao-topbar sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo + nav */}
            <div className="flex items-center gap-8">
              <span className="text-lg font-bold text-text-primary select-none">PropDAO</span>
              <nav className="hidden sm:flex items-center gap-1.5">
                {NAV.map(({ href, label, icon }) => {
                  const active =
                    href === '/dashboard'
                      ? !!pathname?.startsWith('/dashboard')
                      : !!pathname?.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-text-secondary hover:text-text-primary hover:bg-primary/10'
                      }`}
                    >
                      {icon}
                      {label}
                    </Link>
                  )
                })}
                {isAdmin && (
                  <Link
                    href="/admin/payouts"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname?.startsWith('/admin')
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'text-text-secondary hover:text-amber-400 hover:bg-amber-500/10'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Admin
                  </Link>
                )}
              </nav>
            </div>

            {/* Account button */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setMenuOpen(o => !o); setEditingName(false) }}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                aria-label="Account settings"
              >
                {userAvatar ? (
                  <span
                    aria-hidden="true"
                    className="w-7 h-7 rounded-full bg-cover bg-center"
                    style={{ backgroundImage: `url("${userAvatar}")` }}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-[0_0_18px_rgba(62,242,120,0.35)]">
                    <svg className="w-4 h-4 text-[#111316]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <svg
                  className={`w-3.5 h-3.5 text-text-secondary transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  width: 272, background: 'rgba(12,14,17,0.96)',
                  border: '1px solid rgba(62,242,120,0.075)', borderRadius: 14,
                  boxShadow: '0 18px 54px rgba(0,0,0,0.42)',
                  overflow: 'hidden',
                  animationName: 'slide-up-content',
                  animationDuration: '0.2s',
                  animationTimingFunction: 'ease-out',
                  animationFillMode: 'both',
                  zIndex: 50,
                }}>

                  {/* Profile section */}
                  <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid rgba(62,242,120,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      {userAvatar ? (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            flexShrink: 0,
                            backgroundImage: `url("${userAvatar}")`,
                            backgroundPosition: 'center',
                            backgroundSize: 'cover',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, #5dba78, #8ef5ad)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="18" height="18" fill="none" stroke="#111316" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 12, color: 'rgba(214,219,208,0.52)', marginBottom: 1 }}>
                          {userEmail}
                        </p>
                        {accountId && (
                          <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#5dba78', letterSpacing: '0.04em' }}>
                            {accountId}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Username row */}
                    {editingName ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          ref={inputRef}
                          value={nameInput}
                          onChange={e => setNameInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                          maxLength={40}
                          style={{
                            flex: 1, padding: '6px 10px', fontSize: 13,
                            border: '1.5px solid rgba(62,242,120,0.52)', borderRadius: 8,
                            outline: 'none', color: '#d7dbd0', background: 'rgba(12,14,17,0.48)',
                            boxShadow: '0 0 0 3px rgba(62,242,120,0.08)',
                          }}
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={isSaving || !nameInput.trim()}
                          style={{
                            padding: '6px 10px', fontSize: 12, fontWeight: 700,
                            background: '#5dba78', color: '#111316',
                            border: 'none', borderRadius: 8, cursor: 'pointer',
                            opacity: isSaving || !nameInput.trim() ? 0.6 : 1,
                          }}
                        >
                          {isSaving ? '…' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEditingName(false); setNameInput(displayName) }}
                          style={{
                            padding: '6px 8px', fontSize: 12, color: 'rgba(214,219,208,0.52)',
                            background: 'none', border: 'none', cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#d7dbd0', flex: 1 }}>
                          {displayName || 'Set a username'}
                        </span>
                        <button
                          onClick={() => setEditingName(true)}
                          title="Edit username"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 4, borderRadius: 6, color: 'rgba(214,219,208,0.52)',
                            display: 'flex', alignItems: 'center',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(62,242,120,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Menu items */}
                  <div style={{ padding: '6px 0' }}>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px', fontSize: 13, color: '#d7dbd0',
                        textDecoration: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(62,242,120,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Dashboard
                    </Link>

                    <Link
                      href="/marketplace"
                      onClick={() => setMenuOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px', fontSize: 13, color: '#d7dbd0',
                        textDecoration: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(62,242,120,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Challenges
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/admin/payouts"
                        onClick={() => setMenuOpen(false)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 16px', fontSize: 13, color: '#f59e0b',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Admin · Payouts
                      </Link>
                    )}

                    <div style={{ height: 1, background: 'rgba(62,242,120,0.07)', margin: '6px 0' }} />

                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px', fontSize: 13, color: '#dc2626',
                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {isSigningOut ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Mobile nav */}
          <nav className="flex sm:hidden items-center gap-1 pb-2">
            {NAV.map(({ href, label, icon }) => {
              const active =
                href === '/dashboard'
                  ? !!pathname?.startsWith('/dashboard')
                  : !!pathname?.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        active
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {icon}
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
