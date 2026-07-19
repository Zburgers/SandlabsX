'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AccountIcon, AssignmentIcon, CapsuleIcon, CloseIcon, DashboardIcon, ImageIcon, MenuIcon, ScenarioIcon } from '../icons';

const destinations = [
  { href: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { href: '/capsules', label: 'Capsules', icon: CapsuleIcon },
  { href: '/scenarios', label: 'Scenarios', icon: ScenarioIcon },
  { href: '/assignments', label: 'Assignments', icon: AssignmentIcon },
  { href: '/images', label: 'Images', icon: ImageIcon },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return <nav aria-label="Workspace navigation" className="flex flex-col gap-1.5">
    {destinations.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`group flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] border px-3.5 text-sm font-medium transition ${active ? 'border-[var(--border-strong)] bg-[var(--surface-strong)] text-ink' : 'border-transparent text-[var(--ink-soft)] hover:bg-[var(--surface-raised)] hover:text-ink'}`}>
        <Icon className={active ? 'text-accent' : 'text-[var(--muted)] group-hover:text-accent'} />{label}
      </Link>;
    })}
  </nav>;
}

export function WorkspaceNav({ pathname, compact = false }: { pathname: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (compact) return <>
    <button type="button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(value => !value)} className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-ink">{open ? <CloseIcon /> : <MenuIcon />}</button>
    {open && <div className="fixed inset-x-3 top-[4.75rem] z-50 surface-raised rounded-[var(--radius-lg)] p-3"><NavLinks pathname={pathname} onNavigate={() => setOpen(false)} /><Link href="/account/settings" onClick={() => setOpen(false)} className="mt-3 flex min-h-11 items-center gap-3 border-t border-border px-3.5 pt-3 text-sm text-[var(--ink-soft)]"><AccountIcon />Account settings</Link></div>}
  </>;
  return <div className="flex h-full flex-col">
    <NavLinks pathname={pathname} />
    <div className="mt-auto border-t border-border pt-4">
      <div className="mb-3 flex items-center gap-2 px-3 text-xs text-[var(--muted)]"><span className="h-1.5 w-1.5 bg-success" aria-hidden />local environment</div>
      <Link href="/account/settings" className="flex min-h-11 items-center gap-3 rounded-md px-3.5 text-sm text-[var(--ink-soft)] transition hover:bg-[var(--surface-raised)] hover:text-ink"><AccountIcon />Account settings</Link>
    </div>
  </div>;
}
