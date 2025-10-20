import type {
  Node,
  CreateNodeRequest,
  CreateNodeResponse,
  StartNodeResponse,
  StopNodeResponse,
  WipeNodeResponse,
  ListNodesResponse,
  ApiResponse,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || 'Request failed',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // List all nodes
  async listNodes(): Promise<ApiResponse<ListNodesResponse>> {
    return this.request<ListNodesResponse>('/nodes');
  }

  // Create new node
  async createNode(data: CreateNodeRequest): Promise<ApiResponse<CreateNodeResponse>> {
    // Transform frontend format to backend format
    const backendRequest = {
      name: data.name,
      osType: data.baseImage, // baseImage maps to osType in backend
      resources: data.resources ? {
        ram: data.resources.ram,
        cpus: data.resources.cpu, // cpu (frontend) maps to cpus (backend)
      } : undefined,
    };
    
    return this.request<CreateNodeResponse>('/nodes', {
      method: 'POST',
      body: JSON.stringify(backendRequest),
    });
  }

  // Start node (boot QEMU VM with overlay)
  async startNode(id: string): Promise<ApiResponse<StartNodeResponse>> {
    return this.request<StartNodeResponse>(`/nodes/${id}/run`, {
      method: 'POST',
    });
  }

  // Stop node (shutdown QEMU VM)
  async stopNode(id: string): Promise<ApiResponse<StopNodeResponse>> {
    return this.request<StopNodeResponse>(`/nodes/${id}/stop`, {
      method: 'POST',
    });
  }

  // Wipe node (delete overlay and recreate from base)
  async wipeNode(id: string): Promise<ApiResponse<WipeNodeResponse>> {
    return this.request<WipeNodeResponse>(`/nodes/${id}/wipe`, {
      method: 'POST',
    });
  }

  // Delete node completely
  async deleteNode(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/nodes/${id}`, {
      method: 'DELETE',
    });
  }

  // Get node details
  async getNode(id: string): Promise<ApiResponse<Node>> {
    return this.request<Node>(`/nodes/${id}`);
  }
}

export const apiClient = new ApiClient();
