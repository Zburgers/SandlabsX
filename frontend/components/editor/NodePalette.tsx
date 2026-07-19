'use client';

import { useMemo, useState } from 'react';
import type { CapsuleProfile } from '../../lib/capsule-types';
import { PlusIcon, SearchIcon } from '../icons';

export function NodePalette({ profiles, onSelect, disabled }: { profiles: CapsuleProfile[]; onSelect: (profile: CapsuleProfile) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => profiles.filter(profile => profile.name.toLowerCase().includes(query.toLowerCase())), [profiles, query]);
  return <aside aria-label="Workload profiles" className="flex h-full min-h-0 flex-col bg-[var(--canvas-soft)]"><div className="border-b border-border p-3"><label className="relative block"><span className="sr-only">Search workload profiles</span><SearchIcon className="pointer-events-none absolute left-3 top-3 text-[var(--muted)]" /><input className="field pl-10 text-sm" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search profiles" /></label></div><div className="flex-1 overflow-y-auto p-3"><p className="px-1 text-xs font-medium text-[var(--muted)]">Installed profiles · {shown.length}</p><div className="mt-3 space-y-2">{shown.map(profile => <button key={profile.id} disabled={disabled} type="button" onClick={() => onSelect(profile)} className="group block min-h-16 w-full rounded-md border border-border bg-[var(--surface)] p-3 text-left transition hover:border-accent hover:bg-[var(--surface-raised)] disabled:opacity-45"><span className="flex items-center justify-between gap-3"><strong className="text-sm font-medium">{profile.name}</strong><PlusIcon className="text-[var(--muted)] group-hover:text-accent" /></span><span className="mt-2 block text-[0.68rem] text-[var(--muted)]">{profile.interfaces.length} interfaces · {profile.resources?.minVcpus || 1}–{profile.resources?.maxVcpus || 1} vCPU</span></button>)}</div>{!shown.length && <p className="mt-6 px-1 text-sm leading-6 text-[var(--ink-soft)]">No installed profile matches this search.</p>}</div></aside>;
}
