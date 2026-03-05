# Postmortem: Auth Provider Production Deploy Failure — Resource Readiness Deadline Exceeded

**Date**: 2026-03-04
**Duration**: ~4 hours (deploy failures began after commit `ec4e410`, resolved after data migration and secret fix)
**Severity**: P1 — Auth provider completely down, blocking all OAuth sign-in across all consumers
**Status**: Resolved

## Summary

After merging the CORS-from-DB change (`ec4e410`) and a follow-up secret version fix (`8d24fef`), Firebase App Hosting deploys failed with "Resource readiness deadline exceeded." The Cloud Run container started but couldn't serve healthy responses because the `provider-database-url` secret pointed to Cloud SQL (`f3_prod`), where the auth tables did not exist in the default search path. This is the **same root cause** as the [2026-02-06 incident](./2026-02-06-auth-provider-wrong-database.md) — the DATABASE_URL pointing to Cloud SQL instead of Supabase — but this time the resolution was to complete the Cloud SQL migration rather than revert to Supabase.

## Impact

- Auth provider returned 500 errors on all routes that query the database
- All OAuth consumers (pax-vault, the-codex, f3-app) could not authenticate users
- No user data loss or security exposure
- The `/api/health` endpoint (added during incident) returned 200, allowing Cloud Run to mark the container as healthy even while the app was functionally broken

## Timeline

1. **Pre-incident**: Auth provider was running on Cloud SQL (`f3_prod`) via the `provider-database-url` secret. The `app_auth` database user has CREATE privileges only in the `auth` schema, but the Drizzle ORM schema references unqualified table names (resolved via the `public` schema by default).

2. **Commit `ec4e410`** (CORS from DB): Replaced the static `ALLOWED_ORIGINS` env var with dynamic DB queries to `oauth_client` via `lib/cors.ts`. Code was correct but added a new DB-dependent code path.

3. **Commit `8d24fef`** (secret version fix): Fixed a Firebase App Hosting issue where old secret versions were being disabled, preventing rollbacks. Triggered a new deploy.

4. **Deploy failure**: Cloud Run reported "Resource readiness deadline exceeded." The container started but database queries failed because:
   - The `provider-database-url` secret pointed to Cloud SQL: `postgresql://app_auth:...@35.239.19.124:5432/f3_prod`
   - The `app_auth` user's `search_path` defaulted to `"$user", public`
   - Auth tables (`user`, `oauth_client`, etc.) did not exist in the `public` schema
   - An `auth` schema existed with tables, but with different names (`user_profiles`, `oauth_clients`, etc.) and different column structures — remnants of an earlier, incomplete migration attempt

5. **Initial misdiagnosis**: The Supabase URL (`...pooler.supabase.com:6543/postgres`) was provided as the "production database URL." Schema push and verification against Supabase succeeded — tables existed and had data there. But Cloud Run was using the Cloud SQL URL from the Firebase secret.

6. **Discovery**: Retrieved the actual secret via `gcloud secrets versions access latest --secret=provider-database-url` — confirmed it pointed to Cloud SQL, not Supabase.

7. **Resolution**: Created the correct tables in the `auth` schema, migrated 1,732 users and 9 OAuth clients from Supabase, and updated the secret to include `search_path=auth`. Triggered redeploy.

## Root Cause

**Primary**: The `provider-database-url` Firebase secret pointed to Cloud SQL (`f3_prod`), where the auth app's tables did not exist in the default `search_path`. The `app_auth` user's tables were expected in the `auth` schema but the connection string had no `search_path` override, so all queries resolved against the `public` schema.

**Contributing factor — incomplete migration state**: The Cloud SQL database had an `auth` schema with tables from a previous migration attempt (`user_profiles`, `oauth_clients`, `sessions`, etc.) but these had different names and column structures than what the Drizzle ORM schema defines (`user`, `oauth_client`, `session`, etc.). All tables were empty. The Supabase database held the actual production data.

**Contributing factor — wrong database URL communicated during incident**: The Supabase URL was initially provided for debugging, which led to a successful but misdirected `drizzle-kit push` against the wrong database, delaying resolution.

**Contributing factor — no startup database connectivity check**: The app had no mechanism to fail fast or surface which database it was connected to at startup, making it harder to diagnose the mismatch.

## Resolution

