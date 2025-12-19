import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  isValidEmail,
  isEmailInUse,
  checkRateLimit,
  initiateEmailChange,
} from '@/lib/email-change';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { newEmail } = await request.json();

    // Validate email format
    if (!newEmail || typeof newEmail !== 'string' || !isValidEmail(newEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_EMAIL',
          message: 'Please enter a valid email address',
        },
        { status: 400 }
      );
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();

    // Get current user data
    const [user] = await db
      .select({
        email: users.email,
        f3Name: users.f3Name,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if new email is same as current
    if (normalizedNewEmail === user.email.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: 'SAME_EMAIL',
          message: 'New email must be different from your current email',
        },
        { status: 400 }
      );
    }

    // Check if email is already in use
    const emailInUse = await isEmailInUse(normalizedNewEmail, session.user.id);
    if (emailInUse) {
      return NextResponse.json(
        {
          success: false,
          error: 'EMAIL_IN_USE',
          message: 'This email address is already associated with another account',
        },
        { status: 409 }
      );
    }

    // Check rate limit
    const withinLimit = await checkRateLimit(session.user.id);
    if (!withinLimit) {
      return NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMITED',
          message: 'Too many email change requests. Please try again later.',
        },
        { status: 429 }
      );
    }

    // Initiate email change
    const { requestId } = await initiateEmailChange(
      session.user.id,
      user.email,
      normalizedNewEmail,
      user.f3Name || 'F3 Member'
    );

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Verification codes sent to both email addresses',
    });
  } catch (error) {
    console.error('Email change initiate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
