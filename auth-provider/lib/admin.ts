import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

/**
 * Parse admin emails from environment variable
 * @returns Array of admin email addresses
 */
export function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    return [];
  }
  return adminEmails
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0);
}

/**
 * Check if an email is an admin
 * @param email - Email address to check
 * @returns true if email is in the admin list
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Require admin session for protected routes
 * @throws Error with appropriate status if not authenticated or not admin
 * @returns The session if user is authenticated and admin
 */
export async function requireAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new AdminAuthError('Unauthorized', 401);
  }

  if (!isAdmin(session.user.email)) {
    throw new AdminAuthError('Forbidden: Admin access required', 403);
  }

  return session;
}

/**
 * Custom error class for admin auth errors with status code
 */
export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}
