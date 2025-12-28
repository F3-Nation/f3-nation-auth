import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { users, userProfiles } from '@/db/schema';
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

    // Update the user's F3 name in public.users
    await db
      .update(users)
      .set({
        f3Name: f3Name.trim(),
        updated: new Date(),
      })
      .where(eq(users.id, session.user.id));

    // Update or create user profile in auth.user_profiles
    const existingProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, session.user.id))
      .limit(1);

    if (existingProfile.length > 0) {
      await db
        .update(userProfiles)
        .set({
          hospitalName: hospitalName.trim(),
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, session.user.id));
    } else {
      await db.insert(userProfiles).values({
        userId: session.user.id,
        hospitalName: hospitalName.trim(),
        onboardingCompleted: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
