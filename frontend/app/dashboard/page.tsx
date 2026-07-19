'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CapsuleList } from '../../components/capsules/CapsuleList';
import { InstanceList } from '../../components/instances/InstanceList';
import { CapacitySummary } from '../../components/capacity/CapacitySummary';
import { PageHeader } from '../../components/ui/PageHeader';
import { SurfaceState } from '../../components/ui/SurfaceState';
import { capsuleApi } from '../../lib/capsule-api';
import type { Capacity, CapsuleDraft } from '../../lib/capsule-types';

export default function DashboardPage() {
  const [capsules, setCapsules] = useState<CapsuleDraft[]>([]);
  const [capacity, setCapacity] = useState<Capacity>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all([capsuleApi.listDrafts(), capsuleApi.getCapacity()]).then(([nextCapsules, nextCapacity]) => { setCapsules(nextCapsules); setCapacity(nextCapacity); }).catch(error => setError(error.message)).finally(() => setLoading(false));
  }, []);

  return <div className="mx-auto max-w-[96rem] px-4 py-7 sm:px-7 sm:py-10 xl:px-10"><PageHeader eyebrow="Control room" title="Build labs you can reason about." description="Author exact topology in Capsules, validate before publication, and keep desired state separate from what the host has actually observed." actions={<Link href="/capsules" className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-[var(--accent-ink)]">Open Capsule workspace</Link>} />
    {loading ? <div className="mt-8"><SurfaceState tone="loading" title="Loading workstation state" detail="Reading your latest drafts and the host admission envelope." /></div> : error ? <div className="mt-8"><SurfaceState tone="error" title="Workstation state is unavailable" detail={error} /></div> : <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]"><CapsuleList capsules={capsules} compact /><div className="grid content-start gap-5"><CapacitySummary capacity={capacity} /><InstanceList instances={[]} /></div></div>}
    <section className="mt-5 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border md:grid-cols-3"><div className="bg-[var(--canvas-soft)] p-5"><p className="eyebrow">01 · author</p><p className="mt-3 text-sm text-[var(--ink-soft)]">Place exact workload profiles and declare interface-level links.</p></div><div className="bg-[var(--canvas-soft)] p-5"><p className="eyebrow">02 · validate</p><p className="mt-3 text-sm text-[var(--ink-soft)]">Resolve images, resource bounds, and topology errors before revisioning.</p></div><div className="bg-[var(--canvas-soft)] p-5"><p className="eyebrow">03 · operate</p><p className="mt-3 text-sm text-[var(--ink-soft)]">Compare desired topology with durable runtime observations.</p></div></section>
  </div>;
}
