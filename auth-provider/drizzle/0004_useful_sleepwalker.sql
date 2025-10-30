ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pending_google_link" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "primary_auth_method" text DEFAULT 'email' NOT NULL;
