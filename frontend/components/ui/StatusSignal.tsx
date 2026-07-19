export function StatusSignal({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  const colors = { neutral: 'bg-[var(--muted)]', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-[var(--info)]' };
  return <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--ink-soft)]"><span aria-hidden className={`h-1.5 w-1.5 rotate-45 ${colors[tone]}`} />{label}</span>;
}
