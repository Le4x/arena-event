'use client';

import { useState, useEffect } from 'react';

const API_URL = 'http://91.134.135.247:3001';

interface Team {
  id: string;
  name: string;
  score: number;
  isConnected: boolean;
  buzzerTime?: number;
  lastAnswer?: string;
}

interface Question {
  id: string;
  text: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'BUZZER' | 'TEXT';
  options?: string[];
  correctAnswer?: string;
  points: number;
  timeLimit: number;
}

type GameStatus = 'LOBBY' | 'QUESTION' | 'BUZZER_OPEN' | 'REVEAL' | 'LEADERBOARD' | 'PAUSED' | 'FINISHED';

export default function StudioHome() {
  // Session state
  const [sessionCode, setSessionCode] = useState('XK7M2P');
  const [gameStatus, setGameStatus] = useState<GameStatus>('LOBBY');
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Teams state
  const [teams, setTeams] = useState<Team[]>([
    { id: '1', name: 'Les Champions', score: 850, isConnected: true, lastAnswer: 'A' },
    { id: '2', name: 'Quiz Masters', score: 720, isConnected: true, lastAnswer: 'B' },
    { id: '3', name: 'Brain Storm', score: 680, isConnected: true, lastAnswer: 'A' },
    { id: '4', name: 'Les Genies', score: 540, isConnected: false },
    { id: '5', name: 'Team Rocket', score: 490, isConnected: true, lastAnswer: 'C' },
  ]);

  // Question state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions] = useState<Question[]>([
    {
      id: '1',
      text: 'Quelle est la capitale de la France ?',
      type: 'MCQ',
      options: ['Lyon', 'Paris', 'Marseille', 'Bordeaux'],
      correctAnswer: 'B',
      points: 100,
      timeLimit: 30,
    },
    {
      id: '2',
      text: 'Le soleil se leve a l\'ouest.',
      type: 'TRUE_FALSE',
      correctAnswer: 'FALSE',
      points: 100,
      timeLimit: 20,
    },
    {
      id: '3',
      text: 'Quel est le plus grand ocean du monde ?',
      type: 'BUZZER',
      correctAnswer: 'Pacifique',
      points: 200,
      timeLimit: 60,
    },
  ]);

  // Buzzer state
  const [buzzerWinner, setBuzzerWinner] = useState<Team | null>(null);
  const [buzzerLocked, setBuzzerLocked] = useState(false);
  const [buzzerQueue, setBuzzerQueue] = useState<Team[]>([]);

  // UI state
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [scoreAdjustment, setScoreAdjustment] = useState(0);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeRemaining]);

  const currentQuestion = questions[currentQuestionIndex];

  // Game controls
  const startQuestion = () => {
    setGameStatus('QUESTION');
    setTimeRemaining(currentQuestion?.timeLimit || 30);
    setIsTimerRunning(true);
    setBuzzerWinner(null);
    setBuzzerLocked(false);
    setBuzzerQueue([]);
  };

  const pauseGame = () => {
    setIsTimerRunning(false);
    setGameStatus('PAUSED');
  };

  const resumeGame = () => {
    setIsTimerRunning(true);
    setGameStatus('QUESTION');
  };

  const endQuestion = () => {
    setIsTimerRunning(false);
    setGameStatus('REVEAL');
  };

  const showLeaderboard = () => {
    setGameStatus('LEADERBOARD');
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setGameStatus('LOBBY');
      setTimeRemaining(questions[currentQuestionIndex + 1]?.timeLimit || 30);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setGameStatus('LOBBY');
    }
  };

  const openBuzzer = () => {
    setGameStatus('BUZZER_OPEN');
    setBuzzerLocked(false);
    setBuzzerWinner(null);
    setBuzzerQueue([]);
  };

  const lockBuzzer = () => {
    setBuzzerLocked(true);
  };

  const resetBuzzer = () => {
    setBuzzerWinner(null);
    setBuzzerLocked(false);
    setBuzzerQueue([]);
  };

  // Simulate buzzer press (for demo)
  const simulateBuzzer = (team: Team) => {
    if (!buzzerLocked && !buzzerWinner) {
      setBuzzerWinner(team);
      setBuzzerQueue([...buzzerQueue, team]);
    }
  };

  // Score management
  const adjustScore = (team: Team, points: number) => {
    setTeams(teams.map(t =>
      t.id === team.id ? { ...t, score: Math.max(0, t.score + points) } : t
    ));
  };

  const openScoreModal = (team: Team) => {
    setSelectedTeam(team);
    setScoreAdjustment(0);
    setShowScoreModal(true);
  };

  const applyScoreAdjustment = () => {
    if (selectedTeam) {
      adjustScore(selectedTeam, scoreAdjustment);
      setShowScoreModal(false);
    }
  };

  const markCorrect = (team: Team) => {
    adjustScore(team, currentQuestion?.points || 100);
  };

  const markWrong = (team: Team) => {
    // Optionally deduct points
  };

  // Sorted teams by score
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-3xl">🎮</span>
            <div>
              <h1 className="text-2xl font-bold">Arena Event Studio</h1>
              <p className="text-gray-400 text-sm">Game Master Control Panel</p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* Session Code */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 rounded-xl">
              <p className="text-xs text-purple-200">Session Code</p>
              <p className="text-2xl font-mono font-bold tracking-widest">{sessionCode}</p>
            </div>

            {/* Status */}
            <div className={`px-4 py-2 rounded-full font-semibold ${
              gameStatus === 'LOBBY' ? 'bg-yellow-500/20 text-yellow-400' :
              gameStatus === 'QUESTION' ? 'bg-green-500/20 text-green-400' :
              gameStatus === 'BUZZER_OPEN' ? 'bg-red-500/20 text-red-400 animate-pulse' :
              gameStatus === 'REVEAL' ? 'bg-blue-500/20 text-blue-400' :
              gameStatus === 'LEADERBOARD' ? 'bg-purple-500/20 text-purple-400' :
              gameStatus === 'PAUSED' ? 'bg-orange-500/20 text-orange-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {gameStatus}
            </div>

            {/* Connected Teams */}
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{teams.filter(t => t.isConnected).length}</p>
              <p className="text-xs text-gray-400">Teams Online</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar - Teams */}
        <aside className="w-80 bg-gray-800 border-r border-gray-700 h-[calc(100vh-80px)] overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">👥</span> Teams ({teams.length})
            </h2>

            <div className="space-y-2">
              {sortedTeams.map((team, index) => (
                <div
                  key={team.id}
                  className={`bg-gray-700/50 rounded-lg p-3 transition cursor-pointer hover:bg-gray-700 ${
                    buzzerWinner?.id === team.id ? 'ring-2 ring-red-500 bg-red-500/20' : ''
                  }`}
                  onClick={() => openScoreModal(team)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-gray-400 text-black' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <p className="text-xs text-gray-400">
                          {team.isConnected ? (
                            <span className="text-green-400">● Online</span>
                          ) : (
                            <span className="text-red-400">● Offline</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-purple-400">{team.score}</p>
                      {team.lastAnswer && gameStatus !== 'LOBBY' && (
                        <p className="text-xs text-gray-400">Rep: {team.lastAnswer}</p>
                      )}
                    </div>
                  </div>

                  {/* Quick score buttons */}
                  <div className="flex space-x-2 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); markCorrect(team); }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-2 rounded transition"
                    >
                      +{currentQuestion?.points || 100}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); adjustScore(team, -50); }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded transition"
                    >
                      -50
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Timer & Question Navigation */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={prevQuestion}
                disabled={currentQuestionIndex === 0}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white p-3 rounded-lg transition"
              >
                ◀
              </button>
              <div className="text-center">
                <p className="text-sm text-gray-400">Question</p>
                <p className="text-2xl font-bold">{currentQuestionIndex + 1} / {questions.length}</p>
              </div>
              <button
                onClick={nextQuestion}
                disabled={currentQuestionIndex === questions.length - 1}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white p-3 rounded-lg transition"
              >
                ▶
              </button>
            </div>

            {/* Timer */}
            <div className={`text-center px-8 py-4 rounded-2xl ${
              timeRemaining <= 5 ? 'bg-red-500/20 animate-pulse' :
              timeRemaining <= 10 ? 'bg-yellow-500/20' :
              'bg-gray-800'
            }`}>
              <p className="text-sm text-gray-400">Time Remaining</p>
              <p className={`text-5xl font-mono font-bold ${
                timeRemaining <= 5 ? 'text-red-400' :
                timeRemaining <= 10 ? 'text-yellow-400' :
                'text-white'
              }`}>
                {timeRemaining}s
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setTimeRemaining(t => Math.max(0, t - 10))}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
              >
                -10s
              </button>
              <button
                onClick={() => setTimeRemaining(t => t + 10)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
              >
                +10s
              </button>
            </div>
          </div>

          {/* Current Question Preview */}
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                currentQuestion?.type === 'MCQ' ? 'bg-blue-500/20 text-blue-400' :
                currentQuestion?.type === 'TRUE_FALSE' ? 'bg-green-500/20 text-green-400' :
                currentQuestion?.type === 'BUZZER' ? 'bg-red-500/20 text-red-400' :
                'bg-purple-500/20 text-purple-400'
              }`}>
                {currentQuestion?.type}
              </span>
              <span className="text-purple-400 font-bold">{currentQuestion?.points} pts</span>
            </div>

            <h2 className="text-2xl font-semibold mb-4">{currentQuestion?.text}</h2>

            {currentQuestion?.type === 'MCQ' && currentQuestion.options && (
              <div className="grid grid-cols-2 gap-3">
                {currentQuestion.options.map((option, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 transition ${
                      gameStatus === 'REVEAL' && String.fromCharCode(65 + idx) === currentQuestion.correctAnswer
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-gray-600 bg-gray-700/50'
                    }`}
                  >
                    <span className="inline-block w-8 h-8 rounded-full bg-gray-600 text-center leading-8 mr-3 font-bold">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {option}
                  </div>
                ))}
              </div>
            )}

            {currentQuestion?.type === 'TRUE_FALSE' && (
              <div className="flex space-x-4">
                <div className={`flex-1 p-6 rounded-lg border-2 text-center text-xl font-bold ${
                  gameStatus === 'REVEAL' && currentQuestion.correctAnswer === 'TRUE'
                    ? 'border-green-500 bg-green-500/20 text-green-400'
                    : 'border-gray-600 bg-gray-700/50'
                }`}>
                  VRAI
                </div>
                <div className={`flex-1 p-6 rounded-lg border-2 text-center text-xl font-bold ${
                  gameStatus === 'REVEAL' && currentQuestion.correctAnswer === 'FALSE'
                    ? 'border-green-500 bg-green-500/20 text-green-400'
                    : 'border-gray-600 bg-gray-700/50'
                }`}>
                  FAUX
                </div>
              </div>
            )}

            {currentQuestion?.type === 'BUZZER' && (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">Reponse attendue:</p>
                <p className={`text-3xl font-bold ${gameStatus === 'REVEAL' ? 'text-green-400' : 'text-gray-500 blur-sm hover:blur-none transition-all'}`}>
                  {currentQuestion.correctAnswer}
                </p>
              </div>
            )}
          </div>

          {/* Main Control Buttons */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <button
              onClick={startQuestion}
              disabled={gameStatus === 'QUESTION'}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl transition transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
            >
              <span className="text-2xl block mb-1">▶️</span>
              Start Question
            </button>

            {gameStatus === 'PAUSED' ? (
              <button
                onClick={resumeGame}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl transition transform hover:scale-105 shadow-lg"
              >
                <span className="text-2xl block mb-1">▶️</span>
                Resume
              </button>
            ) : (
              <button
                onClick={pauseGame}
                disabled={gameStatus === 'LOBBY'}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl transition transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
              >
                <span className="text-2xl block mb-1">⏸️</span>
                Pause
              </button>
            )}

            <button
              onClick={endQuestion}
              disabled={gameStatus === 'LOBBY'}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl transition transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
            >
              <span className="text-2xl block mb-1">⏹️</span>
              End & Reveal
            </button>

            <button
              onClick={showLeaderboard}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-xl transition transform hover:scale-105 shadow-lg"
            >
              <span className="text-2xl block mb-1">🏆</span>
              Leaderboard
            </button>
          </div>

          {/* Buzzer Controls */}
          {currentQuestion?.type === 'BUZZER' && (
            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <span className="mr-2">🔔</span> Buzzer Control
              </h3>

              <div className="flex items-center space-x-4 mb-4">
                <button
                  onClick={openBuzzer}
                  disabled={gameStatus === 'BUZZER_OPEN'}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl transition"
                >
                  Open Buzzer
                </button>
                <button
                  onClick={lockBuzzer}
                  disabled={buzzerLocked}
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl transition"
                >
                  Lock Buzzer
                </button>
                <button
                  onClick={resetBuzzer}
                  className="flex-1 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold py-4 px-6 rounded-xl transition"
                >
                  Reset Buzzer
                </button>
              </div>

              {/* Buzzer Winner Display */}
              {buzzerWinner && (
                <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-6 text-center animate-pulse">
                  <p className="text-red-400 text-lg mb-2">BUZZER!</p>
                  <p className="text-4xl font-bold text-white">{buzzerWinner.name}</p>
                  <div className="flex justify-center space-x-4 mt-4">
                    <button
                      onClick={() => { markCorrect(buzzerWinner); resetBuzzer(); }}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg"
                    >
                      ✓ Correct (+{currentQuestion?.points})
                    </button>
                    <button
                      onClick={() => { markWrong(buzzerWinner); resetBuzzer(); }}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg"
                    >
                      ✗ Wrong
                    </button>
                  </div>
                </div>
              )}

              {/* Demo Buzzer Simulation */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400 mb-2">Demo: Simulate buzzer press</p>
                <div className="flex flex-wrap gap-2">
                  {teams.filter(t => t.isConnected).map(team => (
                    <button
                      key={team.id}
                      onClick={() => simulateBuzzer(team)}
                      disabled={buzzerLocked || buzzerWinner !== null}
                      className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm py-1 px-3 rounded transition"
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Answer Statistics */}
          {gameStatus !== 'LOBBY' && currentQuestion?.type === 'MCQ' && (
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">Answer Distribution</h3>
              <div className="space-y-3">
                {currentQuestion.options?.map((option, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const count = teams.filter(t => t.lastAnswer === letter).length;
                  const percentage = teams.length > 0 ? (count / teams.length) * 100 : 0;
                  const isCorrect = letter === currentQuestion.correctAnswer;

                  return (
                    <div key={idx} className="flex items-center space-x-4">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        isCorrect && gameStatus === 'REVEAL' ? 'bg-green-500' : 'bg-gray-600'
                      }`}>
                        {letter}
                      </span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{option}</span>
                          <span>{count} ({percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isCorrect && gameStatus === 'REVEAL' ? 'bg-green-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Quick Stats */}
        <aside className="w-64 bg-gray-800 border-l border-gray-700 p-4">
          <h3 className="text-lg font-semibold mb-4">Quick Links</h3>

          <div className="space-y-3">
            <a
              href="http://91.134.135.247:3004"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-blue-600 hover:bg-blue-700 text-white text-center py-3 px-4 rounded-lg transition"
            >
              📺 Open Screen Display
            </a>
            <a
              href="http://91.134.135.247:3003"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-green-600 hover:bg-green-700 text-white text-center py-3 px-4 rounded-lg transition"
            >
              📱 Player View
            </a>
            <a
              href="http://91.134.135.247:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-purple-600 hover:bg-purple-700 text-white text-center py-3 px-4 rounded-lg transition"
            >
              ⚙️ Admin Dashboard
            </a>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Top 3</h3>
            <div className="space-y-2">
              {sortedTeams.slice(0, 3).map((team, index) => (
                <div key={team.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className={`text-xl ${
                      index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
                    }`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </span>
                    <span className="font-medium truncate max-w-[100px]">{team.name}</span>
                  </div>
                  <span className="font-bold text-purple-400">{team.score}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Session Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Teams</span>
                <span className="font-medium">{teams.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Online</span>
                <span className="font-medium text-green-400">{teams.filter(t => t.isConnected).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Questions</span>
                <span className="font-medium">{questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Current</span>
                <span className="font-medium">{currentQuestionIndex + 1}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Score Adjustment Modal */}
      {showScoreModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Adjust Score</h3>
            <p className="text-gray-400 mb-4">{selectedTeam.name}</p>

            <div className="text-center mb-6">
              <p className="text-sm text-gray-400">Current Score</p>
              <p className="text-4xl font-bold text-purple-400">{selectedTeam.score}</p>
            </div>

            <div className="flex items-center justify-center space-x-4 mb-6">
              <button
                onClick={() => setScoreAdjustment(scoreAdjustment - 100)}
                className="bg-red-600 hover:bg-red-700 text-white w-12 h-12 rounded-full text-xl font-bold"
              >
                -
              </button>
              <input
                type="number"
                value={scoreAdjustment}
                onChange={(e) => setScoreAdjustment(parseInt(e.target.value) || 0)}
                className="w-32 text-center text-2xl font-bold bg-gray-700 border border-gray-600 rounded-lg py-2 text-white"
              />
              <button
                onClick={() => setScoreAdjustment(scoreAdjustment + 100)}
                className="bg-green-600 hover:bg-green-700 text-white w-12 h-12 rounded-full text-xl font-bold"
              >
                +
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-6">
              {[-50, -25, 25, 50].map(val => (
                <button
                  key={val}
                  onClick={() => setScoreAdjustment(val)}
                  className="bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm"
                >
                  {val > 0 ? '+' : ''}{val}
                </button>
              ))}
            </div>

            <div className="text-center mb-6">
              <p className="text-sm text-gray-400">New Score</p>
              <p className="text-3xl font-bold text-white">
                {Math.max(0, selectedTeam.score + scoreAdjustment)}
              </p>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setShowScoreModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={applyScoreAdjustment}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl transition"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
