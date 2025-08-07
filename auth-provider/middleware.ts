import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Handle CORS for OAuth endpoints and login pages
  const { pathname, origin } = request.nextUrl;

  // Allow requests from known client domains
  const allowedOrigins = [
    'https://app.freemensworkout.org',
    'https://app2.freemensworkout.org',
    'https://localhost:3001',
    'http://localhost:3001',
  ];

  const requestOrigin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Check if the request is coming from an allowed origin or referer
  const isAllowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin);
  const isAllowedReferer = referer && allowedOrigins.some(origin => referer.startsWith(origin));

  // For OAuth authorization flow and login pages, we need to be more permissive
  if (
    pathname.startsWith('/api/oauth/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/onboarding')
  ) {
    const response = NextResponse.next();

    // Set CORS headers for OAuth endpoints
    if (pathname.startsWith('/api/oauth/')) {
      if (isAllowedOrigin) {
        response.headers.set('Access-Control-Allow-Origin', requestOrigin);
      }
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // For login and onboarding pages, ensure they can be accessed in cross-origin contexts
    if (pathname.startsWith('/login') || pathname.startsWith('/onboarding')) {
      // Remove X-Frame-Options to allow embedding if needed
      response.headers.delete('X-Frame-Options');
      // Set less restrictive CSP for login pages
      response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
      );
    }

    return response;
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });

    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', requestOrigin);
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/oauth/:path*', '/login/:path*', '/onboarding/:path*'],
};
