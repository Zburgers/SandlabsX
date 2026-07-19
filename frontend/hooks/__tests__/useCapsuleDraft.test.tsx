import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CapsuleApiError } from '../../lib/capsule-api';
import { useCapsuleDraft } from '../useCapsuleDraft';
import { canonicalCapsule } from '../../test/fixtures/canonical-capsule';
import type { CapsuleDraft } from '../../lib/capsule-types';

const initial: CapsuleDraft = { id: 'draft-1', revision: 4, status: 'DRAFT', document: canonicalCapsule };
const changed = (name: string) => ({ ...canonicalCapsule, metadata: { ...canonicalCapsule.metadata, displayName: name } });

describe('useCapsuleDraft', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces changes and saves against the exact current server revision', async () => {
    const save = vi.fn().mockResolvedValue({ ...initial, revision: 5, document: changed('Saved') });
    const { result } = renderHook(() => useCapsuleDraft(initial, save));

    act(() => result.current.update(changed('Local')));
    expect(result.current.status).toBe('unsaved');
    expect(save).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });

    expect(save).toHaveBeenCalledWith('draft-1', 4, changed('Local'));
    expect(result.current.status).toBe('saved');
    expect(result.current.revision).toBe(5);
  });

  it('serializes writes and coalesces edits made while a save is in flight', async () => {
    let resolveFirst!: (draft: CapsuleDraft) => void;
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<CapsuleDraft>(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ...initial, revision: 6, document: changed('Second') });
    const { result } = renderHook(() => useCapsuleDraft(initial, save));

    act(() => result.current.update(changed('First')));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    act(() => result.current.update(changed('Second')));
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { resolveFirst({ ...initial, revision: 5, document: changed('First') }); await Promise.resolve(); });
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });

    expect(save).toHaveBeenNthCalledWith(2, 'draft-1', 5, changed('Second'));
    expect(result.current.status).toBe('saved');
  });

  it('retains local state and exposes revision conflicts for explicit recovery', async () => {
    const save = vi.fn().mockRejectedValue(new CapsuleApiError('Draft changed', 'REVISION_CONFLICT', 'corr-7', 409));
    const { result } = renderHook(() => useCapsuleDraft(initial, save));
    act(() => result.current.update(changed('Keep me')));
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });

    expect(result.current.status).toBe('conflict');
    expect(result.current.document.metadata.displayName).toBe('Keep me');
    expect(result.current.error?.correlationId).toBe('corr-7');
  });
});
