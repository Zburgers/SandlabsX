import type { Node, BaseImage } from './types';

// Available base images - Cloud images that work perfectly with QEMU
export const baseImages: BaseImage[] = [
  {
    id: 'ubuntu-24-lts',
    name: 'Ubuntu 24.04 LTS',
    type: 'ubuntu',
    size: '596 MB',
    description: 'Ubuntu Noble Server Cloud Image - Latest LTS release',
    available: true,
  },
  {
    id: 'debian-13',
    name: 'Debian 13 (Trixie)',
    type: 'debian',
    size: '387 MB',
    description: 'Debian 13 NoCloud Image - Stable and reliable',
    available: true,
  },
  {
    id: 'alpine-3',
    name: 'Alpine Linux 3.x',
    type: 'alpine',
    size: '137 MB',
    description: 'Alpine Linux Cloud Image - Lightweight and secure',
    available: true,
  },
];

// Mock nodes for development
export const mockNodes: Node[] = [
  {
    id: '1',
    name: 'ubuntu-dev-1',
    status: 'running',
    osType: 'ubuntu',
    baseImage: 'ubuntu',
    vncPort: 5900,
    guacUrl: 'http://localhost:8081/guacamole/#/client/MQBjAHBvc3RncmVzcWw',
    guacConnectionId: 1,
    overlayPath: '/vms/ubuntu_node_1.qcow2',
    resources: {
      cpu: 2,
      cpus: 2,
      ram: 2048,
      disk: 10,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'alpine-test-1',
    status: 'stopped',
    osType: 'alpine',
    baseImage: 'alpine',
    vncPort: null,
    guacUrl: null,
    guacConnectionId: null,
    overlayPath: '/vms/alpine_node_1.qcow2',
    resources: {
      cpu: 1,
      cpus: 1,
      ram: 1024,
      disk: 5,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
