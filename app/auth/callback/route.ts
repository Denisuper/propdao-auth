import { NextRequest, NextResponse } from 'next/server'

// Hand off to the client-side page so the PKCE code_verifier (stored in the
// browser's localStorage) is accessible when exchangeCodeForSession runs.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/signin?error=${error}`, origin))
  }

  const params = searchParams.toString()
  return NextResponse.redirect(new URL(`/auth/complete${params ? `?${params}` : ''}`, origin))
}
