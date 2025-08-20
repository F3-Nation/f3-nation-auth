import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// next/image is mocked in test-setup to a plain img element

describe('Logo', () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders external http image URL unchanged', async () => {
    const { default: Logo } = await import('./Logo');
    const { getByAltText } = render(<Logo src="http://example.com/avatar.png" alt="Avatar" width={50} height={50} />);
    const img = getByAltText('Avatar') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('http://example.com/avatar.png');
    expect(img.alt).toBe('Avatar');
  });

  it('renders dark theme variant when theme is dark', async () => {
    vi.doMock('next-themes', () => ({
      useTheme: () => ({ theme: 'dark', systemTheme: 'dark' }),
    }));
    const { default: DarkLogo } = await import('./Logo');
    const { getByAltText } = render(<DarkLogo src="/f3nation.svg" alt="Logo" width={40} height={40} />);
    const img = getByAltText('Logo') as HTMLImageElement;
    expect(img.src.endsWith('/f3nation-white.svg')).toBe(true);
  });

  it('renders light theme variant when theme is light', async () => {
    vi.doMock('next-themes', () => ({
      useTheme: () => ({ theme: 'light', systemTheme: 'light' }),
    }));
    const { default: LightLogo } = await import('./Logo');
    const { getByAltText } = render(<LightLogo src="/f3nation.svg" alt="Logo" width={40} height={40} />);
    const img = getByAltText('Logo') as HTMLImageElement;
    expect(img.src.endsWith('/f3nation.svg')).toBe(true);
  });

  it('uses system theme when theme is system', async () => {
    vi.doMock('next-themes', () => ({
      useTheme: () => ({ theme: 'system', systemTheme: 'dark' }),
    }));
    const { default: SystemLogo } = await import('./Logo');
    const { getByAltText } = render(<SystemLogo src="/f3nation.svg" alt="Logo" width={40} height={40} />);
    const img = getByAltText('Logo') as HTMLImageElement;
    expect(img.src.endsWith('/f3nation-white.svg')).toBe(true);
  });
});
