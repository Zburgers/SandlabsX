import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuthPage from '../page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('../../../lib/auth', () => ({ isAuthenticated: () => false, fetchUserProfile: vi.fn(), readApiJson: vi.fn() }));

describe('AuthPage', () => {
  it('renders deterministic, fully labelled sign-in and account-creation modes', () => {
    render(<AuthPage />);

    expect(screen.getByRole('heading', { name: /sign in to sandlabx/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toHaveAttribute('type', 'submit');
  });
});
