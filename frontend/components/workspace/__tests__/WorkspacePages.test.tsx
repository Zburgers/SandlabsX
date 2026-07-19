import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '../../../app/dashboard/page';
import CapsulesPage from '../../../app/capsules/page';
import { capsuleApi } from '../../../lib/capsule-api';
import { canonicalCapsule } from '../../../test/fixtures/canonical-capsule';

vi.mock('../../../lib/capsule-api', () => ({
  capsuleApi: {
    listDrafts: vi.fn(),
    getCapacity: vi.fn(),
    createDraft: vi.fn(),
  },
}));

describe('workstation index pages', () => {
  beforeEach(() => {
    vi.mocked(capsuleApi.listDrafts).mockResolvedValue([]);
    vi.mocked(capsuleApi.getCapacity).mockResolvedValue({ availableVcpus: 8, availableMemoryMiB: 16384, availableDiskGiB: 120, admission: 'AVAILABLE' });
  });

  it('loads host capacity and gives an empty workspace a clear first action', async () => {
    render(<DashboardPage />);

    expect(await screen.findByText(/8 vCPU available/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create a capsule/i })).toHaveAttribute('href', '/capsules');
    expect(capsuleApi.getCapacity).toHaveBeenCalledOnce();
  });

  it('renders capsule topology and resource summaries from canonical drafts', async () => {
    vi.mocked(capsuleApi.listDrafts).mockResolvedValue([{ id: 'draft-1', revision: 4, status: 'DRAFT', document: canonicalCapsule, updatedAt: '2026-07-19T10:00:00.000Z' }]);

    render(<CapsulesPage />);

    expect(await screen.findByText('Routing lab')).toBeInTheDocument();
    expect(screen.getByText(/1 node/i)).toBeInTheDocument();
    expect(screen.getByText(/1 vCPU/i)).toBeInTheDocument();
    await waitFor(() => expect(capsuleApi.listDrafts).toHaveBeenCalled());
  });
});
