'use client';
import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';

type Step = 'enter-email' | 'verify' | 'success' | 'error';

interface EmailChangeFlowProps {
  currentEmail: string;
  onClose: () => void;
}

interface PendingChange {
  requestId: string;
  newEmail: string;
  oldEmailVerified: boolean;
  newEmailVerified: boolean;
  expiresAt: string;
}

export default function EmailChangeFlow({ currentEmail, onClose }: EmailChangeFlowProps) {
  const [step, setStep] = useState<Step>('enter-email');
  const [newEmail, setNewEmail] = useState('');
  const [requestId, setRequestId] = useState('');
  const [oldCode, setOldCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [oldEmailVerified, setOldEmailVerified] = useState(false);
  const [newEmailVerified, setNewEmailVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState<string>('');

  // Check for pending email change on mount
  useEffect(() => {
    const checkPendingChange = async () => {
      try {
        const response = await fetch('/api/profile/email');
        if (response.ok) {
          const data = await response.json();
          if (data.pendingChange) {
            const pending: PendingChange = data.pendingChange;
            setRequestId(pending.requestId);
            setNewEmail(pending.newEmail);
            setOldEmailVerified(pending.oldEmailVerified);
            setNewEmailVerified(pending.newEmailVerified);
            setStep('verify');
          }
        }
      } catch (err) {
        console.error('Error checking pending change:', err);
      }
    };
    checkPendingChange();
  }, []);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      setError('Please enter a new email address');
      return;
    }

    setIsLoading(true);
    setError('');
    setErrorType('');

    try {
      const response = await fetch('/api/profile/email/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorType(data.error || '');
        throw new Error(data.message || 'Failed to initiate email change');
      }

      setRequestId(data.requestId);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate email change');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOld = async () => {
    if (!oldCode.trim() || oldCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/profile/email/verify-old', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, code: oldCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'EMAIL_IN_USE') {
          setErrorType('EMAIL_IN_USE');
          setStep('error');
          return;
        }
        throw new Error(data.message || 'Invalid code');
      }

      setOldEmailVerified(data.oldEmailVerified);
      setNewEmailVerified(data.newEmailVerified);

      if (data.complete) {
        setStep('success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyNew = async () => {
    if (!newCode.trim() || newCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/profile/email/verify-new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, code: newCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'EMAIL_IN_USE') {
          setErrorType('EMAIL_IN_USE');
          setStep('error');
          return;
        }
        throw new Error(data.message || 'Invalid code');
      }

      setOldEmailVerified(data.oldEmailVerified);
      setNewEmailVerified(data.newEmailVerified);

      if (data.complete) {
        setStep('success');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async (target: 'old' | 'new' | 'both') => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/profile/email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, target }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resend codes');
      }

      setError(''); // Clear any previous errors
      // Show a brief success indicator
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend codes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (requestId) {
      try {
        await fetch('/api/profile/email', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId }),
        });
      } catch (err) {
        console.error('Error canceling request:', err);
      }
    }
    onClose();
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const handleTryAgain = () => {
    setStep('enter-email');
    setNewEmail('');
    setRequestId('');
    setOldCode('');
    setNewCode('');
    setOldEmailVerified(false);
    setNewEmailVerified(false);
    setError('');
    setErrorType('');
  };

  // Step 1: Enter new email
  if (step === 'enter-email') {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Change Email Address</h2>
        <p className="text-gray-700 dark:text-gray-300">Current email: {currentEmail}</p>

        <form onSubmit={handleInitiate} className="space-y-4">
          <div>
            <label
              htmlFor="newEmail"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              New Email Address
            </label>
            <input
              type="email"
              id="newEmail"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Enter your new email"
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={isLoading}
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">
              {errorType === 'EMAIL_IN_USE'
                ? 'This email is already associated with another account.'
                : error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 text-gray-700 dark:text-white font-medium py-2 px-4 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !newEmail.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg"
            >
              {isLoading ? 'Sending...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Step 2: Verify both emails
  if (step === 'verify') {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Verify Email Change</h2>
        <p className="text-gray-700 dark:text-gray-300">
          We sent verification codes to both your current and new email addresses.
        </p>

        {/* Old Email Verification */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900 dark:text-white">Current Email</span>
            {oldEmailVerified && (
              <span className="text-green-600 dark:text-green-500 text-sm">Verified</span>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{currentEmail}</p>
          {!oldEmailVerified && (
            <div className="flex gap-2">
              <input
                type="text"
                value={oldCode}
                onChange={e => setOldCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleVerifyOld}
                disabled={isLoading || oldCode.length !== 6}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg"
              >
                Verify
              </button>
            </div>
          )}
        </div>

        {/* New Email Verification */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900 dark:text-white">New Email</span>
            {newEmailVerified && (
              <span className="text-green-600 dark:text-green-500 text-sm">Verified</span>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{newEmail}</p>
          {!newEmailVerified && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newCode}
                onChange={e => setNewCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={handleVerifyNew}
                disabled={isLoading || newCode.length !== 6}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg"
              >
                Verify
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleResend('both')}
            disabled={isLoading}
            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 text-gray-700 dark:text-white font-medium py-2 px-4 rounded-lg text-sm"
          >
            {isLoading ? 'Sending...' : 'Resend Codes'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 text-gray-700 dark:text-white font-medium py-2 px-4 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Success
  if (step === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl text-green-600">&#10003;</div>
        <h2 className="text-xl font-bold text-green-600">Email Changed Successfully!</h2>
        <p className="text-gray-700 dark:text-gray-300">Your email is now {newEmail}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          For security, you will be signed out. Please sign in again with your new email.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg"
        >
          Sign In
        </button>
      </div>
    );
  }

  // Error state (race condition)
  if (step === 'error') {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl text-red-500">&#10005;</div>
        <h2 className="text-xl font-bold text-red-600">Email Change Failed</h2>
        <p className="text-gray-700 dark:text-gray-300">
          Sorry, {newEmail} was claimed by another account while you were verifying.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Please try again with a different email address.
        </p>
        <button
          type="button"
          onClick={handleTryAgain}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg"
        >
          Try Again
        </button>
      </div>
    );
  }

  return null;
}
