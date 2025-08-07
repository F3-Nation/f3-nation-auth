import { NextRequest, NextResponse } from 'next/server';
import {
  validateClient,
  validateAuthorizationCode,
  createAccessToken,
  refreshAccessToken,
  type TokenRequest,
} from '@/lib/oauth';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData();

    // Parse token request parameters
    const tokenRequest: TokenRequest = {
      grant_type: body.get('grant_type')?.toString() || '',
      code: body.get('code')?.toString() || undefined,
      redirect_uri: body.get('redirect_uri')?.toString() || undefined,
      client_id: body.get('client_id')?.toString() || '',
      client_secret: body.get('client_secret')?.toString() || undefined,
      code_verifier: body.get('code_verifier')?.toString() || undefined,
      refresh_token: body.get('refresh_token')?.toString() || undefined,
    };

    // Validate required parameters
    if (!tokenRequest.grant_type || !tokenRequest.client_id) {
      return addCorsHeaders(
        NextResponse.json(
          { error: 'invalid_request', error_description: 'Missing required parameters' },
          { status: 400 }
        )
      );
    }

    // Validate client
    const client = await validateClient(tokenRequest.client_id, tokenRequest.client_secret);
    if (!client) {
      return addCorsHeaders(
        NextResponse.json(
          { error: 'invalid_client', error_description: 'Invalid client credentials' },
          { status: 401 }
        )
      );
    }

    if (tokenRequest.grant_type === 'authorization_code') {
      // Authorization code flow
      if (!tokenRequest.code || !tokenRequest.redirect_uri) {
        return addCorsHeaders(
          NextResponse.json(
            { error: 'invalid_request', error_description: 'Missing code or redirect_uri' },
            { status: 400 }
          )
        );
      }

      // Validate and consume authorization code
      const codeData = await validateAuthorizationCode(
        tokenRequest.code,
        tokenRequest.client_id,
        tokenRequest.redirect_uri,
        tokenRequest.code_verifier
      );

      if (!codeData) {
        return addCorsHeaders(
          NextResponse.json(
            { error: 'invalid_grant', error_description: 'Invalid authorization code' },
            { status: 400 }
          )
        );
      }

      // Create access token
      const tokens = await createAccessToken(
        tokenRequest.client_id,
        codeData.userId,
        codeData.scopes
      );

      return addCorsHeaders(
        NextResponse.json({
          access_token: tokens.accessToken,
          token_type: 'Bearer',
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refreshToken,
          scope: codeData.scopes.join(' '),
        })
      );
    } else if (tokenRequest.grant_type === 'refresh_token') {
      // Refresh token flow
      if (!tokenRequest.refresh_token) {
        return addCorsHeaders(
          NextResponse.json(
            { error: 'invalid_request', error_description: 'Missing refresh_token' },
            { status: 400 }
          )
        );
      }

      // Refresh access token
      const tokens = await refreshAccessToken(tokenRequest.refresh_token, tokenRequest.client_id);
      if (!tokens) {
        return addCorsHeaders(
          NextResponse.json(
            { error: 'invalid_grant', error_description: 'Invalid refresh token' },
            { status: 400 }
          )
        );
      }

      return addCorsHeaders(
        NextResponse.json({
          access_token: tokens.accessToken,
          token_type: 'Bearer',
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refreshToken,
        })
      );
    } else {
      return addCorsHeaders(
        NextResponse.json(
          { error: 'unsupported_grant_type', error_description: 'Grant type not supported' },
          { status: 400 }
        )
      );
    }
  } catch (error) {
    console.error('OAuth token error:', error);
    return addCorsHeaders(
      NextResponse.json(
        { error: 'server_error', error_description: 'Internal server error' },
        { status: 500 }
      )
    );
  }
}
