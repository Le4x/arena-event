'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = 'http://91.134.135.247:3001';

type GameState = 'JOIN' | 'TEAM_SELECT' | 'LOBBY' | 'QUESTION' | 'BUZZER' | 'WAITING' | 'RESULT' | 'LEADERBOARD' | 'FINISHED';

interface Question {
  id: string;
  text: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'BUZZER' | 'OPEN';
  options?: string[];
  points: number;
  timeLimit: number;
  mediaUrl?: string;
}

interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
}

interface Session {
  id: string;
  code: string;
  eventName: string;
}

export default function PlayerHome() {
  // Socket
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Join state
  const [sessionCode, setSessionCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#8B5CF6');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Session state
  const [session, setSession] = useState<Session | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [existingTeams, setExistingTeams] = useState<Team[]>([]);

  // Game state
  const [gameState, setGameState] = useState<GameState>('JOIN');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);

  // Buzzer state
  const [buzzerPressed, setBuzzerPressed] = useState(false);
  const [buzzerOpen, setBuzzerOpen] = useState(false);
  const [buzzerWinner, setBuzzerWinner] = useState<string | null>(null);
  const [buzzerWrongFeedback, setBuzzerWrongFeedback] = useState(false);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<Team[]>([]);

  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTime = useRef<number>(0);

  // Join session via API
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: sessionCode.toUpperCase() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Session not found');
      }

      const data = await res.json();
      setSession({
        id: data.session.id,
        code: data.session.code,
        eventName: data.session.event?.name || 'Arena Event',
      });
      setExistingTeams(data.session.teams || []);
      setGameState('TEAM_SELECT');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  // Create or join team
  const handleTeamJoin = async () => {
    if (!teamName.trim() || !session) {
      setError('Please enter a team name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/sessions/${session.id}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim(), color: teamColor }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create team');
      }

      const data = await res.json();
      setTeam(data);
      setGameState('LOBBY');

      // Connect socket
      connectSocket(session.id, data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team');
    } finally {
      setLoading(false);
    }
  };

  // Join existing team
  const joinExistingTeam = async (existingTeam: Team) => {
    if (!session) return;

    setTeam(existingTeam);
    setTeamName(existingTeam.name);
    setGameState('LOBBY');
    connectSocket(session.id, existingTeam.id);
  };

  // Socket connection
  const connectSocket = (sessionId: string, teamId: string) => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-session', {
        sessionId,
        teamId,
        role: 'player',
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Game events
    socket.on('question-start', (data) => {
      setCurrentQuestion(data.question);
      setTimeRemaining(data.timeLimit || data.question.timeLimit || 30);
      setHasAnswered(false);
      setSelectedAnswer(null);
      setTextAnswer('');
      setIsCorrect(null);
      setPointsEarned(0);
      setCorrectAnswer(null);
      setBuzzerPressed(false);
      setBuzzerOpen(data.question.type === 'BUZZER');
      setBuzzerWinner(null);
      questionStartTime.current = Date.now();
      setGameState('QUESTION');
      startTimer(data.timeLimit || data.question.timeLimit || 30);
    });

    socket.on('question-end', (data) => {
      stopTimer();
      setCorrectAnswer(data.correctAnswer);
      setGameState('RESULT');
    });

    socket.on('timer-update', (data) => {
      setTimeRemaining(data.timeRemaining);
    });

    socket.on('timer-end', () => {
      stopTimer();
      if (!hasAnswered) {
        setGameState('WAITING');
      }
    });

    socket.on('buzzer-open', () => {
      setBuzzerOpen(true);
      setBuzzerPressed(false);
      setBuzzerWinner(null);
    });

    socket.on('buzzer-lock', () => {
      setBuzzerOpen(false);
    });

    socket.on('buzzer-reset', () => {
      setBuzzerPressed(false);
      setBuzzerWinner(null);
      setBuzzerOpen(true);
    });

    socket.on('buzzer-winner', (data) => {
      setBuzzerWinner(data.teamName);
      // If this team won the buzzer, lock it
      if (data.teamId === teamId) {
        setBuzzerOpen(false);
      }
    });

    // Buzzer validation events
    socket.on('buzzer-correct', (data) => {
      if (data.teamId === teamId) {
        setIsCorrect(true);
        setPointsEarned(data.points || 0);
        setTeam(prev => prev ? { ...prev, score: prev.score + (data.points || 0) } : prev);
        setGameState('RESULT');
      }
      setBuzzerWinner(null);
      setBuzzerPressed(false);
    });

    socket.on('buzzer-wrong', (data) => {
      if (data.teamId === teamId) {
        setIsCorrect(false);
        setPointsEarned(0);
        // Show wrong feedback briefly then allow another try
        setBuzzerWrongFeedback(true);
        setTimeout(() => setBuzzerWrongFeedback(false), 2000);
        setBuzzerPressed(false);
        setBuzzerOpen(true);
      } else {
        // Other teams can try again
        setBuzzerOpen(true);
      }
      setBuzzerWinner(null);
    });

    socket.on('answer-result', (data) => {
      if (data.teamId === teamId) {
        setIsCorrect(data.isCorrect);
        setPointsEarned(data.points || 0);
        if (data.points > 0) {
          setTeam(prev => prev ? { ...prev, score: prev.score + data.points } : prev);
        }
      }
    });

    socket.on('score-update', (data) => {
      if (data.teamId === teamId) {
        setTeam(prev => prev ? { ...prev, score: data.newScore } : prev);
      }
    });

    socket.on('show-leaderboard', (data) => {
      setLeaderboard(data.teams);
      setGameState('LEADERBOARD');
    });

    socket.on('game-paused', () => {
      stopTimer();
    });

    socket.on('game-resumed', () => {
      if (gameState === 'QUESTION' && timeRemaining > 0) {
        startTimer(timeRemaining);
      }
    });

    socket.on('session-end', () => {
      setGameState('FINISHED');
    });
  };

  const startTimer = (seconds: number) => {
    stopTimer();
    setTimeRemaining(seconds);
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          stopTimer();
          if (!hasAnswered) {
            setGameState('WAITING');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Submit answer
  const handleAnswer = async (answer: string) => {
    if (hasAnswered || !currentQuestion || !session || !team) return;

    setSelectedAnswer(answer);
    setHasAnswered(true);
    setGameState('WAITING');

    const responseTime = Date.now() - questionStartTime.current;

    // Send via socket
    socketRef.current?.emit('submit-answer', {
      sessionId: session.id,
      teamId: team.id,
      questionId: currentQuestion.id,
      answer,
      responseTime,
    });

    // Also save via API
    try {
      await fetch(`${API_URL}/sessions/${session.id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          questionId: currentQuestion.id,
          answer,
          responseTime,
        }),
      });
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  };

  // Submit text answer
  const handleTextAnswer = () => {
    if (textAnswer.trim()) {
      handleAnswer(textAnswer.trim());
    }
  };

  // Press buzzer
  const handleBuzzer = () => {
    if (buzzerPressed || !buzzerOpen || !session || !team) return;

    setBuzzerPressed(true);
    socketRef.current?.emit('buzzer-press', {
      sessionId: session.id,
      teamId: team.id,
      timestamp: Date.now(),
    });
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopTimer();
      socketRef.current?.disconnect();
    };
  }, []);

  // Calculate rank
  const getRank = () => {
    if (!team || leaderboard.length === 0) return 1;
    const index = leaderboard.findIndex(t => t.id === team.id);
    return index >= 0 ? index + 1 : leaderboard.length + 1;
  };

  // Team colors
  const colors = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

  // JOIN SCREEN
  if (gameState === 'JOIN') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-7xl mb-4 animate-bounce">🎮</div>
            <h1 className="text-4xl font-black text-white drop-shadow-lg">Arena Event</h1>
            <p className="text-purple-100 mt-2 text-lg">Join the game!</p>
          </div>

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
                  placeholder="ABC123"
                  maxLength={6}
                  required
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading || sessionCode.length < 4}
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
          </div>

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

  // TEAM SELECTION SCREEN
  if (gameState === 'TEAM_SELECT') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">👥</div>
            <h1 className="text-3xl font-bold text-white">{session?.eventName}</h1>
            <p className="text-purple-100 mt-2">
              Code: <span className="font-mono font-bold">{session?.code}</span>
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Existing teams */}
            {existingTeams.length > 0 && (
              <div className="mb-6">
                <p className="text-gray-600 font-medium mb-3">Join existing team:</p>
                <div className="space-y-2">
                  {existingTeams.map(t => (
                    <button
                      key={t.id}
                      onClick={() => joinExistingTeam(t)}
                      className="w-full flex items-center p-3 bg-gray-50 hover:bg-purple-50 rounded-xl transition"
                    >
                      <div
                        className="w-10 h-10 rounded-full mr-3"
                        style={{ backgroundColor: t.color }}
                      ></div>
                      <span className="font-semibold text-gray-800">{t.name}</span>
                      <span className="ml-auto text-purple-600 font-bold">{t.score} pts</span>
                    </button>
                  ))}
                </div>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-4 text-gray-500 text-sm">or create new team</span>
                  </div>
                </div>
              </div>
            )}

            {/* Create new team */}
            <div className="space-y-4">
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-4 py-4 text-xl text-center font-bold border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-200 text-gray-800"
                placeholder="Team Name"
                maxLength={20}
              />

              <div>
                <p className="text-gray-600 text-sm mb-2 text-center">Choose color:</p>
                <div className="flex justify-center gap-3">
                  {colors.map(c => (
                    <button
                      key={c}
                      onClick={() => setTeamColor(c)}
                      className={`w-10 h-10 rounded-full transition transform hover:scale-110 ${
                        teamColor === c ? 'ring-4 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleTeamJoin}
                disabled={!teamName.trim() || loading}
                className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white text-xl font-bold py-5 rounded-2xl shadow-lg transition transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Creating...' : `JOIN AS ${teamName || '...'}`}
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              setGameState('JOIN');
              setSession(null);
              setError('');
            }}
            className="mt-6 text-white/80 hover:text-white transition mx-auto block"
          >
            ← Back
          </button>
        </div>
      </main>
    );
  }

  // LOBBY SCREEN
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
              <div className="flex items-center">
                <div
                  className="w-4 h-4 rounded-full mr-2"
                  style={{ backgroundColor: team?.color || teamColor }}
                ></div>
                <span className="font-bold text-purple-600">{team?.name || teamName}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500">Session</span>
              <span className="font-mono font-bold text-gray-800">{session?.code}</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500">Score</span>
              <span className="font-bold text-purple-600">{team?.score || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`flex items-center font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                {isConnected ? 'Connected' : 'Connecting...'}
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

  // QUESTION SCREEN
  if (gameState === 'QUESTION' && currentQuestion) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col">
        {/* Timer Header */}
        <header className={`p-4 text-center transition-colors ${
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
            {currentQuestion.mediaUrl && (
              <img
                src={currentQuestion.mediaUrl}
                alt="Question"
                className="w-full h-40 object-cover rounded-xl mb-4"
              />
            )}
            <p className="text-white text-xl font-semibold text-center leading-relaxed">
              {currentQuestion.text}
            </p>
            <p className="text-purple-400 text-center mt-2">{currentQuestion.points} points</p>
          </div>

          {/* MCQ Options */}
          {currentQuestion.type === 'MCQ' && currentQuestion.options && (
            <div className="grid grid-cols-1 gap-3 flex-1">
              {currentQuestion.options.map((option, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const colorClasses = [
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
                    className={`bg-gradient-to-r ${colorClasses[idx % 4]} text-white font-bold py-5 px-6 rounded-2xl shadow-lg transition transform active:scale-95 disabled:opacity-70 ${
                      isSelected ? 'ring-4 ring-white scale-[1.02]' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-4 text-xl font-black">
                        {letter}
                      </span>
                      <span className="text-lg text-left flex-1">{option}</span>
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
            <div className="flex-1 flex flex-col items-center justify-center">
              {/* Wrong answer feedback */}
              {buzzerWrongFeedback && (
                <div className="mb-4 bg-red-500/20 border-2 border-red-500 rounded-xl p-4 text-center animate-pulse">
                  <p className="text-red-400 text-xl font-bold">❌ Wrong! Try again!</p>
                </div>
              )}

              {buzzerWinner ? (
                <div className="text-center">
                  <p className="text-2xl text-white mb-4">
                    {buzzerWinner === team?.name ? '🎉 You got the buzzer!' : `${buzzerWinner} got the buzzer!`}
                  </p>
                  {buzzerWinner === team?.name && (
                    <p className="text-gray-400">Waiting for validation...</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleBuzzer}
                  disabled={buzzerPressed || !buzzerOpen}
                  className={`w-56 h-56 rounded-full shadow-2xl transition transform active:scale-90 ${
                    buzzerPressed
                      ? 'bg-gray-600'
                      : buzzerOpen
                        ? 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 animate-pulse'
                        : 'bg-gray-600 opacity-50'
                  }`}
                >
                  <span className="text-white text-3xl font-black">
                    {buzzerPressed ? 'BUZZED!' : buzzerOpen ? 'BUZZ!' : 'WAIT...'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Open/Text Answer */}
          {currentQuestion.type === 'OPEN' && (
            <div className="flex-1 flex flex-col justify-center">
              <input
                type="text"
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                disabled={hasAnswered}
                className="w-full px-4 py-4 text-xl text-center font-bold bg-gray-800 border-2 border-gray-600 rounded-2xl focus:outline-none focus:border-purple-500 text-white mb-4"
                placeholder="Your answer..."
              />
              <button
                onClick={handleTextAnswer}
                disabled={hasAnswered || !textAnswer.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-4 rounded-2xl disabled:opacity-50"
              >
                Submit Answer
              </button>
            </div>
          )}
        </div>

        {/* Score Footer */}
        <footer className="bg-gray-800 p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400 text-sm">Your Score</p>
              <p className="text-2xl font-bold text-purple-400">{team?.score || 0}</p>
            </div>
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: team?.color || teamColor }}
            ></div>
          </div>
        </footer>
      </main>
    );
  }

  // WAITING SCREEN
  if (gameState === 'WAITING') {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-bounce">
            {selectedAnswer ? '✅' : buzzerPressed ? '🔔' : '⏳'}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {selectedAnswer ? 'Answer Submitted!' : buzzerPressed ? 'Buzzer Pressed!' : "Time's Up!"}
          </h1>
          <p className="text-gray-400">Waiting for results...</p>

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

  // RESULT SCREEN
  if (gameState === 'RESULT') {
    const wasCorrect = isCorrect || (selectedAnswer && selectedAnswer === correctAnswer);

    return (
      <main className={`min-h-screen flex flex-col items-center justify-center p-4 ${
        wasCorrect ? 'bg-gradient-to-br from-green-600 to-teal-600' : 'bg-gradient-to-br from-red-600 to-orange-600'
      }`}>
        <div className="text-center">
          <div className="text-8xl mb-6">
            {wasCorrect ? '🎉' : '😢'}
          </div>
          <h1 className="text-4xl font-black text-white mb-4">
            {wasCorrect ? 'CORRECT!' : 'WRONG!'}
          </h1>

          {correctAnswer && (
            <div className="bg-white/20 backdrop-blur rounded-2xl p-4 mb-4">
              <p className="text-white/80 text-sm">Correct Answer</p>
              <p className="text-2xl font-bold text-white">{correctAnswer}</p>
            </div>
          )}

          {pointsEarned > 0 && (
            <div className="bg-white/20 backdrop-blur rounded-2xl p-6 mb-6">
              <p className="text-white/80">Points Earned</p>
              <p className="text-5xl font-black text-white">+{pointsEarned}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 mt-6">
            <div className="text-center">
              <p className="text-gray-500 text-sm">Total Score</p>
              <p className="text-4xl font-bold text-purple-600">{team?.score || 0}</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // LEADERBOARD SCREEN
  if (gameState === 'LEADERBOARD') {
    const rank = getRank();

    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🏆</div>
            <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
            <p className="text-purple-300 mt-2">Your rank: #{rank}</p>
          </div>

          <div className="space-y-3">
            {leaderboard.map((t, index) => {
              const isYou = t.id === team?.id;
              return (
                <div
                  key={t.id}
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
                    <p className="font-bold text-white">
                      {t.name} {isYou && '(You)'}
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-purple-300">{t.score}</div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // FINISHED SCREEN
  if (gameState === 'FINISHED') {
    const rank = getRank();

    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="text-8xl mb-6">🏆</div>
          <h1 className="text-4xl font-black text-white mb-2">GAME OVER!</h1>
          <p className="text-white/80 text-xl mb-8">Final Results</p>

          <div className="bg-white rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-center mb-4">
              <div
                className="w-6 h-6 rounded-full mr-2"
                style={{ backgroundColor: team?.color || teamColor }}
              ></div>
              <p className="text-gray-600 font-semibold">{team?.name}</p>
            </div>
            <p className="text-gray-500 mb-2">Your Final Score</p>
            <p className="text-5xl font-black text-purple-600 mb-4">{team?.score || 0}</p>
            <p className="text-gray-500 mb-2">Final Rank</p>
            <p className="text-4xl font-bold text-yellow-500">#{rank}</p>
          </div>

          <button
            onClick={() => {
              socketRef.current?.disconnect();
              setGameState('JOIN');
              setSessionCode('');
              setTeamName('');
              setSession(null);
              setTeam(null);
              setLeaderboard([]);
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
