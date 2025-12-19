# Profile Settings Feature Plan

## Overview

Extend `auth-provider/app/page.tsx` to include profile settings allowing users to update their:

- F3 Name
- Hospital Name
- Profile Picture
- Email Address (requires dual OTP verification)

---

## 1. Database Schema Changes

### 1.1 Email Change Requests Table

Add a new table to track pending email change requests:

```sql
CREATE TABLE email_change_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_email TEXT NOT NULL,
  old_email_verified BOOLEAN DEFAULT FALSE,
  new_email_verified BOOLEAN DEFAULT FALSE,
  old_email_code_hash TEXT,
  new_email_code_hash TEXT,
  old_email_verified_at TIMESTAMP,
  new_email_verified_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_email_change_user ON email_change_requests(user_id);
CREATE INDEX idx_email_change_expires ON email_change_requests(expires_at);
```

**Rationale:** Track both verification states separately with a 24-hour TTL for the entire flow.

### 1.2 Schema Definition

Add to `auth-provider/db/schema.ts`:

```typescript
export const emailChangeRequests = pgTable("email_change_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  newEmail: text("new_email").notNull(),
  oldEmailVerified: boolean("old_email_verified").default(false),
  newEmailVerified: boolean("new_email_verified").default(false),
  oldEmailCodeHash: text("old_email_code_hash"),
  newEmailCodeHash: text("new_email_code_hash"),
  oldEmailVerifiedAt: timestamp("old_email_verified_at"),
  newEmailVerifiedAt: timestamp("new_email_verified_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});
```

---

## 2. API Routes

### 2.1 Profile Update Endpoint

**`POST /api/profile`** - Update basic profile fields

```typescript
// Request body
{
  f3Name?: string;
  hospitalName?: string;
  image?: string;  // URL only
}

// Response
{
  success: boolean;
  user: { f3Name, hospitalName, image };
}
```

**Validation:**

- Require authentication
- `f3Name` and `hospitalName` must be non-empty strings if provided
- `image` must be a valid URL (http/https)

### 2.2 Email Change Flow Endpoints

#### 2.2.1 Initiate Email Change

**`POST /api/profile/email/initiate`**

```typescript
// Request body
{
  newEmail: string;
}

// Success Response (200)
{
  success: true;
  requestId: string;
  message: "Verification codes sent to both email addresses";
}

// Error Responses
// 400 - Invalid email format
{
  success: false;
  error: "INVALID_EMAIL";
  message: "Please enter a valid email address";
}

// 400 - Same as current email
{
  success: false;
  error: "SAME_EMAIL";
  message: "New email must be different from your current email";
}

// 409 - Email already in use
{
  success: false;
  error: "EMAIL_IN_USE";
  message: "This email address is already associated with another account";
}

// 429 - Rate limited
{
  success: false;
  error: "RATE_LIMITED";
  message: "Too many email change requests. Please try again later.";
}
```

**Flow:**

1. Validate new email format (return 400 `INVALID_EMAIL` if malformed)
2. Check new email is different from current (return 400 `SAME_EMAIL` if identical)
3. **Check new email is not already in use by another user** (return 409 `EMAIL_IN_USE`)
4. Check rate limit (return 429 `RATE_LIMITED` if exceeded)
5. Cancel any pending email change requests for this user
6. Create `email_change_requests` record with 24hr TTL
7. Generate 6-digit code for old email, hash and store
8. Generate 6-digit code for new email, hash and store
9. Send verification email to OLD email: "Confirm you want to change your email"
10. Send verification email to NEW email: "Confirm this is your new email"

#### 2.2.2 Verify Old Email

**`POST /api/profile/email/verify-old`**

```typescript
// Request body
{
  requestId: string;
  code: string;
}

// Response
{
  success: boolean;
  oldEmailVerified: boolean;
  newEmailVerified: boolean;
  complete: boolean;
}
```

#### 2.2.3 Verify New Email

**`POST /api/profile/email/verify-new`**

```typescript
// Request body
{
  requestId: string;
  code: string;
}

// Response
{
  success: boolean;
  oldEmailVerified: boolean;
  newEmailVerified: boolean;
  complete: boolean;
}
```

#### 2.2.4 Complete Email Change

Automatically triggered when both verifications are complete (`oldEmailVerified && newEmailVerified`):

