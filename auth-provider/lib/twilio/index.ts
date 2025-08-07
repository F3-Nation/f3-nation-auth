import twilio from 'twilio';
import type { VerificationInstance } from 'twilio/lib/rest/verify/v2/service/verification';
import crypto from 'crypto';

// Lazy initialization of Twilio client
let client: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!client) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

    if (!TWILIO_ACCOUNT_SID) {
      throw new Error('TWILIO_ACCOUNT_SID environment variable is required');
    }

    if (!TWILIO_AUTH_TOKEN) {
      throw new Error('TWILIO_AUTH_TOKEN environment variable is required');
    }

    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }

  return client;
}

function getTwilioVerifyServiceSid() {
  const { TWILIO_VERIFY_SERVICE_SID } = process.env;

  if (!TWILIO_VERIFY_SERVICE_SID) {
    throw new Error('TWILIO_VERIFY_SERVICE_SID environment variable is required');
  }

  return TWILIO_VERIFY_SERVICE_SID;
}

// Store for custom email verification codes (in production, use Redis or database)
const emailVerificationCodes = new Map<
  string,
  { code: string; expires: number; consumed: boolean }
>();

// Generate a 6-digit verification code
function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Custom email verification function with magic link
export async function createEmailVerification(
  email: string,
  callback: string
): Promise<VerificationInstance> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Production: Use Twilio's built-in verification system
    try {
      const twilioClient = getTwilioClient();
      const serviceSid = getTwilioVerifyServiceSid();

      const code = generateVerificationCode();
      const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store the code temporarily
      emailVerificationCodes.set(email, { code, expires, consumed: false });

      // Create magic link with the code
      const baseUrl = process.env.NEXTAUTH_URL;
      const magic_link = `${baseUrl}/login/email/verify?email=${encodeURIComponent(email)}&code=${code}&callbackUrl=${encodeURIComponent(callback)}`;

      const verification = await twilioClient.verify.v2.services(serviceSid).verifications.create({
        channel: 'email',
        channelConfiguration: {
          substitutions: {
            code,
            magic_link,
          },
        },
        to: email,
      });

      console.log('Twilio email verification created:', {
        sid: verification.sid,
        to: verification.to,
        status: verification.status,
      });

      return verification;
    } catch (error) {
      console.error('Error creating Twilio email verification:', error);
      throw error; // Re-throw in production to surface the issue
    }
  } else {
    // Development: Use custom verification system
    const code = generateVerificationCode();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store the code temporarily
    emailVerificationCodes.set(email, { code, expires, consumed: false });

    // Create magic link with the code
    const baseUrl = process.env.NEXTAUTH_URL;
    const magic_link = `${baseUrl}/login/email/verify?email=${encodeURIComponent(email)}&code=${code}&callbackUrl=${encodeURIComponent(callback)}`;

    console.log('Custom email verification created (DEV MODE):', {
      sid: `custom_${Date.now()}`,
      code,
      magic_link,
    });

    // Return mock verification object for development
    const { TWILIO_ACCOUNT_SID } = process.env;
    const serviceSid = getTwilioVerifyServiceSid();

    return {
      sid: `custom_${Date.now()}`,
      status: 'pending',
      to: email,
      channel: 'email',
      valid: false,
      lookup: {},
      amount: null,
      payee: null,
      dateCreated: new Date(),
      dateUpdated: new Date(),
      accountSid: TWILIO_ACCOUNT_SID!,
      serviceSid: serviceSid,
      url: '',
      sendCodeAttempts: [],
    } as unknown as VerificationInstance;
  }
}

// Function to verify email verification code
export async function verifyEmailCode(
  email: string,
  code: string,
  consumeCode: boolean = true
): Promise<boolean> {
  try {
    console.log('Attempting to verify email code:', { email, code });

    // First check our custom verification codes
    const storedVerification = emailVerificationCodes.get(email);
    if (storedVerification) {
      const { code: storedCode, expires, consumed } = storedVerification;

      if (Date.now() > expires) {
        emailVerificationCodes.delete(email);
        console.log('Custom verification code expired');
        return false;
      }

      if (consumed && consumeCode) {
        console.log('Custom verification code already consumed');
        return false;
      }

      if (storedCode === code) {
        if (consumeCode) {
          // Mark as consumed instead of deleting immediately
          emailVerificationCodes.set(email, { ...storedVerification, consumed: true });
          console.log('Custom verification code verified and consumed');
          // Clean up after a short delay to prevent immediate re-verification attempts
          setTimeout(() => {
            emailVerificationCodes.delete(email);
          }, 5000);
        } else {
          console.log('Custom verification code verified (not consumed)');
        }
        return true;
      }
    }

    // Only try Twilio verification in production
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      // Fallback to Twilio verification for backwards compatibility
      try {
        const twilioClient = getTwilioClient();
        const serviceSid = getTwilioVerifyServiceSid();

        const verification = await twilioClient.verify.v2
          .services(serviceSid)
          .verificationChecks.create({ to: email, code: code });

        console.log('Twilio verification check result:', {
          status: verification.status,
          sid: verification.sid,
          to: verification.to,
          valid: verification.valid,
        });

        return verification.status === 'approved';
      } catch (twilioError) {
        console.error('Twilio verification failed:', {
          error: twilioError,
          message: twilioError instanceof Error ? twilioError.message : 'Unknown Twilio error',
          email,
          code,
        });

        // If Twilio verification fails, don't throw - just return false
        // This allows the system to gracefully handle Twilio service issues
        return false;
      }
    }

    // In development, if we reach here, the code was not found in our custom store
    console.log('Custom verification code not found or invalid');
    return false;
  } catch (error) {
    console.error('Email verification error details:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      email,
      code,
    });

    // Don't throw the error, just return false to indicate verification failed
    return false;
  }
}
