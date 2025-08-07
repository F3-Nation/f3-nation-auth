-- Remove Google-related fields from users table
ALTER TABLE "user" DROP COLUMN IF EXISTS "pending_google_link";
ALTER TABLE "user" DROP COLUMN IF EXISTS "primary_auth_method";