```typescript
// Success Response (200)
{
  success: true;
  complete: true;
  message: "Email changed successfully. Please sign in again.";
}

// Error Response (409) - Race condition: email taken during verification
{
  success: false;
  error: "EMAIL_IN_USE";
  message: "This email address was claimed by another account. Please try a different email.";
}
```

**Flow:**

1. **Re-check that new email is still not in use** (return 409 `EMAIL_IN_USE` if claimed during verification window)
2. Update `users.email` to new email
3. Update `users.emailVerified` to current timestamp
4. Mark request as `completed_at`
5. Send notification email to OLD email: "Your email was successfully changed"
6. Invalidate all existing sessions for security
7. Return success with redirect to re-login

#### 2.2.5 Cancel Email Change

**`DELETE /api/profile/email`**

```typescript
// Request body
{
  requestId: string;
}

// Response
{
  success: boolean;
}
```

#### 2.2.6 Resend Codes

**`POST /api/profile/email/resend`**

```typescript
// Request body
{
  requestId: string;
  target: "old" | "new" | "both";
}

// Response
{
  success: boolean;
}
```

---

## 3. UI Components

### 3.1 Profile Settings Page Layout

Refactor `auth-provider/app/page.tsx` to include an editable profile section:

```
┌─────────────────────────────────────┐
│        [Profile Picture]            │
│         Change Picture              │
│                                     │
│  F3 Name: [editable field]    [✓]  │
│  Hospital: [editable field]   [✓]  │
│  Email: user@example.com   [Change] │
│                                     │
│         [Sign Out]                  │
└─────────────────────────────────────┘
```

### 3.2 New Components

#### 3.2.1 `ProfileSettingsForm.tsx`

Client component with:

- Inline editable fields for F3 Name and Hospital Name
- Save button per field or single "Save Changes" button
- Loading and success states
- Error handling

#### 3.2.2 `ProfileImageUpload.tsx`

Client component with:

- Display current image
- URL input option (for now, since no file upload exists)
- Preview before save
- Optional: File upload with presigned URL to cloud storage (future enhancement)

#### 3.2.3 `EmailChangeFlow.tsx`

Client component managing the email change wizard:

**Step 1: Enter New Email**

```
┌────────────────────────────────────┐
│ Change Email Address               │
│                                    │
│ Current: old@example.com           │
│                                    │
│ New Email: [________________]      │
│                                    │
│ [Cancel]              [Continue]   │
└────────────────────────────────────┘
```

**Step 1 Error States:**

```
┌────────────────────────────────────┐
│ Change Email Address               │
│                                    │
│ Current: old@example.com           │
│                                    │
│ New Email: [taken@example.com]     │
│ ⚠ This email is already in use    │
│   by another account.              │
│                                    │
│ [Cancel]              [Continue]   │
└────────────────────────────────────┘
```

**Step 2: Verify Both Emails**

```
┌────────────────────────────────────┐
│ Verify Email Change                │
│                                    │
│ We sent codes to both addresses:   │
│                                    │
│ Old Email (old@example.com)        │
│ [______] ✓ Verified                │
│                                    │
│ New Email (new@example.com)        │
│ [______] ⏳ Pending                │
│                                    │
│ [Resend Codes]                     │
│ [Cancel]            [Confirm]      │
└────────────────────────────────────┘
```

**Step 3: Confirmation**

```
┌────────────────────────────────────┐
│ Email Changed Successfully!        │
│                                    │
│ Your email is now new@example.com  │
│                                    │
│ You will be signed out for         │
│ security. Please sign in again.    │
│                                    │
│           [Sign In]                │
└────────────────────────────────────┘
```

**Step 3 Error State (Race Condition):**

```
┌────────────────────────────────────┐
│ Email Change Failed                │
│                                    │
│ Sorry, new@example.com was         │
│ claimed by another account while   │
│ you were verifying.                │
│                                    │
│ Please try again with a different  │
│ email address.                     │
│                                    │
│          [Try Again]               │
└────────────────────────────────────┘
```

#### 3.2.4 `EmailChangeModal.tsx`

Modal wrapper for `EmailChangeFlow` triggered by "Change" button next to email.

---

## 4. Email Templates

### 4.1 Old Email Verification

**Subject:** Confirm your email change request

**Body:**

