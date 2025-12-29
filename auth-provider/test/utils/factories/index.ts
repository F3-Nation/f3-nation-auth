// User factories
export {
  createUserData,
  createMockUser,
  createUserProfileData,
  createMockUserProfile,
  resetUserCounter,
} from './user.factory';

// OAuth client factories
export {
  createOAuthClientData,
  createMockOAuthClient,
  createOAuthClientDataWithMultipleRedirects,
  resetOAuthClientCounter,
} from './oauth-client.factory';

// Session factories
export {
  createSessionData,
  createMockSession,
  createExpiredSessionData,
  createExpiringSessionData,
  resetSessionCounter,
} from './session.factory';

// Email MFA code factories
export {
  generateVerificationCode,
  hashCode,
  createMfaCodeData,
  createMockMfaCode,
  createExpiredMfaCodeData,
  createConsumedMfaCodeData,
  resetMfaCodeCounter,
} from './email-mfa-code.factory';

/**
 * Reset all factory counters.
 * Call this in beforeEach() to ensure unique IDs across tests.
 */
export function resetAllFactoryCounters(): void {
  const { resetUserCounter } = require('./user.factory');
  const { resetOAuthClientCounter } = require('./oauth-client.factory');
  const { resetSessionCounter } = require('./session.factory');
  const { resetMfaCodeCounter } = require('./email-mfa-code.factory');

  resetUserCounter();
  resetOAuthClientCounter();
  resetSessionCounter();
  resetMfaCodeCounter();
}
