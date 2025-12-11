'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// API URL - configurable via environment variable or defaults to the VPS
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://91.134.135.247:3001';

type DisplayMode = 'SELECT' | 'LOBBY' | 'WAITING' | 'QUESTION' | 'TIME_UP' | 'REVEAL' | 'LEADERBOARD' | 'BUZZER' | 'PODIUM' | 'PAUSED' | 'BLINDTEST' | 'TRANSITION' | 'SPONSORS';

interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
  hasAnswered?: boolean;
  lastAnswer?: string;
}

interface Question {
  id: string;
  text: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'BUZZER' | 'OPEN' | 'BLIND_TEST' | 'IMAGE' | 'TEXT';
  options?: string[];
  correctAnswer?: string;
  points: number;
  negativePoints?: number;
  timeLimit: number;
  mediaUrl?: string;
  artist?: string;
  songTitle?: string;
  explanation?: string;
  questionCueStart?: number;
  questionCueEnd?: number;
  revealCueStart?: number;
  revealCueEnd?: number;
}

interface Session {
  id: string;
  code: string;
  status: string;
  event: {
    id: string;
    name: string;
    description?: string;
  };
  teams: Team[];
}

interface EventTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    correct: string;
    wrong: string;
  };
  logo: string | null;
  frame: string | null;
  background: string | null;
  backgroundType: 'gradient' | 'solid' | 'image';
  sounds: {
    correct: string | null;
    wrong: string | null;
    timer: string | null;
    buzzer: string | null;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

const defaultTheme: EventTheme = {
  colors: {
    primary: '#8B5CF6',
    secondary: '#EC4899',
    accent: '#F59E0B',
    background: '#0F172A',
    text: '#FFFFFF',
    correct: '#10B981',
    wrong: '#EF4444',
  },
  logo: null,
  frame: null,
  background: null,
  backgroundType: 'gradient',
  sounds: { correct: null, wrong: null, timer: null, buzzer: null },
  fonts: { heading: 'inherit', body: 'inherit' },
};

// Animated particles component
const ParticleBackground = ({ color1, color2 }: { color1: string; color2: string }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full opacity-20 animate-float"
        style={{
          width: `${Math.random() * 100 + 50}px`,
          height: `${Math.random() * 100 + 50}px`,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          background: `linear-gradient(135deg, ${color1}, ${color2})`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${Math.random() * 10 + 10}s`,
        }}
      />
    ))}
  </div>
);

// Confetti component for celebrations
const Confetti = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(50)].map((_, i) => (
      <div
        key={i}
        className="absolute w-3 h-3 animate-confetti"
        style={{
          left: `${Math.random() * 100}%`,
          backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA'][Math.floor(Math.random() * 6)],
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${Math.random() * 2 + 2}s`,
          transform: `rotate(${Math.random() * 360}deg)`,
        }}
      />
    ))}
  </div>
);

