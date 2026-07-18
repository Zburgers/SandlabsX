export type CapsuleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type InstanceState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'RESETTING' | 'FAILED' | 'DESTROYED';

export interface CapsuleInterface { id: string; model?: string }
export interface ImageArtifactReference { version: string; digest?: string }
export interface WorkloadProfileReference { version: string }
export interface CapsuleNode { driver: string; image: string; workloadProfile: string; interfaces: CapsuleInterface[]; displayName?: string; presentation?: { position?: { x: number; y: number } } }
export interface CapsuleLink { id: string; type: 'pointToPoint' | 'segment'; endpoints: string[] }
export interface CapsuleDocument { apiVersion: 'sandlabx.io/v1alpha1'; kind: 'LabCapsule'; metadata: { name: string; displayName?: string; description?: string; tags?: string[] }; runtime: { architecture: string }; policy: { network: { internetEgress: false } }; images: Record<string, ImageArtifactReference>; workloadProfiles: Record<string, WorkloadProfileReference>; nodes: Record<string, CapsuleNode>; links: CapsuleLink[] }
export interface ScenarioDocument { apiVersion: 'sandlabx.io/v1alpha1'; kind: 'LabScenario'; metadata: { name: string; displayName?: string }; spec: { capsuleVersion: string }; stages: Array<{ id: string; title?: string; instructions?: string[]; checks: unknown[] }> }
export interface CapsuleDraft { id: string; revision: number; status?: CapsuleStatus; document: CapsuleDocument; updatedAt?: string }
export interface CapsuleVersion { id: string; capsuleId?: string; versionNumber?: number; document: CapsuleDocument }
export interface ScenarioDraft { id: string; revision: number; document: ScenarioDocument }
export interface ScenarioVersion { id: string; scenarioId?: string; capsuleVersionId: string; versionNumber?: number; document: ScenarioDocument }
export type ScenarioCheckStatus = 'PASSED' | 'FAILED' | 'SKIPPED';
export interface ScenarioCheckResult { id: string; type: string; status: ScenarioCheckStatus; attempts: number; expected: unknown; observed: unknown; evidence: unknown; hint?: string }
export interface ScenarioStageResult { id: string; status: ScenarioCheckStatus; score: number; maximumScore: number; results: ScenarioCheckResult[] }
export interface ScenarioEvidence { stageId: string; checkId: string; outcome: ScenarioCheckStatus; evidence: unknown }
export interface ScenarioAttempt { id: string; status: 'ACTIVE' | 'PASSED' | 'FAILED'; score: number; maximumScore: number; stages: ScenarioStageResult[]; evidence: ScenarioEvidence[]; startedAt?: string; finishedAt?: string }
export interface CapsuleProfile { id: string; version: string; name: string; image: { name: string; version: string; digest: string }; interfaces: CapsuleInterface[] }
export interface InstanceSummary { id: string; name: string; capsuleVersionId: string; state: InstanceState; desiredState: InstanceState; observedState?: InstanceState; ownerName?: string }
export interface OperationEvent { cursor: number; type: string; payload: unknown; timestamp?: string }
export interface Operation { id: string; type?: string; state: string; progress?: number; events?: OperationEvent[]; error?: { code: string; message: string } }
export interface Capacity { availableVcpus: number; availableMemoryMiB: number; availableDiskGiB: number; admission: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' }
export interface ImpactPreview { token: string; summary: string; expiresAt?: string }
export interface ConsoleGrant { url: string; expiresAt: string; transport: 'serial' | 'vnc' }
