'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';
import { isAuthenticated, fetchUserProfile, readApiJson } from '../../lib/auth';
import { CapsuleIcon } from '../../components/icons';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (isAuthenticated()) fetchUserProfile().then(result => { if (result.success) router.push('/dashboard'); }); }, []);
  const switchMode = () => { setIsLogin(value => !value); setError(null); setPassword(''); };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setIsLoading(true); setError(null);
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');
    try {
      const response = await fetch(`${baseUrl}${isLogin ? '/api/auth/login' : '/api/auth/register'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await readApiJson(response);
      if (!response.ok) throw new Error(data.error || 'Authentication failed');
      localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
      const destination = localStorage.getItem('redirectAfterLogin') || '/dashboard'; localStorage.removeItem('redirectAfterLogin'); router.push(destination === '/' ? '/dashboard' : destination);
    } catch (value) { setError(value instanceof Error ? value.message : 'Authentication failed'); } finally { setIsLoading(false); }
  };

  return <main className={styles.page}><section className={styles.context} aria-label="SandLabX product summary"><div className={styles.brand}><span className={styles.mark}><CapsuleIcon width={24} height={24} /></span><span>SandLabX</span></div><div className={styles.contextBody}><p className="eyebrow">capsule workstation</p><h2>Design the network.<br />Know what will run.</h2><p>Author exact-version workloads, allocate host resources, wire declared interfaces, and validate topology before it reaches QEMU.</p><div className={styles.topology} aria-hidden="true"><span>edge-01</span><i /><span>core-01</span><i /><span>client-01</span></div></div><p className={styles.contextFooter}>Self-hosted · isolated by default · revisioned</p></section>
    <section className={styles.authPanel}><div className={styles.formWrap}><p className="eyebrow">{isLogin ? 'Welcome back' : 'New workspace account'}</p><h1>{isLogin ? 'Sign in to SandLabX' : 'Create your account'}</h1><p className={styles.intro}>{isLogin ? 'Continue to your Capsule workspace and runtime console.' : 'Create a student account. Administrators manage elevated roles separately.'}</p>{error && <div className={styles.error} role="alert">{error}</div>}<form onSubmit={handleSubmit} className={styles.form} noValidate><label htmlFor="auth-email">Email address</label><input id="auth-email" className="field" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /><label htmlFor="auth-password">Password</label><input id="auth-password" className="field" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} /><button type="submit" className={styles.submit} disabled={isLoading}>{isLoading ? 'Connecting…' : isLogin ? 'Sign in' : 'Create account'}</button></form><div className={styles.switcher}><span>{isLogin ? 'Need an account?' : 'Already registered?'}</span><button type="button" onClick={switchMode}>{isLogin ? 'Create account' : 'Sign in instead'}</button></div><p className={styles.help}>Your session is stored in this browser. Do not use shared machines for administrator access.</p></div></section>
  </main>;
}
