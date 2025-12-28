import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { users, userProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(session);
  }

  try {
    // Get user data from public.users
    const userResult = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
    const dbUser = userResult[0];

    if (dbUser) {
      // Get profile data from auth.user_profiles
      const profileResult = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, dbUser.id))
        .limit(1);
      const profile = profileResult[0];

      // Merge session data with database data
      const enhancedSession = {
        ...session,
        user: {
          ...session.user,
          onboardingCompleted: profile?.onboardingCompleted ?? false,
          f3Name: dbUser.f3Name,
          hospitalName: profile?.hospitalName,
        },
      };
      return NextResponse.json(enhancedSession);
    }
  } catch (error) {
    console.error('Error fetching user data for session:', error);
  }

  return NextResponse.json(session);
}
