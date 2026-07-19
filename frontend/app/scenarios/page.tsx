import Link from 'next/link';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusSignal } from '../../components/ui/StatusSignal';

export default function ScenariosPage() {
  return <div className="mx-auto max-w-[88rem] px-4 py-7 sm:px-7 sm:py-10 xl:px-10"><PageHeader eyebrow="Learning layer" title="Scenarios" description="Scenarios pin an exact Capsule revision and evaluate staged checks without changing the infrastructure document." />
    <section className="surface mt-8 grid gap-7 rounded-[var(--radius-lg)] p-6 md:grid-cols-[minmax(0,1fr)_16rem] md:p-8"><div><div className="flex items-center gap-3"><h2 className="text-xl font-semibold">Scenario catalogue</h2><StatusSignal label="list contract pending" tone="warning" /></div><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-soft)]">Published Scenario versions can already be opened by ID and rendered with durable attempt evidence. The service does not yet expose a list contract, so this page does not invent catalogue entries.</p></div><div className="border-l border-border pl-6"><p className="text-xs text-[var(--muted)]">Start from infrastructure</p><Link href="/capsules" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent">Open Capsules →</Link></div></section>
  </div>;
}
