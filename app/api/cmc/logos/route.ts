import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
// Cache for 24 hours — CMC logos don't change often
export const revalidate = 86400

// CMC symbols we need: tokens + native coins for each network
const SYMBOLS = 'ETH,BNB,SOL,TRX,USDC,USDT,ARB,MATIC'

// Maps our internal network keys to the CMC symbol for that network's logo
const NETWORK_SYMBOL_MAP: Record<string, string> = {
  ethereum: 'ETH',
  base:     'ETH',    // Base is an L2 — use ETH logo
  arbitrum: 'ARB',
  polygon:  'MATIC',
  bnb:      'BNB',
  solana:   'SOL',
  tron:     'TRX',
}

export async function GET() {
  const apiKey = process.env.CMC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'CMC_API_KEY not configured' }, { status: 500 })
  }

  const res = await fetch(
    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/info?symbol=${SYMBOLS}&aux=logo`,
    {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        Accepts: 'application/json',
      },
      next: { revalidate: 86400 },
    },
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch from CoinMarketCap' }, { status: 502 })
  }

  const json = await res.json() as {
    data: Record<string, { logo: string }[] | { logo: string }>
  }

  // CMC returns an array when multiple coins share a symbol (e.g. USDC on many chains)
  function logoFor(symbol: string): string | null {
    const entry = json.data[symbol]
    if (!entry) return null
    if (Array.isArray(entry)) return entry[0]?.logo ?? null
    return (entry as { logo: string }).logo ?? null
  }

  // Token logos (displayed on token selector buttons)
  const tokens: Record<string, string | null> = {
    USDC: logoFor('USDC'),
    USDT: logoFor('USDT'),
    SOL:  logoFor('SOL'),
    TRX:  logoFor('TRX'),
  }

  // Network logos (displayed on network selector buttons)
  const networks: Record<string, string | null> = {}
  for (const [key, sym] of Object.entries(NETWORK_SYMBOL_MAP)) {
    networks[key] = logoFor(sym)
  }

  return NextResponse.json({ tokens, networks })
}
