'use client';

export default function StudioHome() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-blue-400">🎮 Arena Event Studio</h1>
          <p className="text-gray-400 mt-2">Game Master Control Panel</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Session Selection */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">📡 Active Sessions</h2>
            <p className="text-gray-400">No sessions available. Create one in Admin panel.</p>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">⚡ Quick Actions</h2>
            <div className="space-y-3">
              <button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-md transition">
                Start Question
              </button>
              <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3 px-4 rounded-md transition">
                Show Leaderboard
              </button>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-md transition">
                End Question
              </button>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="mt-6 bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">🎯 Control Panel</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-700 rounded p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">0</div>
              <div className="text-sm text-gray-400 mt-1">Teams Connected</div>
            </div>
            <div className="bg-gray-700 rounded p-4 text-center">
              <div className="text-3xl font-bold text-green-400">0</div>
              <div className="text-sm text-gray-400 mt-1">Answers Received</div>
            </div>
            <div className="bg-gray-700 rounded p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">--</div>
              <div className="text-sm text-gray-400 mt-1">Current Question</div>
            </div>
            <div className="bg-gray-700 rounded p-4 text-center">
              <div className="text-3xl font-bold text-purple-400">LOBBY</div>
              <div className="text-sm text-gray-400 mt-1">Status</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
