'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CapsuleNode, CapsuleProfile } from '../../lib/capsule-types';
import { CloseIcon } from '../icons';
import { ActionButton } from '../ui/ActionButton';

export interface BuiltCapsuleNode { id: string; profile: CapsuleProfile; node: CapsuleNode }

const safeId = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'node';
const uniqueId = (name: string, existing: string[]) => { const base = safeId(name); let candidate = base; let suffix = 2; while (existing.includes(candidate)) candidate = `${base}-${suffix++}`; return candidate; };

export function NodeBuilderDrawer({ open, profiles, existingNodeIds, initialProfileId, onAdd, onClose }: { open: boolean; profiles: CapsuleProfile[]; existingNodeIds: string[]; initialProfileId?: string; onAdd: (value: BuiltCapsuleNode) => void; onClose: () => void }) {
  const [profileId, setProfileId] = useState(initialProfileId || profiles[0]?.id || '');
  const profile = profiles.find(item => item.id === profileId) || profiles[0];
  const [displayName, setDisplayName] = useState(profile?.name || '');
  const [vcpus, setVcpus] = useState(profile?.resources?.minVcpus || 1);
  const [memoryMiB, setMemoryMiB] = useState(profile?.resources?.minMemoryMiB || 1024);
  const [diskGiB, setDiskGiB] = useState(profile?.resources?.defaultDiskGiB || 16);
  const [interfaceCount, setInterfaceCount] = useState(Math.max(1, profile?.interfaces.length || 1));
  const [consoleType, setConsoleType] = useState<'serial' | 'vnc' | 'none'>(profile?.consoles?.[0] || 'serial');

  useEffect(() => {
    if (!open) return;
    const selected = profiles.find(item => item.id === initialProfileId) || profiles[0];
    if (!selected) return;
    setProfileId(selected.id); setDisplayName(selected.name);
    setVcpus(selected.resources?.minVcpus || 1); setMemoryMiB(selected.resources?.minMemoryMiB || 1024);
    setDiskGiB(selected.resources?.defaultDiskGiB || 16); setInterfaceCount(Math.max(1, selected.interfaces.length || 1));
    setConsoleType(selected.consoles?.[0] || 'serial');
  }, [initialProfileId, open, profiles]);

  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [onClose, open]);

  const errors = useMemo(() => {
    if (!profile) return ['No workload profile is available.'];
    const next: string[] = [];
    const resources = profile.resources;
    if (!displayName.trim()) next.push('Display name is required.');
    if (resources && (vcpus < resources.minVcpus || vcpus > resources.maxVcpus)) next.push(`vCPU must be between ${resources.minVcpus} and ${resources.maxVcpus}.`);
    if (resources && (memoryMiB < resources.minMemoryMiB || memoryMiB > resources.maxMemoryMiB)) next.push(`Memory must be between ${resources.minMemoryMiB} and ${resources.maxMemoryMiB} MiB.`);
    if (diskGiB < 1 || (resources?.maxDiskGiB && diskGiB > resources.maxDiskGiB)) next.push(`Disk must be between 1 and ${resources?.maxDiskGiB || 1024} GiB.`);
    if (interfaceCount < 1 || interfaceCount > (profile.maxInterfaces || Math.max(profile.interfaces.length, 1))) next.push(`Interface count must be between 1 and ${profile.maxInterfaces || Math.max(profile.interfaces.length, 1)}.`);
    return next;
  }, [diskGiB, displayName, interfaceCount, memoryMiB, profile, vcpus]);

  if (!open) return null;
  const selectProfile = (id: string) => {
    const selected = profiles.find(item => item.id === id); if (!selected) return;
    setProfileId(id); setDisplayName(selected.name); setVcpus(selected.resources?.minVcpus || 1); setMemoryMiB(selected.resources?.minMemoryMiB || 1024); setDiskGiB(selected.resources?.defaultDiskGiB || 16); setInterfaceCount(Math.max(1, selected.interfaces.length || 1)); setConsoleType(selected.consoles?.[0] || 'serial');
  };
  const place = () => {
    if (!profile || errors.length) return;
    const model = profile.interfaceModels?.[0] || profile.interfaces[0]?.model || 'virtio-net-pci';
    const interfaces = Array.from({ length: interfaceCount }, (_, index) => ({ id: `eth${index}`, model }));
    onAdd({ id: uniqueId(displayName, existingNodeIds), profile, node: { driver: 'qemu', image: profile.image.name, workloadProfile: profile.id, displayName: displayName.trim(), interfaces, resources: { vcpus, memoryMiB, diskGiB }, console: { type: consoleType } } });
  };

  return <div className="fixed inset-0 z-50 bg-[rgba(2,7,10,.72)] backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="node-builder-title" className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-border bg-[var(--canvas-soft)] shadow-2xl">
    <header className="flex items-start justify-between border-b border-border px-5 py-5 sm:px-7"><div><p className="eyebrow">node builder</p><h2 id="node-builder-title" className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Place a workload node</h2><p className="mt-2 text-sm text-[var(--ink-soft)]">Choose an installed profile, then allocate within its declared limits.</p></div><button type="button" aria-label="Close node builder" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-md border border-border text-[var(--ink-soft)] hover:text-ink"><CloseIcon /></button></header>
    <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
      <fieldset><legend className="text-sm font-semibold">Identity & workload</legend><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs text-[var(--ink-soft)]">Workload profile<select aria-label="Workload profile" className="field mt-2" value={profileId} onChange={event => selectProfile(event.target.value)}>{profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs text-[var(--ink-soft)]">Display name<input aria-label="Display name" className="field mt-2" value={displayName} onChange={event => setDisplayName(event.target.value)} /></label></div>{profile && <div className="mt-3 rounded-md bg-[var(--surface)] p-3 text-xs text-[var(--muted)]"><span className="mono">{profile.version}</span> · image <span className="mono">{profile.image.version}</span><span className="mt-1 block truncate mono">{profile.image.digest}</span></div>}</fieldset>
      <fieldset><legend className="text-sm font-semibold">Resources</legend><div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-xs text-[var(--ink-soft)]">vCPU<input aria-label="vCPU" type="number" className="field mt-2 tabular" value={vcpus} onChange={event => setVcpus(Number(event.target.value))} /></label><label className="text-xs text-[var(--ink-soft)]">Memory (MiB)<input aria-label="Memory" type="number" className="field mt-2 tabular" value={memoryMiB} onChange={event => setMemoryMiB(Number(event.target.value))} /></label><label className="text-xs text-[var(--ink-soft)]">Disk (GiB)<input aria-label="Disk" type="number" className="field mt-2 tabular" value={diskGiB} onChange={event => setDiskGiB(Number(event.target.value))} /></label></div><p className="mt-3 text-xs text-[var(--muted)]">Allocation: {vcpus} vCPU · {(memoryMiB / 1024).toFixed(1)} GiB RAM · {diskGiB} GiB disk</p></fieldset>
      <fieldset><legend className="text-sm font-semibold">Networking & access</legend><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs text-[var(--ink-soft)]">Interface count<input aria-label="Interface count" type="number" className="field mt-2 tabular" value={interfaceCount} onChange={event => setInterfaceCount(Number(event.target.value))} /></label><label className="text-xs text-[var(--ink-soft)]">Console<select aria-label="Console" className="field mt-2" value={consoleType} onChange={event => setConsoleType(event.target.value as typeof consoleType)}>{(profile?.consoles?.length ? profile.consoles : ['serial', 'vnc', 'none']).map(value => <option key={value} value={value}>{value}</option>)}</select></label></div></fieldset>
      {errors.length > 0 && <div role="alert" className="rounded-md border border-[color:var(--danger)] bg-[rgba(255,143,136,.07)] p-4 text-sm text-danger"><ul className="list-disc space-y-1 pl-4">{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    </div>
    <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-7"><button type="button" onClick={onClose} className="min-h-11 px-2 text-sm font-medium text-[var(--ink-soft)]">Cancel</button><ActionButton onClick={place} disabled={!profile || errors.length > 0}>Place node</ActionButton></footer>
  </section></div>;
}
