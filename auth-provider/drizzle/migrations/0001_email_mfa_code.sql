CREATE TABLE IF NOT EXISTS "email_mfa_code" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "consumed_at" timestamp,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_mfa_code_email_idx" ON "email_mfa_code" ("email");
CREATE INDEX IF NOT EXISTS "email_mfa_code_expires_idx" ON "email_mfa_code" ("expires_at");
