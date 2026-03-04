import { NextRequest, NextResponse } from 'next/server';
export const config = {
  matcher: ['/login/:path*', '/onboarding/:path*'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // For login and onboarding pages, set permissive CSP
  if (pathname.startsWith('/login') || pathname.startsWith('/onboarding')) {
    const response = NextResponse.next();
    response.headers.delete('X-Frame-Options');
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
    );
    return response;
  }

  return NextResponse.next();
}
