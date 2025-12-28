# Agent Notes

Instructions and context for AI agents working on this codebase.

## Database Migrations

The auth app uses Drizzle ORM with a split database architecture:

- **`public.users`** - External table managed by F3 production database (NOT managed by Drizzle)
- **`auth.*`** - Auth schema tables managed by Drizzle migrations

### Generating Migrations

After running `npm run db:generate`, **always review the generated SQL** before applying.

**Remove any `CREATE TABLE "users"` statement** - this table already exists in the F3 production database and should not be created by auth migrations.

The FK constraints referencing `"public"."users"("id")` should remain - only remove the table creation block.

Example of what to remove:

```sql
-- REMOVE THIS BLOCK:
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (...),
	...
);
```

Example of what to keep:

```sql
-- KEEP FK CONSTRAINTS:
ALTER TABLE "auth"."user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
```
