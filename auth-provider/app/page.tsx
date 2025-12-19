import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import ProfilePage from './components/ProfilePage';

interface User {
  name: string;
  email: string;
  image: string;
  id: string;
}

interface Session {
  user: User;
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const session = await getServerSession<typeof authOptions, Session>(authOptions);

  if (!session) {
    redirect('/login?callbackUrl=/');
  }

  // Check if user has completed onboarding and get F3 name, hospital name, and image
  const userResult = await db
    .select({
      onboardingCompleted: users.onboardingCompleted,
      f3Name: users.f3Name,
      hospitalName: users.hospitalName,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const user = userResult[0];

  // Preserve any OAuth callback parameters
  const callbackParams = new URLSearchParams();
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === 'string') {
      callbackParams.set(key, value);
    }
  });
  const callbackQuery = callbackParams.toString();
  const callbackSuffix = callbackQuery ? `?${callbackQuery}` : '';

  if (!user?.onboardingCompleted) {
    redirect(`/onboarding${callbackSuffix}`);
  }

  // If this is an OAuth request (has OAuth parameters), redirect to OAuth authorize endpoint
  if (
    resolvedSearchParams.response_type &&
    resolvedSearchParams.client_id &&
    resolvedSearchParams.redirect_uri
  ) {
    const oauthParams = new URLSearchParams();
    [
      'response_type',
      'client_id',
      'redirect_uri',
      'scope',
      'state',
      'code_challenge',
      'code_challenge_method',
    ].forEach(param => {
      const value = resolvedSearchParams[param];
      if (typeof value === 'string') {
        oauthParams.set(param, value);
      }
    });
    redirect(`/api/oauth/authorize?${oauthParams.toString()}`);
  }

  return (
    <ProfilePage
      user={{
        f3Name: user.f3Name || '',
        hospitalName: user.hospitalName || '',
        email: session.user.email,
        image: user.image,
      }}
    />
  );
}
