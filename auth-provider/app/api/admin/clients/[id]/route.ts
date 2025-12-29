import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin';
import { oauthClientRepository } from '@/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/clients/[id] - Get a single client
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdminSession();

    const { id } = await params;
    const client = await oauthClientRepository.findById(id);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/clients/[id] - Update a client
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdminSession();

    const { id } = await params;
    const body = await request.json();
    const { name, redirectUris, allowedOrigin, scopes, isActive } = body;

    // Check if client exists
    const existingClient = await oauthClientRepository.findById(id);
    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (redirectUris !== undefined) {
      if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
        return NextResponse.json(
          { error: 'At least one redirect URI is required' },
          { status: 400 }
        );
      }
      // Validate URIs
      for (const uri of redirectUris) {
        try {
          new URL(uri);
        } catch {
          return NextResponse.json({ error: `Invalid redirect URI: ${uri}` }, { status: 400 });
        }
      }
      updateData.redirectUris = JSON.stringify(redirectUris);
    }

    if (allowedOrigin !== undefined) {
      if (typeof allowedOrigin !== 'string' || !allowedOrigin.trim()) {
        return NextResponse.json(
          { error: 'Allowed origin must be a non-empty string' },
          { status: 400 }
        );
      }
      try {
        new URL(allowedOrigin);
      } catch {
        return NextResponse.json({ error: 'Invalid allowed origin URL' }, { status: 400 });
      }
      updateData.allowedOrigin = allowedOrigin.trim();
    }

    if (scopes !== undefined) {
      if (!Array.isArray(scopes)) {
        return NextResponse.json({ error: 'Scopes must be an array' }, { status: 400 });
      }
      const validScopes = ['openid', 'profile', 'email'];
      for (const scope of scopes) {
        if (!validScopes.includes(scope)) {
          return NextResponse.json({ error: `Invalid scope: ${scope}` }, { status: 400 });
        }
      }
      updateData.scopes = scopes.join(' ');
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
      }
      updateData.isActive = isActive;
    }

    // Update the client
    const updatedClient = await oauthClientRepository.update(id, updateData);

    return NextResponse.json({ client: updatedClient });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/clients/[id] - Delete or deactivate a client
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdminSession();

    const { id } = await params;
    const url = new URL(request.url);
    const permanent = url.searchParams.get('permanent') === 'true';

    // Check if client exists
    const existingClient = await oauthClientRepository.findById(id);
    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (permanent) {
      // Permanently delete the client
      await oauthClientRepository.delete(id);
      return NextResponse.json({ message: 'Client permanently deleted' });
    } else {
      // Soft delete (deactivate)
      await oauthClientRepository.deactivate(id);
      return NextResponse.json({ message: 'Client deactivated' });
    }
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
