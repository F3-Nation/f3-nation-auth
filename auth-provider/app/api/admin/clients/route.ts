import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin';
import { oauthClientRepository } from '@/db';
import { generateSecureToken } from '@/lib/oauth';

// GET /api/admin/clients - List all OAuth clients
export async function GET() {
  try {
    await requireAdminSession();

    const clients = await oauthClientRepository.findAll();

    return NextResponse.json({ clients });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/clients - Create a new OAuth client
export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();

    const body = await request.json();
    const { name, redirectUris, allowedOrigin, scopes } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
      return NextResponse.json({ error: 'At least one redirect URI is required' }, { status: 400 });
    }

    // Validate redirect URIs are valid URLs
    for (const uri of redirectUris) {
      try {
        new URL(uri);
      } catch {
        return NextResponse.json({ error: `Invalid redirect URI: ${uri}` }, { status: 400 });
      }
    }

    if (!allowedOrigin || typeof allowedOrigin !== 'string' || !allowedOrigin.trim()) {
      return NextResponse.json({ error: 'Allowed origin is required' }, { status: 400 });
    }

    // Validate allowed origin is a valid URL
    try {
      new URL(allowedOrigin);
    } catch {
      return NextResponse.json({ error: 'Invalid allowed origin URL' }, { status: 400 });
    }

    // Validate scopes if provided
    const validScopes = ['openid', 'profile', 'email'];
    const scopeList = scopes && Array.isArray(scopes) ? scopes : ['openid', 'profile', 'email'];

    for (const scope of scopeList) {
      if (!validScopes.includes(scope)) {
        return NextResponse.json({ error: `Invalid scope: ${scope}` }, { status: 400 });
      }
    }

    // Generate client ID and secret
    const clientId = generateSecureToken(16);
    const clientSecret = generateSecureToken(32);

    // Create the client
    const client = await oauthClientRepository.create({
      id: clientId,
      name: name.trim(),
      clientSecret,
      redirectUris: JSON.stringify(redirectUris),
      allowedOrigin: allowedOrigin.trim(),
      scopes: scopeList.join(' '),
    });

    // Return client with plaintext secret (only time it's visible)
    return NextResponse.json({
      client: {
        ...client,
        clientSecret, // Return the plaintext secret
      },
      message: 'Client created successfully. Save the client secret - it will not be shown again.',
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
