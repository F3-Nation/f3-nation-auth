# Migration Plan: DATABASE_URL to F3_DATABASE_URL

## Overview

Migrate auth app from isolated user table (text IDs) to F3 production's `public.users` table (integer IDs), with all auth tables in `auth.*` schema namespace.

## Key Changes Summary

- **Database connection**: `DATABASE_URL` → `F3_DATABASE_URL`
- **User table**: Use existing `public.users` (integer IDs) instead of `user` (text IDs)
- **Auth tables**: Move to `auth.*` namespace (auth.sessions, auth.oauth_clients, etc.)
- **New table**: `auth.user_profiles` for auth-specific fields (hospitalName, onboardingCompleted)
- **User ID type**: All FKs change from `text` to `integer`

---

## Phase 1: Create External Users Schema (Read-Only Definition)

### Create `auth-provider/db/external/users.ts`

Define `public.users` table schema for Drizzle without including in migrations:

```typescript
import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

// External users table - DO NOT MIGRATE
// This table is managed externally; we only read/write data
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  f3Name: text("f3_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  homeRegionId: integer("home_region_id"),
  avatarUrl: text("avatar_url"),
  meta: text("meta"),
  created: timestamp("created", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated", { withTimezone: true }).defaultNow(),
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  emergencyNotes: text("emergency_notes"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  status: text("status").$type<"active" | "inactive">().default("active"),
});

export type ExternalUser = typeof users.$inferSelect;
export type NewExternalUser = typeof users.$inferInsert;
```

---

## Phase 2: Rewrite Auth Schema with `auth.*` Namespace

### Rewrite `auth-provider/db/schema.ts`

Key changes:

- Use `pgSchema('auth')` for all auth tables
- Change all `userId` FKs from `text` to `integer` referencing `users.id`
- Add new `auth.user_profiles` table
- Rename tables to snake_case (auth.sessions, auth.oauth_clients, etc.)

Tables to define in `auth.*` schema:

1. `auth.user_profiles` - NEW (userId FK, hospitalName, onboardingCompleted)
2. `auth.sessions` - (sessionToken, userId as integer, expires)
3. `auth.verification_tokens` - (identifier, token, expires)
4. `auth.oauth_clients` - (id, name, clientSecret, redirectUris, allowedOrigin, scopes, createdAt, isActive)
5. `auth.oauth_authorization_codes` - (code, clientId, userId as integer, ...)
6. `auth.oauth_access_tokens` - (token, clientId, userId as integer, ...)
7. `auth.oauth_refresh_tokens` - (token, accessToken, clientId, userId as integer, ...)
8. `auth.email_mfa_codes` - (id, email, codeHash, expiresAt, consumedAt, attemptCount, createdAt)

---

## Phase 3: Update Drizzle Configuration

### Update `auth-provider/drizzle.config.ts`

```typescript
export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.F3_DATABASE_URL || "",
  },
  schemaFilter: ["auth"], // Only manage auth schema, not public
} satisfies Config;
```

### Update `auth-provider/db/index.ts`

```typescript
const pool = new Pool({
  connectionString: process.env.F3_DATABASE_URL, // Changed from DATABASE_URL
});
```

---

## Phase 4: Update Application Logic

### 4.1 Update `auth-provider/lib/auth.ts`

- Change `User.id` type from `string` to `number` in NextAuth module declarations
- Update user lookup to query `public.users` by email
- On new user: insert into `public.users`, then create `auth.user_profiles` record
- On existing user: update `emailVerified` timestamp
- Fetch profile data from `auth.user_profiles` for onboardingCompleted/hospitalName
- Update session callback to join users + user_profiles

### 4.2 Update `auth-provider/lib/oauth.ts`

- Change all `userId: string` parameters/returns to `userId: number`
- Update `createAuthorizationCode`, `validateAuthorizationCode`, `createAccessToken`, `validateAccessToken`, `getUserInfo` signatures
- Update `getUserInfo` to query from `public.users`

### 4.3 Update `auth-provider/app/api/onboarding/route.ts`