export default function ScreenHome() {
  // Socket
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 10;

  // Session
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Theme
  const [theme, setTheme] = useState<EventTheme>(defaultTheme);

  // Display state
  const [displayMode, setDisplayMode] = useState<DisplayMode>('SELECT');
  const [previousMode, setPreviousMode] = useState<DisplayMode>('SELECT');
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [buzzerWinner, setBuzzerWinner] = useState<Team | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showTimeUp, setShowTimeUp] = useState(false);

  // Animation states
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Blindtest state
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [blindtestRevealed, setBlindtestRevealed] = useState(false);
  const [revealedArtist, setRevealedArtist] = useState('');
  const [revealedSong, setRevealedSong] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cueEndTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Transition helper
  const transitionTo = useCallback((newMode: DisplayMode) => {
    setIsTransitioning(true);
    setPreviousMode(displayMode);
    setTimeout(() => {
      setDisplayMode(newMode);
      setIsTransitioning(false);
    }, 300);
  }, [displayMode]);

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(`${API_URL}/sessions?status=ACTIVE`, { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = res.ok ? await res.json() : [];
        const res2 = await fetch(`${API_URL}/sessions?status=WAITING`);
        const data2 = res2.ok ? await res2.json() : [];
        setSessions([...data, ...data2]);
        setConnectionError(null);
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
        if (error instanceof Error && error.name === 'AbortError') {
          setConnectionError('Le serveur ne répond pas. Vérifiez que l\'API est démarrée.');
        } else {
          setConnectionError('Impossible de charger les sessions. Vérifiez votre connexion.');
        }
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();
  }, []);

  // Select session and connect
  const selectSession = async (session: Session) => {
    setSelectedSession(session);
    setTeams(session.teams.map(t => ({ ...t, hasAnswered: false })));
    transitionTo('LOBBY');
    connectSocket(session.id);

    // Fetch theme for this session
    try {
      const res = await fetch(`${API_URL}/sessions/${session.id}/theme`);
      if (res.ok) {
        const themeData = await res.json();
        setTheme({ ...defaultTheme, ...themeData });
      }
    } catch (error) {
      console.error('Failed to fetch theme:', error);
    }
  };

  // Socket connection
  const connectSocket = (sessionId: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      reconnectionAttempts: maxRetries,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Screen socket connected');
      setIsConnected(true);
      setConnectionError(null);
      setRetryCount(0);
      socket.emit('join-session', { sessionId, role: 'screen' });
    });

    socket.on('disconnect', (reason) => {
      console.log('Screen socket disconnected:', reason);
      setIsConnected(false);
      setConnectionError(`Connexion perdue: ${reason}`);
    });

    socket.on('connect_error', (err) => {
      console.error('Screen connection error:', err.message);
      setConnectionError(`Erreur de connexion: ${err.message}`);
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      setRetryCount(attempt);
    });

    socket.io.on('reconnect', () => {
      setIsConnected(true);
      setConnectionError(null);
      setRetryCount(0);
    });

    socket.io.on('reconnect_failed', () => {
      setConnectionError('Impossible de se reconnecter au serveur');
    });

    // Team events
    socket.on('team-joined', (data) => {
      setTeams(prev => {
        const exists = prev.find(t => t.id === data.team.id);
        if (exists) return prev;
        return [...prev, { ...data.team, hasAnswered: false }];
      });
    });

    socket.on('team-left', () => {});

    // Game events
    socket.on('question-start', (data) => {
      setCurrentQuestion(data.question);
      setTimeRemaining(data.timeLimit || data.question.timeLimit || 30);
      setCorrectAnswer(null);
      setBuzzerWinner(null);
      setAnswers({});
      setShowTimeUp(false);
      setTeams(prev => prev.map(t => ({ ...t, hasAnswered: false, lastAnswer: undefined })));
      transitionTo('QUESTION');
    });

    socket.on('finale-question-start', (data) => {
      setCurrentQuestion(data.question);
      setTimeRemaining(data.timeLimit || data.question?.timeLimit || 30);
      setCorrectAnswer(null);
      setBuzzerWinner(null);
      setAnswers({});
      setShowTimeUp(false);
      setTeams(prev => prev.map(t => ({ ...t, hasAnswered: false, lastAnswer: undefined })));
      transitionTo('QUESTION');
    });

    socket.on('timer-sync', (data) => {
      setTimeRemaining(data.remaining);
    });

    socket.on('timer-update', (data) => {
      setTimeRemaining(data.timeRemaining || data.remaining);
    });

    socket.on('timer-end', () => {
      setTimeRemaining(0);
      // Show TIME_UP screen briefly before reveal
      setShowTimeUp(true);
      transitionTo('TIME_UP');
    });

    socket.on('question-end', (data) => {
      setCorrectAnswer(data.correctAnswer);
      if (data.explanation) {
        setCurrentQuestion(prev => prev ? { ...prev, explanation: data.explanation } : prev);
      }
      transitionTo('REVEAL');
    });

    socket.on('answer-submitted', (data) => {
      setAnswers(prev => ({ ...prev, [data.teamId]: data.answer }));
      setTeams(prev => prev.map(t =>
        t.id === data.teamId ? { ...t, hasAnswered: true, lastAnswer: data.answer } : t
      ));
    });

    // Buzzer events
    socket.on('buzzer-open', () => {
      setBuzzerWinner(null);
      transitionTo('BUZZER');
    });

    socket.on('buzzer-lock', () => {});

    socket.on('buzzer-reset', () => {
      setBuzzerWinner(null);
    });

    socket.on('buzzer-pressed', (data) => {
      if (!buzzerWinner) {
        setBuzzerWinner(data.team);
      }
    });

    // Score events
    socket.on('score-update', (data) => {
      setTeams(prev => prev.map(t =>
        t.id === data.teamId ? { ...t, score: data.newScore } : t
      ));
    });

    // Display events
    socket.on('show-leaderboard', (data) => {
      if (data.teams) {
        setTeams(data.teams);
      }
      transitionTo('LEADERBOARD');
    });

    socket.on('show-transition', () => {
      transitionTo('TRANSITION');
    });

    socket.on('show-waiting', () => {
      transitionTo('WAITING');
    });

    socket.on('show-sponsors', () => {
      transitionTo('SPONSORS');
    });

    socket.on('game-paused', () => {
      transitionTo('PAUSED');
    });

    socket.on('game-resumed', () => {
      if (currentQuestion) {
        transitionTo('QUESTION');
      }
    });

    socket.on('session-end', () => {
      setShowConfetti(true);
      transitionTo('PODIUM');
    });

    // Blindtest events
    socket.on('blindtest-play', (data) => {
      if (cueEndTimerRef.current) {
        clearTimeout(cueEndTimerRef.current);
        cueEndTimerRef.current = null;
      }

      setIsAudioPlaying(true);
      setBlindtestRevealed(false);
      if (currentQuestion?.type === 'BLIND_TEST') {
        transitionTo('BLINDTEST');
      }
      if (audioRef.current && data.audioUrl) {
        audioRef.current.src = data.audioUrl;
        const startTime = data.questionCueStart || data.startTime || 0;
        audioRef.current.currentTime = startTime;
        audioRef.current.play().catch(console.error);

        const endTime = data.questionCueEnd || data.endTime;
        if (endTime && endTime > startTime) {
          const duration = (endTime - startTime) * 1000;
          cueEndTimerRef.current = setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.pause();
            }
            setIsAudioPlaying(false);
          }, duration);
        }
      }
    });

    socket.on('blindtest-pause', () => {
      if (cueEndTimerRef.current) {
        clearTimeout(cueEndTimerRef.current);
        cueEndTimerRef.current = null;
      }
      setIsAudioPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    });

    socket.on('blindtest-stop', () => {
      if (cueEndTimerRef.current) {
        clearTimeout(cueEndTimerRef.current);
        cueEndTimerRef.current = null;
      }
      setIsAudioPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    });

    socket.on('blindtest-reveal', (data) => {
      if (cueEndTimerRef.current) {
        clearTimeout(cueEndTimerRef.current);
        cueEndTimerRef.current = null;
      }

      setBlindtestRevealed(true);
      setRevealedArtist(data.artist);
      setRevealedSong(data.songTitle);

      if (audioRef.current && data.audioUrl) {
        const startTime = data.revealCueStart || data.startTime || 0;
        audioRef.current.src = data.audioUrl;
        audioRef.current.currentTime = startTime;
        audioRef.current.play().catch(console.error);
        setIsAudioPlaying(true);

        const endTime = data.revealCueEnd || data.endTime;
        if (endTime && endTime > startTime) {
          const duration = (endTime - startTime) * 1000;
          cueEndTimerRef.current = setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.pause();
            }
            setIsAudioPlaying(false);
          }, duration);
        }
      } else {
        setIsAudioPlaying(false);
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }
    });
  };

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const answeredCount = teams.filter(t => t.hasAnswered).length;

  // Get dramatic timer class
  const getTimerClass = () => {
    if (timeRemaining <= 3) return 'animate-shake text-red-500 scale-150';
    if (timeRemaining <= 5) return 'animate-pulse text-red-400 scale-125';
    if (timeRemaining <= 10) return 'text-orange-400 scale-110';
    return 'text-white';
  };

  // Background style helper
  const getBgStyle = () => {
    if (theme.background && theme.backgroundType === 'image') {
      return { backgroundImage: `url(${theme.background})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    return {};
  };

  // Base container with transition
  const containerClass = `min-h-screen transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`;

  // SESSION SELECT
  if (displayMode === 'SELECT') {
    return (
      <main className={`${containerClass} bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-8`}>
        <ParticleBackground color1={theme.colors.primary} color2={theme.colors.secondary} />

        <div className="relative z-10 text-center mb-12">
          <div className="text-8xl mb-6 animate-bounce">🎮</div>
          <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-orange-400 mb-4">
            Arena Event
          </h1>
          <p className="text-2xl text-purple-300">Écran Public</p>
        </div>

        <div className="relative z-10 w-full max-w-3xl">
          <h2 className="text-3xl font-bold text-white text-center mb-8">Sélectionner une Session</h2>

          {loadingSessions ? (
            <div className="text-center py-12">
              <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-purple-300 text-xl">Chargement...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10">
              <p className="text-6xl mb-4">📭</p>
              <p className="text-2xl text-purple-300">Aucune session active</p>
              <button
                onClick={async () => {
                  setLoadingSessions(true);
                  try {
                    const [res1, res2] = await Promise.all([
                      fetch(`${API_URL}/sessions?status=ACTIVE`),
                      fetch(`${API_URL}/sessions?status=WAITING`)
                    ]);
                    const data1 = res1.ok ? await res1.json() : [];
                    const data2 = res2.ok ? await res2.json() : [];
                    setSessions([...(Array.isArray(data1) ? data1 : []), ...(Array.isArray(data2) ? data2 : [])]);
                  } catch (error) {
                    console.error('Failed to fetch sessions:', error);
                    setSessions([]);
                  } finally {
                    setLoadingSessions(false);
                  }
                }}
                className="mt-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-xl text-xl font-bold transition-all hover:scale-105"
              >
                Rafraîchir
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => selectSession(session)}
                  className="bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-purple-400/50 rounded-2xl p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20 group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-3xl font-bold text-white group-hover:text-purple-300 transition-colors">
                        {session.event.name}
                      </h3>
                      <p className="text-purple-300/70 mt-2">{session.event.description}</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-xl shadow-lg shadow-purple-500/30">
                      <p className="text-sm text-purple-200">Code</p>
                      <p className="text-4xl font-mono font-black text-white">{session.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 mt-6">
                    <span className={`px-4 py-2 rounded-full text-lg font-semibold ${
                      session.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}>
                      {session.status === 'ACTIVE' ? '🟢 En cours' : '🟡 En attente'}
                    </span>
                    <span className="text-purple-300 text-lg">
                      👥 {session.teams.length} équipes
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  // LOBBY
  if (displayMode === 'LOBBY') {
    return (
      <main className={containerClass} style={{ ...getBgStyle(), background: !theme.background ? `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.primary}40 50%, ${theme.colors.secondary}40 100%)` : undefined }}>
        <ParticleBackground color1={theme.colors.primary} color2={theme.colors.secondary} />

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8">
          <div className="text-center mb-8">
            {theme.logo ? (
              <img src={theme.logo} alt="Event Logo" className="max-h-32 mx-auto mb-6 drop-shadow-2xl" />
            ) : (
              <h1 className="text-7xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.accent})` }}>
                🎮 ARENA EVENT
              </h1>
            )}
            <p className="text-3xl font-medium" style={{ color: theme.colors.text }}>{selectedSession?.event.name}</p>
          </div>

          <div className="bg-black/30 backdrop-blur-2xl rounded-3xl p-12 max-w-4xl mx-auto border border-white/10 shadow-2xl">
            <p className="text-2xl mb-4 text-center" style={{ color: `${theme.colors.text}99` }}>🌐 Rejoignez le jeu sur</p>
            <div className="text-4xl font-bold mb-8 text-center px-8 py-4 bg-white/5 rounded-2xl" style={{ color: theme.colors.text }}>
              play.arena-event.fr
            </div>

            <div className="border-t border-white/10 pt-8 mt-8">
              <p className="text-2xl mb-6 text-center" style={{ color: `${theme.colors.text}99` }}>📱 Code de session</p>
              <div className="flex justify-center">
                <div className="inline-block rounded-2xl px-12 py-6 shadow-2xl transform hover:scale-105 transition-transform"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.primary})` }}>
                  <span className="text-7xl font-black tracking-[0.3em]" style={{ color: '#000' }}>
                    {selectedSession?.code}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex justify-center items-center gap-8">
            <div className="bg-black/30 backdrop-blur rounded-2xl px-8 py-6 text-center border border-white/10">
              <div className="text-6xl font-black" style={{ color: theme.colors.correct }}>{teams.length}</div>
              <div className="text-xl mt-2" style={{ color: `${theme.colors.text}99` }}>Équipes connectées</div>
            </div>
          </div>

          {teams.length > 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-3 max-w-4xl">
              {teams.map((team, i) => (
                <div
                  key={team.id}
                  className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 flex items-center gap-2 animate-fade-in border border-white/10"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: team.color }}></div>
                  <span className="font-medium" style={{ color: theme.colors.text }}>{team.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12">
            <div className="inline-flex items-center px-8 py-4 rounded-full text-xl font-bold animate-pulse"
              style={{ backgroundColor: `${theme.colors.accent}33`, color: theme.colors.accent }}>
              <span className="mr-3 text-2xl">⏳</span>
              EN ATTENTE DES JOUEURS...
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            socketRef.current?.disconnect();
            setSelectedSession(null);
            setDisplayMode('SELECT');
          }}
          className="absolute top-8 left-8 text-white/40 hover:text-white transition-colors z-20"
        >
          ← Retour
        </button>
      </main>
    );
  }

  // WAITING (Instructions screen)
  if (displayMode === 'WAITING') {
    return (
      <main className={containerClass} style={{ ...getBgStyle(), background: !theme.background ? `linear-gradient(135deg, ${theme.colors.background}, ${theme.colors.primary}60)` : undefined }}>
        <ParticleBackground color1={theme.colors.primary} color2={theme.colors.accent} />

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-8 text-center">
          {theme.logo && <img src={theme.logo} alt="Logo" className="h-24 mb-8" />}

          <h1 className="text-6xl font-black mb-8" style={{ color: theme.colors.text }}>
            🎯 COMMENT JOUER ?
          </h1>

          <div className="max-w-4xl space-y-6">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 flex items-center gap-6 border border-white/10">
              <div className="text-5xl">📱</div>
              <div className="text-left">
                <h3 className="text-2xl font-bold" style={{ color: theme.colors.text }}>1. Connectez-vous</h3>
                <p className="text-xl" style={{ color: `${theme.colors.text}99` }}>Allez sur play.arena-event.fr et entrez le code</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 flex items-center gap-6 border border-white/10">
              <div className="text-5xl">⏱️</div>
              <div className="text-left">
                <h3 className="text-2xl font-bold" style={{ color: theme.colors.text }}>2. Répondez vite</h3>
                <p className="text-xl" style={{ color: `${theme.colors.text}99` }}>Plus vous répondez vite, plus vous gagnez de points !</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 flex items-center gap-6 border border-white/10">
              <div className="text-5xl">🏆</div>
              <div className="text-left">
                <h3 className="text-2xl font-bold" style={{ color: theme.colors.text }}>3. Gagnez !</h3>
                <p className="text-xl" style={{ color: `${theme.colors.text}99` }}>L'équipe avec le plus de points remporte la partie</p>
              </div>
            </div>
          </div>

          <div className="mt-12 px-8 py-4 rounded-2xl" style={{ backgroundColor: `${theme.colors.accent}33` }}>
            <span className="text-3xl font-bold" style={{ color: theme.colors.accent }}>
              Code: {selectedSession?.code}
            </span>
          </div>
        </div>
      </main>
    );
  }

  // QUESTION
  if (displayMode === 'QUESTION' && currentQuestion) {
    const isUrgent = timeRemaining <= 5;
    const isWarning = timeRemaining <= 10;

    return (
      <main className={`${containerClass} flex flex-col`}
        style={{
          ...getBgStyle(),
          backgroundColor: !theme.background ? theme.colors.background : undefined,
        }}>

        {/* Urgent overlay */}
        {isUrgent && (
          <div className="fixed inset-0 bg-red-500/20 animate-pulse pointer-events-none z-50" />
        )}

        {/* Header */}
        <header className="bg-black/40 backdrop-blur-xl px-8 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-4">
            {theme.logo ? (
              <img src={theme.logo} alt="Logo" className="h-10" />
            ) : (
              <span className="text-3xl">🎮</span>
            )}
            <span className="text-xl font-bold" style={{ color: theme.colors.text }}>{selectedSession?.event.name}</span>
          </div>
          <div className="text-center">
            <span className="text-lg font-semibold" style={{ color: theme.colors.primary }}>Question {questionNumber}/{totalQuestions}</span>
          </div>
          <div className="px-4 py-2 rounded-xl" style={{ backgroundColor: `${theme.colors.primary}33` }}>
            <span className="font-mono text-xl font-bold" style={{ color: theme.colors.primary }}>{selectedSession?.code}</span>
          </div>
        </header>

        {/* DRAMATIC TIMER */}
        <div className={`py-8 text-center relative overflow-hidden transition-all duration-300 ${isUrgent ? 'bg-red-600' : isWarning ? 'bg-orange-500' : ''}`}
          style={{ backgroundColor: !isUrgent && !isWarning ? theme.colors.primary : undefined }}>

          {isUrgent && (
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-red-500 to-red-600 animate-pulse" />
          )}

          <div className={`relative z-10 transition-all duration-300 ${getTimerClass()}`}>
            <div className={`font-black transition-all duration-300 ${isUrgent ? 'text-[12rem] animate-bounce' : isWarning ? 'text-9xl' : 'text-8xl'}`}
              style={{ color: theme.colors.text, textShadow: isUrgent ? '0 0 60px rgba(255,0,0,0.8)' : 'none' }}>
              {timeRemaining}
            </div>
            {isUrgent && (
              <div className="text-3xl font-bold animate-pulse mt-2" style={{ color: theme.colors.text }}>
                ⚠️ DÉPÊCHEZ-VOUS ! ⚠️
              </div>
            )}
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
          {theme.frame && (
            <img src={theme.frame} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10" />
          )}

          <div className="bg-black/40 backdrop-blur-xl rounded-3xl p-12 max-w-5xl w-full text-center shadow-2xl border border-white/10 relative z-0">
            <div className="flex items-center justify-center mb-6 gap-4">
              <span className="px-4 py-2 rounded-full text-lg font-bold border"
                style={{ backgroundColor: `${theme.colors.primary}20`, color: theme.colors.primary, borderColor: `${theme.colors.primary}40` }}>
                {currentQuestion.type === 'MCQ' ? '📝 Choix Multiple' :
                 currentQuestion.type === 'TRUE_FALSE' ? '✅ Vrai ou Faux' :
                 currentQuestion.type === 'BUZZER' ? '🔔 Buzzer' : '💬 Question Ouverte'}
              </span>
              <span className="font-bold text-xl px-4 py-2 rounded-full"
                style={{ backgroundColor: `${theme.colors.accent}20`, color: theme.colors.accent }}>
                🏆 {currentQuestion.points} pts
              </span>
            </div>

            {currentQuestion.mediaUrl && (
              <img src={currentQuestion.mediaUrl} alt="Question media" className="max-w-2xl mx-auto rounded-2xl mb-8 shadow-xl" />
            )}

            <h2 className="text-5xl font-bold leading-tight mb-12" style={{ color: theme.colors.text }}>
              {currentQuestion.text}
            </h2>

            {/* MCQ Options */}
            {currentQuestion.type === 'MCQ' && currentQuestion.options && (
              <div className="grid grid-cols-2 gap-6">
                {currentQuestion.options.map((option, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const gradients = [
                    'from-red-500 to-red-600',
                    'from-blue-500 to-blue-600',
                    'from-yellow-500 to-yellow-600',
                    'from-green-500 to-green-600',
                  ];

                  return (
                    <div
                      key={idx}
                      className={`bg-gradient-to-br ${gradients[idx]} rounded-2xl p-6 flex items-center shadow-xl transform hover:scale-[1.02] transition-transform`}
                    >
                      <span className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mr-6 text-3xl font-black text-white shadow-inner">
                        {letter}
                      </span>
                      <span className="text-2xl font-bold text-white">{option}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* True/False */}
            {currentQuestion.type === 'TRUE_FALSE' && (
              <div className="grid grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-12 text-center shadow-xl transform hover:scale-[1.02] transition-transform">
                  <span className="text-5xl font-black text-white">✓ VRAI</span>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-12 text-center shadow-xl transform hover:scale-[1.02] transition-transform">
                  <span className="text-5xl font-black text-white">✗ FAUX</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Answer Progress */}
        <footer className="bg-black/40 backdrop-blur-xl px-8 py-6 border-t border-white/10">
          <div className="flex items-center justify-center gap-4">
            <span className="text-xl font-semibold" style={{ color: theme.colors.primary }}>📊 Réponses:</span>
            <div className="flex-1 max-w-2xl bg-black/30 rounded-full h-6 overflow-hidden">
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${teams.length > 0 ? (answeredCount / teams.length) * 100 : 0}%`,
                  background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})`
                }}
              />
            </div>
            <span className="text-2xl font-black" style={{ color: theme.colors.text }}>{answeredCount}/{teams.length}</span>
          </div>
        </footer>
      </main>
    );
  }

  // TIME_UP
  if (displayMode === 'TIME_UP') {
    return (
      <main className={`${containerClass} bg-gradient-to-br from-red-900 via-red-800 to-orange-900 flex flex-col items-center justify-center`}>
        <div className="text-center animate-bounce">
          <div className="text-[14rem] mb-4">⏰</div>
          <h1 className="text-8xl font-black text-white mb-4 animate-pulse">TEMPS ÉCOULÉ !</h1>
          <p className="text-4xl text-red-200">Voyons les résultats...</p>
        </div>

        <div className="mt-12 flex gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-6 h-6 bg-white rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </main>
    );
  }

  // REVEAL
  if (displayMode === 'REVEAL' && currentQuestion) {
    return (
      <main className={containerClass} style={{ ...getBgStyle(), background: !theme.background ? `linear-gradient(135deg, ${theme.colors.background}, ${theme.colors.primary}40)` : undefined }}>
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="text-3xl font-bold mb-4" style={{ color: `${theme.colors.text}99` }}>{currentQuestion.text}</h2>
            <p className="text-4xl font-black" style={{ color: theme.colors.primary }}>✨ La bonne réponse est... ✨</p>
          </div>

          {currentQuestion.type === 'MCQ' && currentQuestion.options && (
            <div className="grid grid-cols-2 gap-6 max-w-4xl w-full mb-8">
              {currentQuestion.options.map((option, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const isCorrect = letter === correctAnswer;
                const answerCount = Object.values(answers).filter(a => a === letter).length;

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl p-6 flex items-center justify-between transition-all duration-700 ${
                      isCorrect ? 'scale-105 animate-pulse shadow-2xl' : 'opacity-40 scale-95'
                    }`}
                    style={{
                      backgroundColor: isCorrect ? theme.colors.correct : 'rgba(0,0,0,0.3)',
                      boxShadow: isCorrect ? `0 0 60px ${theme.colors.correct}60` : 'none'
                    }}
                  >
                    <div className="flex items-center">
                      <span className="w-14 h-14 rounded-full flex items-center justify-center mr-4 text-2xl font-black"
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: theme.colors.text }}>
                        {isCorrect ? '✓' : letter}
                      </span>
                      <span className="text-xl font-bold" style={{ color: theme.colors.text }}>{option}</span>
                    </div>
                    <div className="rounded-full px-4 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                      <span className="text-xl font-bold" style={{ color: theme.colors.text }}>{answerCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {currentQuestion.type === 'TRUE_FALSE' && (
            <div className="grid grid-cols-2 gap-8 max-w-2xl w-full mb-8">
              {['TRUE', 'FALSE'].map((val) => {
                const isCorrect = correctAnswer === val;
                return (
                  <div key={val}
                    className={`rounded-2xl p-12 text-center transition-all duration-700 ${isCorrect ? 'scale-105 animate-pulse shadow-2xl' : 'opacity-40 scale-95'}`}
                    style={{ backgroundColor: isCorrect ? theme.colors.correct : 'rgba(0,0,0,0.3)', boxShadow: isCorrect ? `0 0 60px ${theme.colors.correct}60` : 'none' }}>
                    <span className="text-4xl font-black" style={{ color: theme.colors.text }}>{val === 'TRUE' ? '✓ VRAI' : '✗ FAUX'}</span>
                    <div className="mt-4 text-2xl" style={{ color: `${theme.colors.text}99` }}>
                      {Object.values(answers).filter(a => a === val).length} réponses
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(currentQuestion.type === 'BUZZER' || currentQuestion.type === 'OPEN' || currentQuestion.type === 'TEXT') && correctAnswer && (
            <div className="rounded-2xl px-12 py-8 mb-8 animate-pulse shadow-2xl"
              style={{ backgroundColor: theme.colors.correct, boxShadow: `0 0 60px ${theme.colors.correct}60` }}>
              <p className="text-2xl mb-2" style={{ color: `${theme.colors.text}99` }}>Réponse correcte</p>
              <p className="text-5xl font-black" style={{ color: theme.colors.text }}>{correctAnswer}</p>
            </div>
          )}

          <div className="flex gap-8 mb-8">
            <div className="rounded-2xl px-8 py-6 text-center" style={{ backgroundColor: `${theme.colors.correct}33`, border: `2px solid ${theme.colors.correct}` }}>
              <div className="text-5xl font-bold" style={{ color: theme.colors.correct }}>
                {Object.values(answers).filter(a => a === correctAnswer).length}
              </div>
              <div className="mt-2" style={{ color: theme.colors.correct }}>✓ Bonnes réponses</div>
            </div>
            <div className="rounded-2xl px-8 py-6 text-center" style={{ backgroundColor: `${theme.colors.wrong}33`, border: `2px solid ${theme.colors.wrong}` }}>
              <div className="text-5xl font-bold" style={{ color: theme.colors.wrong }}>
                {Object.values(answers).filter(a => a && a !== correctAnswer).length}
              </div>
              <div className="mt-2" style={{ color: theme.colors.wrong }}>✗ Mauvaises réponses</div>
            </div>
          </div>

          {currentQuestion.explanation && (
            <div className="max-w-4xl w-full rounded-2xl p-8 text-center animate-fade-in border-2"
              style={{ backgroundColor: `${theme.colors.accent}20`, borderColor: theme.colors.accent }}>
              <div className="text-4xl mb-4">💡</div>
              <p className="text-2xl leading-relaxed" style={{ color: theme.colors.text }}>{currentQuestion.explanation}</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  // LEADERBOARD
  if (displayMode === 'LEADERBOARD') {
    return (
      <main className={containerClass} style={{ ...getBgStyle(), background: !theme.background ? `linear-gradient(135deg, ${theme.colors.background}, ${theme.colors.primary}60, ${theme.colors.secondary}60)` : undefined }}>
        <div className="min-h-screen p-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              {theme.logo && <img src={theme.logo} alt="Logo" className="h-20 mx-auto mb-4" />}
              <div className="text-7xl mb-4">🏆</div>
              <h1 className="text-6xl font-black" style={{ color: theme.colors.text }}>CLASSEMENT</h1>
            </div>

            <div className="space-y-4">
              {sortedTeams.map((team, index) => {
                const isTop3 = index < 3;
                const medals = ['🥇', '🥈', '🥉'];

                return (
                  <div
                    key={team.id}
                    className="rounded-2xl p-6 flex items-center animate-slide-in"
                    style={{
                      animationDelay: `${index * 0.1}s`,
                      background: isTop3 ? `linear-gradient(135deg, ${theme.colors.primary}60, ${theme.colors.secondary}60)` : 'rgba(255,255,255,0.05)',
                      border: isTop3 ? `2px solid ${theme.colors.primary}` : '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl mr-6 shadow-lg ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-600' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                      'bg-gray-700'
                    }`}>
                      {isTop3 ? medals[index] : index + 1}
                    </div>

                    <div className="flex items-center flex-1">
                      <div className="w-6 h-6 rounded-full mr-4 shadow-lg" style={{ backgroundColor: team.color }}></div>
                      <p className="text-3xl font-bold" style={{ color: theme.colors.text }}>{team.name}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-5xl font-black" style={{ color: theme.colors.primary }}>{team.score}</p>
                      <p className="text-sm" style={{ color: `${theme.colors.primary}99` }}>points</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // SPONSORS
  if (displayMode === 'SPONSORS') {
    return (
      <main className={containerClass} style={{ ...getBgStyle(), background: !theme.background ? `linear-gradient(135deg, ${theme.colors.background}, ${theme.colors.primary}40)` : undefined }}>
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
          {theme.logo && <img src={theme.logo} alt="Logo" className="h-24 mb-8" />}

          <h1 className="text-6xl font-black mb-4" style={{ color: theme.colors.text }}>🙏 MERCI À NOS SPONSORS</h1>
          <p className="text-2xl mb-12" style={{ color: `${theme.colors.text}99` }}>Cet événement est rendu possible grâce à :</p>

          <div className="grid grid-cols-3 gap-8 max-w-4xl">
            {/* Placeholder for sponsor logos */}
            <div className="bg-white/10 backdrop-blur rounded-2xl p-8 flex items-center justify-center h-32 border border-white/10">
              <span className="text-2xl" style={{ color: `${theme.colors.text}60` }}>Sponsor 1</span>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-8 flex items-center justify-center h-32 border border-white/10">
              <span className="text-2xl" style={{ color: `${theme.colors.text}60` }}>Sponsor 2</span>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-8 flex items-center justify-center h-32 border border-white/10">
              <span className="text-2xl" style={{ color: `${theme.colors.text}60` }}>Sponsor 3</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // TRANSITION
  if (displayMode === 'TRANSITION') {
    return (
      <main className={`${containerClass} flex flex-col items-center justify-center`}
        style={{ background: `linear-gradient(135deg, ${theme.colors.background}, ${theme.colors.primary}60)` }}>
        <ParticleBackground color1={theme.colors.primary} color2={theme.colors.secondary} />

        <div className="relative z-10 text-center">
          <div className="text-[10rem] mb-8 animate-bounce">⏳</div>
          <h1 className="text-6xl font-black mb-4" style={{ color: theme.colors.text }}>Prochaine Question...</h1>
          <p className="text-3xl" style={{ color: `${theme.colors.text}80` }}>Préparez-vous !</p>
        </div>

        <div className="mt-12 flex gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-5 h-5 rounded-full animate-bounce"
              style={{ backgroundColor: theme.colors.primary, animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </main>
    );
  }

  // BUZZER
  if (displayMode === 'BUZZER') {
    return (
      <main className={`${containerClass} flex flex-col items-center justify-center`}
        style={{ background: buzzerWinner ? `linear-gradient(135deg, ${theme.colors.wrong}80, ${theme.colors.wrong}40)` : `linear-gradient(135deg, ${theme.colors.background}, ${theme.colors.primary}60)` }}>
        {buzzerWinner ? (
          <div className="text-center animate-fade-in">
            <div className="text-[14rem] mb-8 animate-bounce">🔔</div>
            <h1 className="text-8xl font-black mb-8" style={{ color: theme.colors.wrong }}>BUZZ!</h1>
            <div className="rounded-3xl px-20 py-16 border-4"
              style={{ backgroundColor: `${theme.colors.wrong}30`, borderColor: theme.colors.wrong }}>
              <p className="text-7xl font-black" style={{ color: theme.colors.text }}>{buzzerWinner.name}</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-[14rem] mb-8 animate-pulse">🔔</div>
            <h1 className="text-6xl font-bold mb-4" style={{ color: theme.colors.text }}>Buzzer Ouvert !</h1>
            <p className="text-3xl" style={{ color: `${theme.colors.text}80` }}>Premier arrivé, premier servi !</p>
          </div>
        )}
      </main>
    );
  }

  // PAUSED
  if (displayMode === 'PAUSED') {
    return (
      <main className={`${containerClass} flex flex-col items-center justify-center`}
        style={{ background: `linear-gradient(135deg, ${theme.colors.background}, ${theme.colors.primary}40)` }}>
        <div className="text-center">
          <div className="text-[12rem] mb-8">⏸️</div>
          <h1 className="text-6xl font-bold mb-4" style={{ color: theme.colors.text }}>Jeu en Pause</h1>
          <p className="text-2xl" style={{ color: `${theme.colors.text}80` }}>En attente de la reprise...</p>
        </div>
      </main>
    );
  }

  // PODIUM
  if (displayMode === 'PODIUM') {
    const top3 = sortedTeams.slice(0, 3);

    return (
      <main className={`${containerClass} flex flex-col items-center justify-center p-8`}
        style={{ background: `linear-gradient(135deg, ${theme.colors.accent}80, ${theme.colors.primary}80, ${theme.colors.secondary}80)` }}>
        {showConfetti && <Confetti />}

        <div className="relative z-10 text-center mb-12">
          <h1 className="text-7xl font-black mb-4" style={{ color: theme.colors.text }}>🏆 RÉSULTATS FINAUX 🏆</h1>
        </div>

        <div className="relative z-10 flex items-end justify-center gap-8">
          {/* 2nd Place */}
          {top3[1] && (
            <div className="text-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="text-6xl mb-4">🥈</div>
              <div className="bg-gradient-to-b from-gray-300 to-gray-400 rounded-t-2xl w-52 h-44 flex flex-col items-center justify-center shadow-2xl">
                <div className="w-8 h-8 rounded-full mb-2 shadow-lg" style={{ backgroundColor: top3[1].color }}></div>
                <p className="text-2xl font-bold text-gray-800">{top3[1].name}</p>
                <p className="text-3xl font-black text-gray-700">{top3[1].score}</p>
              </div>
              <div className="bg-gray-500 w-52 h-8 rounded-b-lg shadow-lg"></div>
            </div>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <div className="text-center animate-slide-up">
              <div className="text-8xl mb-4 animate-bounce">🥇</div>
              <div className="bg-gradient-to-b from-yellow-400 to-amber-500 rounded-t-2xl w-60 h-60 flex flex-col items-center justify-center shadow-2xl">
                <div className="w-10 h-10 rounded-full mb-2 shadow-lg" style={{ backgroundColor: top3[0].color }}></div>
                <p className="text-3xl font-bold text-yellow-900">{top3[0].name}</p>
                <p className="text-5xl font-black text-yellow-800">{top3[0].score}</p>
              </div>
              <div className="bg-amber-600 w-60 h-8 rounded-b-lg shadow-lg"></div>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="text-center animate-slide-up" style={{ animationDelay: '0.6s' }}>
              <div className="text-5xl mb-4">🥉</div>
              <div className="bg-gradient-to-b from-orange-400 to-orange-500 rounded-t-2xl w-48 h-36 flex flex-col items-center justify-center shadow-2xl">
                <div className="w-6 h-6 rounded-full mb-2 shadow-lg" style={{ backgroundColor: top3[2].color }}></div>
                <p className="text-xl font-bold text-orange-900">{top3[2].name}</p>
                <p className="text-2xl font-black text-orange-800">{top3[2].score}</p>
              </div>
              <div className="bg-orange-600 w-48 h-8 rounded-b-lg shadow-lg"></div>
            </div>
          )}
        </div>

        <div className="relative z-10 mt-16 text-center">
          <p className="text-3xl" style={{ color: `${theme.colors.text}99` }}>Merci d'avoir joué !</p>
          {theme.logo && <img src={theme.logo} alt="Logo" className="h-16 mx-auto mt-4 opacity-80" />}
        </div>

        <button
          onClick={() => {
            socketRef.current?.disconnect();
            setSelectedSession(null);
            setDisplayMode('SELECT');
            setTeams([]);
            setShowConfetti(false);
          }}
          className="relative z-10 mt-8 font-bold py-4 px-8 rounded-2xl text-xl transition-all hover:scale-105"
          style={{ backgroundColor: theme.colors.text, color: theme.colors.background }}
        >
          Nouvelle Session
        </button>
      </main>
    );
  }

  // BLINDTEST
  if (displayMode === 'BLINDTEST') {
    return (
      <main className={`${containerClass} flex flex-col items-center justify-center relative overflow-hidden`}
        style={{ background: `linear-gradient(135deg, ${theme.colors.background}, ${theme.colors.primary}80)` }}>
        <audio ref={audioRef} onEnded={() => setIsAudioPlaying(false)} />

        {/* Animated background circles */}
        {isAudioPlaying && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full animate-ping opacity-20" style={{ backgroundColor: theme.colors.primary, animationDuration: '2s' }}></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full animate-ping opacity-15" style={{ backgroundColor: theme.colors.secondary, animationDuration: '2.5s' }}></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full animate-ping opacity-10" style={{ backgroundColor: theme.colors.accent, animationDuration: '3s' }}></div>
          </div>
        )}

        {/* Audio visualizer bars */}
        {isAudioPlaying && (
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-2 h-40 px-8">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-6 rounded-t-lg animate-audio-bar"
                style={{
                  height: '20%',
                  background: `linear-gradient(to top, ${theme.colors.primary}, ${theme.colors.secondary})`,
                  animationDelay: `${i * 0.05}s`
                }}
              />
            ))}
          </div>
        )}

        <div className="relative z-10 text-center px-8">
          {blindtestRevealed ? (
            <div className="animate-fade-in">
              <div className="text-8xl mb-8">🎵</div>
              <h1 className="text-5xl font-bold mb-4" style={{ color: theme.colors.primary }}>C'ÉTAIT...</h1>
              <div className="bg-black/30 backdrop-blur-xl rounded-3xl p-12 border border-white/10">
                <p className="text-7xl font-black mb-4" style={{ color: theme.colors.text }}>{revealedSong || currentQuestion?.songTitle}</p>
                <p className="text-4xl" style={{ color: `${theme.colors.text}80` }}>par</p>
                <p className="text-6xl font-bold mt-4" style={{ color: theme.colors.secondary }}>{revealedArtist || currentQuestion?.artist}</p>
              </div>
            </div>
          ) : (
            <div>
              <div className={`text-[12rem] mb-8 ${isAudioPlaying ? 'animate-bounce' : ''}`}>
                {isAudioPlaying ? '🎵' : '🎧'}
              </div>
              <h1 className="text-6xl font-black mb-4" style={{ color: theme.colors.text }}>
                {isAudioPlaying ? 'ÉCOUTEZ BIEN...' : 'BLINDTEST'}
              </h1>
              <p className="text-3xl" style={{ color: `${theme.colors.text}80` }}>
                {isAudioPlaying ? 'Qui sera le premier à trouver ?' : 'Préparez-vous...'}
              </p>

              <div className="mt-12 rounded-2xl px-8 py-4 inline-block" style={{ backgroundColor: `${theme.colors.accent}30` }}>
                <span className="text-2xl" style={{ color: `${theme.colors.text}80` }}>Points: </span>
                <span className="text-4xl font-bold" style={{ color: theme.colors.accent }}>{currentQuestion?.points}</span>
              </div>
            </div>
          )}

          {buzzerWinner && !blindtestRevealed && (
            <div className="mt-12 rounded-3xl px-16 py-8 animate-pulse border-4"
              style={{ backgroundColor: `${theme.colors.wrong}30`, borderColor: theme.colors.wrong }}>
              <p className="text-3xl mb-2" style={{ color: theme.colors.wrong }}>🔔 BUZZ!</p>
              <p className="text-5xl font-black" style={{ color: theme.colors.text }}>{buzzerWinner.name}</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  return null;
}
