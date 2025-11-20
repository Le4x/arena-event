'use client';

export default function ScreenHome() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-8xl font-bold text-white mb-4 animate-pulse">
          🎮 Arena Event
        </h1>
        <p className="text-4xl text-blue-300">Public Display Screen</p>
      </div>

      {/* Session Info */}
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 text-center max-w-4xl">
        <div className="mb-8">
          <div className="text-2xl text-gray-300 mb-4">Join the game at</div>
          <div className="text-6xl font-bold text-white mb-2">arena-event.com</div>
          <div className="text-3xl text-gray-300">Session Code:</div>
          <div className="text-9xl font-black text-yellow-400 mt-4 tracking-wider">
            ABC123
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/20">
          <div className="text-3xl text-gray-300 mb-4">Status</div>
          <div className="inline-block bg-yellow-500 text-black px-8 py-4 rounded-full text-4xl font-bold">
            WAITING FOR PLAYERS
          </div>
        </div>
      </div>

      {/* Connected Teams Counter */}
      <div className="mt-16 flex gap-8">
        <div className="bg-white/10 backdrop-blur rounded-2xl px-8 py-6 text-center">
          <div className="text-6xl font-bold text-green-400">0</div>
          <div className="text-xl text-gray-300 mt-2">Teams Connected</div>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-2xl px-8 py-6 text-center">
          <div className="text-6xl font-bold text-blue-400">0</div>
          <div className="text-xl text-gray-300 mt-2">Questions</div>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-2xl px-8 py-6 text-center">
          <div className="text-6xl font-bold text-purple-400">0</div>
          <div className="text-xl text-gray-300 mt-2">Rounds</div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-gray-500 text-xl">
        Powered by Arena Event Platform
      </div>
    </main>
  );
}
