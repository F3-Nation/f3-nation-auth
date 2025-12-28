# Plan: Consolidate to Single Database (DATABASE_URL)

## Summary

Eliminate all references to `F3_DATABASE_URL` and the old `f3auth` database, consolidating to a single `DATABASE_URL` pointing to what was previously `f3prod_dev`.

---

## Changes

### 1. Application Code (2 files)

**auth-provider/db/index.ts:7**

```diff
- connectionString: process.env.F3_DATABASE_URL,
+ connectionString: process.env.DATABASE_URL,
```

**auth-provider/drizzle.config.ts:12**

```diff
- url: process.env.F3_DATABASE_URL || '',
+ url: process.env.DATABASE_URL || '',
```

---

### 2. Docker Setup (2 files)

**auth-provider/docker-compose.yml**

- Rename primary user/db from `f3auth`/`f3auth_dev` to `f3prod`/`f3prod_dev`
- Update healthcheck to use `f3prod` user and `f3prod_dev` database
- Rename volume from `f3auth_postgres_data` to `f3prod_postgres_data`

**auth-provider/scripts/db/init/01-create-f3prod.sql**

- Delete this file entirely (no longer need to create a second database)
- The types/functions it creates will be moved to a new simpler init script

**New: auth-provider/scripts/db/init/01-init.sql**

- Create `citext` extension
- Create `user_status` enum type
- Create `set_updated_column()` trigger function
- Create `auth` schema

---

### 3. Shell Scripts (4 files)

**auth-provider/scripts/db/snapshot.sh**

- Remove reference to `F3_DATABASE_URL` (lines 32, 37, 218)
- Remove `f3auth` snapshot call (line 216)
- Simplify to snapshot single database from `DATABASE_URL`
- Update to save snapshots to `db-snapshots/latest/` (no subdirectory per db)

**auth-provider/scripts/db/local/up.sh**

- Remove secondary database check (lines 36-50)
- Update output to show single database with `DATABASE_URL`
- Update user/password references to `f3prod`

**auth-provider/scripts/db/local/seed.sh**

- Remove `f3auth` case from `get_db_url()` and `get_env_var()` functions
- Simplify to only handle single database
- Remove dual-database seeding logic (lines 150-175)

**auth-provider/scripts/db/local/reset.sh**

- Remove `f3auth` case from `get_db_url()` function
- Remove dual-database reset logic (lines 81-103)
- Simplify to reset single database

---

### 4. Documentation (3 files)

**auth-provider/README.md** (lines 130-224)

- Update "Local Development Database" section to describe single database
- Remove references to `F3_DATABASE_URL` and dual-database setup
- Simplify command table to single database commands
- Update connection details table

**QA_SMOKE_TEST.md:13**

```diff
- - [ ] `F3_DATABASE_URL` environment variable is configured
+ - [ ] `DATABASE_URL` environment variable is configured
```

**MIGRATION_PLAN.md**

- Update references from `F3_DATABASE_URL` to `DATABASE_URL`
- Mark the migration as complete

---

### 5. Cleanup

**Delete: db-snapshots/f3auth/**

- Remove the deprecated f3auth snapshot folder

---

## Execution Order

1. Update application code (db/index.ts, drizzle.config.ts)
2. Update docker-compose.yml and create new init script
3. Delete old init script (01-create-f3prod.sql)
4. Update shell scripts (snapshot.sh, up.sh, seed.sh, reset.sh)
5. Update documentation (README.md, QA_SMOKE_TEST.md, MIGRATION_PLAN.md)
6. Delete db-snapshots/f3auth/

---

## Local Testing After Changes

```bash
# Destroy existing docker volume (has old dual-db setup)
npm run db:local:down -- --remove-data

# Start fresh with new single-db setup
npm run db:local:up

# Verify single database is accessible
psql postgresql://f3prod:f3prod_local_dev@localhost:5433/f3prod_dev -c "SELECT 1"
```
