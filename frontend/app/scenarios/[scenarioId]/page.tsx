'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { ScenarioRunner } from '../../../components/scenarios/ScenarioRunner';
export default function ScenarioPage() { const { scenarioId } = useParams<{ scenarioId: string }>(); const instanceId = useSearchParams().get('instanceId') || ''; return <main className="min-h-screen bg-slate-950 p-5 text-slate-100"><div className="mx-auto max-w-3xl"><ScenarioRunner instanceId={instanceId} scenario={{ id: scenarioId, title: 'Scenario progress', stages: [] }} /><p className="mt-4 text-sm text-slate-400">Instructor console access, when granted, is visible to the student and recorded by the server audit trail.</p></div></main>; }
