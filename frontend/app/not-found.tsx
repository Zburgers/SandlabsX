import Link from 'next/link';
import { CapsuleIcon } from '../components/icons';

export default function NotFound() {
  return <div className="grid min-h-[calc(100dvh-var(--topbar-height))] place-items-center px-5"><section className="surface max-w-xl rounded-[var(--radius-lg)] p-8"><CapsuleIcon className="text-accent" width={32} height={32} /><p className="eyebrow mt-7">404 · route unavailable</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">This workstation surface does not exist.</h1><p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">Return to the dashboard or open your Capsule workspace. No persistent state was changed.</p><div className="mt-7 flex gap-3"><Link className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-[var(--accent-ink)]" href="/dashboard">Dashboard</Link><Link className="inline-flex min-h-11 items-center rounded-md border border-[var(--border-strong)] px-4 text-sm font-semibold" href="/capsules">Capsules</Link></div></section></div>;
}
