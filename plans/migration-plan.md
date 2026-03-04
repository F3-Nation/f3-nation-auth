# Migration Plan: Supabase → Google Cloud Shared Database

## Current State

**Database**: PostgreSQL on Supabase (dedicated)
**Schema**: `public` (default)
**ORM**: Drizzle ORM v0.44.3

**Tables**:

- `user` - Core user profiles (id, email, f3Name, hospitalName, etc.)
- `session` - NextAuth sessions
- `account` - OAuth provider accounts
- `verificationToken` - Email verification tokens
- `oauth_client` - OAuth application clients
- `oauth_authorization_code`, `oauth_access_token`, `oauth_refresh_token`
- `email_mfa_code` - Email verification codes

## Target State

**Database**: Google Cloud shared PostgreSQL
**Schema**: `Auth` (scoped permissions)
**Integration**: F3Nation Map uses `public.users` in same database

---

## Migration Plan

### Phase 1: Prepare Auth Application for Schema-Qualified Tables

**Goal**: Update Drizzle configuration to use `Auth` schema without breaking current deployment.

1. **Update `drizzle.config.ts`** to specify schema:

   ```typescript
   export default {
     schema: "./db/schema.ts",
     out: "./drizzle",
     dialect: "postgresql",
     schemaFilter: ["Auth"], // Only manage Auth schema
     dbCredentials: {
       url: process.env.DATABASE_URL || "",
     },
   } satisfies Config;
   ```

2. **Update `db/schema.ts`** to use schema qualification:

   ```typescript
   import { pgSchema, pgTable, text, ... } from 'drizzle-orm/pg-core';

   // Define the Auth schema
   export const authSchema = pgSchema('Auth');

   // All tables use authSchema.table() instead of pgTable()
   export const users = authSchema.table('user', { ... });
   export const sessions = authSchema.table('session', { ... });
   // etc.
   ```

3. **Test locally** with a test database that has the Auth schema created.

### Phase 2: Set Up Google Cloud Database

**Goal**: Create the Auth schema and tables in the new shared database.

1. **Create the Auth schema** (requires DBA or elevated permissions):

   ```sql
   CREATE SCHEMA IF NOT EXISTS "Auth";
   ```

2. **Run Drizzle migrations** against new database:

   ```bash
   DATABASE_URL="<new-gcloud-url>" npm run db:push
   ```

3. **Verify tables** were created in Auth schema:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'Auth';
   ```

### Phase 3: Data Migration

**Goal**: Migrate existing user data from Supabase to Google Cloud.

1. **Export data from Supabase**:

   ```bash
   pg_dump -h <supabase-host> -U postgres -d postgres \
     -t user -t session -t account -t "verificationToken" \
     -t oauth_client -t oauth_authorization_code \
     -t oauth_access_token -t oauth_refresh_token \
     -t email_mfa_code \
     --data-only --format=plain > auth_data.sql
   ```

2. **Transform SQL to use Auth schema** (sed/awk or manual):
   - Change `INSERT INTO user` → `INSERT INTO "Auth"."user"`
   - Change all table references to schema-qualified names

3. **Import to Google Cloud**:
   ```bash
   psql -h <gcloud-host> -U auth_user -d shared_db < auth_data_transformed.sql
   ```

### Phase 4: Cutover

**Goal**: Switch Auth application to use new database.

1. **Update environment variable**:

   ```
   DATABASE_URL=postgresql://auth_user:***@gcloud-host/shared_db
   ```

2. **Deploy updated Auth application**.

3. **Verify functionality**:
   - Test login flow
   - Test session management
   - Test OAuth flows
   - Verify onboarding works

4. **Decommission Supabase** (after verification period).

---

## Phase 5: Bridge Solution for F3Nation Map

**Context**:

- Users overlap but are not identical (some Map users don't have Auth accounts yet)
- Auth will be the source of truth going forward
- Map cannot be modified immediately but will be updated later

**Goal**: Create a database-level bridge so Map continues working with `public.users` while Auth owns the data.

### Step 1: Link Auth users to existing Map users

Add a `map_user_id` column to `Auth.user` to reference existing Map users:

```sql
ALTER TABLE "Auth"."user" ADD COLUMN map_user_id UUID REFERENCES public.users(id);
```

When a user authenticates via Auth:

1. Look up their email in `public.users`
2. If found, set `map_user_id` to link them
3. If not found, leave it null (new user)

### Step 2: Create a sync trigger (Auth → public.users)

Create a trigger that syncs changes from `Auth.user` to `public.users`:

```sql
CREATE OR REPLACE FUNCTION sync_auth_to_public_users()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.map_user_id IS NOT NULL THEN
    -- Update existing Map user
    UPDATE public.users
    SET email = NEW.email,
        -- add other relevant columns
        updated_at = NOW()
    WHERE id = NEW.map_user_id;
  ELSE
    -- Insert new user into public.users for Map
    INSERT INTO public.users (id, email, ...)
    VALUES (gen_random_uuid(), NEW.email, ...)
    RETURNING id INTO NEW.map_user_id;

    -- Link back to Auth user
    UPDATE "Auth"."user" SET map_user_id = NEW.map_user_id WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auth_user_sync
AFTER INSERT OR UPDATE ON "Auth"."user"
FOR EACH ROW EXECUTE FUNCTION sync_auth_to_public_users();
```

### Step 3: Map reads from public.users (unchanged)

Map continues to query `public.users` as before - no changes needed.

---

## Phase 6: Final Migration (When Map is Ready)

**Goal**: Migrate Map to use `Auth.user` directly and deprecate `public.users`.

### Step 1: Update Map queries

Change Map's database queries from:

```sql
SELECT * FROM public.users WHERE ...
```

To:

```sql
SELECT * FROM "Auth"."user" WHERE ...
```

### Step 2: Migrate Map-specific columns

If `public.users` has columns that `Auth.user` doesn't have, either:

- Add them to `Auth.user`
- Or keep them in a separate `Auth.user_profile` table

### Step 3: Drop the bridge

```sql
DROP TRIGGER auth_user_sync ON "Auth"."user";
DROP FUNCTION sync_auth_to_public_users();
ALTER TABLE "Auth"."user" DROP COLUMN map_user_id;
-- Eventually: DROP TABLE public.users;
```

---

## Files to Modify

| File                                 | Changes                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| `auth-provider/drizzle.config.ts`    | Add schemaFilter for 'Auth'                              |
| `auth-provider/db/schema.ts`         | Use `pgSchema('Auth')` for all tables, add `map_user_id` |
| `auth-provider/drizzle/relations.ts` | Update table references                                  |
| `auth-provider/lib/auth.ts`          | Link users to Map on authentication                      |
| Environment variables                | Update DATABASE_URL                                      |

---

## Summary: Step-by-Step Execution Order

1. **Update Auth codebase** to use `Auth` schema in Drizzle
2. **Test locally** with schema-qualified tables
3. **Create `Auth` schema** in Google Cloud database
4. **Run migrations** to create tables in Auth schema
5. **Add `map_user_id` column** to `Auth.user`
6. **Create sync trigger** (Auth → public.users)
7. **Export data** from Supabase
8. **Import data** to Google Cloud `Auth` schema
9. **Link existing users** (match by email to set `map_user_id`)
10. **Update DATABASE_URL** and deploy Auth
11. **Verify** both Auth and Map work correctly
12. **(Later)** Update Map to query `Auth.user` directly
13. **(Later)** Remove sync trigger and bridge columns
