import crypto from 'crypto';
import { and, eq, isNull, lt, gt } from 'drizzle-orm';
import { db } from '@/db';
import { emailChangeRequests, users } from '@/db/schema';

const CODE_TTL_MINUTES = 10;
const REQUEST_TTL_HOURS = 24;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_REQUESTS = 3;
const RATE_LIMIT_HOURS = 1;
const SENDGRID_API_BASE = 'https://api.sendgrid.com/v3/mail/send';

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function buildRequestId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function resolveBaseUrl(): string {
  const configured =
    process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_NEXTAUTH_URL || 'http://localhost:3000';
  return configured.endsWith('/') ? configured.slice(0, -1) : configured;
}

function resolveFromEmail(): string {
  return (
    process.env.EMAIL_VERIFICATION_SENDER ||
    process.env.EMAIL_FROM ||
    'no-reply@f3nation-auth.local'
  );
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function isEmailInUse(email: string, excludeUserId?: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (result.length === 0) {
    return false;
  }

  // If excludeUserId is provided, don't count that user
  if (excludeUserId && result[0].id === excludeUserId) {
    return false;
  }

  return true;
}

async function sendEmailChangeVerification(params: {
  email: string;
  code: string;
  magicLink: string;
  expiresAt: Date;
  isOldEmail: boolean;
  f3Name: string;
  currentEmail?: string;
  newEmail?: string;
}) {
  const apiKey = process.env.TWILIO_SENDGRID_API_KEY;
  const templateId =
    process.env.TWILIO_SENDGRID_EMAIL_CHANGE_TEMPLATE_ID || process.env.TWILIO_SENDGRID_TEMPLATE_ID;

  if (!apiKey || !templateId) {
    console.warn('SendGrid credentials missing; skipping email delivery.');
    console.info('Email change verification code (not sent):', {
      email: params.email,
      code: params.code,
      magicLink: params.magicLink,
      isOldEmail: params.isOldEmail,
    });
    return;
  }

  const body = {
    from: {
      email: resolveFromEmail(),
    },
    personalizations: [
      {
        to: [{ email: params.email }],
        dynamic_template_data: {
          code: params.code,
          magic_link: params.magicLink,
          expires_at: params.expiresAt.toISOString(),
          expires_in_minutes: CODE_TTL_MINUTES,
          f3_name: params.f3Name,
          is_old_email: params.isOldEmail,
          current_email: params.currentEmail,
          new_email: params.newEmail,
          // Subject line hint for template
          subject: params.isOldEmail
            ? 'Confirm your email change request'
            : 'Verify your new F3 Nation email',
        },
      },
    ],
    template_id: templateId,
  };

  const response = await fetch(SENDGRID_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('SendGrid email send failed', {
      status: response.status,
      body: errorBody,
    });
    throw new Error('Failed to send verification email');
  }
}

export async function checkRateLimit(userId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_HOURS * 60 * 60 * 1000);

  const recentRequests = await db
    .select({ id: emailChangeRequests.id })
    .from(emailChangeRequests)
    .where(and(eq(emailChangeRequests.userId, userId), gt(emailChangeRequests.createdAt, cutoff)));

  return recentRequests.length < RATE_LIMIT_REQUESTS;
}

