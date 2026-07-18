import type { CapsuleDocument, CapsuleDraft, CapsuleVersion, ConsoleGrant, ImpactPreview, InstanceSummary, Operation, ScenarioDocument, ScenarioDraft, ScenarioVersion } from './capsule-types';

const baseUrl = `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '')}/api`;
const v2 = (path: string) => `/v2${path}`;
export const afterEventCursor = (cursor: number) => `${v2('/events')}?after=${cursor}`;
export class CapsuleApiError extends Error { constructor(message: string, public readonly code = 'REQUEST_FAILED', public readonly correlationId?: string, public readonly status?: number) { super(message); } }
export function normalizeCapsuleError(value: unknown, status?: number): CapsuleApiError { const body = value as { code?: string; message?: string; error?: string; correlationId?: string }; return new CapsuleApiError(body?.message || body?.error || 'The Capsule service could not complete this request.', body?.code || 'REQUEST_FAILED', body?.correlationId, status); }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> { const token = typeof localStorage === 'undefined' ? null : localStorage.getItem('token'); const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } }); const body = await response.json().catch(() => ({})); if (!response.ok || body.success === false) throw normalizeCapsuleError(body, response.status); return body as T; }
const pending = (capability: string): never => { throw new CapsuleApiError(`${capability} contract has not landed.`, 'CONTRACT_PENDING'); };
export const capsuleApi = {
  listDrafts: async (): Promise<CapsuleDraft[]> => pending('Capsule-list'),
  getDraft: async (id: string) => (await request<{ capsule: CapsuleDraft }>(v2(`/capsules/${id}`))).capsule,
  createDraft: async (document: CapsuleDocument) => (await request<{ capsule: CapsuleDraft }>(v2('/capsules'), { method: 'POST', body: JSON.stringify(document) })).capsule,
  saveDraft: async (id: string, revision: number, document: CapsuleDocument) => (await request<{ capsule: CapsuleDraft }>(v2(`/capsules/${id}`), { method: 'PUT', headers: { 'If-Match': String(revision) }, body: JSON.stringify(document) })).capsule,
  publish: async (id: string) => (await request<{ version: CapsuleVersion }>(v2(`/capsules/${id}/publish`), { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } })).version,
  getInstance: async (id: string) => (await request<{ instance: InstanceSummary }>(v2(`/instances/${id}`))).instance,
  instanceAction: async (id: string, action: 'start' | 'stop' | 'reset') => (await request<{ operation: Operation }>(v2(`/instances/${id}/actions/${action}`), { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } })).operation,
  getOperation: async (id: string) => (await request<{ operation: Operation }>(v2(`/operations/${id}`))).operation,
  createScenario: async (document: ScenarioDocument) => (await request<{ scenario: ScenarioDraft }>(v2('/scenarios'), { method: 'POST', body: JSON.stringify(document) })).scenario,
  publishScenario: async (id: string) => (await request<{ version: ScenarioVersion }>(v2(`/scenarios/${id}/publish`), { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } })).version,
  getScenarioVersion: async (id: string) => (await request<{ version: ScenarioVersion }>(v2(`/scenarios/versions/${id}`))).version,
  createCheckpoint: async (_instanceId: string, _name: string, _nodes: string[]): Promise<never> => pending('Checkpoint'),
  runVerification: async (_instanceId: string, _scenarioId: string): Promise<never> => pending('Scenario verification'),
  impactPreview: async (_id: string, _action: 'reset' | 'destroy'): Promise<ImpactPreview> => pending('Impact-preview'),
  confirmImpact: async (_id: string, _action: 'reset' | 'destroy', _token: string, _key: string): Promise<Operation> => pending('Destructive-action'),
  requestConsoleGrant: async (_id: string, _transport: ConsoleGrant['transport']): Promise<ConsoleGrant> => pending('Console-grant'),
};
