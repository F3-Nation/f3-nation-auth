import { NextRequest, NextResponse } from 'next/server';
import { clients } from '@/oauth-clients';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // Handle preflight requests first
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    if (origin) {
      const client = clients.find(c => c.allowedOrigin === origin);
      if (client) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Vary', 'Origin');
    return response;
  }

  // For OAuth endpoints, validate origins
  if (pathname.startsWith('/api/oauth/')) {
    const response = NextResponse.next();
    if (origin) {
      const client = clients.find(c => c.allowedOrigin === origin);
      if (client) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
    }
    response.headers.set('Vary', 'Origin');
    return response;
  }

  // For login and onboarding pages, we need to be more permissive
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

export const config = {
  matcher: ['/api/oauth/:path*', '/login/:path*', '/onboarding/:path*'],
};
