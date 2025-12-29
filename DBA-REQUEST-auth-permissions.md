# DBA Request: Grant Database Permissions for Auth Service

## Summary for DBA

The auth-provider service (`app_auth` database user) needs permissions on the `public.users` table to complete user authentication. Currently failing with PostgreSQL error 42501 "permission denied for table users".

---

## Required Actions

### Database: Staging (`f3_prod` on `35.239.19.124`)

Execute as superuser or table owner:

```sql
-- Grant permissions to app_auth user on public.users table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO app_auth;
GRANT USAGE, SELECT ON SEQUENCE public.users_id_seq TO app_auth;
```

### Database: Production (same host, if not already configured)

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO app_auth;
GRANT USAGE, SELECT ON SEQUENCE public.users_id_seq TO app_auth;
```

---

## Verification Query

After granting permissions, verify with:

```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'users'
  AND table_schema = 'public'
  AND grantee = 'app_auth';
```

Expected output should include: SELECT, INSERT, UPDATE, DELETE

---

## Technical Context

### Why This Is Needed

- The auth-provider application handles user authentication (email OTP, OAuth)
- During authentication, it needs to lookup/create users in `public.users`
- The `public.users` table is owned by the Map application, not auth-provider
- The `app_auth` database user has permissions on `auth.*` schema but not `public.users`

### Operations Performed on `public.users`

1. **SELECT**: Find user by email during login
2. **INSERT**: Create new user on first-time login
3. **UPDATE**: Update `email_verified` timestamp after verification

### Error Being Fixed

```
Database error: error: permission denied for table users
PostgreSQL error code: 42501
```

---

## Architecture Reference

```
Database: f3_prod
├── Schema: public (owned by Map app)
│   └── public.users ← auth-provider needs access here
│
└── Schema: auth (owned by auth-provider)
    └── auth.* tables ← already has full access
```

---

## Contact

If questions, refer to:

- Auth service repo: `f3-nation-auth/auth-provider`
- Relevant code: `db/repositories/user.repository.ts`
