'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, fetchUserProfile } from '../lib/auth';

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      if (isAuthenticated()) {
        // Verify token is still valid
        const result = await fetchUserProfile();
        if (result.success) {
          // User is authenticated, redirect to dashboard
          router.push('/');
        } else {
          // Token is invalid, redirect to auth
          router.push('/auth');
        }
      } else {
        // Not authenticated, redirect to auth
        router.push('/auth');
      }
    };

    checkAuthAndRedirect();
  }, [router]);

  return (
    <div className="min-h-screen bg-lab-darker grid-pattern flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lab-primary mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}