```
Hi {f3Name},

You requested to change your F3 Nation email from {oldEmail} to {newEmail}.

Your verification code is: {code}

Or click this link: {magicLink}

This code expires in 10 minutes.

If you did not request this change, please ignore this email and
consider changing your password.
```

### 4.2 New Email Verification

**Subject:** Verify your new F3 Nation email

**Body:**

```
Hi {f3Name},

Someone is trying to add this email address to their F3 Nation account.

Your verification code is: {code}

Or click this link: {magicLink}

This code expires in 10 minutes.

If you did not request this, please ignore this email.
```

**Note:** May need a new SendGrid template or parameterized existing template.

---

## 5. Security Considerations

### 5.1 Rate Limiting

- Limit email change initiations to 3 per hour per user
- Limit verification attempts to 5 per code
- Lock out after 10 failed attempts across all active requests

### 5.2 Session Invalidation

- On successful email change, invalidate all sessions
- Force re-authentication with new email

### 5.3 Notification

- Send notification to OLD email when change completes
- Include instructions to contact support if unauthorized

### 5.4 Code Security

- 6-digit codes with SHA-256 hashing (existing pattern)
- 10-minute TTL per code
- 24-hour TTL for overall request

### 5.5 Email Uniqueness Enforcement

- **On Initiation:** Query `users` table to verify `newEmail` doesn't exist for another user
  - Return 409 `EMAIL_IN_USE` if found
  - Use case-insensitive comparison (normalize to lowercase)
- **On Completion:** Re-query before final update (race condition protection)
  - Another user may have registered or changed to this email during the verification window
  - Return 409 `EMAIL_IN_USE` and show "Try Again" UI if detected
- **Database Constraint:** Consider adding unique index on `LOWER(email)` for belt-and-suspenders protection

---

## 6. File Changes Summary

### New Files

| File                                           | Purpose                       |
| ---------------------------------------------- | ----------------------------- |
| `db/migrations/XXXX_email_change_requests.sql` | New table migration           |
| `app/api/profile/route.ts`                     | Basic profile update endpoint |
| `app/api/profile/email/initiate/route.ts`      | Start email change            |
| `app/api/profile/email/verify-old/route.ts`    | Verify old email              |
| `app/api/profile/email/verify-new/route.ts`    | Verify new email              |
| `app/api/profile/email/resend/route.ts`        | Resend verification codes     |
| `app/api/profile/email/route.ts`               | Cancel email change (DELETE)  |
| `app/components/ProfileSettingsForm.tsx`       | Editable profile form         |
| `app/components/ProfileImageUpload.tsx`        | Image URL input               |
| `app/components/EmailChangeFlow.tsx`           | Email change wizard           |
| `app/components/EmailChangeModal.tsx`          | Modal wrapper                 |
| `lib/email-change.ts`                          | Email change business logic   |

### Modified Files

| File               | Changes                                           |
| ------------------ | ------------------------------------------------- |
| `db/schema.ts`     | Add `emailChangeRequests` table                   |
| `app/page.tsx`     | Replace static display with `ProfileSettingsForm` |
| `lib/mfa/index.ts` | Add email template variants (optional)            |

---

## 7. Implementation Order

1. **Database:** Add schema and migration for `email_change_requests`
2. **Profile API:** Implement `POST /api/profile` for basic field updates
3. **Profile UI:** Create `ProfileSettingsForm` with inline editing
4. **Email Change API:** Implement all email change endpoints
5. **Email Templates:** Configure SendGrid templates or adapt existing
6. **Email Change UI:** Create modal and flow components
7. **Integration:** Wire up page.tsx with new components
8. **Testing:** Manual and automated tests for all flows
9. **Security Review:** Rate limiting, session handling

---

## 8. Open Questions

1. **Profile Image Upload:** Should we implement actual file upload to cloud storage (S3/GCS), or keep URL-only for now?
   - Recommendation: URL-only initially, file upload as future enhancement

2. **Email Template:** Create new SendGrid template or use dynamic subject/body with existing template?
   - Recommendation: Parameterize existing template with `template_type` field

3. **Session Strategy:** Force logout on email change or keep current session valid until natural expiry?
   - Recommendation: Force logout for security

4. **Notification Email:** Send "email changed" notification to old address after successful change?
   - Recommendation: Yes, for security awareness
