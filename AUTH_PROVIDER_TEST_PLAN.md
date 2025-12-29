# Plan: Comprehensive Test Coverage for auth-provider

## Overview

Add comprehensive test coverage to the auth-provider app using Vitest with full-stack testing (unit, integration, and database tests with test PostgreSQL).

## Current State

- **auth-provider**: Zero tests, no test infrastructure
- **auth-sdk**: Uses Vitest 3.2.4 (2 basic tests)
- **Stack**: Next.js 15, NextAuth 4, PostgreSQL (raw SQL with repository pattern), SendGrid

---

## Implementation Steps

### Phase 1: Test Infrastructure Setup

#### 1.1 Install Dependencies

Add to `auth-provider/package.json` devDependencies:

```json
{
  "vitest": "^3.2.4",
  "@vitest/coverage-v8": "^3.2.4",
  "@vitejs/plugin-react": "^4.3.0",
  "@testing-library/react": "^16.0.0",
  "msw": "^2.7.0",
  "testcontainers": "^10.18.0",
  "@testcontainers/postgresql": "^10.18.0"
}
```

#### 1.2 Create Vitest Configuration

**File**: `auth-provider/vitest.config.ts`

- Configure for Node environment (jsdom for component tests)
- Setup path aliases (@/)
- Coverage thresholds: 70% statements, 60% branches
- Single-threaded for database tests
- 30s timeout for integration tests

