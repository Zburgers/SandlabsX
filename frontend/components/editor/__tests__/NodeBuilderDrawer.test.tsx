import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NodeBuilderDrawer } from '../NodeBuilderDrawer';
import type { CapsuleProfile } from '../../../lib/capsule-types';

const routerProfile: CapsuleProfile = {
  id: 'router', version: 'profile-router-v2', name: 'Router',
  image: { name: 'router', version: 'artifact-router-v3', digest: `sha256:${'a'.repeat(64)}` },
  interfaces: [{ id: 'eth0', model: 'virtio-net-pci' }, { id: 'eth1', model: 'virtio-net-pci' }],
  interfaceModels: ['virtio-net-pci'], maxInterfaces: 4, consoles: ['serial', 'vnc'],
  resources: { minVcpus: 1, maxVcpus: 4, minMemoryMiB: 512, maxMemoryMiB: 4096, defaultDiskGiB: 16, maxDiskGiB: 80 },
};

describe('NodeBuilderDrawer', () => {
  it('builds a canonical resource-aware node from an installed profile', () => {
    const onAdd = vi.fn();
    render(<NodeBuilderDrawer open profiles={[routerProfile]} existingNodeIds={[]} onAdd={onAdd} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Edge Router' } });
    fireEvent.change(screen.getByLabelText(/vCPU/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/memory/i), { target: { value: '2048' } });
    fireEvent.change(screen.getByLabelText(/disk/i), { target: { value: '24' } });
    fireEvent.change(screen.getByLabelText(/interface count/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/console/i), { target: { value: 'vnc' } });
    fireEvent.click(screen.getByRole('button', { name: /place node/i }));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      id: 'edge-router',
      profile: routerProfile,
      node: expect.objectContaining({
        displayName: 'Edge Router',
        resources: { vcpus: 4, memoryMiB: 2048, diskGiB: 24 },
        console: { type: 'vnc' },
        interfaces: [
          { id: 'eth0', model: 'virtio-net-pci' },
          { id: 'eth1', model: 'virtio-net-pci' },
          { id: 'eth2', model: 'virtio-net-pci' },
        ],
      }),
    }));
  });

  it('blocks profile-bound resource allocations and supports keyboard dismissal', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<NodeBuilderDrawer open profiles={[routerProfile]} existingNodeIds={[]} onAdd={onAdd} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/vCPU/i), { target: { value: '8' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/between 1 and 4/i);
    expect(screen.getByRole('button', { name: /place node/i })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
