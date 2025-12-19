import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyNewEmail } from '@/lib/email-change';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId, code } = await request.json();

    if (!requestId || typeof requestId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'INVALID_REQUEST', message: 'Request ID is required' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'INVALID_CODE', message: 'Verification code is required' },
        { status: 400 }
      );
    }

    const result = await verifyNewEmail(requestId, code, session.user.id);

    if (!result.success) {
      const statusCode =
        result.error === 'NOT_FOUND'
          ? 404
          : result.error === 'EXPIRED'
            ? 410
            : result.error === 'EMAIL_IN_USE'
              ? 409
              : 400;

      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: result.message,
          oldEmailVerified: result.oldEmailVerified,
          newEmailVerified: result.newEmailVerified,
          complete: result.complete,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      oldEmailVerified: result.oldEmailVerified,
      newEmailVerified: result.newEmailVerified,
      complete: result.complete,
    });
  } catch (error) {
    console.error('Verify new email error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
