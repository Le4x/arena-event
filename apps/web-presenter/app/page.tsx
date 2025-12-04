'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// API URL - configurable via environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
  hasAnswered?: boolean;
  isConnected?: boolean;
}

interface Question {
  id: string;
  text: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'BUZZER' | 'OPEN' | 'BLIND_TEST' | 'IMAGE';
  options?: string[];
  correctAnswer?: string;
  points: number;
  timeLimit: number;
}

interface Session {
  id: string;
  code: string;
  status: string;
  event: {
    id: string;
    name: string;
  };
  teams: Team[];
}

export default function PresenterDashboard() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

  // Game state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [gamePhase, setGamePhase] = useState<string>('LOBBY');
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Check for stored token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('presenter_token');
    const storedUser = localStorage.getItem('presenter_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUserInfo(JSON.parse(storedUser));
      setIsAuthenticated(true);
      fetchSessions(storedToken);
    }
  }, []);

  // Login function
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Check if user has PRESENTER or SUPER_ADMIN role
      if (data.user.role !== 'PRESENTER' && data.user.role !== 'SUPER_ADMIN') {
        throw new Error('Access denied. Presenter role required.');
      }

      // Store token and user info
      localStorage.setItem('presenter_token', data.token);
      localStorage.setItem('presenter_user', JSON.stringify(data.user));

      setToken(data.token);
      setUserInfo(data.user);
      setIsAuthenticated(true);

      // Fetch sessions
      fetchSessions(data.token);
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('presenter_token');
    localStorage.removeItem('presenter_user');
    setToken(null);
    setUserInfo(null);
    setIsAuthenticated(false);
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  // Fetch active sessions
  const fetchSessions = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/sessions?status=ACTIVE`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  // Connect to session via WebSocket
  const connectToSession = (session: Session) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setSelectedSession(session);
    setTeams(session.teams);

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Presenter connected to socket');
      setIsConnected(true);
      socket.emit('join-session', {
        sessionId: session.id,
        role: 'presenter'
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen to game events
    socket.on('question-start', (data) => {
      setCurrentQuestion(data.question);
      setTimeRemaining(data.timeLimit || data.question.timeLimit);
      setCorrectAnswer(null);
      setGamePhase('QUESTION');
      // Reset answered status
      setTeams(prev => prev.map(t => ({ ...t, hasAnswered: false })));
    });

    socket.on('timer-sync', (data) => {
      setTimeRemaining(Math.ceil(data.remaining / 1000));
    });

    socket.on('answer-submitted', (data) => {
      // Mark team as answered
      setTeams(prev => prev.map(t =>
        t.id === data.teamId ? { ...t, hasAnswered: true } : t
      ));
    });

    socket.on('question-end', (data) => {
      setCorrectAnswer(data.correctAnswer);
      setGamePhase('REVEAL');
    });

    socket.on('score-updated', (data) => {
      setTeams(prev => prev.map(t =>
        t.id === data.teamId ? { ...t, score: data.newScore } : t
      ));
    });

    socket.on('team-joined', (data) => {
      setTeams(prev => {
        const exists = prev.find(t => t.id === data.team.id);
        if (exists) {
          return prev.map(t => t.id === data.team.id ? { ...t, isConnected: true } : t);
        }
        return [...prev, { ...data.team, isConnected: true }];
      });
    });

    socket.on('team-left', (data) => {
      setTeams(prev => prev.map(t =>
        t.id === data.teamId ? { ...t, isConnected: false } : t
      ));
    });
  };

  // Login page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl">
          <h1 className="text-4xl font-black text-white mb-2 text-center">
            🎤 Dashboard Animateur
          </h1>
          <p className="text-purple-200 text-center mb-8">Arena Event - Presenter Access</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="presenter@arena-event.fr"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="••••••••"
                required
              />
            </div>

            {authError && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-xl text-sm">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-4 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Session selection
  if (!selectedSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-black text-white mb-2">
                🎤 Dashboard Animateur
              </h1>
              <p className="text-purple-200">
                Bienvenue, {userInfo?.firstName || userInfo?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
            >
              Déconnexion
            </button>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">Sessions actives</h2>
            {sessions.length === 0 ? (
              <p className="text-purple-200 text-center py-8">Aucune session active</p>
            ) : (
              <div className="grid gap-4">
                {sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => connectToSession(session)}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-6 text-left transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">{session.event.name}</h3>
                        <p className="text-purple-200">Code: <span className="font-mono font-bold">{session.code}</span></p>
                        <p className="text-purple-300 text-sm mt-2">{session.teams.length} équipes connectées</p>
                      </div>
                      <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                        {session.status}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Presenter dashboard
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 mb-4 flex justify-between items-center border border-white/20">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-white">
            🎤 {selectedSession.event.name}
          </h1>
          <div className="bg-purple-500/20 text-purple-200 px-3 py-1 rounded-full text-sm">
            Code: <span className="font-mono font-bold">{selectedSession.code}</span>
          </div>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
        </div>
        <button
          onClick={() => {
            socketRef.current?.disconnect();
            setSelectedSession(null);
          }}
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition"
        >
          ← Changer de session
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Current Question */}
        <div className="col-span-2 bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4">Question actuelle</h2>

          {currentQuestion ? (
            <div>
              <div className="bg-white/10 rounded-xl p-6 mb-4">
                <p className="text-2xl text-white font-medium mb-4">{currentQuestion.text}</p>
                <div className="flex gap-4 text-sm">
                  <div className="bg-purple-500/20 text-purple-200 px-3 py-1 rounded-full">
                    {currentQuestion.type}
                  </div>
                  <div className="bg-yellow-500/20 text-yellow-200 px-3 py-1 rounded-full">
                    {currentQuestion.points} points
                  </div>
                  <div className="bg-blue-500/20 text-blue-200 px-3 py-1 rounded-full">
                    ⏱️ {timeRemaining}s
                  </div>
                </div>
              </div>

              {/* Correct Answer (shown during reveal) */}
              {correctAnswer && (
                <div className="bg-green-500/20 border-2 border-green-400 rounded-xl p-4 mb-4">
                  <p className="text-green-200 text-sm font-medium mb-1">✅ BONNE RÉPONSE :</p>
                  <p className="text-2xl text-white font-bold">{correctAnswer}</p>
                </div>
              )}

              {/* Teams who answered */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Réponses des équipes :</h3>
                <div className="grid grid-cols-2 gap-2">
                  {sortedTeams.map(team => (
                    <div
                      key={team.id}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        team.hasAnswered
                          ? 'bg-green-500/20 border border-green-400'
                          : 'bg-white/10 border border-white/20'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }}></div>
                      <span className="text-white font-medium">{team.name}</span>
                      {team.hasAnswered && <span className="ml-auto text-green-400 text-xl">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-purple-200 text-center py-12">En attente de la prochaine question...</p>
          )}
        </div>

        {/* Leaderboard */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold text-white mb-4">🏆 Classement</h2>
          <div className="space-y-2">
            {sortedTeams.map((team, index) => (
              <div
                key={team.id}
                className="bg-white/10 rounded-xl p-3 flex items-center gap-3"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-gray-300 text-black' :
                  index === 2 ? 'bg-orange-600 text-white' :
                  'bg-white/20 text-white'
                }`}>
                  {index + 1}
                </div>
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }}></div>
                <div className="flex-1">
                  <p className="text-white font-medium">{team.name}</p>
                  <p className="text-purple-200 text-sm">{team.score} points</p>
                </div>
                {team.isConnected !== false && (
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
