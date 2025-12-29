# Internal Admin Dashboard for OAuth Client Management

## Overview

Build an admin dashboard in `auth-provider` for managing OAuth clients. Admins identified via `ADMIN_EMAILS` env var. Full CRUD with secrets visible to admins.

## Requirements

- **Admin Access**: Email allowlist via `ADMIN_EMAILS` environment variable
- **Operations**: Full CRUD (create, read, update, delete/deactivate)
- **Secrets**: Viewable by admins (not hidden after creation)

---

## Implementation Plan

### Phase 1: Admin Authorization Infrastructure

**1.1 Create `auth-provider/lib/admin.ts`**

```typescript
export function getAdminEmails(): string[]; // Parse ADMIN_EMAILS env var
export function isAdmin(email: string | null | undefined): boolean;
export async function requireAdminSession(): Promise<Session>; // Throws 401/403
```

**1.2 Update `auth-provider/lib/auth.ts`**

- Add `isAdmin?: boolean` to Session interface
- In session callback, set `isAdmin` based on email check

---

### Phase 2: Admin API Routes

**2.1 `auth-provider/app/api/admin/clients/route.ts`**

- `GET` - List all OAuth clients (calls `oauthClientRepository.findAll()`)
- `POST` - Create new client (generate ID/secret, validate inputs)

**2.2 `auth-provider/app/api/admin/clients/[id]/route.ts`**

- `GET` - Get single client by ID
- `PUT` - Update client (name, redirectUris, allowedOrigin, scopes, isActive)
- `DELETE` - Delete client (or deactivate)

**2.3 `auth-provider/app/api/admin/clients/[id]/regenerate-secret/route.ts`**

- `POST` - Generate new secret, return it

---

### Phase 3: Admin UI Pages

**3.1 `auth-provider/app/admin/layout.tsx`** (Server Component)

- Check session with `getServerSession(authOptions)`
- Redirect to `/login?callbackUrl=/admin` if not authenticated
- Return 403 component if authenticated but not admin
- Wrap children with admin navigation

**3.2 `auth-provider/app/admin/page.tsx`**

- Simple redirect to `/admin/clients`

**3.3 `auth-provider/app/admin/clients/page.tsx`** (Server Component)

- Fetch clients directly: `oauthClientRepository.findAll()`
- Display table: Name, Client ID, Status, Created, Actions
- Link to create new client

**3.4 `auth-provider/app/admin/clients/new/page.tsx`** (Client Component)

- Form: name, redirectUris (dynamic array), allowedOrigin, scopes
- On success: Display generated clientId and clientSecret prominently
- Copy-to-clipboard functionality

**3.5 `auth-provider/app/admin/clients/[id]/page.tsx`** (Client Component)

- Display all client details including secret
- Edit form for all fields
- Regenerate secret button (with confirmation)
- Delete/deactivate button (with confirmation)

---

### Phase 4: Reusable Components

Create in `auth-provider/app/admin/components/`:

| Component              | Purpose                              |
| ---------------------- | ------------------------------------ |
| `AdminNav.tsx`         | Navigation header for admin section  |
| `ClientTable.tsx`      | Table displaying client list         |
| `ClientForm.tsx`       | Reusable create/edit form            |
| `RedirectUriInput.tsx` | Dynamic array input for URIs         |
| `CopyButton.tsx`       | Copy text to clipboard               |
| `ConfirmDialog.tsx`    | Confirmation for destructive actions |

---

## File Structure

```
auth-provider/
├── lib/
│   └── admin.ts                          # NEW: Admin auth helpers
├── app/
│   ├── admin/
│   │   ├── layout.tsx                    # NEW: Admin layout + auth
│   │   ├── page.tsx                      # NEW: Dashboard home
│   │   ├── components/
│   │   │   ├── AdminNav.tsx
│   │   │   ├── ClientTable.tsx
│   │   │   ├── ClientForm.tsx
│   │   │   ├── RedirectUriInput.tsx
│   │   │   ├── CopyButton.tsx
│   │   │   └── ConfirmDialog.tsx
│   │   └── clients/
│   │       ├── page.tsx                  # NEW: Client list
│   │       ├── new/
│   │       │   └── page.tsx              # NEW: Create client
│   │       └── [id]/
│   │           └── page.tsx              # NEW: View/edit client
│   └── api/
│       └── admin/
│           └── clients/
│               ├── route.ts              # NEW: GET/POST
│               └── [id]/
│                   ├── route.ts          # NEW: GET/PUT/DELETE
│                   └── regenerate-secret/
│                       └── route.ts      # NEW: POST
```

---

## Environment Variables

Add to `.env` / `.env.example`:

```
ADMIN_EMAILS=admin@f3nation.com,another@f3nation.com
```

---

## Key Files to Reference

| File                                                       | Purpose                                     |
| ---------------------------------------------------------- | ------------------------------------------- |
| `auth-provider/lib/auth.ts`                                | NextAuth config, session callbacks          |
| `auth-provider/db/repositories/oauth-client.repository.ts` | Existing CRUD methods                       |
| `auth-provider/lib/oauth.ts`                               | `generateSecureToken()`, `registerClient()` |
| `auth-provider/app/api/onboarding/route.ts`                | API route pattern                           |
| `auth-provider/app/onboarding/page.tsx`                    | Form UI pattern                             |

---

## Implementation Order

1. `lib/admin.ts` - Admin authorization helpers
2. Update `lib/auth.ts` - Add isAdmin to session
3. `app/api/admin/clients/route.ts` - List/Create API
4. `app/api/admin/clients/[id]/route.ts` - Get/Update/Delete API
5. `app/admin/layout.tsx` - Admin layout with auth check
6. `app/admin/page.tsx` - Dashboard home
7. `app/admin/clients/page.tsx` - Client list
8. `app/admin/components/*` - Reusable components
9. `app/admin/clients/new/page.tsx` - Create client
10. `app/admin/clients/[id]/page.tsx` - View/edit client
11. `app/api/admin/clients/[id]/regenerate-secret/route.ts` - Regenerate secret

---

## Security Notes

- All admin routes verify session AND admin status
- Input validation for URLs (redirectUris, allowedOrigin)
- Scope validation against allowed values
- Consider logging admin actions for audit trail
