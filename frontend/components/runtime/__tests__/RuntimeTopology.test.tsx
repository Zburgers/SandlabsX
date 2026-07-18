import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RuntimeTopology } from '../RuntimeTopology';

describe('RuntimeTopology', () => {
  it('keeps authored wiring separate from observed link state', () => {
    render(<RuntimeTopology desiredLinks={[{ id: 'a-b', label: 'router.eth0 to host.eth0' }]} observedLinks={[{ id: 'a-b', state: 'DOWN', reason: 'carrier lost' }]} />);

    expect(screen.getByText('Desired topology')).toBeInTheDocument();
    expect(screen.getByText('Observed runtime')).toBeInTheDocument();
    expect(screen.getByText(/carrier lost/i)).toBeInTheDocument();
  });
});
