import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ThemeImage from './ThemeImage'

describe('ThemeImage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders with light theme src by default', () => {
    render(<ThemeImage src="/test.png" alt="test" width={100} height={100} />)
    const img = screen.getByAltText('test')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/test.png')
  })

  it('applies className prop', () => {
    render(
      <ThemeImage 
        src="/test.png"
        alt="test-class"
        width={100}
        height={100}
        className="custom-class"
      />
    )
    const img = screen.getByAltText('test-class')
    expect(img).toHaveClass('custom-class')
  })
})
