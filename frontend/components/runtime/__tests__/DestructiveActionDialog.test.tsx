import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DestructiveActionDialog } from '../DestructiveActionDialog';

describe('DestructiveActionDialog', () => {
  it('requires the exact instance name and submits the current impact token', () => {
    const onConfirm = vi.fn();
    render(<DestructiveActionDialog instanceName="routing-lab" action="reset" impact={{ token: 'impact-9', summary: 'Restores all node overlays.' }} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText(/type routing-lab/i), { target: { value: 'wrong' } });
    expect(screen.getByRole('button', { name: /reset instance/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/type routing-lab/i), { target: { value: 'routing-lab' } });
    fireEvent.click(screen.getByRole('button', { name: /reset instance/i }));
    expect(onConfirm).toHaveBeenCalledWith({ impactToken: 'impact-9', idempotencyKey: expect.any(String) });
  });
});
