// Node status types
export type NodeStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error';

// Base image types
export type BaseImageType = 'ubuntu' | 'alpine' | 'debian' | 'fedora' | 'arch';

export interface BaseImage {
  id: string;
  name: string;
  type: BaseImageType;
  size: string;
  description: string;
  available: boolean;
}

// Node interface
export interface Node {
  id: string;
  name: string;
  status: NodeStatus;
  osType: BaseImageType; // Changed from baseImage to match backend
  baseImage?: BaseImageType; // Keep for backward compatibility
  vncPort: number | null;
  guacUrl: string | null;
  guacConnectionId: number | null;
  overlayPath: string;
  resources: {
    cpu?: number; // cores (for compatibility)
    cpus: number; // cores (main field)
    ram: number; // MB
    disk?: number; // GB
  };
  createdAt: string;
  updatedAt: string;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateNodeRequest {
  name?: string;
  baseImage: BaseImageType;
  resources?: {
    cpu?: number;
    ram?: number;
    disk?: number;
  };
}

export interface CreateNodeResponse {
  id: string;
  name: string;
  status: NodeStatus;
  overlayPath: string;
  baseImage: BaseImageType;
  createdAt: string;
}

export interface StartNodeResponse {
  id: string;
  status: NodeStatus;
  vncPort: number;
  guacUrl: string;
  guacConnectionId: number;
  pid?: number;
}

export interface StopNodeResponse {
  id: string;
  status: NodeStatus;
}

export interface WipeNodeResponse {
  id: string;
  status: NodeStatus;
  message: string;
}

export interface ListNodesResponse {
  nodes: Node[];
  count: number;
}
