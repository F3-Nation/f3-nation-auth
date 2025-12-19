import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cancelEmailChange, getPendingEmailChange } from '@/lib/email-change';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pendingChange = await getPendingEmailChange(session.user.id);

    return NextResponse.json({
      success: true,
      pendingChange,
    });
  } catch (error) {
    console.error('Get pending email change error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = await request.json();

    if (!requestId || typeof requestId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Request ID is required' },
        { status: 400 }
      );
    }

    await cancelEmailChange(requestId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel email change error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
