'use client';
import { useEffect, useState } from 'react';
import { CapsuleList } from '../../components/capsules/CapsuleList';
import { InstanceList } from '../../components/instances/InstanceList';
import { CapacitySummary } from '../../components/capacity/CapacitySummary';
import { capsuleApi } from '../../lib/capsule-api';
import type { CapsuleDraft } from '../../lib/capsule-types';
export default function DashboardPage() { const [capsules, setCapsules] = useState<CapsuleDraft[]>([]); const [error, setError] = useState<string>(); useEffect(() => { capsuleApi.listDrafts().then(setCapsules).catch(error => setError(error.message)); }, []); return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-8"><div className="mx-auto max-w-7xl"><header className="max-w-5xl"><p className="text-sm font-medium text-cyan-300">SandLabX workspace</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">Operate capsules with durable state.</h1><p className="mt-4 max-w-2xl text-slate-400">Draft topology, instance state, and operations remain separate so the console never overstates what the host has observed.</p></header>{error && <p role="alert" className="mt-6 rounded border border-red-400/50 p-3 text-red-200">{error}</p>}<div className="mt-12 grid grid-flow-dense gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"><CapsuleList capsules={capsules} /><InstanceList instances={[]} /><CapacitySummary /></div></div></main>; }
