import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { oauthClients } from '@/db/schema';
import { eq } from 'drizzle-orm';

const CORS_METHODS = 'GET, POST, OPTIONS';
const CORS_HEADERS = 'Content-Type, Authorization';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedOrigins: Set<string> | null = null;
let cacheTimestamp = 0;
let pendingRefresh: Promise<Set<string>> | null = null;

/** Returns the set of all allowed origins from active OAuth clients, cached for 5 minutes. */
async function getAllowedOrigins(): Promise<Set<string>> {
  if (cachedOrigins && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedOrigins;
  }

  if (!pendingRefresh) {
    pendingRefresh = db
      .select({ allowedOrigin: oauthClients.allowedOrigin })
      .from(oauthClients)
      .then(clients => {
        cachedOrigins = new Set(clients.map(c => c.allowedOrigin));
        cacheTimestamp = Date.now();
        pendingRefresh = null;
        return cachedOrigins;
      });
  }

  return pendingRefresh;
}

/** Checks if the origin belongs to any registered OAuth client. */
export async function isAllowedOrigin(origin: string): Promise<boolean> {
  const origins = await getAllowedOrigins();
  return origins.has(origin);
}

function setCorsHeaders(headers: Headers, origin: string) {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', CORS_METHODS);
  headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Vary', 'Origin');
}

/** Handle OPTIONS preflight: returns 204 with CORS headers if the origin is registered. */
export async function handlePreflight(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('Origin');
  const response = new NextResponse(null, { status: 204 });

  if (origin && (await isAllowedOrigin(origin))) {
    setCorsHeaders(response.headers, origin);
  }

  // Intentional: unrecognized origins get no CORS headers — browser blocks the request.
  return response;
}

/**
 * Add CORS headers to a response.
 *
 * When `clientId` is provided the origin is validated against that specific client
 * (strict per-client check). Otherwise falls back to checking against all registered origins.
 */
export async function addCorsHeaders(
  response: NextResponse,
  origin: string | null,
  clientId?: string
): Promise<NextResponse> {
  if (!origin) return response;

  if (clientId) {
    // Strict per-client validation
    const [client] = await db
      .select({ allowedOrigin: oauthClients.allowedOrigin })
      .from(oauthClients)
      .where(eq(oauthClients.id, clientId))
      .limit(1);

    if (client && origin === client.allowedOrigin) {
      setCorsHeaders(response.headers, origin);
    }
  } else {
    // Broad check against all registered client origins
    if (await isAllowedOrigin(origin)) {
      setCorsHeaders(response.headers, origin);
    }
  }

  return response;
}
