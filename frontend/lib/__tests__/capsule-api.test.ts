import { describe, expect, it, vi } from 'vitest';
import { afterEventCursor, capsuleApi, CapsuleApiError, normalizeCapsuleError } from '../capsule-api';
import { capsuleEventCursor, normalizeDurableEvent } from '../event-stream';
import { canonicalCapsule } from '../../test/fixtures/canonical-capsule';

describe('Capsule API boundary', () => {
  it('preserves safe server error details and correlation IDs', () => {
    const error = normalizeCapsuleError({ code: 'REVISION_CONFLICT', message: 'Draft changed', correlationId: 'corr-7' }, 409);

    expect(error).toBeInstanceOf(CapsuleApiError);
    expect(error.code).toBe('REVISION_CONFLICT');
    expect(error.correlationId).toBe('corr-7');
    expect(error.message).toBe('Draft changed');
  });

  it('resumes event streams after the newest durable event', () => {
    expect(capsuleEventCursor([{ cursor: 1 }, { cursor: 2 }])).toBe(2);
    expect(capsuleEventCursor([])).toBeUndefined();
  });

  it('targets v2 Capsule routes and uses the server revision contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, capsule: { id: 'draft-1', revision: 2, document: canonicalCapsule } }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await capsuleApi.saveDraft('draft-1', 1, canonicalCapsule);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v2\/capsules\/draft-1$/), expect.objectContaining({ method: 'PUT', headers: expect.objectContaining({ 'If-Match': '1' }), body: JSON.stringify(canonicalCapsule) }));
  });

  it('lists Capsule drafts from the authenticated production contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, capsules: [{ id: 'draft-1', revision: 1, document: canonicalCapsule }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(capsuleApi.listDrafts()).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v2\/capsules$/), expect.any(Object));
  });

  it('loads browser catalogues and host capacity from their mounted contracts', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, images: [{ id: 'image-v1', name: 'debian' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, profiles: [{ id: 'profile-v1', name: 'router' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, capacity: { availableVcpus: 8, availableMemoryMiB: 16384, availableDiskGiB: 120, admission: 'AVAILABLE' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(capsuleApi.listImageVersions()).resolves.toEqual([expect.objectContaining({ id: 'image-v1' })]);
    await expect(capsuleApi.listProfileVersions()).resolves.toEqual([expect.objectContaining({ id: 'profile-v1' })]);
    await expect(capsuleApi.getCapacity()).resolves.toEqual(expect.objectContaining({ availableVcpus: 8 }));

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringMatching(/\/api\/images\/v2\/versions$/),
      expect.stringMatching(/\/api\/images\/v2\/profiles\/versions$/),
      expect.stringMatching(/\/api\/v2\/instances\/capacity\/admission$/),
    ]);
  });

  it('validates drafts, creates private revisions, and lists assignments', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, valid: true, issues: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, version: { id: 'private-v1' } }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, assignments: [{ id: 'assignment-1', title: 'OSPF recovery' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(capsuleApi.validateDraft('draft-1')).resolves.toEqual({ valid: true, issues: [] });
    await expect(capsuleApi.createPrivateRevision('draft-1')).resolves.toEqual(expect.objectContaining({ id: 'private-v1' }));
    await expect(capsuleApi.listAssignments()).resolves.toHaveLength(1);

    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/\/api\/v2\/capsules\/draft-1\/private-revisions$/), expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringMatching(/\/api\/v2\/assignments$/), expect.any(Object));
  });

  it('uses monotonic numeric cursors for v2 durable event resumes', () => {
    expect(afterEventCursor(8)).toBe('/v2/events?after=8');
  });

  it('normalizes the v2 named-SSE shape into a durable operation event', () => {
    expect(normalizeDurableEvent({ lastEventId: '9', type: 'OPERATION_PROGRESS', data: '{"progress":50}' })).toEqual({ cursor: 9, type: 'OPERATION_PROGRESS', payload: { progress: 50 } });
  });
});
