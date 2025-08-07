ALTER TABLE "user" ADD COLUMN "pending_google_link" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "primary_auth_method" text DEFAULT 'email' NOT NULL;