import type { CapsuleDraft, CapsuleVersion, ConsoleGrant, ImpactPreview, InstanceSummary, Operation, OperationEvent } from './capsule-types';

const baseUrl = `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '')}/api`;
export class CapsuleApiError extends Error { constructor(message: string, public readonly code = 'REQUEST_FAILED', public readonly correlationId?: string, public readonly status?: number) { super(message); } }
export function normalizeCapsuleError(value: unknown, status?: number): CapsuleApiError { const body = value as { code?: string; message?: string; error?: string; correlationId?: string }; return new CapsuleApiError(body?.message || body?.error || 'The Capsule service could not complete this request.', body?.code || 'REQUEST_FAILED', body?.correlationId, status); }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window === 'undefined' ? null : localStorage.getItem('token');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw normalizeCapsuleError(body, response.status);
  return body as T;
}

export const capsuleApi = {
  listDrafts: async () => (await request<{ capsules: CapsuleDraft[] }>('/capsules')).capsules,
  getDraft: async (id: string) => (await request<{ capsule: CapsuleDraft }>(`/capsules/${id}`)).capsule,
  createDraft: async (document: CapsuleDraft['document']) => (await request<{ capsule: CapsuleDraft }>('/capsules', { method: 'POST', body: JSON.stringify(document) })).capsule,
  saveDraft: async (id: string, revision: number, document: CapsuleDraft['document']) => (await request<{ capsule: CapsuleDraft }>(`/capsules/${id}`, { method: 'PATCH', headers: { 'If-Match': String(revision) }, body: JSON.stringify({ revision, document }) })).capsule,
  publish: async (id: string) => (await request<{ version: CapsuleVersion }>(`/capsules/${id}/publish`, { method: 'POST' })).version,
  getInstance: async (id: string) => (await request<{ instance: InstanceSummary }>(`/instances/${id}`)).instance,
  instanceAction: async (id: string, action: 'start' | 'stop' | 'reset') => (await request<{ operation: Operation }>(`/instances/${id}/actions/${action}`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } })).operation,
  getOperation: async (id: string) => (await request<{ operation: Operation }>(`/operations/${id}`)).operation,
  getOperationEvents: async (id: string) => (await request<{ events: OperationEvent[] }>(`/operations/${id}/events`)).events,
  createCheckpoint: async (id: string, name: string, nodes: string[]) => request(`/instances/${id}/checkpoints`, { method: 'POST', body: JSON.stringify({ name, nodes }) }),
  runVerification: async (id: string, scenarioId: string) => request(`/instances/${id}/verifications`, { method: 'POST', body: JSON.stringify({ scenarioId }) }),
  impactPreview: async (_id: string, _action: 'reset' | 'destroy'): Promise<ImpactPreview> => { throw new CapsuleApiError('Impact-preview contract has not landed.', 'CONTRACT_PENDING'); },
  confirmImpact: async (_id: string, _action: 'reset' | 'destroy', _token: string, _key: string): Promise<Operation> => { throw new CapsuleApiError('Destructive-action contract has not landed.', 'CONTRACT_PENDING'); },
  requestConsoleGrant: async (_id: string, _transport: ConsoleGrant['transport']): Promise<ConsoleGrant> => { throw new CapsuleApiError('Console-grant contract has not landed.', 'CONTRACT_PENDING'); },
};
