import { NextRequest, NextResponse } from 'next/server';
import { createEmailVerification } from '@/lib/mfa';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, callbackUrl } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const resolvedCallbackUrl = callbackUrl || '/';

    await createEmailVerification(email, resolvedCallbackUrl);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending verification email:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email. Please try again.' },
      { status: 500 }
    );
  }
}