export async function initiateEmailChange(
  userId: string,
  currentEmail: string,
  newEmail: string,
  f3Name: string
): Promise<{ requestId: string }> {
  const normalizedNewEmail = newEmail.toLowerCase().trim();
  const requestId = buildRequestId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REQUEST_TTL_HOURS * 60 * 60 * 1000);
  const codeExpiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000);

  const oldEmailCode = generateCode();
  const newEmailCode = generateCode();

  await db.transaction(async tx => {
    // Clean up expired requests
    await tx.delete(emailChangeRequests).where(lt(emailChangeRequests.expiresAt, now));

    // Cancel any pending requests for this user
    await tx
      .delete(emailChangeRequests)
      .where(and(eq(emailChangeRequests.userId, userId), isNull(emailChangeRequests.completedAt)));

    // Create new request
    await tx.insert(emailChangeRequests).values({
      id: requestId,
      userId,
      currentEmail,
      newEmail: normalizedNewEmail,
      oldEmailVerified: false,
      newEmailVerified: false,
      oldEmailCodeHash: hashCode(oldEmailCode),
      newEmailCodeHash: hashCode(newEmailCode),
      oldEmailAttemptCount: 0,
      newEmailAttemptCount: 0,
      expiresAt,
      createdAt: now,
    });
  });

  const baseUrl = resolveBaseUrl();

  // Send verification to old email
  const oldEmailMagicLink = `${baseUrl}/profile/email-change/verify?requestId=${encodeURIComponent(requestId)}&target=old&code=${encodeURIComponent(oldEmailCode)}`;
  await sendEmailChangeVerification({
    email: currentEmail,
    code: oldEmailCode,
    magicLink: oldEmailMagicLink,
    expiresAt: codeExpiresAt,
    isOldEmail: true,
    f3Name,
    currentEmail,
    newEmail: normalizedNewEmail,
  });

  // Send verification to new email
  const newEmailMagicLink = `${baseUrl}/profile/email-change/verify?requestId=${encodeURIComponent(requestId)}&target=new&code=${encodeURIComponent(newEmailCode)}`;
  await sendEmailChangeVerification({
    email: normalizedNewEmail,
    code: newEmailCode,
    magicLink: newEmailMagicLink,
    expiresAt: codeExpiresAt,
    isOldEmail: false,
    f3Name,
    currentEmail,
    newEmail: normalizedNewEmail,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.info('Email change verification generated (development)', {
      requestId,
      currentEmail,
      newEmail: normalizedNewEmail,
      oldEmailCode,
      newEmailCode,
      expiresAt: expiresAt.toISOString(),
    });
  }

  return { requestId };
}

export type VerifyResult = {
  success: boolean;
  oldEmailVerified: boolean;
  newEmailVerified: boolean;
  complete: boolean;
  error?: 'EXPIRED' | 'INVALID_CODE' | 'MAX_ATTEMPTS' | 'NOT_FOUND' | 'EMAIL_IN_USE';
  message?: string;
};

export async function verifyOldEmail(
  requestId: string,
  code: string,
  userId: string
): Promise<VerifyResult> {
  const now = new Date();

  const [request] = await db
    .select()
    .from(emailChangeRequests)
    .where(
      and(
        eq(emailChangeRequests.id, requestId),
        eq(emailChangeRequests.userId, userId),
        isNull(emailChangeRequests.completedAt)
      )
    )
    .limit(1);

  if (!request) {
    return {
      success: false,
      oldEmailVerified: false,
      newEmailVerified: false,
      complete: false,
      error: 'NOT_FOUND',
      message: 'Email change request not found',
    };
  }

  if (request.expiresAt <= now) {
    return {
      success: false,
      oldEmailVerified: false,
      newEmailVerified: false,
      complete: false,
      error: 'EXPIRED',
      message: 'Email change request has expired',
    };
  }

  if (request.oldEmailVerified) {
    // Already verified
    return {
      success: true,
      oldEmailVerified: true,
      newEmailVerified: request.newEmailVerified,
      complete: request.newEmailVerified,
    };
  }

  if (request.oldEmailAttemptCount >= MAX_ATTEMPTS) {
    return {
      success: false,
      oldEmailVerified: false,
      newEmailVerified: request.newEmailVerified,
      complete: false,
      error: 'MAX_ATTEMPTS',
      message: 'Too many failed attempts',
    };
  }

  const hashedCode = hashCode(code);

  if (request.oldEmailCodeHash !== hashedCode) {
    // Increment attempt count
    await db
      .update(emailChangeRequests)
      .set({ oldEmailAttemptCount: request.oldEmailAttemptCount + 1 })
      .where(eq(emailChangeRequests.id, requestId));

    return {
      success: false,
      oldEmailVerified: false,
      newEmailVerified: request.newEmailVerified,
      complete: false,
      error: 'INVALID_CODE',
      message: 'Invalid verification code',
    };
  }

  // Mark old email as verified
  await db
    .update(emailChangeRequests)
    .set({
      oldEmailVerified: true,
      oldEmailVerifiedAt: now,
    })
    .where(eq(emailChangeRequests.id, requestId));

  const complete = request.newEmailVerified;

  // If both verified, complete the email change
  if (complete) {
    const completed = await completeEmailChange(requestId, userId, request.newEmail);
    if (!completed.success) {
      return completed;
    }
  }

  return {
    success: true,
    oldEmailVerified: true,
    newEmailVerified: request.newEmailVerified,
    complete,
  };
}

