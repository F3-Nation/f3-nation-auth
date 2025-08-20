import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import SignOutButton from './SignOutButton'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(() => Promise.resolve())
}))

describe('SignOutButton', () => {
  it('renders and triggers sign out', async () => {
    const { getByText } = render(<SignOutButton />)
    const button = getByText('Sign Out')
    expect(button).toBeInTheDocument()
    
    fireEvent.click(button)
    
    const { signOut } = await import('next-auth/react')
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })
})
