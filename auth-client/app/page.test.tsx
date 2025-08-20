import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, fireEvent, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Mock the Logo component
vi.mock('./components/Logo', () => {
  interface LogoProps {
    src?: string
    alt?: string
    width?: number
    height?: number
    className?: string
    priority?: boolean
  }
  const MockLogo = ({ width, height, className }: LogoProps) => (
    <div data-testid="logo" style={{ width, height }} className={className}>Logo</div>
  )
  return { default: MockLogo }
})

// Mock crypto.randomUUID for the client-side code
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-123'),
  },
})

describe('Home Page', () => {
  beforeEach(() => {
    // reset spies and storage state between tests
    vi.resetModules()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('renders without crashing and shows login button', async () => {
    const { default: Page } = await import('./page')
    const { container, findByText } = render(<Page />)
    
    expect(container).toBeInTheDocument()
    
    // Wait for the component to finish loading
    await waitFor(() => {
      expect(container.textContent).toContain('F3 Auth Client Demo')
    })
    
    // Should show login button when not authenticated
    expect(await findByText('Login with F3 Auth')).toBeInTheDocument()
  })

  it('clicking login saves oauth_state and attempts redirect', async () => {
    const { default: Page } = await import('./page')
    render(<Page />)

    // wait for button to appear
    const btn = await screen.findByText('Login with F3 Auth')
    fireEvent.click(btn)

    // ensures state was encoded and saved
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'oauth_state',
      expect.any(String)
    )
  })

  it('loads user info from storage and supports logout', async () => {
    // simulate previously stored user info
    window.localStorage.setItem(
      'user_info',
      JSON.stringify({
        sub: 'user-123',
        name: 'Tester',
        email: 't@example.com',
        picture: 'http://example.com/p.png'
      })
    )

    const { default: Page } = await import('./page')
    render(<Page />)

    // waits for welcome UI branch
    await waitFor(() => {
      expect(screen.getByText(/Welcome, Tester!/)).toBeInTheDocument()
    })

    // click logout and verify clears storage keys
    fireEvent.click(screen.getByText('Logout'))

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('user_info')
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('access_token')
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('refresh_token')
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('oauth_state')
  })

  it('shows error if getOAuthConfig fails to load', async () => {
    vi.doMock('@/lib/actions', () => ({
      getOAuthConfig: vi.fn().mockRejectedValue(new Error('boom')),
      exchangeCodeForToken: vi.fn()
    }))

    const { default: Page } = await import('./page')
    render(<Page />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load OAuth configuration')).toBeInTheDocument()
    })
  })
})
