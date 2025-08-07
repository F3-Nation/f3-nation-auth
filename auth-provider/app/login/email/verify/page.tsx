'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import ThemeImage from '../../../components/ThemeImage';

function EmailVerifyContent() {
  const [mounted, setMounted] = useState(false);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const hasAutoSubmitted = useRef(false);
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const urlCode = searchParams.get('code');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleVerification = useCallback(
    async (verificationCode: string) => {
      // Prevent multiple simultaneous calls
      if (isLoading) {
        return;
      }

      setIsLoading(true);
      setError('');

      if (!verificationCode) {
        setError('Verification code is required');
        setIsLoading(false);
        return;
      }

      if (!email) {
        setError('Email is required');
        setIsLoading(false);
        return;
      }

      try {
        // First, verify the email code and check for linking requirements
        const verifyResponse = await fetch('/api/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: email, code: verificationCode }),
        });

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok) {
          setError(verifyData.error || 'Verification failed');
          return;
        }

        if (verifyData.requiresGoogleLink) {
          // Redirect to Google linking page
          window.location.href = `/login/link-google?email=${encodeURIComponent(email!)}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
          return;
        }

        if (verifyData.canSignIn) {
          // Proceed with normal email sign-in
          // Since we already verified the code, just pass it to NextAuth
          const result = await signIn('email', {
            email,
            code: verificationCode,
            callbackUrl,
            redirect: true, // Let NextAuth handle the redirect
          });

          // If we reach here with redirect: true, it means there was an error
          // (successful authentication would have redirected away from this page)
          console.log('SignIn result:', JSON.stringify(result, null, 2));

          if (result?.error) {
            console.log('Authentication error:', result.error);
            if (result.error === 'CredentialsSignin') {
              setError('Invalid verification code. Please try again.');
            } else {
              setError(result.error);
            }
          } else if (result === null || result === undefined) {
            // This might happen if the redirect is successful but we somehow reach this code
            // Don't show an error in this case, just wait for the redirect
            console.log('Authentication may have succeeded, waiting for redirect...');
          } else {
            setError('Authentication failed. Please try again.');
          }
        }
      } catch (err) {
        console.error('Verification error:', err);
        setError('Verification failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [email, callbackUrl, isLoading]
  );

  // Auto-submit if code is provided in URL (only once)
  useEffect(() => {
    if (mounted && urlCode && email && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      setCode(urlCode);
      handleVerification(urlCode);
    }
  }, [mounted, urlCode, email, handleVerification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleVerification(code);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <ThemeImage src="/f3nation.svg" alt="F3 Nation Logo" width={96} height={96} priority />
      <h1 className="text-2xl font-bold">Verify Email</h1>
      {urlCode ? (
        <p className="text-center max-w-md">
          {isLoading ? 'Verifying your email...' : 'Processing verification...'}
        </p>
      ) : (
        <p className="text-center max-w-md">
          We sent a verification code to {email}. Please enter it below.
        </p>
      )}

      {!urlCode && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
          <input
            type="text"
            placeholder="Enter verification code"
            value={code}
            onChange={e => setCode(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isLoading}
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg"
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>

          <button
            type="button"
            onClick={() =>
              (window.location.href = `/login/email?callbackUrl=${encodeURIComponent(callbackUrl)}`)
            }
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            Resend Code
          </button>
        </form>
      )}

      {urlCode && error && (
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <p className="text-red-500 text-sm text-center">{error}</p>
          <button
            type="button"
            onClick={() =>
              (window.location.href = `/login/email?callbackUrl=${encodeURIComponent(callbackUrl)}`)
            }
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

export default function EmailVerify() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EmailVerifyContent />
    </Suspense>
  );
}
