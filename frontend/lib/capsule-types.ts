export type CapsuleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type InstanceState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'RESETTING' | 'FAILED' | 'DESTROYED';

export interface CapsuleNode { id: string; name: string; profileId: string; interfaces: string[]; position?: { x: number; y: number }; image?: string; resources?: { vcpus?: number; memoryMiB?: number; diskGiB?: number } }
export interface CapsuleLink { id: string; kind: 'pointToPoint' | 'segment'; endpoints: Array<{ nodeId: string; interfaceId: string }>; segmentId?: string }
export interface CapsuleDocument { apiVersion: 'sandlabx.io/v1alpha1'; kind: 'LabCapsule'; metadata: { name: string; displayName?: string; description?: string; tags?: string[] }; images: Record<string, unknown>; nodes: Record<string, CapsuleNode>; links: CapsuleLink[]; scenarios: Array<{ id: string; title?: string; instructions?: string[]; stages?: Array<{ id: string; title: string }> }>; presentation?: { positions?: Record<string, { x: number; y: number }> } }
export interface CapsuleDraft { id: string; revision: number; status: CapsuleStatus; document: CapsuleDocument; updatedAt?: string }
export interface CapsuleVersion { id: string; capsuleId: string; versionNumber: number; document: CapsuleDocument }
export interface CapsuleProfile { id: string; name: string; interfaces: string[] }
export interface InstanceSummary { id: string; name: string; capsuleVersionId: string; state: InstanceState; desiredState: InstanceState; observedState?: InstanceState; ownerName?: string }
export interface OperationEvent { id: string; type: string; timestamp?: string; message?: string; state?: string }
export interface Operation { id: string; type: string; state: string; progress?: number; events?: OperationEvent[]; error?: { code: string; message: string } }
export interface Capacity { availableVcpus: number; availableMemoryMiB: number; availableDiskGiB: number; admission: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' }
export interface ImpactPreview { token: string; summary: string; expiresAt?: string }
export interface ConsoleGrant { url: string; expiresAt: string; transport: 'serial' | 'vnc' }
