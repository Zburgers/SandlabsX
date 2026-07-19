import Link from 'next/link';
import type { InstanceSummary } from '../../lib/capsule-types';
import { StatusSignal } from '../ui/StatusSignal';

export function InstanceList({ instances }: { instances: InstanceSummary[] }) {
  return <section className="surface rounded-[var(--radius-lg)] p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="eyebrow">runtime</p><h2 className="mt-2 text-lg font-semibold">Active instances</h2></div><span className="tabular text-2xl font-semibold">{instances.length}</span></div>{instances.length ? <ul className="mt-5 space-y-2">{instances.map(instance => <li key={instance.id}><Link href={`/instances/${instance.id}`} className="flex items-center justify-between rounded-md bg-[var(--surface-raised)] p-3 hover:bg-[var(--surface-strong)]"><span className="font-medium">{instance.name}</span><StatusSignal label={instance.observedState || instance.state} tone={(instance.observedState || instance.state) === 'RUNNING' ? 'success' : 'neutral'} /></Link></li>)}</ul> : <p className="mt-5 text-sm leading-6 text-[var(--ink-soft)]">No owned instances are exposed by the current service contract. Publish a Capsule revision before runtime admission.</p>}</section>;
}
