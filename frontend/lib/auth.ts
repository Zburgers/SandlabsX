// Authentication utility functions

export interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

// Check if user is authenticated by checking for token
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') {
    return false; // Server-side, can't check authentication
  }

  const token = localStorage.getItem('token');
  return !!token;
}

// Get current user from localStorage
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') {
    return null; // Server-side, can't access localStorage
  }

  const userStr = localStorage.getItem('user');
  if (!userStr) {
    return null;
  }

  try {
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Failed to parse user data:', error);
    return null;
  }
}

// Get JWT token
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem('token');
}

// Set authentication data
export function setAuthData(token: string, user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }
}

// Clear authentication data
export function clearAuthData(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

// Get user profile from backend API
export async function fetchUserProfile(): Promise<AuthResponse> {
  const token = getAuthToken();

  if (!token) {
    return {
      success: false,
      error: 'No authentication token found'
    };
  }

  try {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');
    const response = await fetch(`${baseUrl}/api/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      clearAuthData();
      return {
        success: false,
        error: data.error || 'Failed to fetch user profile'
      };
    }

    if (data.user) {
      // Update user in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      return {
        success: true,
        user: data.user
      };
    } else {
      return {
        success: false,
        error: 'User data not found in response'
      };
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    clearAuthData();
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}