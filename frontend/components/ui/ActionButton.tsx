import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function ActionButton({ children, icon, tone = 'primary', busy, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; tone?: 'primary' | 'secondary' | 'quiet' | 'danger'; busy?: boolean }) {
  const tones = {
    primary: 'border-accent bg-accent text-[var(--accent-ink)] hover:bg-[var(--accent-strong)]',
    secondary: 'border-[var(--border-strong)] bg-[var(--surface-raised)] text-ink hover:border-accent',
    quiet: 'border-transparent bg-transparent text-[var(--ink-soft)] hover:bg-[var(--surface-raised)] hover:text-ink',
    danger: 'border-[color:var(--danger)] bg-transparent text-danger hover:bg-[rgba(255,143,136,.1)]',
  };
  return <button {...props} disabled={props.disabled || busy} aria-busy={busy || undefined} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border px-4 py-2 text-sm font-semibold transition duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 ${tones[tone]} ${className}`}>
    {icon}<span>{busy ? 'Working…' : children}</span>
  </button>;
}
