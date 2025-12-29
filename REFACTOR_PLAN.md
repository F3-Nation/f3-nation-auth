# Plan: Replace Drizzle ORM with Type-Safe Raw SQL

## Overview

Refactor the auth-provider app to remove Drizzle ORM completely and use raw PostgreSQL queries with type-safe TypeScript interfaces and a repository pattern.

## Architecture

### Folder Structure (New/Modified)

```
auth-provider/db/
├── index.ts                      # DB client + repository exports (modify)
├── client.ts                     # DatabaseClient class (new)
├── types/
│   ├── index.ts                  # Re-exports all types
│   ├── user.ts                   # User + UserRow types
│   ├── user-profile.ts
│   ├── session.ts
│   ├── verification-token.ts
│   ├── oauth-client.ts
│   ├── oauth-authorization-code.ts
│   ├── oauth-access-token.ts
│   ├── oauth-refresh-token.ts
│   └── email-mfa-code.ts
├── repositories/
│   ├── index.ts                  # Repository factory
│   ├── base.repository.ts        # BaseRepository class
│   ├── user.repository.ts
│   ├── user-profile.repository.ts
│   ├── session.repository.ts
│   ├── verification-token.repository.ts
│   ├── oauth-client.repository.ts
│   ├── oauth-authorization-code.repository.ts
│   ├── oauth-access-token.repository.ts
│   ├── oauth-refresh-token.repository.ts
│   └── email-mfa-code.repository.ts
├── utils/
│   ├── case-transform.ts         # snake_case <-> camelCase
│   └── transaction.ts            # Transaction wrapper
└── schema.ts                     # KEEP for reference, remove Drizzle later
```

---

## Implementation Steps

### Phase 1: Infrastructure (Non-Breaking)

Create new files alongside existing Drizzle code.

1. **Create `db/client.ts`** - DatabaseClient class
   - `query<T>()` - execute parameterized queries with type safety
   - `queryOne<T>()` - single row helper
   - `withTransaction()` - transaction wrapper

2. **Create `db/utils/case-transform.ts`**
   - `toSnakeCase()` / `toCamelCase()` converters
   - `rowToEntity<TRow, TEntity>()` - transform DB rows to TypeScript entities
   - `entityToRow<TEntity, TRow>()` - reverse transform for inserts

3. **Create `db/types/*.ts`** - One file per entity
   - `User` / `UserRow` / `UserInsert` / `UserUpdate`
   - `UserProfile` / `UserProfileRow` / etc.
   - All 9 entities from current schema

4. **Create `db/repositories/base.repository.ts`**
   - Abstract class with common operations
   - `buildInsertQuery()`, `buildUpdateQuery()` helpers
   - `mapRow()` / `mapRows()` transformers

### Phase 2: Repository Implementation

5. **Create all 9 repositories** in `db/repositories/`:
   - `user.repository.ts` - findById, findByEmail, create, update
   - `user-profile.repository.ts` - findByUserId, create, update
   - `session.repository.ts` - findByToken, create, delete
   - `verification-token.repository.ts` - find, create, delete
   - `oauth-client.repository.ts` - findActiveById, create
   - `oauth-authorization-code.repository.ts` - create, findValid, delete
   - `oauth-access-token.repository.ts` - create, findValid, delete
   - `oauth-refresh-token.repository.ts` - create, findValid, delete
   - `email-mfa-code.repository.ts` - create, findLatestUnconsumed, markConsumed, deleteExpired

6. **Create `db/repositories/index.ts`**
   - `Repositories` interface
   - `createRepositories()` factory
   - `getRepositories()` singleton getter

7. **Update `db/index.ts`**
   - Export `dbClient` (DatabaseClient instance)
   - Export `getRepositories()`
   - Keep `pool` export for migration scripts

### Phase 3: NextAuth Custom Adapter

8. **Create `lib/next-auth-adapter.ts`**
   - Implement NextAuth `Adapter` interface
   - Methods: `createUser`, `getUser`, `getUserByEmail`, `getUserByAccount`, `updateUser`, `deleteUser`
   - Methods: `linkAccount`, `unlinkAccount`, `createSession`, `getSessionAndUser`, `updateSession`, `deleteSession`
   - Methods: `createVerificationToken`, `useVerificationToken`

### Phase 4: Migrate Business Logic (File by File)

Migrate each file, replacing Drizzle imports with repository calls.

9. **Migrate `lib/mfa/index.ts`** (easiest - already partially raw SQL)
   - Replace `db.select/update` calls with `emailMfaCodeRepository`

10. **Migrate `lib/oauth.ts`** (largest file, ~20 queries)
    - Replace all Drizzle queries with repository calls
    - Functions: validateClient, createAuthorizationCode, validateAuthorizationCode, createAccessToken, validateAccessToken, refreshAccessToken, getUserInfo, registerClient

11. **Migrate `lib/auth.ts`**
    - Replace Drizzle adapter with custom adapter
    - Update authorize callback to use repositories
    - Update session/jwt callbacks

12. **Migrate `app/api/session/route.ts`**
    - Replace db.select() with userRepository, userProfileRepository

