'use client';

import React from 'react';

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function ConnectionStatus({
  isConnected,
  isConnecting = false,
  error = null,
  onRetry,
  className = '',
}: ConnectionStatusProps) {
  // Connected state - minimal indicator
  if (isConnected && !error) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-green-600 text-sm font-medium">Connecté</span>
      </div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <svg className="w-4 h-4 animate-spin text-yellow-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-yellow-600 text-sm font-medium">Connexion en cours...</span>
      </div>
    );
  }

  // Disconnected/Error state with retry
  return (
    <div className={`bg-red-50 border border-red-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-red-800 font-medium">Connexion perdue</p>
          <p className="text-red-600 text-sm">{error || 'Impossible de joindre le serveur'}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex-shrink-0 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}

// Full-screen connection error overlay
interface ConnectionOverlayProps {
  isVisible: boolean;
  error?: string | null;
  onRetry?: () => void;
  retryCount?: number;
  maxRetries?: number;
}

export function ConnectionOverlay({
  isVisible,
  error = null,
  onRetry,
  retryCount = 0,
  maxRetries = 10,
}: ConnectionOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">Connexion perdue</h2>
        <p className="text-gray-600 mb-6">
          {error || 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.'}
        </p>

        {retryCount > 0 && (
          <p className="text-sm text-gray-500 mb-4">
            Tentative {retryCount}/{maxRetries}...
          </p>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105"
          >
            Réessayer la connexion
          </button>
        )}

        <p className="text-xs text-gray-400 mt-6">
          Si le problème persiste, contactez l'organisateur
        </p>
      </div>
    </div>
  );
}