export async function verifyNewEmail(
  requestId: string,
  code: string,
  userId: string
): Promise<VerifyResult> {
  const now = new Date();

  const [request] = await db
    .select()
    .from(emailChangeRequests)
    .where(
      and(
        eq(emailChangeRequests.id, requestId),
        eq(emailChangeRequests.userId, userId),
        isNull(emailChangeRequests.completedAt)
      )
    )
    .limit(1);

  if (!request) {
    return {
      success: false,
      oldEmailVerified: false,
      newEmailVerified: false,
      complete: false,
      error: 'NOT_FOUND',
      message: 'Email change request not found',
    };
  }

  if (request.expiresAt <= now) {
    return {
      success: false,
      oldEmailVerified: false,
      newEmailVerified: false,
      complete: false,
      error: 'EXPIRED',
      message: 'Email change request has expired',
    };
  }

  if (request.newEmailVerified) {
    // Already verified
    return {
      success: true,
      oldEmailVerified: request.oldEmailVerified,
      newEmailVerified: true,
      complete: request.oldEmailVerified,
    };
  }

  if (request.newEmailAttemptCount >= MAX_ATTEMPTS) {
    return {
      success: false,
      oldEmailVerified: request.oldEmailVerified,
      newEmailVerified: false,
      complete: false,
      error: 'MAX_ATTEMPTS',
      message: 'Too many failed attempts',
    };
  }

  const hashedCode = hashCode(code);

  if (request.newEmailCodeHash !== hashedCode) {
    // Increment attempt count
    await db
      .update(emailChangeRequests)
      .set({ newEmailAttemptCount: request.newEmailAttemptCount + 1 })
      .where(eq(emailChangeRequests.id, requestId));

    return {
      success: false,
      oldEmailVerified: request.oldEmailVerified,
      newEmailVerified: false,
      complete: false,
      error: 'INVALID_CODE',
      message: 'Invalid verification code',
    };
  }

  // Mark new email as verified
  await db
    .update(emailChangeRequests)
    .set({
      newEmailVerified: true,
      newEmailVerifiedAt: now,
    })
    .where(eq(emailChangeRequests.id, requestId));

  const complete = request.oldEmailVerified;

  // If both verified, complete the email change
  if (complete) {
    const completed = await completeEmailChange(requestId, userId, request.newEmail);
    if (!completed.success) {
      return completed;
    }
  }

  return {
    success: true,
    oldEmailVerified: request.oldEmailVerified,
    newEmailVerified: true,
    complete,
  };
}

async function completeEmailChange(
  requestId: string,
  userId: string,
  newEmail: string
): Promise<VerifyResult> {
  const now = new Date();

  // Re-check email uniqueness (race condition protection)
  const emailTaken = await isEmailInUse(newEmail, userId);
  if (emailTaken) {
    return {
      success: false,
      oldEmailVerified: true,
      newEmailVerified: true,
      complete: false,
      error: 'EMAIL_IN_USE',
      message: 'This email address was claimed by another account. Please try a different email.',
    };
  }

  await db.transaction(async tx => {
    // Update user's email
    await tx
      .update(users)
      .set({
        email: newEmail.toLowerCase().trim(),
        emailVerified: now,
      })
      .where(eq(users.id, userId));

    // Mark request as completed
    await tx
      .update(emailChangeRequests)
      .set({ completedAt: now })
      .where(eq(emailChangeRequests.id, requestId));
  });

  return {
    success: true,
    oldEmailVerified: true,
    newEmailVerified: true,
    complete: true,
  };
}

