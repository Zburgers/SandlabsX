'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, fetchUserProfile } from '../lib/auth';
export default function RedirectPage() { const router = useRouter(); useEffect(() => { if (!isAuthenticated()) { router.replace('/auth'); return; } fetchUserProfile().then(result => router.replace(result.success ? '/dashboard' : '/auth')); }, []); return <main className="grid min-h-screen place-items-center"><p role="status" className="text-sm text-[var(--ink-soft)]">Opening SandLabX…</p></main>; }
