import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import Page from './page'

// Mock ThemeImage component to avoid priority prop issues
vi.mock('./components/ThemeImage', () => ({
  default: ({ src, alt, width, height, className }: any) => (
    <img src={src} alt={alt} width={width} height={height} className={className} />
  )
}))

// Mock SignOutButton component
vi.mock('./components/SignOutButton', () => ({
  default: () => <button>Sign Out</button>
}))

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => Promise.resolve({
    user: {
      id: '123',
      name: 'Test User',
      email: 'test@example.com',
      image: null
    }
  }))
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {
    adapter: {},
    providers: [],
    callbacks: {}
  }
}))

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{
            onboardingCompleted: true,
            f3Name: 'Test F3',
            hospitalName: 'Test Hospital'
          }]))
        }))
      }))
    }))
  }
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}))

describe('Auth Provider Page', () => {
  it('renders user info when authenticated', async () => {
    const PageComponent = await Page({ 
      searchParams: Promise.resolve({}) 
    })
    const { findByText } = render(PageComponent)
    
    expect(await findByText('Test F3')).toBeInTheDocument()
    expect(await findByText('(Test Hospital)')).toBeInTheDocument()
    expect(await findByText('test@example.com')).toBeInTheDocument()
  })
})
