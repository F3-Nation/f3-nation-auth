# Postmortem: Auth Provider Production OAuth Failure

**Date**: 2026-02-06
**Duration**: ~30 minutes (detected immediately after pax-vault deploy)
**Severity**: P1 — Sign-in completely broken for pax-vault
**Status**: Resolved

## Summary

After deploying the pax-vault Firebase → OAuth migration, clicking "Sign in with F3 Nation" redirected users to `https://0.0.0.0:8080/?error=server_error`. Two independent bugs compounded: (1) the auth-provider's `DATABASE_URL` secret pointed to a Google Cloud SQL database that lacked the OAuth tables, and (2) the pax-vault callback route used `request.nextUrl.origin` which resolves to the Cloud Run internal container address.

## Impact

- All OAuth sign-in attempts for pax-vault returned `server_error`
- No user data loss or security exposure
- Other auth-provider consumers (the-codex, f3-app) were NOT affected — they were already working against the Supabase database before the `provider-database-url` secret was changed

## Timeline

1. **Pre-incident**: Auth-provider production had been using Supabase as its database. A planned Supabase → Cloud SQL migration was documented but not yet executed.
2. **During pax-vault OAuth rollout**: The `firebase-secrets.sh` script for auth-provider was run to push updated `ALLOWED_ORIGINS`. This script reads ALL env vars from `.env.prod` and pushes them as GCP secrets — including `DATABASE_URL`, which in `.env.prod` pointed to Cloud SQL (`35.239.19.124:5432/f3_prod`).
3. **Secret overwrite**: The `provider-database-url` secret was silently overwritten from the Supabase URL to the Cloud SQL URL. The script reported "Secret changed, adding new version" but this was expected for the `ALLOWED_ORIGINS` change and went unnoticed for `DATABASE_URL`.
4. **Auth-provider redeployed**: The new revision picked up the Cloud SQL `DATABASE_URL`.
5. **Cloud SQL missing tables**: The Cloud SQL database (`f3_prod`) has an `auth` schema with NextAuth tables but no `oauth_client` table in the default search path. The OAuth tables only exist in the Supabase database's `public` schema.
6. **pax-vault deployed**: The OAuth migration code went live. Sign-in attempts hit auth-provider's `/api/oauth/authorize`, which tried to query `oauth_client` → PostgreSQL returned `42P01: relation "oauth_client" does not exist` → caught by try-catch → redirected to pax-vault callback with `error=server_error`.
7. **Secondary bug**: pax-vault's callback route used `request.nextUrl.origin` for the error redirect base URL, which resolved to `0.0.0.0:8080` (Cloud Run's internal bind address) instead of `pax-vault.f3nation.com`.

## Root Cause

**Primary**: The `firebase-secrets.sh` script is a "push everything" script — it reads ALL variables from a single `.env.prod` file and pushes every one as a GCP secret. When `.env.prod` contained a Cloud SQL `DATABASE_URL` (from the planned-but-unexecuted migration), running the script to update `ALLOWED_ORIGINS` also silently overwrote `DATABASE_URL` to point at the wrong database.

**Secondary**: pax-vault's callback route (`src/app/api/auth/callback/route.ts:30`) used `request.nextUrl.origin` to construct redirect URLs. Behind Cloud Run's load balancer, this returns the internal container address (`http://0.0.0.0:8080`) rather than the public-facing URL.

**Tertiary**: `NEXT_PUBLIC_SITE_URL` in pax-vault's `.env.firebase` was stale (`https://pax-vault.vercel.app` instead of `https://pax-vault.f3nation.com`).

## Resolution

1. Updated `provider-database-url` GCP secret back to the Supabase URL
2. Triggered auth-provider redeploy via `firebase apphosting:rollouts:create`
3. Fixed pax-vault callback route to use forwarded headers instead of `request.nextUrl.origin`
4. Fixed `NEXT_PUBLIC_SITE_URL` in env files
5. Updated auth-provider `.env.prod` DATABASE_URL to Supabase URL

## Lessons Learned

### What went wrong

1. **Bulk secret push is dangerous**: The firebase-secrets script pushes ALL env vars from a single file. There's no diff preview, no confirmation per-variable, and no protection against accidentally overwriting unrelated secrets. A targeted `ALLOWED_ORIGINS`-only update inadvertently changed `DATABASE_URL`.

2. **`.env.prod` drifted from production**: `.env.prod` contained a Cloud SQL DATABASE_URL that was never the actual production value. It represented a future migration target, not current state. There was no validation that `.env.prod` matched what was actually in GCP Secret Manager.

3. **No smoke test after auth-provider deploy**: After the auth-provider redeployed, there was no automated or manual check that OAuth authorization was functional.

4. **`request.nextUrl.origin` is unreliable in Cloud Run**: This is a known issue with reverse-proxied environments but wasn't caught during development (localhost doesn't have this problem).

### What went right

1. The error was detected immediately after pax-vault deploy (first sign-in attempt)
2. Auth-provider logs clearly showed the exact SQL error and table name
3. The Supabase database already had the `pax-vault-prod` client registered
4. Fix was quick — secret update + redeploy, no code changes required for the primary issue

## Action Items

### Immediate (done)

- [x] Restore `provider-database-url` to Supabase URL
- [x] Trigger auth-provider redeploy
- [x] Fix pax-vault callback route `baseUrl`
- [x] Fix stale `NEXT_PUBLIC_SITE_URL`
- [x] Update auth-provider `.env.prod` to match actual production DATABASE_URL

### Short-term

- [ ] **Add diff preview to firebase-secrets scripts**: Before pushing, show which secrets changed and require confirmation. Consider a `--dry-run` flag.
- [ ] **Split env files or use targeted updates**: Instead of pushing all secrets at once, support pushing individual secrets (e.g., `npm run firebase:secrets -- ALLOWED_ORIGINS`).
- [ ] **Add OAuth health check**: A simple endpoint or startup check that verifies the `oauth_client` table is accessible.
- [ ] **Document which database is production**: Add to `.context/f3-nation-auth.md` that production uses Supabase (until migration is complete) and that `.env.prod` must match.

### Long-term

- [ ] **Complete Supabase → Cloud SQL migration** (or abandon it): The partial migration state is the root cause. Either fully migrate (create OAuth tables in Cloud SQL, migrate data, update `.env.prod`) or keep Supabase and remove Cloud SQL references.
- [ ] **Consider per-secret environment files**: Separate secrets that change rarely (DATABASE_URL, NEXTAUTH_SECRET) from secrets that change often (ALLOWED_ORIGINS).

## Related Files

- `f3-nation-auth/auth-provider/scripts/firebase-secrets.sh` — The bulk push script
- `f3-nation-auth/auth-provider/.env.prod` — Source of truth for production secrets
- `f3-nation-auth/auth-provider/apphosting.yaml` — Secret-to-env-var mapping
- `pax-vault/src/app/api/auth/callback/route.ts` — Callback route with baseUrl bug
- `.context/auth-provider-prod-logs.json` — Raw production logs showing the error
