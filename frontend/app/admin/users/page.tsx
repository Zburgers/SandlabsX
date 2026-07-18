'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminUser, apiClient } from '../../../lib/api';
import { clearAuthData } from '../../../lib/auth';
import { useAuth } from '../../../hooks/useAuth';

const roleLabels = { admin: 'Administrator', instructor: 'Instructor', student: 'Student' } as const;

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'student' });

  useEffect(() => {
    if (!loading && user?.role !== 'admin') router.replace('/?forbidden=admin-users');
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === 'admin') void loadUsers();
  }, [user, page, role, status]);

  async function loadUsers() {
    const result = await apiClient.listUsers({ page, search, role, status });
    if (result.success && result.data) {
      setUsers(result.data.users);
      setPagination(result.data.pagination);
      setRequiresPasswordChange(false);
      setMessage('');
      return;
    }
    if (result.error?.toLowerCase().includes('password')) {
      setRequiresPasswordChange(true);
      setMessage('');
    } else if (result.error?.toLowerCase().includes('authentication') || result.error?.toLowerCase().includes('token')) {
      clearAuthData();
      router.replace('/auth');
    } else {
      setMessage(result.error || 'Unable to load users');
    }
  }

  async function runAction(result: Promise<{ success: boolean; error?: string; data?: any }>, keepTemporaryPassword = false) {
    const response = await result;
    if (!response.success) {
      setMessage(response.error || 'Action failed');
      return;
    }
    setMessage('Changes saved');
    if (!keepTemporaryPassword) setTemporaryPassword('');
    await loadUsers();
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(apiClient.createUser(newUser));
    setNewUser({ email: '', password: '', role: 'student' });
  }

  if (loading) return <PageShell><LoadingState /></PageShell>;
  if (user?.role !== 'admin') return <PageShell><ForbiddenState /></PageShell>;

  return (
    <PageShell>
      <header className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Administration</p>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-white">User directory</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Manage access across your SandLabX workspace. Account changes revoke existing sessions immediately.</p>
        </div>
        <button onClick={() => router.push('/')} className="self-start rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-300/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/60">Back to dashboard</button>
      </header>

      {requiresPasswordChange && (
        <section className="mt-7 flex flex-col gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-5 md:flex-row md:items-center md:justify-between" role="alert">
          <div><p className="font-medium text-amber-100">Password change required</p><p className="mt-1 text-sm text-amber-100/70">Finish securing the bootstrap account before opening the user directory.</p></div>
          <button onClick={() => router.push('/account/settings?required=1')} className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200/70">Open security settings</button>
        </section>
      )}

      {message && <p role="status" className="mt-6 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm text-cyan-100">{message}</p>}

      <section className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="User totals">
        <Summary label="Total accounts" value={pagination.total} />
        <Summary label="Active" value={users.filter(account => account.isActive).length} />
        <Summary label="Administrators" value={users.filter(account => account.role === 'admin').length} />
      </section>

      <section className="mt-7 rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/20 md:p-6">
        <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Provisioning</p><h2 className="mt-1 text-lg font-semibold text-white">Create an account</h2></div><span className="hidden rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-500 sm:block">Credentials are never shown again</span></div>
        <form onSubmit={createUser} autoComplete="off" className="grid gap-3 lg:grid-cols-[1.4fr_1fr_0.8fr_auto]">
          <input required type="email" placeholder="name@company.com" aria-label="New user email" autoComplete="off" value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })} className="field" />
          <input required minLength={8} type="password" placeholder="Temporary password" aria-label="New user password" autoComplete="new-password" value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })} className="field" />
          <select value={newUser.role} aria-label="New user role" onChange={event => setNewUser({ ...newUser, role: event.target.value })} className="field"><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Administrator</option></select>
          <button className="rounded-lg bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200/70">Create account</button>
        </form>
      </section>

      <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-slate-950/20">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 md:flex-row md:items-end md:justify-between md:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Directory</p><h2 className="mt-1 text-lg font-semibold text-white">All users <span className="ml-2 font-mono text-sm font-normal text-slate-500">{pagination.total}</span></h2></div><div className="flex flex-wrap gap-2"><input aria-label="Search users" placeholder="Search email" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => event.key === 'Enter' && void loadUsers()} className="field w-48" /><select aria-label="Role filter" value={role} onChange={event => { setPage(1); setRole(event.target.value); }} className="field"><option value="">All roles</option><option value="admin">Administrators</option><option value="instructor">Instructors</option><option value="student">Students</option></select><select aria-label="Status filter" value={status} onChange={event => { setPage(1); setStatus(event.target.value); }} className="field"><option value="">All status</option><option value="active">Active</option><option value="disabled">Disabled</option></select><button onClick={() => void loadUsers()} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-300/50 hover:text-white">Refresh</button></div></div>
        {users.length === 0 ? <EmptyState hasFilters={Boolean(search || role || status)} onReset={() => { setSearch(''); setRole(''); setStatus(''); setPage(1); }} /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-500"><th className="px-6 py-4">Account</th><th className="px-4 py-4">Role</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Created</th><th className="px-6 py-4 text-right">Actions</th></tr></thead><tbody>{users.map(account => <UserRow key={account.id} account={account} currentUserId={user.id} onRoleChange={roleValue => void runAction(apiClient.updateUserRole(account.id, roleValue))} onStatusChange={active => void runAction(apiClient.updateUserStatus(account.id, active))} onReset={async () => { await runAction(apiClient.resetUserPassword(account.id).then(response => { if (response.success && response.data) setTemporaryPassword(response.data.temporaryPassword); return response; }), true); }} />)}</tbody></table></div>}
        {temporaryPassword && <div className="m-5 flex flex-col gap-3 rounded-xl border border-amber-300/30 bg-amber-300/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-amber-100">Temporary password</p><p className="text-xs text-amber-100/60">Copy this now. It will disappear when you leave or clear it.</p></div><div className="flex items-center gap-3"><code className="rounded-md bg-slate-950 px-3 py-2 font-mono text-sm text-amber-200">{temporaryPassword}</code><button onClick={() => setTemporaryPassword('')} className="text-xs text-slate-400 hover:text-white">Clear</button></div></div>}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 text-sm text-slate-400"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30">Previous</button><span className="font-mono text-xs">Page {pagination.page} / {Math.max(1, pagination.totalPages)}</span><button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30">Next</button></div>
      </section>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#080d14] px-5 py-8 text-white md:px-10 md:py-12"><div className="mx-auto max-w-[1320px]">{children}</div></main>; }
function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-white/10 bg-slate-900/60 px-5 py-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-2 font-mono text-2xl tabular-nums text-white">{value}</p></div>; }
function LoadingState() { return <div className="space-y-5"><div className="h-4 w-28 animate-pulse rounded bg-slate-800" /><div className="h-12 w-72 animate-pulse rounded bg-slate-800" /><div className="h-56 animate-pulse rounded-2xl bg-slate-900" /></div>; }
function ForbiddenState() { return <div className="rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-8"><p className="text-xs uppercase tracking-[0.18em] text-red-200/70">403 Forbidden</p><h1 className="mt-2 text-2xl font-semibold">Administrator access required</h1><p className="mt-2 text-sm text-slate-400">This directory is limited to administrators.</p></div>; }
function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) { return <div className="px-6 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] font-mono text-cyan-200">∅</div><h3 className="mt-4 text-base font-semibold text-white">{hasFilters ? 'No matching users' : 'No additional users yet'}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{hasFilters ? 'Try a different search or clear the filters.' : 'The bootstrap administrator is the first account. Create an instructor or student above to begin.'}</p>{hasFilters && <button onClick={onReset} className="mt-5 text-sm text-cyan-200 hover:text-cyan-100">Clear filters</button>}</div>; }
function UserRow({ account, currentUserId, onRoleChange, onStatusChange, onReset }: { account: AdminUser; currentUserId: string; onRoleChange: (role: string) => void; onStatusChange: (active: boolean) => void; onReset: () => void }) { const isSelf = account.id === currentUserId; return <tr className="border-b border-white/[0.07] transition hover:bg-white/[0.025]"><td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-300/10 font-semibold text-cyan-200">{account.email.charAt(0).toUpperCase()}</div><div><p className="font-medium text-slate-100">{account.email}</p>{isSelf && <p className="mt-0.5 text-xs text-cyan-300/70">You · protected account</p>}</div></div></td><td className="px-4 py-4"><select disabled={isSelf} value={account.role} aria-label={`Role for ${account.email}`} onChange={event => onRoleChange(event.target.value)} className="field w-36 disabled:cursor-not-allowed disabled:opacity-50">{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="px-4 py-4"><span className={`inline-flex items-center gap-2 text-sm ${account.isActive ? 'text-emerald-300' : 'text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${account.isActive ? 'bg-emerald-300' : 'bg-slate-600'}`} />{account.isActive ? 'Active' : 'Disabled'}</span></td><td className="px-4 py-4 font-mono text-xs text-slate-500">{new Date(account.createdAt).toLocaleDateString()}</td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-3 text-sm"><button disabled={isSelf} onClick={() => { if (confirm(`${account.isActive ? 'Disable' : 'Enable'} ${account.email}?`)) onStatusChange(!account.isActive); }} className="text-slate-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30">{account.isActive ? 'Disable' : 'Enable'}</button><button onClick={() => { if (confirm(`Issue a temporary password for ${account.email}?`)) onReset(); }} className="text-amber-200 transition hover:text-amber-100">Reset password</button></div></td></tr>; }
