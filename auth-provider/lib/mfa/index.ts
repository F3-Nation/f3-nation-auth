import crypto from 'crypto';
import { and, eq, isNull, desc } from 'drizzle-orm';

import { db, pool } from '@/db';
import { emailMfaCodes } from '@/db/schema';

const CODE_TTL_MINUTES = 10;
const SENDGRID_API_BASE = 'https://api.sendgrid.com/v3/mail/send';

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function buildVerificationId(): string {
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

async function sendVerificationEmail(params: {
  email: string;
  code: string;
  magicLink: string;
  expiresAt: Date;
}) {
  const apiKey = process.env.TWILIO_SENDGRID_API_KEY;
  const templateId = process.env.TWILIO_SENDGRID_TEMPLATE_ID;

  if (!apiKey || !templateId) {
    console.warn(
      'SendGrid credentials missing (TWILIO_SENDGRID_API_KEY / TWILIO_SENDGRID_TEMPLATE_ID); skipping email delivery.'
    );
    console.info('Verification code (not sent):', {
      email: params.email,
      code: params.code,
      magicLink: params.magicLink,
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

export async function createEmailVerification(email: string, callbackUrl: string): Promise<void> {
  const code = generateCode();
  const verificationId = buildVerificationId();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CODE_TTL_MINUTES * 60 * 1000);

  const codeHash = hashCode(code);

  // Use raw SQL queries to bypass Drizzle's caching that conflicts with Next.js 15 tracing
  const client = await pool.connect();
  try {
    // Clean up expired codes for all users to keep the table tidy
    await client.query('DELETE FROM auth.email_mfa_codes WHERE expires_at < $1', [issuedAt]);

    // Ensure only one active code exists per email address
    await client.query(
      'DELETE FROM auth.email_mfa_codes WHERE email = $1 AND consumed_at IS NULL',
      [email]
    );

    // Insert new verification code
    await client.query(
      `INSERT INTO auth.email_mfa_codes (id, email, code_hash, expires_at, attempt_count, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [verificationId, email, codeHash, expiresAt, 0, issuedAt]
    );
  } finally {
    client.release();
  }

  const baseUrl = resolveBaseUrl();
  const magicLink = `${baseUrl}/login/email/verify?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}&callbackUrl=${encodeURIComponent(callbackUrl)}`;

  try {
    await sendVerificationEmail({
      email,
      code,
      magicLink,
      expiresAt,
    });
  } catch (error) {
    console.error('Error dispatching verification email', {
      email,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('Email verification generated (development)', {
      email,
      code,
      magicLink,
      expiresAt: expiresAt.toISOString(),
    });
  }
}

export async function verifyEmailCode(
  email: string,
  code: string,
  consumeCode: boolean = true
): Promise<boolean> {
  try {
    const now = new Date();
    const hashed = hashCode(code);

    const [latest] = await db
      .select()
      .from(emailMfaCodes)
      .where(and(eq(emailMfaCodes.email, email), isNull(emailMfaCodes.consumedAt)))
      .orderBy(desc(emailMfaCodes.createdAt))
      .limit(1);

    if (!latest) {
      return false;
    }

    if (latest.expiresAt <= now) {
      await db
        .update(emailMfaCodes)
        .set({ consumedAt: now })
        .where(eq(emailMfaCodes.id, latest.id));
      return false;
    }

    if (latest.codeHash !== hashed) {
      await db
        .update(emailMfaCodes)
        .set({ attemptCount: latest.attemptCount + 1 })
        .where(eq(emailMfaCodes.id, latest.id));
      return false;
    }

    if (consumeCode) {
      await db
        .update(emailMfaCodes)
        .set({ consumedAt: now })
        .where(eq(emailMfaCodes.id, latest.id));
    }

    return true;
  } catch (error) {
    console.error('Error verifying email code', {
      email,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
}