1. **Created auth tables in Cloud SQL** `auth` schema with correct names matching the Drizzle ORM schema (`user`, `session`, `verificationToken`, `oauth_client`, `oauth_authorization_code`, `oauth_access_token`, `oauth_refresh_token`, `email_mfa_code`)

2. **Migrated data from Supabase to Cloud SQL**: 9 OAuth clients and 1,732 users copied via direct SQL insert

3. **Updated `provider-database-url` secret** (version 29) to append `?options=-csearch_path%3Dauth`, directing all queries to the `auth` schema

4. **Added `/api/health` endpoint** (`auth-provider/app/api/health/route.ts`) — lightweight 200 response for Cloud Run startup probes

5. **Increased Cloud Run resources** in `apphosting.yaml`: `cpu: 1`, `memoryMiB: 512`, `maxInstances: 4`

6. **Triggered redeploy** via empty commit push to main

## Lessons Learned

### What went wrong

1. **Same root cause as 2026-02-06 — again**: The Feb 6 postmortem identified the Supabase-to-Cloud-SQL migration limbo as the root cause and listed "Complete Supabase → Cloud SQL migration (or abandon it)" as a long-term action item. That action item was never completed, and the same class of failure recurred.

2. **No single source of truth for the production DATABASE_URL**: The Supabase URL was believed to be production, but the Firebase secret held the Cloud SQL URL. There's no documentation or validation that confirms which database is actually in use.

3. **`drizzle-kit push` against wrong database**: Without knowing the real secret value, the initial fix was applied to Supabase (which was already correct), wasting time. The Firebase secret was only checked after the first fix didn't work.

4. **Silent schema mismatch in Cloud SQL**: The `auth` schema had tables with different names and structures from the Drizzle schema. There was no migration tracking or validation to flag this drift.

### What went right

1. Cloud Run logs clearly identified the exact failing SQL queries and table names
2. `gcloud secrets versions access` quickly revealed the actual DATABASE_URL mismatch
3. Direct SQL table creation and data migration was fast once the correct database was identified
4. The health check endpoint decoupled container liveness from database connectivity, allowing Cloud Run to at least start the container

## Action Items

### Immediate (done)

- [x] Create auth tables with correct names in `auth` schema
- [x] Migrate users and OAuth clients from Supabase to Cloud SQL
- [x] Update `provider-database-url` secret with `search_path=auth`
- [x] Add `/api/health` endpoint for startup probes
- [x] Increase Cloud Run CPU/memory for cold starts
- [x] Trigger redeploy

### Short-term

- [ ] **Add startup database validation**: On app boot, verify that critical tables (`user`, `oauth_client`) are queryable. Log the connected database host and schema. Fail fast with a clear error message if tables are missing.
- [ ] **Document the canonical production database**: Update `.context/` with which database is production (now Cloud SQL `f3_prod`, `auth` schema), the connection string pattern, and the `search_path` requirement.
- [ ] **Add diff preview to firebase-secrets script** (carried over from Feb 6 postmortem — still not done)
- [ ] **Decommission Supabase or mark as deprecated**: Now that Cloud SQL holds the production data, clearly mark Supabase as the old database to prevent future confusion.

### Long-term

- [ ] **Automated deploy smoke test**: After each Firebase App Hosting deploy, run an automated check that hits `/api/health` AND a database-dependent endpoint (e.g., `/api/oauth/authorize` with a test client) to catch functional failures that a simple health check misses.
- [ ] **Drizzle schema pinned to `auth` schema**: Update the Drizzle schema to explicitly use `{ schema: 'auth' }` rather than relying on `search_path` in the connection string. This makes the schema self-documenting and removes a hidden dependency.
- [ ] **Secret change alerting**: Set up notifications when `provider-database-url` is modified in GCP Secret Manager, so the team is aware of any future changes.

## Related Files

- `auth-provider/apphosting.yaml` — Secret-to-env mapping and Cloud Run config
- `auth-provider/db/index.ts` — Database connection setup (uses `DATABASE_URL` env var)
- `auth-provider/db/schema.ts` — Drizzle ORM schema (unqualified table names)
- `auth-provider/lib/cors.ts` — CORS validation via DB queries (added in `ec4e410`)
- `auth-provider/app/api/health/route.ts` — Health check endpoint (added during incident)
- `.context/postmortems/2026-02-06-auth-provider-wrong-database.md` — Previous identical incident
