'use client'

import { useEffect, useRef, useState } from 'react'

export type TierKey = 'starter' | '25k' | '50k' | '100k' | '200k'

const TABS: { key: TierKey; label: string }[] = [
  { key: 'starter', label: 'Starter' },
  { key: '25k',     label: '$25K' },
  { key: '50k',     label: '$50K' },
  { key: '100k',    label: '$100K' },
  { key: '200k',    label: '$200K' },
]

interface TierTabsProps {
  active: TierKey
  onChange: (key: TierKey) => void
}

export function TierTabs({ active, onChange }: TierTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const idx = TABS.findIndex(t => t.key === active)
    const btn = btnRefs.current[idx]
    const container = containerRef.current
    if (!btn || !container) return
    const btnRect = btn.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    setPillStyle({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
    })
    if (!mounted) setMounted(true)
  }, [active, mounted])

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center rounded-xl p-1 gap-0"
      style={{ background: 'rgba(125, 144, 96, 0.13)', border: '1.5px solid #b5c49a' }}
    >
      {/* sliding pill */}
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-lg"
        style={{
          left: pillStyle.left,
          width: pillStyle.width,
          background: 'linear-gradient(135deg, #92a872 0%, #7d9060 100%)',
          boxShadow: '0 2px 8px rgba(125,144,96,0.35)',
          transition: mounted
            ? 'left 260ms cubic-bezier(0.4,0,0.2,1), width 260ms cubic-bezier(0.4,0,0.2,1)'
            : 'none',
        }}
      />

      {TABS.map(({ key, label }, idx) => (
        <button
          key={key}
          ref={el => { btnRefs.current[idx] = el }}
          onClick={() => onChange(key)}
          className="relative z-10 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer focus-visible:outline-none select-none"
          style={{
            color: active === key ? '#fff' : '#7d9060',
            transition: 'color 200ms ease',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