#### 1.3 Add npm Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run --testPathPattern='.*\\.unit\\.test\\.ts'",
  "test:integration": "vitest run --testPathPattern='.*\\.integration\\.test\\.ts'",
  "test:db": "vitest run --testPathPattern='.*\\.db\\.test\\.ts'",
  "test:coverage": "vitest run --coverage"
}
```

#### 1.4 Create Test Setup

**File**: `auth-provider/test/setup.ts`

- Set test environment variables (NEXTAUTH_SECRET, NEXTAUTH_URL)
- Global test hooks

---

### Phase 2: Test Utilities

#### 2.1 Test Database Utilities

**File**: `auth-provider/test/utils/test-database.ts`

- Testcontainers PostgreSQL setup/teardown
- Run migrations on test database
- `cleanupTestData()` - truncate tables between tests
- Export `getTestRepositories()`, `getTestDbClient()`

#### 2.2 Test Factories

**Directory**: `auth-provider/test/utils/factories/`

- `user.factory.ts` - `createUserData()`, `createMockUser()`
- `oauth-client.factory.ts` - `createOAuthClientData()`, `createMockOAuthClient()`
- `session.factory.ts` - `createSessionData()`, `createMockSession()`
- `email-mfa-code.factory.ts` - `createMfaCodeData()`
- `index.ts` - barrel export

#### 2.3 Mocks

**Directory**: `auth-provider/test/utils/mocks/`

- `sendgrid.mock.ts` - Mock SendGrid API, capture sent emails
- `next-auth.mock.ts` - Mock `getServerSession()`
- `index.ts` - barrel export

---

### Phase 3: Unit Tests (Pure Functions)

| File to Create                                   | Tests For                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `lib/__tests__/state-utils.unit.test.ts`         | `encodeState()`, `decodeState()`                                                                     |
| `lib/__tests__/mfa.unit.test.ts`                 | `createEmailVerification()`, `verifyEmailCode()` (mocked repo)                                       |
| `lib/__tests__/oauth.unit.test.ts`               | `generateSecureToken()`, `validateRedirectUri()`, `validateScopes()`, `generateAuthorizationState()` |
| `db/__tests__/utils/case-transform.unit.test.ts` | `toSnakeCase()`, `toCamelCase()`, `rowToEntity()`                                                    |

---

### Phase 4: Database Repository Tests

| File to Create                                                             | Repository                       |
| -------------------------------------------------------------------------- | -------------------------------- |
| `db/__tests__/repositories/user.repository.db.test.ts`                     | UserRepository                   |
| `db/__tests__/repositories/user-profile.repository.db.test.ts`             | UserProfileRepository            |
| `db/__tests__/repositories/session.repository.db.test.ts`                  | SessionRepository                |
| `db/__tests__/repositories/email-mfa-code.repository.db.test.ts`           | EmailMfaCodeRepository           |
| `db/__tests__/repositories/oauth-client.repository.db.test.ts`             | OAuthClientRepository            |
| `db/__tests__/repositories/oauth-authorization-code.repository.db.test.ts` | OAuthAuthorizationCodeRepository |
| `db/__tests__/repositories/oauth-access-token.repository.db.test.ts`       | OAuthAccessTokenRepository       |
| `db/__tests__/repositories/oauth-refresh-token.repository.db.test.ts`      | OAuthRefreshTokenRepository      |
| `db/__tests__/repositories/verification-token.repository.db.test.ts`       | VerificationTokenRepository      |

**Test scenarios per repository**:

- `create()` - returns entity with ID
- `findById()` / `findByEmail()` - found and not-found cases
- `update()` - partial updates, non-existent record
- `delete()` - success and not-found
- Domain-specific methods (e.g., `findLatestUnconsumed`, `markConsumed`)

---

### Phase 5: API Route Integration Tests

| File to Create                                                  | Endpoint                    |
| --------------------------------------------------------------- | --------------------------- |
| `app/api/send-verification/__tests__/route.integration.test.ts` | POST /api/send-verification |
| `app/api/verify-email/__tests__/route.integration.test.ts`      | POST /api/verify-email      |
| `app/api/session/__tests__/route.integration.test.ts`           | GET /api/session            |
| `app/api/onboarding/__tests__/route.integration.test.ts`        | POST /api/onboarding        |
| `app/api/oauth/authorize/__tests__/route.integration.test.ts`   | GET /api/oauth/authorize    |
| `app/api/oauth/token/__tests__/route.integration.test.ts`       | POST /api/oauth/token       |
| `app/api/oauth/userinfo/__tests__/route.integration.test.ts`    | GET /api/oauth/userinfo     |

**Test scenarios per endpoint**:

- Valid request → success response
- Missing required fields → 400 error
- Invalid data → appropriate error
- Authentication/authorization failures
- Edge cases (expired tokens, consumed codes, etc.)

---

### Phase 6: Higher-Level Integration Tests

| File to Create                                        | Tests For                                     |
| ----------------------------------------------------- | --------------------------------------------- |
| `__tests__/middleware.integration.test.ts`            | CORS handling, CSP headers, origin validation |
| `lib/__tests__/next-auth-adapter.integration.test.ts` | Custom adapter methods with test DB           |
| `lib/__tests__/auth.integration.test.ts`              | NextAuth callbacks, session enrichment        |

---

## Key Files to Modify/Create

### New Files (Test Infrastructure)

- `auth-provider/vitest.config.ts`
- `auth-provider/test/setup.ts`
- `auth-provider/test/utils/test-database.ts`
- `auth-provider/test/utils/factories/*.ts`
- `auth-provider/test/utils/mocks/*.ts`

### Modified Files

- `auth-provider/package.json` (add dependencies and scripts)

### Test Files (~25 total)

- 4 unit test files (lib + db utils)
- 9 database repository test files
- 7 API route integration test files
- 3 higher-level integration test files

---

## Test Naming Conventions

- `*.unit.test.ts` - Pure unit tests with mocks
- `*.integration.test.ts` - Integration tests with some real dependencies
- `*.db.test.ts` - Database tests requiring PostgreSQL container

---

## Coverage Targets

| Category         | Target |
| ---------------- | ------ |
| lib/             | 80%    |
| db/repositories/ | 90%    |
| app/api/         | 75%    |
| Overall          | 70%    |

---

## Execution Order

1. Phase 1: Infrastructure setup (vitest.config.ts, package.json, test/setup.ts)
2. Phase 2: Test utilities (factories, mocks, test-database.ts)
3. Phase 3: Unit tests for pure functions
4. Phase 4: Database repository tests
5. Phase 5: API route integration tests
6. Phase 6: Higher-level integration tests
