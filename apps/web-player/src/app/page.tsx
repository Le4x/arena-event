'use client';

import { useState, useEffect } from 'react';

const API_URL = 'http://91.134.135.247:3001';

type GameState = 'JOIN' | 'TEAM_SELECT' | 'LOBBY' | 'QUESTION' | 'BUZZER' | 'WAITING' | 'RESULT' | 'LEADERBOARD' | 'FINISHED';

interface Question {
  text: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'BUZZER' | 'TEXT';
  options?: string[];
  timeLimit: number;
}

export default function PlayerHome() {
  // Join state
  const [sessionCode, setSessionCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Game state
  const [gameState, setGameState] = useState<GameState>('JOIN');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [score, setScore] = useState(0);
  const [rank, setRank] = useState(1);
  const [totalTeams, setTotalTeams] = useState(5);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [buzzerPressed, setBuzzerPressed] = useState(false);
  const [buzzerRank, setBuzzerRank] = useState<number | null>(null);

  // Demo mode - simulate game flow
  const [demoMode, setDemoMode] = useState(false);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState === 'QUESTION' && timeRemaining > 0 && !hasAnswered) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setGameState('WAITING');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, timeRemaining, hasAnswered]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate joining
    setTimeout(() => {
      if (sessionCode.length === 6) {
        setGameState('TEAM_SELECT');
        setLoading(false);
      } else {
        setError('Invalid session code');
        setLoading(false);
      }
    }, 500);
  };

  const handleTeamJoin = () => {
    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }
    setGameState('LOBBY');
    setDemoMode(true);
  };

  const handleAnswer = (answer: string) => {
    if (hasAnswered) return;
    setSelectedAnswer(answer);
    setHasAnswered(true);
    setGameState('WAITING');

    // Simulate result after 2 seconds
    setTimeout(() => {
      const correct = answer === 'B'; // Demo: B is correct
      setIsCorrect(correct);
      if (correct) {
        setScore(prev => prev + 100);
      }
      setGameState('RESULT');
    }, 2000);
  };

  const handleBuzzer = () => {
    if (buzzerPressed) return;
    setBuzzerPressed(true);
    setBuzzerRank(Math.floor(Math.random() * 3) + 1); // Demo: random rank 1-3
    setGameState('WAITING');
  };

  // Demo: Start question after joining
  useEffect(() => {
    if (gameState === 'LOBBY' && demoMode) {
      const timer = setTimeout(() => {
        setCurrentQuestion({
          text: 'Quelle est la capitale de la France ?',
          type: 'MCQ',
          options: ['Lyon', 'Paris', 'Marseille', 'Bordeaux'],
          timeLimit: 30,
        });
        setTimeRemaining(30);
        setHasAnswered(false);
        setSelectedAnswer(null);
        setIsCorrect(null);
        setGameState('QUESTION');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState, demoMode]);

  // Join Screen
  if (gameState === 'JOIN') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="text-7xl mb-4 animate-bounce">🎮</div>
            <h1 className="text-4xl font-black text-white drop-shadow-lg">Arena Event</h1>
            <p className="text-purple-100 mt-2 text-lg">Join the game!</p>
          </div>

          {/* Join Form */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-6">
              <div>
                <label className="block text-lg font-bold text-gray-700 mb-3">
                  Session Code
                </label>
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-5 text-3xl text-center font-black border-3 border-gray-200 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-200 uppercase tracking-[0.3em] text-gray-800"
                  placeholder="XK7M2P"
                  maxLength={6}
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || sessionCode.length < 6}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-2xl font-bold py-5 px-6 rounded-2xl shadow-lg transition duration-200 transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Joining...
                  </span>
                ) : 'JOIN GAME'}
              </button>
            </form>

            <p className="text-center text-gray-500 mt-6 text-sm">
              Enter the 6-character code shown on screen
            </p>
          </div>

          {/* Features */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { icon: '⚡', label: 'Fast' },
              { icon: '🎯', label: 'Real-time' },
              { icon: '🏆', label: 'Compete' },
            ].map((item, idx) => (
              <div key={idx} className="bg-white/20 backdrop-blur rounded-xl p-4 text-center">
                <div className="text-3xl mb-1">{item.icon}</div>
                <div className="text-xs text-white font-semibold">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Team Selection Screen
  if (gameState === 'TEAM_SELECT') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">👥</div>
            <h1 className="text-3xl font-bold text-white">Enter Your Team Name</h1>
            <p className="text-purple-100 mt-2">Session: <span className="font-mono font-bold">{sessionCode}</span></p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-4 py-4 text-xl text-center font-bold border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-200"
                placeholder="Team Name"
                maxLength={20}
              />

              <div className="grid grid-cols-2 gap-3">
                {['Les Champions', 'Quiz Masters', 'Brain Storm', 'Team Rocket'].map((name) => (
                  <button
                    key={name}
                    onClick={() => setTeamName(name)}
                    className="bg-gray-100 hover:bg-purple-100 text-gray-700 py-3 px-4 rounded-xl transition text-sm font-medium"
                  >
                    {name}
                  </button>
                ))}
              </div>

              <button
                onClick={handleTeamJoin}
                disabled={!teamName.trim()}
                className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white text-xl font-bold py-5 px-6 rounded-2xl shadow-lg transition transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                JOIN AS {teamName || '...'}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Lobby Screen
  if (gameState === 'LOBBY') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8">
            <div className="text-6xl mb-4 animate-pulse">⏳</div>
            <h1 className="text-3xl font-bold text-white mb-2">Waiting for host...</h1>
            <p className="text-purple-200">The game will start soon!</p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500">Your Team</span>
              <span className="font-bold text-purple-600">{teamName}</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500">Session</span>
              <span className="font-mono font-bold text-gray-800">{sessionCode}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>
              <span className="flex items-center text-green-600 font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                Connected
              </span>
            </div>
          </div>

          <p className="text-purple-200 mt-8 text-sm">
            Get ready! The first question is coming...
          </p>
        </div>
      </main>
    );
  }

  // Question Screen
  if (gameState === 'QUESTION' && currentQuestion) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col">
        {/* Timer Header */}
        <header className={`p-4 text-center ${
          timeRemaining <= 5 ? 'bg-red-600 animate-pulse' :
          timeRemaining <= 10 ? 'bg-yellow-500' :
          'bg-purple-600'
        }`}>
          <div className="text-5xl font-black text-white">{timeRemaining}</div>
          <div className="text-white/80 text-sm">seconds remaining</div>
        </header>

        {/* Question */}
        <div className="flex-1 p-4 flex flex-col">
          <div className="bg-gray-800 rounded-2xl p-6 mb-4">
            <p className="text-white text-xl font-semibold text-center leading-relaxed">
              {currentQuestion.text}
            </p>
          </div>

          {/* MCQ Options */}
          {currentQuestion.type === 'MCQ' && currentQuestion.options && (
            <div className="grid grid-cols-1 gap-3 flex-1">
              {currentQuestion.options.map((option, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const colors = [
                  'from-red-500 to-red-600',
                  'from-blue-500 to-blue-600',
                  'from-yellow-500 to-yellow-600',
                  'from-green-500 to-green-600',
                ];
                const isSelected = selectedAnswer === letter;

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(letter)}
                    disabled={hasAnswered}
                    className={`bg-gradient-to-r ${colors[idx]} text-white font-bold py-6 px-6 rounded-2xl shadow-lg transition transform active:scale-95 disabled:opacity-70 ${
                      isSelected ? 'ring-4 ring-white scale-[1.02]' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-4 text-xl font-black">
                        {letter}
                      </span>
                      <span className="text-lg">{option}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* True/False Options */}
          {currentQuestion.type === 'TRUE_FALSE' && (
            <div className="grid grid-cols-2 gap-4 flex-1">
              <button
                onClick={() => handleAnswer('TRUE')}
                disabled={hasAnswered}
                className={`bg-gradient-to-br from-green-500 to-green-600 text-white font-black text-3xl py-8 rounded-2xl shadow-lg transition transform active:scale-95 ${
                  selectedAnswer === 'TRUE' ? 'ring-4 ring-white' : ''
                }`}
              >
                VRAI
              </button>
              <button
                onClick={() => handleAnswer('FALSE')}
                disabled={hasAnswered}
                className={`bg-gradient-to-br from-red-500 to-red-600 text-white font-black text-3xl py-8 rounded-2xl shadow-lg transition transform active:scale-95 ${
                  selectedAnswer === 'FALSE' ? 'ring-4 ring-white' : ''
                }`}
              >
                FAUX
              </button>
            </div>
          )}

          {/* Buzzer */}
          {currentQuestion.type === 'BUZZER' && (
            <div className="flex-1 flex items-center justify-center">
              <button
                onClick={handleBuzzer}
                disabled={buzzerPressed}
                className={`w-64 h-64 rounded-full shadow-2xl transition transform active:scale-90 ${
                  buzzerPressed
                    ? 'bg-gray-600'
                    : 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 animate-pulse'
                }`}
              >
                <span className="text-white text-4xl font-black">
                  {buzzerPressed ? 'BUZZED!' : 'BUZZ!'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Score Footer */}
        <footer className="bg-gray-800 p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-sm">Your Score</p>
              <p className="text-2xl font-bold text-purple-400">{score}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Rank</p>
              <p className="text-2xl font-bold text-yellow-400">#{rank}</p>
            </div>
          </div>
        </footer>
      </main>
    );
  }

  // Waiting Screen
  if (gameState === 'WAITING') {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-bounce">
            {selectedAnswer ? '✅' : buzzerPressed ? '🔔' : '⏳'}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {selectedAnswer ? 'Answer Submitted!' : buzzerPressed ? 'Buzzer Pressed!' : 'Time\'s Up!'}
          </h1>
          <p className="text-gray-400">Waiting for other players...</p>

          {selectedAnswer && (
            <div className="mt-8 bg-gray-800 rounded-2xl p-6">
              <p className="text-gray-400 mb-2">Your Answer</p>
              <p className="text-4xl font-bold text-purple-400">{selectedAnswer}</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Result Screen
  if (gameState === 'RESULT') {
    return (
      <main className={`min-h-screen flex flex-col items-center justify-center p-4 ${
        isCorrect ? 'bg-gradient-to-br from-green-600 to-teal-600' : 'bg-gradient-to-br from-red-600 to-orange-600'
      }`}>
        <div className="text-center">
          <div className="text-8xl mb-6">
            {isCorrect ? '🎉' : '😢'}
          </div>
          <h1 className="text-4xl font-black text-white mb-4">
            {isCorrect ? 'CORRECT!' : 'WRONG!'}
          </h1>

          {isCorrect && (
            <div className="bg-white/20 backdrop-blur rounded-2xl p-6 mb-6">
              <p className="text-white/80">Points Earned</p>
              <p className="text-5xl font-black text-white">+100</p>
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 mt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-500 text-sm">Total Score</p>
                <p className="text-3xl font-bold text-purple-600">{score}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-sm">Current Rank</p>
                <p className="text-3xl font-bold text-yellow-500">#{rank}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setGameState('LOBBY');
              setHasAnswered(false);
              setSelectedAnswer(null);
              setIsCorrect(null);
            }}
            className="mt-8 bg-white text-purple-600 font-bold py-4 px-8 rounded-2xl shadow-lg"
          >
            Continue
          </button>
        </div>
      </main>
    );
  }

  // Leaderboard Screen
  if (gameState === 'LEADERBOARD') {
    const leaderboard = [
      { name: 'Les Champions', score: 850 },
      { name: 'Quiz Masters', score: 720 },
      { name: teamName, score: score },
      { name: 'Brain Storm', score: 680 },
      { name: 'Team Rocket', score: 490 },
    ].sort((a, b) => b.score - a.score);

    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🏆</div>
            <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
          </div>

          <div className="space-y-3">
            {leaderboard.map((team, index) => {
              const isYou = team.name === teamName;
              return (
                <div
                  key={index}
                  className={`rounded-2xl p-4 flex items-center ${
                    isYou ? 'bg-purple-500 ring-2 ring-yellow-400' :
                    index < 3 ? 'bg-white/10' : 'bg-white/5'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mr-4 ${
                    index === 0 ? 'bg-yellow-400 text-yellow-900' :
                    index === 1 ? 'bg-gray-300 text-gray-700' :
                    index === 2 ? 'bg-orange-400 text-orange-900' :
                    'bg-gray-600 text-white'
                  }`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold ${isYou ? 'text-white' : 'text-white'}`}>
                      {team.name} {isYou && '(You)'}
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-purple-300">{team.score}</div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // Finished Screen
  if (gameState === 'FINISHED') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="text-8xl mb-6">🏆</div>
          <h1 className="text-4xl font-black text-white mb-2">GAME OVER!</h1>
          <p className="text-white/80 text-xl mb-8">Final Results</p>

          <div className="bg-white rounded-3xl p-8 shadow-2xl">
            <p className="text-gray-500 mb-2">Your Final Score</p>
            <p className="text-5xl font-black text-purple-600 mb-4">{score}</p>
            <p className="text-gray-500 mb-2">Final Rank</p>
            <p className="text-4xl font-bold text-yellow-500">#{rank} / {totalTeams}</p>
          </div>

          <button
            onClick={() => {
              setGameState('JOIN');
              setSessionCode('');
              setTeamName('');
              setScore(0);
              setRank(1);
            }}
            className="mt-8 bg-white text-orange-600 font-bold py-4 px-8 rounded-2xl shadow-lg"
          >
            Play Again
          </button>
        </div>
      </main>
    );
  }

  return null;
}