- Update `public.users.f3_name` for user's F3 name
- Update `auth.user_profiles` for hospitalName and onboardingCompleted

### 4.4 Update `auth-provider/app/api/session/route.ts`

- Join `public.users` with `auth.user_profiles` for enriched session data
- Use integer ID for lookups

### 4.5 Update `auth-provider/app/api/oauth/userinfo/route.ts`

- Change userId type from string to number

### 4.6 Update `auth-provider/app/api/oauth/authorize/route.ts`

- Ensure session.user.id is handled as number

---

## Phase 5: Update Relations and Types

### Update `auth-provider/drizzle/relations.ts`

- Update all relations to use new table references
- Ensure user relations reference `public.users` correctly

---

## Phase 6: Migration Consolidation & Execution

### 6.1 Clean up old migrations

Delete all existing migration files in `auth-provider/drizzle/`:

- `0000_magenta_franklin_storm.sql`
- `0001_outstanding_killraven.sql`
- `0002_add_onboarding_completed.sql`
- `0002_majestic_spirit.sql`
- `0003_remove_phone_column.sql`
- `0004_add_google_linking_fields.sql`
- `0004_useful_sleepwalker.sql`
- `0005_melodic_preak.sql`
- `0006_remove_google_fields.sql`
- `0007_remove_pending_email_link.sql`
- All snapshot files in `drizzle/meta/`
- Reset `drizzle/meta/_journal.json`

Also clean up manual migrations in `drizzle/migrations/`:

- `0000_nextauth_tables.sql`
- `0001_email_mfa_code.sql`

### 6.2 Generate fresh "MVP" migration

```bash
npm run db:generate
```

This creates a single clean migration that represents the complete auth schema:

- `0000_initial_auth_schema.sql` (or similar generated name)

### 6.3 Review generated SQL

Ensure the single migration:

- Creates `auth` schema namespace
- Creates all auth.\* tables with correct FKs to public.users(id)
- Does NOT touch public.users table
- Represents the complete final state

### 6.4 Run migration

```bash
npm run db:push  # or db:migrate
```

### Benefits of consolidation

- Clean slate for new database structure
- Single source of truth for schema
- Easier to understand for new developers
- No legacy cruft from text-ID era

---

## Phase 7: Update Local Development

### Update `auth-provider/scripts/db/init/01-create-f3prod.sql`

Add:

```sql
CREATE SCHEMA IF NOT EXISTS auth;
```

### Update seed scripts

Ensure test data creates users in `public.users` and profiles in `auth.user_profiles`.

---

## Critical Files to Modify

| File                               | Changes                                                 |
| ---------------------------------- | ------------------------------------------------------- |
| `db/external/users.ts`             | NEW - public.users schema (read-only definition)        |
| `db/schema.ts`                     | REWRITE - auth.\* namespace, integer FKs, user_profiles |
| `db/index.ts`                      | Change DATABASE_URL → F3_DATABASE_URL                   |
| `drizzle.config.ts`                | Add schemaFilter: ['auth'], use F3_DATABASE_URL         |
| `lib/auth.ts`                      | User ID string→number, split user/profile logic         |
| `lib/oauth.ts`                     | userId type string→number in all functions              |
| `app/api/onboarding/route.ts`      | Write to users + user_profiles                          |
| `app/api/session/route.ts`         | Join users + user_profiles                              |
| `app/api/oauth/userinfo/route.ts`  | userId type change                                      |
| `app/api/oauth/authorize/route.ts` | userId type handling                                    |
| `drizzle/relations.ts`             | Update for new schema structure                         |

---

## Testing Checklist

- [ ] New user registration creates public.users + auth.user_profiles records
- [ ] Existing user login works with integer ID
- [ ] Onboarding updates both tables correctly
- [ ] Session contains correct user data from joined tables
- [ ] OAuth authorization flow works with integer user IDs
- [ ] OAuth token exchange works
- [ ] OAuth userinfo endpoint returns correct data
- [ ] Email MFA codes work (keyed by email, not affected)
