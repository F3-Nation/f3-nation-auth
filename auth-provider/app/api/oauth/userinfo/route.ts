import { NextRequest, NextResponse } from 'next/server';
import { validateAccessToken, getUserInfo } from '@/lib/oauth';

// Add CORS headers
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

export async function GET(request: NextRequest) {
  try {
    // Extract access token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return addCorsHeaders(
        NextResponse.json(
          {
            error: 'invalid_request',
            error_description: 'Missing or invalid Authorization header',
          },
          { status: 401 }
        )
      );
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate access token
    const tokenData = await validateAccessToken(accessToken);
    if (!tokenData) {
      return addCorsHeaders(
        NextResponse.json(
          { error: 'invalid_token', error_description: 'Invalid or expired access token' },
          { status: 401 }
        )
      );
    }

    // Get user info based on token scopes
    const userInfo = await getUserInfo(tokenData.userId, tokenData.scopes);
    if (!userInfo) {
      return addCorsHeaders(
        NextResponse.json(
          { error: 'server_error', error_description: 'User not found' },
          { status: 500 }
        )
      );
    }

    return addCorsHeaders(NextResponse.json(userInfo));
  } catch (error) {
    console.error('OAuth userinfo error:', error);
    return addCorsHeaders(
      NextResponse.json(
        { error: 'server_error', error_description: 'Internal server error' },
        { status: 500 }
      )
    );
  }
}

export async function POST(request: NextRequest) {
  // Support POST method as well (some OAuth implementations use POST)
  return GET(request);
}
