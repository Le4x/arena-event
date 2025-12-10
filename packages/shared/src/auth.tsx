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

export function AuthGuard({
  children,
  allowedRoles = ['SUPER_ADMIN', 'ORGANIZER'],
  redirectUrl = 'https://admin.arena-event.fr'
}: AuthGuardProps) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      // No authentication, redirect to admin
      window.location.href = redirectUrl;
      return;
    }

    try {
      const user: User = JSON.parse(userStr);

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
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    window.location.href = 'https://admin.arena-event.fr';
  };

  return { user, token, logout };
}
