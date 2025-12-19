import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resendEmailChangeCodes } from '@/lib/email-change';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId, target } = await request.json();

    if (!requestId || typeof requestId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Request ID is required' },
        { status: 400 }
      );
    }

    if (!target || !['old', 'new', 'both'].includes(target)) {
      return NextResponse.json(
        { success: false, error: 'Target must be "old", "new", or "both"' },
        { status: 400 }
      );
    }

    // Get user's f3Name
    const [user] = await db
      .select({ f3Name: users.f3Name })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const result = await resendEmailChangeCodes(
      requestId,
      session.user.id,
      target as 'old' | 'new' | 'both',
      user?.f3Name || 'F3 Member'
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend email codes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
