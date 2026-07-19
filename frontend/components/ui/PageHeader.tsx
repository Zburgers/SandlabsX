import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="flex flex-col gap-6 border-b border-border pb-7 md:flex-row md:items-end md:justify-between">
    <div><p className="eyebrow">{eyebrow}</p><h1 className="mt-3 max-w-4xl text-balance text-[clamp(2rem,4vw,3.55rem)] font-semibold leading-[1.02] tracking-[-0.055em]">{title}</h1><p className="mt-4 max-w-2xl text-pretty text-sm leading-6 text-[var(--ink-soft)] sm:text-base">{description}</p></div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </header>;
}
