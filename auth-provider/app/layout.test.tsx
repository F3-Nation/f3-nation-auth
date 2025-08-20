import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import Layout from './layout'

// Mock the Providers component to avoid NextAuth issues
vi.mock('./providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <div data-testid="providers">{children}</div>
}))

describe('Layout', () => {
  it('renders children content', () => {
    // Test the layout component by checking for the main content area and providers
    const { getByTestId, container } = render(
      <Layout>
        <div>Test Content</div>
      </Layout>
    )
    
    // Check that the providers wrapper and main content area are rendered
    expect(getByTestId('providers')).toBeInTheDocument()
    expect(container.querySelector('main')).toBeInTheDocument()
    expect(container.textContent).toContain('Test Content')
  })
})
