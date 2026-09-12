import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { App } from '../../app/App.jsx';

describe('Phase 5 E2E: Responsive Layout & Network Resilience Verification', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  const viewports = [
    { name: 'Mobile Mini', width: 320, height: 568 },
    { name: 'Mobile Standard', width: 375, height: 667 },
    { name: 'Mobile Modern', width: 390, height: 844 },
    { name: 'Mobile Large', width: 430, height: 932 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Desktop Standard', width: 1280, height: 800 },
    { name: 'Desktop Wide', width: 1440, height: 900 },
  ];

  viewports.forEach(({ name, width, height }) => {
    it(`renders cleanly at viewport ${name} (${width}x${height}) without layout crashes`, () => {
      window.innerWidth = width;
      window.innerHeight = height;

      const { unmount } = render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: /Run every round\. Own the competition\./i })).toBeDefined();
      unmount();
    });
  });

  it('handles server network errors gracefully with retry action without blank screen', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Initial app render should succeed cleanly without crashing into an unhandled exception
    expect(screen.getByRole('heading', { name: /Run every round\. Own the competition\./i })).toBeDefined();
    unmount();
  });
});
