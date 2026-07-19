'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../components/ui/ActionButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { PlusIcon, SearchIcon } from '../../components/icons';
import { CapsuleList } from '../../components/capsules/CapsuleList';
import { SurfaceState } from '../../components/ui/SurfaceState';
import { capsuleApi } from '../../lib/capsule-api';
import type { CapsuleDocument, CapsuleDraft } from '../../lib/capsule-types';

const starter: CapsuleDocument = { apiVersion: 'sandlabx.io/v1alpha1', kind: 'LabCapsule', metadata: { name: 'new-capsule', displayName: 'Untitled Capsule' }, runtime: { architecture: 'x86_64' }, policy: { network: { internetEgress: false } }, images: {}, workloadProfiles: {}, nodes: {}, links: [] };

export default function CapsulesPage() {
  const [capsules, setCapsules] = useState<CapsuleDraft[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string>();
  useEffect(() => { capsuleApi.listDrafts().then(setCapsules).catch(error => setMessage(error.message)).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => capsules.filter(capsule => `${capsule.document.metadata.displayName} ${capsule.document.metadata.name}`.toLowerCase().includes(query.toLowerCase())), [capsules, query]);
  const create = async () => { setCreating(true); setMessage(undefined); try { const draft = await capsuleApi.createDraft(structuredClone(starter)); window.location.assign(`/capsules/${draft.id}/edit`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create Capsule'); setCreating(false); } };
  return <div className="mx-auto max-w-[88rem] px-4 py-7 sm:px-7 sm:py-10 xl:px-10"><PageHeader eyebrow="Authoring" title="Capsule workspace" description="Design canonical network labs visually. Every node pins a workload and image version; every link names exact interfaces." actions={<ActionButton onClick={() => void create()} busy={creating} icon={<PlusIcon />}>New Capsule</ActionButton>} />
    <div className="mt-7 flex items-center gap-3"><label className="relative block w-full max-w-md"><span className="sr-only">Search Capsules</span><SearchIcon className="pointer-events-none absolute left-3.5 top-3 text-[var(--muted)]" /><input className="field pl-11" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search Capsules" /></label><span className="text-sm text-[var(--muted)] tabular">{visible.length} shown</span></div>
    {message && <div className="mt-6"><SurfaceState tone="error" title="Capsules are unavailable" detail={message} /></div>}
    <div className="mt-6">{loading ? <SurfaceState tone="loading" title="Loading Capsules" detail="Reading your canonical drafts." /> : <CapsuleList capsules={visible} />}</div>
  </div>;
}
