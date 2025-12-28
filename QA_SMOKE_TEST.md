# QA Smoke Test Plan: F3 Database Migration

Manual verification checklist for the auth app migration from isolated user table (text IDs) to F3 production's `public.users` table (integer IDs).

---

## Prerequisites

Before testing, ensure:

- [ ] Fresh local database initialized (`docker compose down -v && docker compose up -d`)
- [ ] Migration has been run (`npm run db:push` or `npm run db:migrate`)
- [ ] `DATABASE_URL` environment variable is configured
- [ ] App is running locally (`npm run dev`)

---

## 1. New User Registration

**Test:** First-time user sign-up creates records in both tables

### Steps:

1. Open the app in a private/incognito browser window
2. Navigate to `/login`
3. Enter a new email address that doesn't exist in the system
4. Receive and click the magic link OR enter the verification code
5. Complete the onboarding flow (enter F3 name and hospital name)

### Expected Results:

- [ ] User record created in `public.users` with integer ID
- [ ] Profile record created in `auth.user_profiles` linked to user ID
- [ ] Session shows correct `f3Name` and `hospitalName`
- [ ] User ID in session is a number (not a string)

### Database Verification:

```sql
-- Verify user record
SELECT id, f3_name, email, email_verified, status FROM public.users WHERE email = 'test@example.com';

-- Verify profile record
SELECT user_id, hospital_name, onboarding_completed FROM auth.user_profiles WHERE user_id = <user_id>;
```

---

## 2. Existing User Login

**Test:** Returning user login works with integer ID

### Steps:

1. Use the same email from test #1
2. Request new magic link / verification code
3. Complete the login flow

### Expected Results:

- [ ] User is logged in successfully
- [ ] `email_verified` timestamp is updated in `public.users`
- [ ] Session contains correct user data with integer ID
- [ ] No duplicate user or profile records created

### Database Verification:

```sql
-- Verify email_verified was updated (not the original timestamp)
SELECT id, email_verified, updated FROM public.users WHERE email = 'test@example.com';
```

---

## 3. Onboarding Updates

**Test:** Onboarding updates both tables correctly

### Steps:

1. Log in with a new user that hasn't completed onboarding
2. Complete the onboarding form with:
   - F3 Name: "TestPax"
   - Hospital Name: "TestHospital"
3. Submit the form

### Expected Results:

- [ ] `f3_name` updated in `public.users`
- [ ] `hospital_name` updated in `auth.user_profiles`
- [ ] `onboarding_completed` set to `true` in `auth.user_profiles`
- [ ] Redirect to home page shows correct names

### Database Verification:

```sql
-- Verify user table
SELECT f3_name, updated FROM public.users WHERE id = <user_id>;

-- Verify profile table
SELECT hospital_name, onboarding_completed, updated_at FROM auth.user_profiles WHERE user_id = <user_id>;
```

---

## 4. Session Data

**Test:** Session contains merged data from both tables

### Steps:

1. Log in with a completed user
2. Navigate to `/api/session`
3. Inspect the JSON response

### Expected Results:

- [ ] `user.id` is a number (integer)
- [ ] `user.f3Name` populated from `public.users`
- [ ] `user.hospitalName` populated from `auth.user_profiles`
- [ ] `user.onboardingCompleted` is `true`

---

## 5. OAuth Authorization Flow

**Test:** OAuth flow works with integer user IDs

### Steps:

1. Configure an OAuth client in the database
2. Initiate OAuth authorization request:
   ```
   /api/oauth/authorize?response_type=code&client_id=<CLIENT_ID>&redirect_uri=<REDIRECT_URI>&scope=openid%20profile%20email
   ```
3. Complete login if not authenticated
4. Observe the redirect with authorization code

### Expected Results:

- [ ] Authorization code created in `auth.oauth_authorization_codes`
- [ ] `user_id` in auth code record is an integer
- [ ] Redirect contains valid `code` parameter

