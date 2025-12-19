CREATE TABLE IF NOT EXISTS "email_change_request" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "current_email" text NOT NULL,
  "new_email" text NOT NULL,
  "old_email_verified" boolean NOT NULL DEFAULT false,
  "new_email_verified" boolean NOT NULL DEFAULT false,
  "old_email_code_hash" text,
  "new_email_code_hash" text,
  "old_email_verified_at" timestamp,
  "new_email_verified_at" timestamp,
  "old_email_attempt_count" integer NOT NULL DEFAULT 0,
  "new_email_attempt_count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "email_change_request_user_idx" ON "email_change_request" ("user_id");
CREATE INDEX IF NOT EXISTS "email_change_request_expires_idx" ON "email_change_request" ("expires_at");
