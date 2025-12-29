import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin';
import { oauthClientRepository } from '@/db';
import { generateSecureToken } from '@/lib/oauth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/clients/[id]/regenerate-secret - Generate a new client secret
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdminSession();

    const { id } = await params;

    // Check if client exists
    const existingClient = await oauthClientRepository.findById(id);
    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Generate a new secret
    const newSecret = generateSecureToken(32);

    // Update the client with the new secret
    const updatedClient = await oauthClientRepository.update(id, {
      clientSecret: newSecret,
    });

    return NextResponse.json({
      client: {
        ...updatedClient,
        clientSecret: newSecret, // Return the plaintext secret
      },
      message:
        'Client secret regenerated successfully. Save the new secret - it will not be shown again.',
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error regenerating client secret:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
