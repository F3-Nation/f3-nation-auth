import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Providers } from './providers';
import { ThemeProvider } from 'next-themes';

vi.mock('next-themes', () => {
  const ThemeProvider = vi.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ));
  return { ThemeProvider };
});

describe('Providers', () => {
  it('wraps children with ThemeProvider and passes config', () => {
    render(
      <Providers>
        <div data-testid="test-child">Test Content</div>
      </Providers>
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();

    // Verify ThemeProvider was called with correct props
    const tp = ThemeProvider as unknown as { mock: { calls: unknown[][] } };
    expect(tp.mock.calls.length).toBeGreaterThan(0);

    const props = tp.mock.calls[0][0] as Record<string, unknown>;
    expect(props).toMatchObject({
      attribute: 'class',
      defaultTheme: 'system',
      enableSystem: true,
    });
  });
});
