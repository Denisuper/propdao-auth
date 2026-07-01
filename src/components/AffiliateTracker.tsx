'use client'

import { useEffect } from 'react'

const REF_PARAM_NAMES = ['ref', 'affiliate', 'aff']
const REF_COOKIE = 'pdao_ref'
const REF_MAX_AGE = 60 * 60 * 24 * 30
const REF_RE = /^[A-Z0-9_-]{3,30}$/

function readCookie(name: string) {
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

function writeRefCookie(code: string) {
  document.cookie = `${REF_COOKIE}=${encodeURIComponent(code)}; path=/; samesite=lax; max-age=${REF_MAX_AGE}`
}

export function AffiliateTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = REF_PARAM_NAMES.map((name) => params.get(name)).find(Boolean)
    const code = raw?.trim().toUpperCase()

    if (!code || !REF_RE.test(code)) return

    if (readCookie(REF_COOKIE)?.toUpperCase() !== code) {
      writeRefCookie(code)
    }

    fetch('/api/affiliate/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refCode: code }),
    }).catch(() => {})
  }, [])

  return null
}
