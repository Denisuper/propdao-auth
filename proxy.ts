import { type NextRequest, NextResponse } from 'next/server'

const publicRoutes = ['/signin', '/auth/callback', '/auth/complete']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get('sb-auth-token')?.value

  const protectedPaths = ['/dashboard', '/marketplace']
  if (protectedPaths.some((p) => pathname.startsWith(p)) && !sessionCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/signin'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