### Database Verification:

```sql
SELECT code, client_id, user_id, expires FROM auth.oauth_authorization_codes WHERE user_id = <user_id>;
```

---

## 6. OAuth Token Exchange

**Test:** Token exchange works with integer user IDs

### Steps:

1. Use the authorization code from test #5
2. Make token request:
   ```bash
   curl -X POST /api/oauth/token \
     -d "grant_type=authorization_code" \
     -d "code=<AUTH_CODE>" \
     -d "client_id=<CLIENT_ID>" \
     -d "client_secret=<CLIENT_SECRET>" \
     -d "redirect_uri=<REDIRECT_URI>"
   ```

### Expected Results:

- [ ] Response contains `access_token` and `refresh_token`
- [ ] Access token record created in `auth.oauth_access_tokens`
- [ ] Refresh token record created in `auth.oauth_refresh_tokens`
- [ ] Both records have integer `user_id`

### Database Verification:

```sql
SELECT token, user_id, expires FROM auth.oauth_access_tokens WHERE user_id = <user_id>;
SELECT token, user_id, expires FROM auth.oauth_refresh_tokens WHERE user_id = <user_id>;
```

---

## 7. OAuth Userinfo Endpoint

**Test:** Userinfo returns correct data with integer user ID

### Steps:

1. Use the access token from test #6
2. Make userinfo request:
   ```bash
   curl /api/oauth/userinfo \
     -H "Authorization: Bearer <ACCESS_TOKEN>"
   ```

### Expected Results:

- [ ] Response contains `sub` field (user ID as string)
- [ ] Response contains `name` (f3Name from `public.users`)
- [ ] Response contains `email`
- [ ] Response contains `email_verified`

---

## 8. Email MFA Codes

**Test:** Email MFA still works (keyed by email, not user ID)

### Steps:

1. Request a new login / magic link
2. Check the `auth.email_mfa_codes` table
3. Verify the code or use the magic link

### Expected Results:

- [ ] MFA code created in `auth.email_mfa_codes`
- [ ] Code is keyed by email address
- [ ] Verification consumes the code (sets `consumed_at`)

### Database Verification:

```sql
SELECT id, email, expires_at, consumed_at, attempt_count FROM auth.email_mfa_codes WHERE email = 'test@example.com';
```

---

## 9. Schema Verification

**Test:** Database schema is correctly organized

### Steps:

Run these queries to verify schema structure:

```sql
-- List auth schema tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth';

-- Verify user_profiles FK constraint
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'auth';
```

### Expected Results:

- [ ] Tables exist: `auth.user_profiles`, `auth.sessions`, `auth.verification_tokens`, `auth.oauth_clients`, `auth.oauth_authorization_codes`, `auth.oauth_access_tokens`, `auth.oauth_refresh_tokens`, `auth.email_mfa_codes`
- [ ] All user ID foreign keys reference `public.users(id)`
- [ ] User IDs are integer type (not text)

---

## 10. Error Scenarios

### 10a. Invalid User ID Format

- [ ] Attempting to use a text user ID in API calls returns appropriate error

### 10b. Missing Profile Record

- [ ] User without profile record still works (profile gets created on onboarding)

### 10c. Orphaned Records

- [ ] Deleting user from `public.users` cascades to `auth.user_profiles`

---

## Summary Checklist

| Test                        | Status |
| --------------------------- | ------ |
| 1. New User Registration    |        |
| 2. Existing User Login      |        |
| 3. Onboarding Updates       |        |
| 4. Session Data             |        |
| 5. OAuth Authorization Flow |        |
| 6. OAuth Token Exchange     |        |
| 7. OAuth Userinfo Endpoint  |        |
| 8. Email MFA Codes          |        |
| 9. Schema Verification      |        |
| 10. Error Scenarios         |        |

---

## Notes

- All tests should be run against the local development environment first
- After local verification, run the same tests against staging
- Document any issues found with specific error messages and database states
