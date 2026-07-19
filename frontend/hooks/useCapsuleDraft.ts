'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { capsuleApi, CapsuleApiError } from '../lib/capsule-api';
import type { CapsuleDocument, CapsuleDraft } from '../lib/capsule-types';

export type CapsuleSaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed' | 'conflict';
type SaveDraft = (id: string, revision: number, document: CapsuleDocument) => Promise<CapsuleDraft>;

export function useCapsuleDraft(initial: CapsuleDraft, save: SaveDraft = capsuleApi.saveDraft) {
  const [document, setDocument] = useState(initial.document);
  const [revision, setRevision] = useState(initial.revision);
  const [status, setStatus] = useState<CapsuleSaveStatus>('saved');
  const [error, setError] = useState<CapsuleApiError>();
  const serverRef = useRef(initial);
  const pendingRef = useRef<CapsuleDocument>();
  const inFlightRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const blockedRef = useRef(false);

  const flush = useCallback(async () => {
    if (inFlightRef.current || blockedRef.current || !pendingRef.current) return;
    const next = pendingRef.current;
    pendingRef.current = undefined;
    inFlightRef.current = true;
    setStatus('saving'); setError(undefined);
    try {
      const saved = await save(serverRef.current.id, serverRef.current.revision, next);
      serverRef.current = saved; setRevision(saved.revision);
      if (!pendingRef.current) { setDocument(saved.document); setStatus('saved'); }
    } catch (value) {
      const nextError = value instanceof CapsuleApiError ? value : new CapsuleApiError(value instanceof Error ? value.message : 'Could not save the Capsule draft.');
      pendingRef.current = next;
      blockedRef.current = true;
      setError(nextError); setStatus(nextError.code === 'REVISION_CONFLICT' ? 'conflict' : 'failed');
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current && !blockedRef.current) timerRef.current = setTimeout(() => void flush(), 0);
    }
  }, [save]);

  const update = useCallback((next: CapsuleDocument) => {
    setDocument(next); pendingRef.current = next; blockedRef.current = false; setError(undefined); setStatus('unsaved');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), 700);
  }, [flush]);

  const retry = useCallback(() => { blockedRef.current = false; setStatus('unsaved'); void flush(); }, [flush]);
  const reset = useCallback((remote: CapsuleDraft) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    serverRef.current = remote; pendingRef.current = undefined; blockedRef.current = false;
    setDocument(remote.document); setRevision(remote.revision); setError(undefined); setStatus('saved');
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (status !== 'saved') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [status]);

  return { document, revision, status, error, update, retry, reset };
}
