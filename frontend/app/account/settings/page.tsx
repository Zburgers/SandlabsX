'use client';

import { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { apiClient } from '../../../lib/api';

export default function AccountSettingsPage() {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');
      const response = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Password changed successfully');
        setError('');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to change password');
        setMessage('');
      }
    } catch (err) {
      setError('Failed to change password');
      setMessage('');
    }
  };

  if (!user) {
    // This shouldn't happen if the layout is properly protecting this route, but just in case
    return (
      <div className="min-h-screen bg-lab-darker grid-pattern flex items-center justify-center">
        <div className="bg-lab-gray rounded-xl p-8 max-w-md w-full mx-4 border border-lab-gray-light">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-4">Access Denied</h2>
            <p className="text-gray-400 mb-6">Please log in to access account settings.</p>
            <button
              onClick={() => window.location.href = '/auth'}
              className="px-4 py-2 bg-lab-primary hover:bg-lab-primary/80 text-white rounded-lg transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lab-darker grid-pattern">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Account Settings</h1>
          <p className="text-gray-400">Manage your account information and security settings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-lab-gray rounded-xl p-6 border border-lab-gray-light">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-lab-primary to-lab-secondary flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-white">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-white">{user.email}</h2>
                <p className="text-gray-400 capitalize mt-1">{user.role}</p>
                <p className="text-sm text-gray-500 mt-2">Member since {new Date(user.createdAt).toLocaleDateString()}</p>
              </div>

              <div className="mt-6 space-y-2">
                <button className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-lab-gray-light rounded-lg transition-colors">
                  Profile Information
                </button>
                <button className="w-full text-left px-4 py-3 text-sm text-lab-primary bg-lab-gray-light rounded-lg">
                  Security & Password
                </button>
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-3 text-sm text-lab-danger hover:bg-lab-danger/10 rounded-lg transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-lab-gray rounded-xl p-6 border border-lab-gray-light">
              <h2 className="text-xl font-semibold text-white mb-6">Security & Password</h2>

              {message && (
                <div className="bg-lab-success/20 border border-lab-success rounded-lg p-4 mb-6">
                  <p className="text-lab-success">{message}</p>
                </div>
              )}

              {error && (
                <div className="bg-lab-danger/20 border border-lab-danger rounded-lg p-4 mb-6">
                  <p className="text-lab-danger">{error}</p>
                </div>
              )}

              <form onSubmit={handlePasswordChange}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-lab-darker border border-lab-gray-light rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-lab-primary focus:border-transparent"
                    placeholder="Enter your current password"
                    required
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-lab-darker border border-lab-gray-light rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-lab-primary focus:border-transparent"
                    placeholder="Enter your new password"
                    required
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">Password must be at least 8 characters</p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-lab-darker border border-lab-gray-light rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-lab-primary focus:border-transparent"
                    placeholder="Confirm your new password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-3 bg-lab-primary hover:bg-lab-primary/80 text-white rounded-lg font-medium transition-colors"
                >
                  Change Password
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}