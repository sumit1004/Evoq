import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App.jsx';

vi.mock('../services/teamApi.js', () => ({
  fetchTeams: vi.fn().mockResolvedValue([]),
  createTeam: vi.fn(),
  removeTeam: vi.fn(),
}));

describe('App routing', () => {
  it('renders the public landing page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Run every round. Own the competition.' })).not.toBeNull();
  });

  it('renders a not found state for unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/missing']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Page not found' })).not.toBeNull();
  });

  it('renders the real login form', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Login' })).not.toBeNull();
    expect(screen.getByLabelText('Email')).not.toBeNull();
    expect(screen.getByLabelText('Password')).not.toBeNull();
  });

  it('renders the signup role and player identity fields', () => {
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Signup' })).not.toBeNull();
    expect(screen.getByLabelText('Account type')).not.toBeNull();
    expect(screen.getByLabelText(/In-game name/)).not.toBeNull();
  });

  it('renders the player teams workspace for an authenticated player', () => {
    window.localStorage.setItem('evoq.identity', JSON.stringify({ id: 4, name: 'Player One', role: 'PLAYER' }));
    render(
      <MemoryRouter initialEntries={['/player/teams']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Your teams' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Create a team' })).not.toBeNull();
    window.localStorage.clear();
  });
});
