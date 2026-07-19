import type { Capacity } from '../../lib/capsule-types';
import { StatusSignal } from '../ui/StatusSignal';

export function CapacitySummary({ capacity }: { capacity?: Capacity }) {
  return <section className="surface rounded-[var(--radius-lg)] p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">admission</p><h2 className="mt-2 text-lg font-semibold tracking-[-0.025em]">Host capacity</h2></div>{capacity && <StatusSignal label={capacity.admission.toLowerCase()} tone={capacity.admission === 'AVAILABLE' ? 'success' : capacity.admission === 'LIMITED' ? 'warning' : 'danger'} />}</div>
    {capacity ? <dl className="mt-8 grid grid-cols-3 gap-3">
      <div><dt className="text-xs text-[var(--muted)]">compute</dt><dd className="mt-1 text-sm font-semibold tabular">{capacity.availableVcpus} vCPU available</dd></div>
      <div><dt className="text-xs text-[var(--muted)]">memory</dt><dd className="mt-1 text-sm font-semibold tabular">{Math.round(capacity.availableMemoryMiB / 1024)} GiB available</dd></div>
      <div><dt className="text-xs text-[var(--muted)]">storage</dt><dd className="mt-1 text-sm font-semibold tabular">{capacity.availableDiskGiB} GiB available</dd></div>
    </dl> : <p className="mt-5 text-sm leading-6 text-[var(--ink-soft)]">Capacity is unavailable. Capsule authoring remains available, but runtime admission cannot be estimated.</p>}
  </section>;
}
