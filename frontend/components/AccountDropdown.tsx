'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '../lib/auth';

interface AccountDropdownProps {
  user: User;
}

export function AccountDropdown({ user }: AccountDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Reload the page to trigger re-authentication
      window.location.href = '/auth';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-full bg-lab-gray hover:bg-lab-gray-light transition-colors focus:outline-none focus:ring-2 focus:ring-lab-primary"
        aria-label="Account menu"
        aria-expanded={isOpen}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lab-primary to-lab-secondary flex items-center justify-center text-sm font-semibold text-white">
          {user.email.charAt(0).toUpperCase()}
        </div>
        <span className="hidden md:block text-sm text-gray-300 truncate max-w-[100px]">
          {user.email}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-lab-gray border border-lab-gray-light rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-lab-gray-light">
            <p className="text-sm font-medium text-white truncate">{user.email}</p>
            {user.role && (
              <p className="text-xs text-lab-accent mt-1 capitalize">{user.role}</p>
            )}
          </div>
          
          <div className="py-1">
            <button
              onClick={() => {
                router.push('/account/settings');
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-lab-gray-light hover:text-white transition-colors"
            >
              Account Settings
            </button>
          </div>
          
          <div className="border-t border-lab-gray-light">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-lab-danger hover:bg-lab-danger/10 hover:text-lab-danger transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}