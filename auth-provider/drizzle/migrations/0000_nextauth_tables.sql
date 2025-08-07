-- Create NextAuth tables
CREATE TABLE IF NOT EXISTS "user" (
  "id" text NOT NULL,
  "name" text,
  "email" text NOT NULL,
  "emailVerified" timestamp,
  "image" text,
  CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "account" (
  "userId" text NOT NULL,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "providerAccountId" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" integer,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  CONSTRAINT "account_pkey" PRIMARY KEY ("provider", "providerAccountId"),
  CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "session" (
  "sessionToken" text NOT NULL,
  "userId" text NOT NULL,
  "expires" timestamp NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sessionToken"),
  CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "verificationToken" (
  "identifier" text NOT NULL,
  "token" text NOT NULL,
  "expires" timestamp NOT NULL,
  CONSTRAINT "verificationToken_pkey" PRIMARY KEY ("identifier", "token")
);
