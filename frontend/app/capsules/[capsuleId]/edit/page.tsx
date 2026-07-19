'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CapsuleEditor } from '../../../../components/editor/CapsuleEditor';
import { RevisionConflictDialog } from '../../../../components/editor/RevisionConflictDialog';
import { ActionButton } from '../../../../components/ui/ActionButton';
import { StatusSignal } from '../../../../components/ui/StatusSignal';
import { SurfaceState } from '../../../../components/ui/SurfaceState';
import { capsuleApi } from '../../../../lib/capsule-api';
import type { CapsuleDraft, CapsuleProfile, CapsuleValidation, ImageArtifactVersion, WorkloadProfileVersion } from '../../../../lib/capsule-types';
import { useCapsuleDraft } from '../../../../hooks/useCapsuleDraft';

function compatibleImage(profile: WorkloadProfileVersion, images: ImageArtifactVersion[]) {
  return images.find(image => (!image.architecture || image.architecture === profile.architecture) && (!profile.supportedImage?.formats?.length || profile.supportedImage.formats.includes(image.format || 'qcow2')));
}

function editorProfiles(profiles: WorkloadProfileVersion[], images: ImageArtifactVersion[]): CapsuleProfile[] {
  return profiles.flatMap(profile => {
    const image = compatibleImage(profile, images); if (!image) return [];
    const count = Math.min(2, Math.max(1, profile.interfaces.max)); const model = profile.interfaces.models[0] || 'virtio-net-pci';
    return [{ id: profile.id, version: profile.id, name: profile.name, image: { name: image.name, version: image.id, digest: image.digest }, interfaces: Array.from({ length: count }, (_, index) => ({ id: `eth${index}`, model })), interfaceModels: profile.interfaces.models, maxInterfaces: profile.interfaces.max, resources: profile.resources, consoles: profile.consoles || (profile.console ? [profile.console as 'serial' | 'vnc' | 'none'] : ['serial']) }];
  });
}

function SaveSignal({ status }: { status: ReturnType<typeof useCapsuleDraft>['status'] }) {
  const tone = status === 'saved' ? 'success' : status === 'failed' || status === 'conflict' ? 'danger' : 'warning';
  return <StatusSignal label={status === 'unsaved' ? 'Unsaved changes' : status[0].toUpperCase() + status.slice(1)} tone={tone} />;
}

function CapsuleEditWorkspace({ initial, profiles }: { initial: CapsuleDraft; profiles: CapsuleProfile[] }) {
  const draft = useCapsuleDraft(initial);
  const [validation, setValidation] = useState<CapsuleValidation>({ valid: true, issues: [] });
  const [action, setAction] = useState<string>();
  const [busy, setBusy] = useState(false);
  const validate = async (published = false) => { setBusy(true); setAction(undefined); try { const result = await capsuleApi.validateDraft(initial.id, published); setValidation(result); setAction(result.valid ? 'Server validation passed.' : `${result.issues.length} validation issues require attention.`); return result.valid; } catch (error) { setAction(error instanceof Error ? error.message : 'Validation failed.'); return false; } finally { setBusy(false); } };
  const revisionAction = async (publish: boolean) => { setBusy(true); setAction(undefined); try { const valid = await validate(publish); if (!valid) return; const version = publish ? await capsuleApi.publish(initial.id) : await capsuleApi.createPrivateRevision(initial.id); setAction(`${publish ? 'Published' : 'Private revision created'}: ${version.id}`); } catch (error) { setAction(error instanceof Error ? error.message : 'Revision action failed.'); } finally { setBusy(false); } };
  const reload = async () => { const remote = await capsuleApi.getDraft(initial.id); draft.reset(remote); setValidation({ valid: true, issues: [] }); };
  return <div className="min-h-[calc(100dvh-var(--topbar-height))]"><header className="sticky top-[var(--topbar-height)] z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[rgba(8,13,18,.92)] px-4 py-3 backdrop-blur-xl lg:top-0 sm:px-6"><div className="min-w-0"><div className="flex items-center gap-2 text-xs text-[var(--muted)]"><Link href="/capsules" className="hover:text-accent">Capsules</Link><span>/</span><span className="truncate mono">{initial.id.slice(0, 10)}</span></div><h1 className="mt-1 truncate text-lg font-semibold tracking-[-0.025em]">{draft.document.metadata.displayName || draft.document.metadata.name}</h1></div><div className="flex flex-wrap items-center gap-2"><SaveSignal status={draft.status} /><span className="mr-2 text-xs text-[var(--muted)] tabular">revision {draft.revision}</span>{draft.status === 'failed' && <ActionButton tone="secondary" onClick={draft.retry}>Retry save</ActionButton>}<ActionButton tone="secondary" busy={busy} onClick={() => void validate(false)}>Validate</ActionButton><ActionButton tone="secondary" disabled={draft.status !== 'saved'} busy={busy} onClick={() => void revisionAction(false)}>Private revision</ActionButton><ActionButton disabled={draft.status !== 'saved'} busy={busy} onClick={() => void revisionAction(true)}>Publish</ActionButton></div></header>
    <div className="p-3 sm:p-5"><CapsuleEditor key={`${initial.id}-${draft.revision === initial.revision ? 'local' : 'saved'}`} draft={{ ...initial, revision: draft.revision, document: draft.document }} profiles={profiles} onSave={draft.update} issues={validation.issues} />{!profiles.length && <div className="mt-4"><SurfaceState title="No compatible workload inputs" detail="Publish at least one workload profile and a compatible immutable image version before placing nodes." /></div>}{draft.status === 'conflict' && <div className="mt-4"><RevisionConflictDialog onReload={() => void reload()} onDismiss={() => {}} /></div>}{draft.error && draft.status !== 'conflict' && <p role="alert" className="mt-4 text-sm text-danger">{draft.error.message}{draft.error.correlationId ? ` · request ${draft.error.correlationId}` : ''}</p>}{action && <p role="status" className="mt-4 text-sm text-[var(--ink-soft)]">{action}</p>}</div>
  </div>;
}

export default function CapsuleEditPage() {
  const { capsuleId } = useParams<{ capsuleId: string }>();
  const [draft, setDraft] = useState<CapsuleDraft>();
  const [catalogue, setCatalogue] = useState<{ profiles: WorkloadProfileVersion[]; images: ImageArtifactVersion[] }>({ profiles: [], images: [] });
  const [message, setMessage] = useState<string>();
  useEffect(() => { Promise.all([capsuleApi.getDraft(capsuleId), capsuleApi.listProfileVersions(), capsuleApi.listImageVersions()]).then(([nextDraft, profiles, images]) => { setDraft(nextDraft); setCatalogue({ profiles, images }); }).catch(error => setMessage(error.message)); }, [capsuleId]);
  const profiles = useMemo(() => editorProfiles(catalogue.profiles, catalogue.images), [catalogue]);
  if (message) return <div className="p-5"><SurfaceState tone="error" title="Capsule could not be opened" detail={message} /></div>;
  if (!draft) return <div className="p-5"><SurfaceState tone="loading" title="Opening Capsule" detail="Loading the canonical draft and installed workload catalogue." /></div>;
  return <CapsuleEditWorkspace initial={draft} profiles={profiles} />;
}
