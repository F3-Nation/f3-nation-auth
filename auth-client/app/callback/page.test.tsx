import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

describe('CallbackPage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    window.localStorage.clear();
  });

  it('shows error UI when error param is present', async () => {
    const pushMock = vi.fn();

    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
      useSearchParams: () => ({
        get: (key: string) => (key === 'error' ? 'access_denied' : null),
      }),
    }));

    const { default: CallbackPage } = await import('./page');

    render(<CallbackPage />);

    expect(await screen.findByText('Authentication Error')).toBeInTheDocument();
    expect(screen.getByText(/OAuth error: access_denied/)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('shows missing params error when code/state are absent', async () => {
    const pushMock = vi.fn();

    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
      useSearchParams: () => ({
        get: () => null,
      }),
    }));

    const { default: CallbackPage } = await import('./page');

    render(<CallbackPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Missing authorization code or state parameter')
      ).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('handles successful callback flow and redirects home', async () => {
    const pushMock = vi.fn();

    const stateObj = {
      csrfToken: 'csrf-123',
      clientId: 'test-client-id',
      returnTo: 'http://localhost:3000/callback',
      timestamp: Date.now(),
    };
    const state = btoa(encodeURIComponent(JSON.stringify(stateObj)));
    window.localStorage.setItem('oauth_state', state);

    vi.doMock('next/navigation', () => ({
      useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
      useSearchParams: () => ({
        get: (key: string) => {
          if (key === 'code') return 'abc123';
          if (key === 'state') return state;
          return null;
        },
      }),
    }));

    const { default: CallbackPage } = await import('./page');

    render(<CallbackPage />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/');
    });

    // user info and tokens are set in localStorage during success flow
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'access_token',
      'test-access-token'
    );
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('oauth_state');
  });
});
