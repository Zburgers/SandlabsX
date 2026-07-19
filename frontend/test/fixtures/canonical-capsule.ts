import type { CapsuleDocument } from '../../lib/capsule-types';

export const canonicalCapsule: CapsuleDocument = {
  apiVersion: 'sandlabx.io/v1alpha1',
  kind: 'LabCapsule',
  metadata: { name: 'routing-lab', displayName: 'Routing lab' },
  runtime: { architecture: 'x86_64' },
  policy: { network: { internetEgress: false } },
  images: { router: { version: 'artifact-router-v3', digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } },
  workloadProfiles: { router: { version: 'profile-router-v2' } },
  nodes: {
    router: { driver: 'qemu', image: 'router', workloadProfile: 'router', interfaces: [{ id: 'wan0', model: 'virtio-net-pci' }, { id: 'lan0', model: 'virtio-net-pci' }], resources: { vcpus: 1, memoryMiB: 512, diskGiB: 16 }, console: { type: 'serial' } },
  },
  links: [],
};
