'use client';

import { useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

interface AuthGuardProps {
  children: ReactNode;
  allowedRoles?: string[];
  redirectUrl?: string;
}

// Helper functions for cookies (shared across subdomains)
function setCookie(name: string, value: string, days = 7) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;domain=.arena-event.fr;SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.arena-event.fr`;
}

// Get auth data from both localStorage (fallback) and cookies
function getAuthData(): { token: string | null; user: User | null } {
  // Try cookies first (shared across subdomains)
  let token = getCookie('token');
  let userStr = getCookie('user');

  // Fallback to localStorage (for same domain)
  if (!token) token = localStorage.getItem('token');
  if (!userStr) userStr = localStorage.getItem('user');

  // Sync: if we have data in localStorage, copy to cookies for cross-domain sharing
  if (token && !getCookie('token')) {
    setCookie('token', token);
  }
  if (userStr && !getCookie('user')) {
    setCookie('user', userStr);
  }

  const user = userStr ? JSON.parse(userStr) : null;
  return { token, user };
}

export function AuthGuard({
  children,
  allowedRoles = ['SUPER_ADMIN', 'ORGANIZER'],
  redirectUrl = 'https://admin.arena-event.fr'
}: AuthGuardProps) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { token, user } = getAuthData();

    if (!token || !user) {
      // No authentication, redirect to admin with return URL
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `${redirectUrl}?redirect=${returnUrl}`;
      return;
    }

    try {
      // Check if user has allowed role
      if (!allowedRoles.includes(user.role)) {
        alert(`Accès refusé. Rôle requis : ${allowedRoles.join(' ou ')}`);
        window.location.href = redirectUrl;
        return;
      }

      setIsAuthorized(true);
    } catch (error) {
      console.error('Auth error:', error);
      window.location.href = redirectUrl;
    } finally {
      setIsLoading(false);
    }
  }, [allowedRoles, redirectUrl]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🔐</div>
          <p className="text-white text-xl">Vérification...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const authData = getAuthData();
    setToken(authData.token);
    setUser(authData.user);
  }, []);

  const logout = () => {
    // Clear both localStorage and cookies
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    deleteCookie('token');
    deleteCookie('user');
    setToken(null);
    setUser(null);
    window.location.href = 'https://admin.arena-event.fr';
  };

  return { user, token, logout };
}

// Helper to save auth data (called from admin after login)
export function saveAuthData(token: string, user: User) {
  // Save to both localStorage and cookies
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  setCookie('token', token);
  setCookie('user', JSON.stringify(user));
}
