import { NextRequest, NextResponse } from 'next/server';
import { validateAccessToken, getUserInfo } from '@/lib/oauth';
import { handlePreflight, addCorsHeaders } from '@/lib/cors';

interface TokenData {
  userId: string;
  clientId: string;
  scopes: string[];
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('Origin');
  try {
    // Note: error responses before token validation use the broad origin check
    // because clientId is only known after validating the access token.
    // Extract access token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return await addCorsHeaders(
        NextResponse.json(
          {
            error: 'invalid_request',
            error_description: 'Missing or invalid Authorization header',
          },
          { status: 401 }
        ),
        origin
      );
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate access token
    const tokenData: TokenData | null = await validateAccessToken(accessToken);
    if (!tokenData) {
      return await addCorsHeaders(
        NextResponse.json(
          { error: 'invalid_token', error_description: 'Invalid or expired access token' },
          { status: 401 }
        ),
        origin
      );
    }

    // Get user info based on token scopes
    const userInfo = await getUserInfo(tokenData.userId, tokenData.scopes);
    if (!userInfo) {
      return await addCorsHeaders(
        NextResponse.json(
          { error: 'server_error', error_description: 'User not found' },
          { status: 500 }
        ),
        origin
      );
    }

    return await addCorsHeaders(NextResponse.json(userInfo), origin, tokenData.clientId);
  } catch (error) {
    console.error('OAuth userinfo error:', error);
    return await addCorsHeaders(
      NextResponse.json(
        { error: 'server_error', error_description: 'Internal server error' },
        { status: 500 }
      ),
      origin
    );
  }
}

export async function POST(request: NextRequest) {
  // Support POST method as well (some OAuth implementations use POST)
  return GET(request);
}
