'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { CapsuleIcon } from '../icons';
import { WorkspaceNav } from './WorkspaceNav';

const publicRoutes = new Set(['/auth', '/redirect']);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();
  const isPublic = publicRoutes.has(pathname);

  useEffect(() => {
    if (!isPublic && !loading && !isAuthenticated) {
      localStorage.setItem('redirectAfterLogin', pathname);
      router.replace('/auth');
    }
  }, [isAuthenticated, isPublic, loading, pathname, router]);

  if (isPublic) return <>{children}</>;
  if (loading || !isAuthenticated) return <main className="grid min-h-screen place-items-center px-5"><div role="status" className="surface w-full max-w-sm rounded-[var(--radius-lg)] p-7"><div className="h-1 w-12 animate-pulse bg-accent" /><p className="mt-5 font-medium">Opening your workstation</p><p className="mt-2 text-sm text-[var(--ink-soft)]">Verifying the current session…</p></div></main>;

  return <div className="min-h-screen lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
    <a href="#main-content" className="sr-only z-[60] rounded-md bg-accent px-4 py-2 font-semibold text-[var(--accent-ink)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] border-r border-border bg-[rgba(8,13,18,.94)] p-4 backdrop-blur-xl lg:block">
      <Link href="/dashboard" className="mb-8 flex items-center gap-3 px-2 py-2"><span className="grid h-9 w-9 place-items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface-raised)] text-accent"><CapsuleIcon /></span><span><strong className="block tracking-[-0.03em]">SandLabX</strong><span className="block text-[0.67rem] uppercase tracking-[.16em] text-[var(--muted)]">capsule workstation</span></span></Link>
      <WorkspaceNav pathname={pathname} />
    </aside>
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center justify-between border-b border-border bg-[rgba(8,13,18,.9)] px-4 backdrop-blur-xl lg:hidden"><Link href="/dashboard" className="flex items-center gap-2 font-semibold"><CapsuleIcon className="text-accent" />SandLabX</Link><WorkspaceNav pathname={pathname} compact /></header>
    <main id="main-content" tabIndex={-1} className="min-w-0">{children}</main>
  </div>;
}