export async function resendEmailChangeCodes(
  requestId: string,
  userId: string,
  target: 'old' | 'new' | 'both',
  f3Name: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const codeExpiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000);

  const [request] = await db
    .select()
    .from(emailChangeRequests)
    .where(
      and(
        eq(emailChangeRequests.id, requestId),
        eq(emailChangeRequests.userId, userId),
        isNull(emailChangeRequests.completedAt)
      )
    )
    .limit(1);

  if (!request) {
    return { success: false, error: 'Request not found' };
  }

  if (request.expiresAt <= now) {
    return { success: false, error: 'Request expired' };
  }

  const baseUrl = resolveBaseUrl();

  if (target === 'old' || target === 'both') {
    if (!request.oldEmailVerified) {
      const newCode = generateCode();
      await db
        .update(emailChangeRequests)
        .set({
          oldEmailCodeHash: hashCode(newCode),
          oldEmailAttemptCount: 0,
        })
        .where(eq(emailChangeRequests.id, requestId));

      const magicLink = `${baseUrl}/profile/email-change/verify?requestId=${encodeURIComponent(requestId)}&target=old&code=${encodeURIComponent(newCode)}`;
      await sendEmailChangeVerification({
        email: request.currentEmail,
        code: newCode,
        magicLink,
        expiresAt: codeExpiresAt,
        isOldEmail: true,
        f3Name,
        currentEmail: request.currentEmail,
        newEmail: request.newEmail,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.info('Resent old email code:', { code: newCode });
      }
    }
  }

  if (target === 'new' || target === 'both') {
    if (!request.newEmailVerified) {
      const newCode = generateCode();
      await db
        .update(emailChangeRequests)
        .set({
          newEmailCodeHash: hashCode(newCode),
          newEmailAttemptCount: 0,
        })
        .where(eq(emailChangeRequests.id, requestId));

      const magicLink = `${baseUrl}/profile/email-change/verify?requestId=${encodeURIComponent(requestId)}&target=new&code=${encodeURIComponent(newCode)}`;
      await sendEmailChangeVerification({
        email: request.newEmail,
        code: newCode,
        magicLink,
        expiresAt: codeExpiresAt,
        isOldEmail: false,
        f3Name,
        currentEmail: request.currentEmail,
        newEmail: request.newEmail,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.info('Resent new email code:', { code: newCode });
      }
    }
  }

  return { success: true };
}

export async function cancelEmailChange(
  requestId: string,
  userId: string
): Promise<{ success: boolean }> {
  await db
    .delete(emailChangeRequests)
    .where(
      and(
        eq(emailChangeRequests.id, requestId),
        eq(emailChangeRequests.userId, userId),
        isNull(emailChangeRequests.completedAt)
      )
    );

  return { success: true };
}

export async function getPendingEmailChange(userId: string): Promise<{
  requestId: string;
  newEmail: string;
  oldEmailVerified: boolean;
  newEmailVerified: boolean;
  expiresAt: Date;
} | null> {
  const now = new Date();

  const [request] = await db
    .select({
      requestId: emailChangeRequests.id,
      newEmail: emailChangeRequests.newEmail,
      oldEmailVerified: emailChangeRequests.oldEmailVerified,
      newEmailVerified: emailChangeRequests.newEmailVerified,
      expiresAt: emailChangeRequests.expiresAt,
    })
    .from(emailChangeRequests)
    .where(
      and(
        eq(emailChangeRequests.userId, userId),
        isNull(emailChangeRequests.completedAt),
        gt(emailChangeRequests.expiresAt, now)
      )
    )
    .limit(1);

  return request || null;
}