13. **Migrate `app/api/onboarding/route.ts`**
    - Replace db.select/insert/update with repositories

14. **Migrate `app/api/oauth/authorize/route.ts`**
    - Replace db.select(oauthClients) with repository

15. **Migrate `app/api/oauth/token/route.ts`**
    - Replace db.select(oauthClients) with repository

16. **Migrate `app/api/oauth/userinfo/route.ts`**
    - Replace db.select(oauthClients) with repository

17. **Migrate `app/page.tsx`** (if any db calls)

### Phase 5: Cleanup

18. **Remove Drizzle dependencies**
    - Remove from package.json: `drizzle-orm`, `drizzle-kit`, `@auth/drizzle-adapter`
    - Update npm scripts: remove `db:generate`, `db:migrate`, `db:push`
    - Keep `db:deploy` (uses raw SQL migrate.ts)

19. **Remove Drizzle files**
    - Delete `drizzle.config.ts`
    - Delete `drizzle/relations.ts`
    - Keep `drizzle/*.sql` migration files (manual migrations)
    - Convert `db/schema.ts` to documentation or delete

20. **Final cleanup**
    - Remove unused imports throughout codebase
    - Run `npm run typecheck` and `npm run lint`
    - Test all auth flows

---

## Files to Modify

| File                               | Action                                     |
| ---------------------------------- | ------------------------------------------ |
| `db/index.ts`                      | Modify - add DatabaseClient, repositories  |
| `db/schema.ts`                     | Delete (after migration)                   |
| `db/external/users.ts`             | Delete (types moved to db/types/)          |
| `lib/auth.ts`                      | Modify - use custom adapter + repositories |
| `lib/oauth.ts`                     | Modify - use repositories                  |
| `lib/mfa/index.ts`                 | Modify - use repositories                  |
| `app/api/session/route.ts`         | Modify - use repositories                  |
| `app/api/onboarding/route.ts`      | Modify - use repositories                  |
| `app/api/oauth/authorize/route.ts` | Modify - use repositories                  |
| `app/api/oauth/token/route.ts`     | Modify - use repositories                  |
| `app/api/oauth/userinfo/route.ts`  | Modify - use repositories                  |
| `drizzle.config.ts`                | Delete                                     |
| `drizzle/relations.ts`             | Delete                                     |
| `package.json`                     | Modify - remove drizzle deps               |

## New Files to Create

| File                         | Purpose                                 |
| ---------------------------- | --------------------------------------- |
| `db/client.ts`               | DatabaseClient class with query helpers |
| `db/utils/case-transform.ts` | snake_case <-> camelCase utilities      |
| `db/types/*.ts`              | 9 type definition files                 |
| `db/repositories/*.ts`       | 10 repository files (base + 9 entities) |
| `lib/next-auth-adapter.ts`   | Custom NextAuth adapter                 |

---

## Key Design Decisions

1. **Raw `pg` over query builders** - Already a dependency, full control, no caching issues
2. **Repository pattern** - Clean separation, testable, type-safe
3. **snake_case DB / camelCase TypeScript** - Transform in repository layer
4. **Custom NextAuth adapter** - Full control, uses same repositories
5. **Keep manual SQL migrations** - Existing migrate.ts script works without Drizzle

## Type Safety Approach

```typescript
// Row type (matches DB exactly)
interface UserRow {
  id: number;
  f3_name: string | null;
  email_verified: Date | null;
}

// Entity type (TypeScript friendly)
interface User {
  id: number;
  f3Name: string | null;
  emailVerified: Date | null;
}

// Query with type parameter
const result = await client.query<UserRow>(sql, params);
// Transform in repository
return rowToEntity<UserRow, User>(result.rows[0]);
```

## Migration Strategy

- **Non-breaking**: Create new infrastructure alongside Drizzle
- **File-by-file**: Migrate one consumer at a time
- **Test after each file**: Ensure no regressions
- **Delete Drizzle last**: Only after all consumers migrated

---

## Reference: Current Database Schema

### Tables (auth schema)

- `auth.user_profiles` - userId (PK), hospitalName, onboardingCompleted, createdAt, updatedAt
- `auth.sessions` - sessionToken (PK), userId, expires
- `auth.verification_tokens` - identifier+token (composite PK), expires
- `auth.oauth_clients` - id (PK), name, clientSecret, redirectUris, allowedOrigin, scopes, createdAt, isActive
- `auth.oauth_authorization_codes` - code (PK), clientId, userId, redirectUri, scopes, codeChallenge, codeChallengeMethod, expires, createdAt
- `auth.oauth_access_tokens` - token (PK), clientId, userId, scopes, expires, createdAt
- `auth.oauth_refresh_tokens` - token (PK), accessToken, clientId, userId, expires, createdAt
- `auth.email_mfa_codes` - id (PK), email, codeHash, expiresAt, consumedAt, attemptCount, createdAt

### External Table (public schema)

- `public.users` - id (PK), f3_name, first_name, last_name, email, phone, home_region_id, avatar_url, meta, created, updated, emergency_contact, emergency_phone, emergency_notes, email_verified, status
