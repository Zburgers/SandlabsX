'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImageIcon, SearchIcon } from '../../components/icons';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusSignal } from '../../components/ui/StatusSignal';
import { SurfaceState } from '../../components/ui/SurfaceState';
import { capsuleApi } from '../../lib/capsule-api';
import type { ImageArtifactVersion, WorkloadProfileVersion } from '../../lib/capsule-types';

const bytes = (value?: number) => value === undefined ? 'size unavailable' : `${(value / (1024 ** 3)).toFixed(1)} GiB`;

export default function ImagesPage() {
  const [images, setImages] = useState<ImageArtifactVersion[]>([]);
  const [profiles, setProfiles] = useState<WorkloadProfileVersion[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => { Promise.all([capsuleApi.listImageVersions(), capsuleApi.listProfileVersions()]).then(([nextImages, nextProfiles]) => { setImages(nextImages); setProfiles(nextProfiles); }).catch(error => setError(error.message)).finally(() => setLoading(false)); }, []);
  const shown = useMemo(() => images.filter(image => image.name.toLowerCase().includes(query.toLowerCase())), [images, query]);
  return <div className="mx-auto max-w-[96rem] px-4 py-7 sm:px-7 sm:py-10 xl:px-10"><PageHeader eyebrow="Immutable inputs" title="Images & workload profiles" description="Capsule nodes reference exact, digest-pinned image artifacts and installed capability profiles. Host paths and source credentials never enter the browser." />
    <label className="relative mt-7 block max-w-md"><span className="sr-only">Search image versions</span><SearchIcon className="pointer-events-none absolute left-3.5 top-3 text-[var(--muted)]" /><input className="field pl-11" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search image versions" /></label>
    {loading ? <div className="mt-7"><SurfaceState tone="loading" title="Loading catalogue" detail="Resolving immutable image and workload profile versions." /></div> : error ? <div className="mt-7"><SurfaceState tone="error" title="Catalogue is unavailable" detail={error} /></div> : <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,.8fr)]"><section className="surface overflow-hidden rounded-[var(--radius-lg)]"><div className="border-b border-border px-5 py-4"><p className="eyebrow">artifacts</p><h2 className="mt-1 font-semibold">Managed image versions</h2></div>{shown.length ? <ul className="divide-y divide-border">{shown.map(image => <li key={image.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"><span className="grid h-10 w-10 place-items-center rounded-md bg-[var(--surface-raised)] text-accent"><ImageIcon /></span><div><h3 className="font-medium">{image.name} <span className="text-[var(--muted)]">v{image.versionNumber || 1}</span></h3><p className="mt-1 max-w-lg truncate text-xs text-[var(--muted)] mono">{image.digest}</p></div><div className="text-right text-xs text-[var(--ink-soft)]"><p>{image.architecture || 'any architecture'}</p><p className="mt-1">{bytes(image.virtualSizeBytes || image.sizeBytes)}</p></div></li>)}</ul> : <div className="p-5"><SurfaceState title="No matching images" detail="Publish or import a managed image artifact before placing workload nodes." /></div>}</section><section className="surface rounded-[var(--radius-lg)] p-5"><p className="eyebrow">capabilities</p><h2 className="mt-1 font-semibold">Installed profiles</h2><ul className="mt-5 space-y-3">{profiles.map(profile => <li key={profile.id} className="rounded-md bg-[var(--surface-raised)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-medium">{profile.name}</h3><StatusSignal label={profile.architecture} tone="info" /></div><p className="mt-2 text-xs text-[var(--ink-soft)]">{profile.resources.minVcpus}–{profile.resources.maxVcpus} vCPU · {profile.resources.minMemoryMiB}–{profile.resources.maxMemoryMiB} MiB · up to {profile.interfaces.max} interfaces</p></li>)}</ul>{!profiles.length && <p className="mt-5 text-sm text-[var(--ink-soft)]">No workload profiles are installed. Node placement stays disabled until an administrator publishes one.</p>}</section></div>}
  </div>;
}
