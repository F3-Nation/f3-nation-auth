ALTER TABLE "user" ADD COLUMN "pending_google_link" text;
ALTER TABLE "user" ADD COLUMN "primary_auth_method" text DEFAULT 'email' NOT NULL;
