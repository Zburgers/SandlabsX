import type { ReactNode } from 'react';

export function SurfaceState({ title, detail, action, tone = 'neutral' }: { title: string; detail: string; action?: ReactNode; tone?: 'neutral' | 'error' | 'loading' }) {
  return <section role={tone === 'error' ? 'alert' : tone === 'loading' ? 'status' : undefined} aria-live={tone === 'loading' ? 'polite' : undefined} className="surface rounded-[var(--radius-lg)] p-6 sm:p-8">
    <div className={`mb-5 h-1 w-10 ${tone === 'error' ? 'bg-danger' : tone === 'loading' ? 'animate-pulse bg-[var(--info)]' : 'bg-accent'}`} />
    <h2 className="text-lg font-semibold tracking-[-0.02em]">{title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ink-soft)]">{detail}</p>{action && <div className="mt-5">{action}</div>}
  </section>;
}
