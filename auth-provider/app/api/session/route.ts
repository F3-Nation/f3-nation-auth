import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(session);
  }

  try {
    // Get additional user data from database
    const userResult = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
    const dbUser = userResult[0];

    if (dbUser) {
      // Merge session data with database data
      const enhancedSession = {
        ...session,
        user: {
          ...session.user,
          onboardingCompleted: dbUser.onboardingCompleted,
          f3Name: dbUser.f3Name,
          hospitalName: dbUser.hospitalName,
        },
      };
      return NextResponse.json(enhancedSession);
    }
  } catch (error) {
    console.error('Error fetching user data for session:', error);
  }

  return NextResponse.json(session);
}
