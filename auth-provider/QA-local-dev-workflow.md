# QA Plan: Local Dev Data Workflow Refactor

Smoke test for the refactored workflow where:

- `npm run db:snapshot:*` reads from `.env.firebase`
- `npm run db:local:seed:*` and `npm run dev` read from `.env.local`
- `LOCAL_*` env vars have been removed

## Prerequisites

- Docker Desktop running
- PostgreSQL client tools installed (`psql`, `pg_dump`)

## Test 1: Snapshot reads from .env.firebase

```bash
# Temporarily rename .env.firebase to verify error handling
mv .env.firebase .env.firebase.bak
npm run db:snapshot
# Expected: Error message about missing .env.firebase

# Restore and run actual snapshot
mv .env.firebase.bak .env.firebase
npm run db:snapshot:all
# Expected: Snapshots created in db-snapshots/f3auth/ and db-snapshots/f3prod/
```

## Test 2: Seed reads from .env.local

```bash
# Start local PostgreSQL
npm run db:local:up

# Seed both databases
npm run db:local:seed:all
# Expected: Success message showing DATABASE_URL and F3_DATABASE_URL (not LOCAL_*)

# Verify data loaded
psql postgresql://f3auth:f3auth_local_dev@localhost:5433/f3auth_dev \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

psql postgresql://f3prod:f3prod_local_dev@localhost:5433/f3prod_dev \
  -c "SELECT count(*) FROM users LIMIT 1;"
```

## Test 3: App uses .env.local databases

```bash
npm run dev
# Expected: App starts and connects to local databases (localhost:5433)
# Verify: Visit https://localhost:3000 - should load without DB connection errors
```

## Test 4: Cleanup

```bash
npm run db:local:down
```

## Pass Criteria

- [ ] Snapshot fails gracefully without .env.firebase
- [ ] Snapshot succeeds reading from .env.firebase
- [ ] Seed succeeds reading from .env.local
- [ ] No `LOCAL_*` vars mentioned in any output
- [ ] Dev server connects to local databases
