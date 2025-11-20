'use client';

import { useState } from 'react';

export default function PlayerHome() {
  const [sessionCode, setSessionCode] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement join logic
    console.log('Joining session:', sessionCode);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">🎮</h1>
          <h2 className="text-3xl font-bold text-white">Arena Event</h2>
          <p className="text-blue-100 mt-2">Join the game!</p>
        </div>

        {/* Join Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">
                Session Code
              </label>
              <input
                type="text"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-4 text-2xl text-center font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 uppercase tracking-widest"
                placeholder="ABC123"
                maxLength={6}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-4 px-6 rounded-xl shadow-lg transition duration-200 active:scale-95"
            >
              Join Game
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Enter the 6-character code shown on screen
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/20 backdrop-blur rounded-lg p-4">
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-xs text-white font-semibold">Fast & Fun</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-lg p-4">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-xs text-white font-semibold">Real-time</div>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-lg p-4">
            <div className="text-3xl mb-2">🏆</div>
            <div className="text-xs text-white font-semibold">Compete</div>
          </div>
        </div>
      </div>
    </main>
  );
}
