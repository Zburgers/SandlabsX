import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspaceNav } from '../WorkspaceNav';

describe('WorkspaceNav', () => {
  it('exposes the complete workstation map and marks the current route', () => {
    render(<WorkspaceNav pathname="/capsules/capsule-1/edit" />);

    expect(screen.getByRole('navigation', { name: /workspace/i })).toBeInTheDocument();
    for (const name of ['Dashboard', 'Capsules', 'Scenarios', 'Assignments', 'Images']) {
      expect(screen.getByRole('link', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /capsules/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /account settings/i })).toHaveAttribute('href', '/account/settings');
  });

  it('opens and closes the mobile navigation with an accessible control', () => {
    render(<WorkspaceNav pathname="/dashboard" compact />);
    const trigger = screen.getByRole('button', { name: /open navigation/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: /close navigation/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /images/i })).toBeVisible();
  });
});
