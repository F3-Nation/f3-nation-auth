import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { f3Name, hospitalName } = await request.json();

    if (!f3Name || typeof f3Name !== 'string' || !f3Name.trim()) {
      return NextResponse.json({ error: 'F3 name is required' }, { status: 400 });
    }

    if (!hospitalName || typeof hospitalName !== 'string' || !hospitalName.trim()) {
      return NextResponse.json({ error: 'Hospital name is required' }, { status: 400 });
    }

    // Update the user's names and mark onboarding as completed
    await db
      .update(users)
      .set({
        name: f3Name.trim(), // Sync with f3Name for NextAuth compatibility
        f3Name: f3Name.trim(),
        hospitalName: hospitalName.trim(),
        onboardingCompleted: true,
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
