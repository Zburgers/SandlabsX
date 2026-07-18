import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CapsuleEditor } from '../CapsuleEditor';
import type { CapsuleDraft } from '../../../lib/capsule-types';
import { canonicalCapsule } from '../../../test/fixtures/canonical-capsule';

const draft: CapsuleDraft = {
  id: 'capsule-1', revision: 4, status: 'DRAFT',
  document: { ...canonicalCapsule, nodes: {}, links: [] },
};

describe('CapsuleEditor', () => {
  it('starts on a blank canvas and adds a canonical node from its profile', () => {
    const onSave = vi.fn();
    render(<CapsuleEditor draft={draft} profiles={[{ id: 'router', version: 'profile-router-v2', name: 'Router', image: { name: 'router', version: 'artifact-router-v3', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }, interfaces: [{ id: 'eth0', model: 'virtio-net-pci' }, { id: 'eth1', model: 'virtio-net-pci' }] }]} onSave={onSave} />);

    expect(screen.getByText(/blank canvas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add router/i }));
    expect(screen.getByText('Router')).toBeInTheDocument();
    expect(screen.getByText('eth0')).toBeInTheDocument();
    const saved = onSave.mock.calls[0][0];
    expect(saved.nodes.router.workloadProfile).toBe('router');
    expect(saved.nodes.router.interfaces).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'eth0' })]));
  });
});
