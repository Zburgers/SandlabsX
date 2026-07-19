import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CapsuleEditor, connectInterfaces, moveCapsuleNode, removeCapsuleNode } from '../CapsuleEditor';
import type { CapsuleDraft, CapsuleProfile } from '../../../lib/capsule-types';
import { canonicalCapsule } from '../../../test/fixtures/canonical-capsule';

const profile: CapsuleProfile = { id: 'router', version: 'profile-router-v2', name: 'Router', image: { name: 'router', version: 'artifact-router-v3', digest: `sha256:${'a'.repeat(64)}` }, interfaces: [{ id: 'eth0', model: 'virtio-net-pci' }, { id: 'eth1', model: 'virtio-net-pci' }], interfaceModels: ['virtio-net-pci'], maxInterfaces: 4, consoles: ['serial', 'vnc'], resources: { minVcpus: 1, maxVcpus: 4, minMemoryMiB: 512, maxMemoryMiB: 4096, defaultDiskGiB: 16 } };
const draft: CapsuleDraft = { id: 'capsule-1', revision: 4, status: 'DRAFT', document: { ...canonicalCapsule, images: {}, workloadProfiles: {}, nodes: {}, links: [] } };

describe('CapsuleEditor', () => {
  it('opens the builder from a blank canvas and places a resource-aware canonical node', () => {
    const onSave = vi.fn();
    render(<CapsuleEditor draft={draft} profiles={[profile]} onSave={onSave} />);

    expect(screen.getByText(/blank canvas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /router/i }));
    fireEvent.click(screen.getByRole('button', { name: /place node/i }));

    const saved = onSave.mock.calls.at(-1)?.[0];
    expect(saved.nodes.router).toEqual(expect.objectContaining({ workloadProfile: 'router', resources: { vcpus: 1, memoryMiB: 512, diskGiB: 16 } }));
    expect(saved.images.router.version).toBe('artifact-router-v3');
  });

  it('supports undo and redo without changing the server revision itself', () => {
    const onSave = vi.fn();
    render(<CapsuleEditor draft={draft} profiles={[profile]} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /router/i }));
    fireEvent.click(screen.getByRole('button', { name: /place node/i }));
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(screen.getByText(/blank canvas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /redo/i }));
    expect(onSave.mock.calls.at(-1)?.[0].nodes.router).toBeDefined();
  });

  it('connects exact free interfaces and rejects interface reuse', () => {
    const document = { ...canonicalCapsule, nodes: {
      r1: { ...canonicalCapsule.nodes.router, interfaces: [{ id: 'eth0' }] },
      r2: { ...canonicalCapsule.nodes.router, interfaces: [{ id: 'eth0' }, { id: 'eth1' }] },
    }, links: [] };
    const first = connectInterfaces(document, 'r1:eth0', 'r2:eth0');
    expect(first.error).toBeUndefined();
    expect(first.document.links[0].endpoints).toEqual(['r1:eth0', 'r2:eth0']);
    const reused = connectInterfaces(first.document, 'r1:eth0', 'r2:eth1');
    expect(reused.error).toMatch(/already connected/i);
    expect(reused.document.links).toHaveLength(1);
  });

  it('stores movement as presentation metadata and removes dependent links with a node', () => {
    const linked = { ...canonicalCapsule, nodes: { router: canonicalCapsule.nodes.router, host: { ...canonicalCapsule.nodes.router, displayName: 'Host' } }, links: [{ id: 'router-host', type: 'pointToPoint' as const, endpoints: ['router:wan0', 'host:wan0'] }] };
    const moved = moveCapsuleNode(linked, 'router', { x: 320, y: 180 });
    expect(moved.nodes.router.presentation?.position).toEqual({ x: 320, y: 180 });
    const removed = removeCapsuleNode(moved, 'router');
    expect(removed.nodes.router).toBeUndefined();
    expect(removed.links).toHaveLength(0);
  });
});
