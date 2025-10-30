import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, type DB } from '@/db';
import { createEmailVerification, verifyEmailCode } from './mfa';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      onboardingCompleted?: boolean;
      hospitalName?: string | null;
      f3Name?: string | null;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    onboardingCompleted?: boolean;
    hospitalName?: string | null;
    f3Name?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'email',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Verification Code', type: 'text' },
        callbackUrl: { label: 'Callback URL', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.code) {
          // First step - send verification email with magic link
          if (!credentials?.email) {
            throw new Error('Email is required');
          }

          // Create verification with magic link - use provided callback URL or default
          const callbackUrl =
            credentials.callbackUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000';
          await createEmailVerification(credentials.email, callbackUrl);
          return null;
        }

        // Second step - verify code
        if (!credentials.email || !credentials.code) {
          throw new Error('Email and verification code are required');
        }

        // Verify the code via the MFA service (and consume it this time)
        console.log('Attempting to verify email code for:', credentials.email);

        const isValid = await verifyEmailCode(credentials.email, credentials.code, true); // Consume the code

        if (!isValid) {
          console.log('Email verification failed for:', credentials.email);
          throw new Error('Invalid verification code');
        }

        console.log('Email verification successful for:', credentials.email);

        // Create or find user in database
        try {
          const userResult = await db
            .select()
            .from(users)
            .where(eq(users.email, credentials.email!))
            .limit(1);
          let existingUser = userResult[0] || null;

          if (!existingUser) {
            // Create new user if not exists
            const f3Name = credentials.email!.split('@')[0];
            const newUser = {
              id: credentials.email!,
              name: f3Name, // Sync with f3Name for NextAuth compatibility
              f3Name: f3Name,
              email: credentials.email!,
              emailVerified: new Date(),
              image: null,
              onboardingCompleted: false,
            };
            const insertResult = await db.insert(users).values(newUser).returning();
            existingUser = insertResult[0];
          } else {
            // User exists, update emailVerified timestamp
            await db
              .update(users)
              .set({
                emailVerified: new Date(),
              })
              .where(eq(users.id, existingUser.id));
          }

          console.log('Successfully found/created user:', existingUser);
          // Map database fields to NextAuth expected fields
          return {
            id: existingUser.id,
            name: existingUser.name || existingUser.f3Name, // Use name field for NextAuth, fallback to f3Name
            email: existingUser.email,
            image: existingUser.image,
            onboardingCompleted: existingUser.onboardingCompleted,
          };
        } catch (dbError) {
          console.error('Database error:', dbError);
          throw new Error('Database error occurred during user creation/lookup');
        }
      },
    }),
  ],
  adapter: DrizzleAdapter(db as unknown as DB),
  session: {
    strategy: 'jwt', // Use JWT for credentials providers
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__session' : 'next-auth.session-token',
      options: {
        path: '/',
        httpOnly: true,
        sameSite: 'none', // Allow cross-site cookies for OAuth flow
        secure: true, // Required when sameSite is 'none'
      },
    },
  },
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, user }) {
      // If user is provided (during sign in), add user info to token
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string | null;
        session.user.email = token.email as string | null;
        session.user.image = token.image as string | null;

        // Fetch additional user data from database
        try {
          const userResult = await db
            .select()
            .from(users)
            .where(eq(users.id, token.id as string))
            .limit(1);
          const dbUser = userResult[0];

          if (dbUser) {
            session.user.onboardingCompleted = dbUser.onboardingCompleted;
            session.user.hospitalName = dbUser.hospitalName;
            session.user.f3Name = dbUser.f3Name;
          }
        } catch (error) {
          console.error('Error fetching user data in session callback:', error);
        }
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      console.log('NextAuth redirect callback:', { url, baseUrl });

      // If url starts with "/", it's a relative path - make it absolute
      if (url.startsWith('/')) {
        const fullUrl = `${baseUrl}${url}`;
        console.log('Redirecting to relative URL:', fullUrl);
        return fullUrl;
      }

      // If url is already absolute, validate it
      try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);

        // Allow same origin redirects
        if (urlObj.origin === baseUrlObj.origin) {
          console.log('Redirecting to same origin URL:', url);
          return url;
        }

        // Allow known client domains for OAuth flow
        const allowedOrigins = [
          'https://app.freemensworkout.org',
          'https://app2.freemensworkout.org',
          'https://localhost:3001',
          'http://localhost:3001',
        ];

        if (allowedOrigins.includes(urlObj.origin)) {
          console.log('Redirecting to allowed client origin:', url);
          return url;
        }

        // Allow subdomain redirects for production
        const baseHost = baseUrlObj.hostname;
        const targetHost = urlObj.hostname;
        if (
          targetHost === baseHost ||
          targetHost.endsWith('.' + baseHost.split('.').slice(-2).join('.'))
        ) {
          console.log('Redirecting to subdomain URL:', url);
          return url;
        }

        console.log('URL not allowed, redirecting to baseUrl:', { url, baseUrl });
      } catch (e) {
        console.error('Redirect callback URL parsing error:', e, 'url:', url, 'baseUrl:', baseUrl);
      }

      // Default to baseUrl if anything goes wrong
      console.log('Defaulting to baseUrl:', baseUrl);
      return baseUrl;
    },
  },
};
