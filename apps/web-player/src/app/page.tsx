'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

// API URL - configurable via environment variable with HTTPS default
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.arena-event.fr';

type GameState = 'JOIN' | 'TEAM_SELECT' | 'LOBBY' | 'QUESTION' | 'BUZZER' | 'WAITING' | 'RESULT' | 'LEADERBOARD' | 'FINISHED';

interface Question {
  id: string;
  text: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'BUZZER' | 'OPEN' | 'BLIND_TEST' | 'TEXT' | 'IMAGE';
  options?: string[];
  points: number;
  negativePoints?: number;
  timeLimit: number;
  mediaUrl?: string;
  artist?: string;
  songTitle?: string;
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
    background: '#1F2937',
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

// Animated background component
const AnimatedBackground = ({ theme }: { theme: EventTheme }) => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          background: theme.background && theme.backgroundType === 'image'
            ? `url(${theme.background}) center/cover`
            : `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.primary}40 50%, ${theme.colors.secondary}40 100%)`
        }}
      />
      {/* Animated orbs */}
      <div
        className="absolute w-96 h-96 rounded-full blur-3xl animate-float opacity-20"
        style={{ backgroundColor: theme.colors.primary, top: '-10%', left: '-10%' }}
      />
      <div
        className="absolute w-80 h-80 rounded-full blur-3xl animate-float-delayed opacity-20"
        style={{ backgroundColor: theme.colors.secondary, bottom: '-10%', right: '-10%' }}
      />
      <div
        className="absolute w-64 h-64 rounded-full blur-3xl animate-float opacity-15"
        style={{ backgroundColor: theme.colors.accent, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
};

// Connection overlay component
const ConnectionOverlay = ({
  isVisible,
  error,
  retryCount,
  maxRetries,
  onRetry,
  onBack,
  theme
}: {
  isVisible: boolean;
  error: string | null;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
  onBack: () => void;
  theme: EventTheme;
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-white/10">
        {/* Animated connection icon */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ backgroundColor: theme.colors.wrong }}
          />
          <div
            className="absolute inset-2 rounded-full animate-pulse"
            style={{ backgroundColor: `${theme.colors.wrong}40` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Connexion perdue</h2>
        <p className="text-gray-400 mb-6">
          {error || 'Tentative de reconnexion en cours...'}
        </p>

        {/* Progress indicator */}
        {retryCount > 0 && retryCount < maxRetries && (
          <div className="mb-6">
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${(retryCount / maxRetries) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">
              Tentative {retryCount}/{maxRetries}...
            </p>
          </div>
        )}

        <button
          onClick={onRetry}
          className="w-full font-bold py-4 px-6 rounded-2xl transition-all transform hover:scale-105 active:scale-95 mb-4"
          style={{
            background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})`,
            color: theme.colors.text
          }}
        >
          Reconnecter maintenant
        </button>

        <button
          onClick={onBack}
          className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium py-3 px-6 rounded-xl transition"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
};

// Page transition wrapper
const PageTransition = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`animate-slide-up ${className}`}>
      {children}
    </div>
  );
};

export default function PlayerHome() {
  // Socket
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showConnectionOverlay, setShowConnectionOverlay] = useState(false);
  const maxRetries = 10;

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

  // Theme
  const [theme, setTheme] = useState<EventTheme>(defaultTheme);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('arena-session');
    const savedTeam = localStorage.getItem('arena-team');
    const savedTheme = localStorage.getItem('arena-theme');
    if (savedSession && savedTeam) {
      try {
        const parsedSession = JSON.parse(savedSession);
        const parsedTeam = JSON.parse(savedTeam);
        setSession(parsedSession);
        setTeam(parsedTeam);
        if (savedTheme) {
          const parsedTheme = JSON.parse(savedTheme);
          setTheme({ ...defaultTheme, ...parsedTheme });
        }
        setGameState('LOBBY');
        connectSocket(parsedSession.id, parsedTeam.id);
      } catch (e) {
        console.error('Failed to restore session:', e);
        localStorage.removeItem('arena-session');
        localStorage.removeItem('arena-team');
        localStorage.removeItem('arena-theme');
      }
    }
  }, []);

  // Handle page visibility changes (mobile app switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page hidden - connection will pause');
      } else {
        console.log('Page visible - checking connection');
        if (socketRef.current && !socketRef.current.connected && session && team) {
          console.log('Forcing reconnection...');
          socketRef.current.connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session, team]);

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
  const [buzzerLockedForMe, setBuzzerLockedForMe] = useState(false); // Locked from buzzing for current question

  // Blindtest state
  const [isBlindtestPlaying, setIsBlindtestPlaying] = useState(false);
  const [blindtestRevealed, setBlindtestRevealed] = useState(false);
  const [revealedArtist, setRevealedArtist] = useState('');
  const [revealedSong, setRevealedSong] = useState('');

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<Team[]>([]);

  // Finale mode state
  const [isFinaleMode, setIsFinaleMode] = useState(false);
  const [myJokers, setMyJokers] = useState<Record<string, number>>({});
  const [activeJoker, setActiveJoker] = useState<string | null>(null);
  const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);
  const [timePlusActive, setTimePlusActive] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Request fullscreen function
  const requestFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen();
    }
    setIsFullscreen(true);
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTime = useRef<number>(0);

  // Game state ref for socket callbacks
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  // Team ID ref for socket callbacks
  const teamIdRef = useRef<string | null>(null);
  useEffect(() => {
    teamIdRef.current = team?.id || null;
  }, [team]);

  // Join session via API
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${API_URL}/sessions/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: sessionCode.toUpperCase() }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Session non trouvée');
      }

      const data = await res.json();
      const newSession = {
        id: data.session.id,
        code: data.session.code,
        eventName: data.session.event?.name || 'Arena Event',
      };
      setSession(newSession);
      localStorage.setItem('arena-session', JSON.stringify(newSession));
      setExistingTeams(data.session.teams || []);

      // Fetch theme for this session
      try {
        const themeRes = await fetch(`${API_URL}/sessions/${data.session.id}/theme`);
        if (themeRes.ok) {
          const themeData = await themeRes.json();
          setTheme({ ...defaultTheme, ...themeData });
          localStorage.setItem('arena-theme', JSON.stringify({ ...defaultTheme, ...themeData }));
        }
      } catch (themeError) {
        console.error('Failed to fetch theme:', themeError);
      }

      setGameState('TEAM_SELECT');
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Le serveur ne répond pas. Vérifiez votre connexion.');
        } else if (err.message.includes('fetch') || err.message.includes('network')) {
          setError('Erreur réseau. Impossible de joindre le serveur.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Erreur lors de la connexion à la session');
      }
    } finally {
      setLoading(false);
    }
  };

  // Create or join team
  const handleTeamJoin = async () => {
    if (!teamName.trim() || !session) {
      setError('Entrez un nom d\'équipe');
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
        throw new Error(data.error || 'Impossible de créer l\'équipe');
      }

      const data = await res.json();
      setTeam(data);
      localStorage.setItem('arena-team', JSON.stringify(data));
      setGameState('LOBBY');
      connectSocket(session.id, data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  // Join existing team
  const joinExistingTeam = async (existingTeam: Team) => {
    if (!session) return;

    setTeam(existingTeam);
    localStorage.setItem('arena-team', JSON.stringify(existingTeam));
    setTeamName(existingTeam.name);
    setGameState('LOBBY');
    connectSocket(session.id, existingTeam.id);
  };

  // Manual retry function
  const retryConnection = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.connect();
    } else if (session && team) {
      connectSocket(session.id, team.id);
    }
    setRetryCount(prev => prev + 1);
  }, [session, team]);

  // Go back to home
  const goBackToHome = useCallback(() => {
    socketRef.current?.disconnect();
    localStorage.removeItem('arena-session');
    localStorage.removeItem('arena-team');
    localStorage.removeItem('arena-theme');
    setShowConnectionOverlay(false);
    setConnectionError(null);
    setGameState('JOIN');
    setSession(null);
    setTeam(null);
    setTheme(defaultTheme);
  }, []);

  // Socket connection
  const connectSocket = (sessionId: string, teamId: string) => {
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
      console.log('Socket connected!');
      setIsConnected(true);
      setConnectionError(null);
      setShowConnectionOverlay(false);
      setRetryCount(0);
      socket.emit('join-session', {
        sessionId,
        teamId,
        role: 'player',
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      if (gameStateRef.current !== 'JOIN' && gameStateRef.current !== 'TEAM_SELECT') {
        setShowConnectionOverlay(true);
        setConnectionError(`Connexion perdue: ${reason}`);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      setConnectionError(`Erreur de connexion: ${err.message}`);
      setShowConnectionOverlay(true);
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      console.log('Reconnection attempt:', attempt);
      setRetryCount(attempt);
    });

    socket.io.on('reconnect', () => {
      console.log('Reconnected successfully!');
      setIsConnected(true);
      setConnectionError(null);
      setShowConnectionOverlay(false);
      setRetryCount(0);
    });

    socket.io.on('reconnect_failed', () => {
      console.error('All reconnection attempts failed');
      setConnectionError('Impossible de se reconnecter au serveur');
      setShowConnectionOverlay(true);
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
      setBuzzerLockedForMe(false); // Reset lock for new question
      questionStartTime.current = Date.now();
      setGameState('QUESTION');
      startTimer(data.timeLimit || data.question.timeLimit || 30);
    });

    socket.on('question-end', (data) => {
      stopTimer();
      setCorrectAnswer(data.correctAnswer);

      if (data.answers && teamIdRef.current) {
        const myAnswer = data.answers.find((a: any) => a.teamId === teamIdRef.current);
        if (myAnswer) {
          setIsCorrect(myAnswer.isCorrect);
          setPointsEarned(myAnswer.points || 0);
        }
      }

      setGameState('RESULT');
    });

    socket.on('timer-sync', (data) => {
      setTimeRemaining(data.remaining);
    });

    socket.on('timer-update', (data) => {
      setTimeRemaining(data.timeRemaining || data.remaining);
    });

    socket.on('timer-end', () => {
      stopTimer();
      setTimeRemaining(0);
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

    socket.on('buzzer-reset', (data) => {
      setBuzzerPressed(false);
      setBuzzerWinner(null);
      // Check if this team is locked
      const lockedIds = data?.lockedTeamIds || [];
      if (lockedIds.includes(teamIdRef.current)) {
        setBuzzerLockedForMe(true);
        setBuzzerOpen(false);
      } else {
        setBuzzerOpen(true);
      }
    });

    socket.on('buzzer-team-locked', (data) => {
      if (data.teamId === teamIdRef.current) {
        setBuzzerLockedForMe(true);
        setBuzzerOpen(false);
      }
    });

    socket.on('buzzer-winner', (data) => {
      setBuzzerWinner(data.teamName);
      if (data.teamId === teamIdRef.current) {
        setBuzzerOpen(false);
      }
    });

    socket.on('buzzer-correct', (data) => {
      if (data.teamId === teamIdRef.current) {
        setIsCorrect(true);
        setPointsEarned(data.points || 0);
        setGameState('RESULT');
      }
      setBuzzerWinner(null);
      setBuzzerPressed(false);
    });

    socket.on('buzzer-wrong', (data) => {
      if (data.teamId === teamIdRef.current) {
        setIsCorrect(false);
        setPointsEarned(0);
        setBuzzerWrongFeedback(true);
        setTimeout(() => setBuzzerWrongFeedback(false), 2000);
        setBuzzerPressed(false);
        // Check if we're locked
        if (data.locked) {
          setBuzzerLockedForMe(true);
          setBuzzerOpen(false);
        } else {
          setBuzzerOpen(true);
        }
      }
      // Don't open buzzer here for other teams - let buzzer-reset handle it
      setBuzzerWinner(null);
    });

    socket.on('answer-result', (data) => {
      if (data.teamId === teamIdRef.current) {
        console.log('Answer submitted successfully');
      }
    });

    socket.on('score-update', (data) => {
      if (data.teamId === teamIdRef.current) {
        setTeam(prev => {
          if (!prev) return prev;
          const updated = { ...prev, score: data.newScore };
          localStorage.setItem('arena-team', JSON.stringify(updated));
          return updated;
        });
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

    // Blindtest events
    socket.on('blindtest-play', () => {
      setIsBlindtestPlaying(true);
      setBlindtestRevealed(false);
      setBuzzerOpen(true);
      setBuzzerPressed(false);
    });

    socket.on('blindtest-pause', () => {
      setIsBlindtestPlaying(false);
    });

    socket.on('blindtest-stop', () => {
      setIsBlindtestPlaying(false);
    });

    socket.on('blindtest-reveal', (data) => {
      setBlindtestRevealed(true);
      setIsBlindtestPlaying(false);
      setRevealedArtist(data.artist);
      setRevealedSong(data.songTitle);
      setBuzzerOpen(false);
    });

    // Finale mode events
    socket.on('finale-started', (data) => {
      setIsFinaleMode(true);
      if (data.jokers && teamIdRef.current && data.jokers[teamIdRef.current]) {
        setMyJokers(data.jokers[teamIdRef.current]);
      }
      setEliminatedOptions([]);
    });

    socket.on('finale-question-start', (data) => {
      setCurrentQuestion(data.question);
      setTimeRemaining(data.timeLimit || data.question?.timeLimit || 30);
      setHasAnswered(false);
      setSelectedAnswer(null);
      setTextAnswer('');
      setIsCorrect(null);
      setPointsEarned(0);
      setCorrectAnswer(null);
      setBuzzerPressed(false);
      setBuzzerOpen(data.question?.type === 'BUZZER');
      setBuzzerWinner(null);
      questionStartTime.current = Date.now();
      setGameState('QUESTION');
      startTimer(data.timeLimit || data.question?.timeLimit || 30);

      if (data.jokers && teamIdRef.current && data.jokers[teamIdRef.current]) {
        setMyJokers(data.jokers[teamIdRef.current]);
      }
      setActiveJoker(null);
      setEliminatedOptions([]);
      setTimePlusActive(false);
    });

    socket.on('joker-used', (data) => {
      if (data.teamId === teamIdRef.current) {
        setMyJokers(data.remainingJokers);
        setActiveJoker(data.jokerType);
      }
    });

    socket.on('fifty-fifty-applied', (data) => {
      setEliminatedOptions(data.eliminatedOptions || []);
    });

    socket.on('time-plus-activated', (data) => {
      setTimePlusActive(true);
      setTimeout(() => setTimePlusActive(false), 3000);
    });

    socket.on('finale-ended', () => {
      setIsFinaleMode(false);
      setMyJokers({});
      setActiveJoker(null);
      setEliminatedOptions([]);
    });
  };

  const startTimer = (seconds: number) => {
    setTimeRemaining(seconds);
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

    socketRef.current?.emit('submit-answer', {
      sessionId: session.id,
      teamId: team.id,
      questionId: currentQuestion.id,
      answer,
      responseTime,
    });
  };

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
      teamName: team.name,
      team: team,
      timestamp: Date.now(),
    }, (response: { success: boolean; winner: boolean; actualWinner?: { name: string } }) => {
      if (response) {
        if (response.success && response.winner) {
          console.log('Buzzer press confirmed - we won!');
        } else if (!response.success && response.actualWinner) {
          console.log(`Buzzer press rejected - ${response.actualWinner.name} was faster`);
          setBuzzerPressed(false);
          setBuzzerOpen(false);
        }
      }
    });
  };

  // Use joker
  const useJoker = (jokerType: string) => {
    if (!session || !team || !isFinaleMode) return;
    if (!myJokers[jokerType] || myJokers[jokerType] <= 0) return;
    if (activeJoker) return;

    socketRef.current?.emit('joker-use', {
      sessionId: session.id,
      teamId: team.id,
      teamName: team.name,
      jokerType
    });
  };

  // Get joker button style
  const getJokerStyle = (jokerType: string) => {
    const count = myJokers[jokerType] || 0;
    const isActive = activeJoker === jokerType;

    if (count <= 0) return 'bg-gray-800/50 opacity-40 cursor-not-allowed';
    if (isActive) return 'bg-gradient-to-r from-yellow-400 to-orange-500 ring-2 ring-white animate-pulse shadow-lg shadow-yellow-500/30';
    return 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg';
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

  // Timer urgency class
  const getTimerClass = () => {
    if (timeRemaining <= 3) return 'animate-shake text-red-500 scale-125';
    if (timeRemaining <= 5) return 'animate-pulse text-red-400 scale-110';
    if (timeRemaining <= 10) return 'text-orange-400';
    return 'text-white';
  };

  // ============== RENDER ==============

  // Connection overlay always available
  const connectionOverlay = (
    <ConnectionOverlay
      isVisible={showConnectionOverlay}
      error={connectionError}
      retryCount={retryCount}
      maxRetries={maxRetries}
      onRetry={retryConnection}
      onBack={goBackToHome}
      theme={theme}
    />
  );

  // JOIN SCREEN
  if (gameState === 'JOIN') {
    return (
      <main className="min-h-screen relative overflow-hidden">
        <AnimatedBackground theme={theme} />
        <PageTransition className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="text-7xl mb-4 animate-bounce">🎮</div>
              <h1 className="text-4xl font-black text-white drop-shadow-lg">Arena Event</h1>
              <p className="text-purple-200 mt-2 text-lg">Rejoins la partie !</p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl animate-shake">
                  <p className="text-red-200 text-sm text-center">{error}</p>
                </div>
              )}

              <form onSubmit={handleJoin} className="space-y-6">
                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    Code de session
                  </label>
                  <input
                    type="text"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-5 text-3xl text-center font-black bg-black/30 border-2 border-white/20 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 uppercase tracking-[0.3em] text-white placeholder-white/30"
                    placeholder="ABC123"
                    maxLength={6}
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || sessionCode.length < 4}
                  className="w-full text-white text-2xl font-bold py-5 px-6 rounded-2xl shadow-lg transition duration-200 transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:transform-none"
                  style={{ background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})` }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Connexion...
                    </span>
                  ) : 'REJOINDRE'}
                </button>
              </form>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { icon: '⚡', label: 'Rapide' },
                { icon: '🎯', label: 'Temps réel' },
                { icon: '🏆', label: 'Compétitif' },
              ].map((item, idx) => (
                <div key={idx} className="bg-white/10 backdrop-blur rounded-xl p-4 text-center border border-white/10">
                  <div className="text-3xl mb-1">{item.icon}</div>
                  <div className="text-xs text-white/80 font-semibold">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </PageTransition>
      </main>
    );
  }

  // TEAM SELECTION SCREEN
  if (gameState === 'TEAM_SELECT') {
    return (
      <main className="min-h-screen relative overflow-hidden">
        <AnimatedBackground theme={theme} />
        <PageTransition className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              {theme.logo && <img src={theme.logo} alt="Logo" className="h-16 mx-auto mb-4" />}
              <div className="text-5xl mb-4">👥</div>
              <h1 className="text-3xl font-bold text-white">{session?.eventName}</h1>
              <p className="text-purple-200 mt-2">
                Code: <span className="font-mono font-bold">{session?.code}</span>
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-6 border border-white/20">
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl">
                  <p className="text-red-200 text-sm text-center">{error}</p>
                </div>
              )}

              {/* Existing teams */}
              {existingTeams.length > 0 && (
                <div className="mb-6">
                  <p className="text-white/80 font-medium mb-3">Rejoindre une équipe:</p>
                  <div className="space-y-2">
                    {existingTeams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => joinExistingTeam(t)}
                        className="w-full flex items-center p-3 bg-black/20 hover:bg-black/30 rounded-xl transition border border-white/10"
                      >
                        <div
                          className="w-10 h-10 rounded-full mr-3 shadow-lg"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="font-semibold text-white">{t.name}</span>
                        <span className="ml-auto font-bold" style={{ color: theme.colors.primary }}>{t.score} pts</span>
                      </button>
                    ))}
                  </div>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/20"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-transparent px-4 text-white/50 text-sm">ou créer une équipe</span>
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
                  className="w-full px-4 py-4 text-xl text-center font-bold bg-black/30 border-2 border-white/20 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/30 text-white placeholder-white/30"
                  placeholder="Nom de l'équipe"
                  maxLength={20}
                />

                <div>
                  <p className="text-white/60 text-sm mb-2 text-center">Choisir une couleur:</p>
                  <div className="flex justify-center gap-3">
                    {colors.map(c => (
                      <button
                        key={c}
                        onClick={() => setTeamColor(c)}
                        className={`w-10 h-10 rounded-full transition transform hover:scale-110 ${
                          teamColor === c ? 'ring-4 ring-white scale-110 shadow-lg' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleTeamJoin}
                  disabled={!teamName.trim() || loading}
                  className="w-full text-white text-xl font-bold py-5 rounded-2xl shadow-lg transition transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  style={{ background: `linear-gradient(to right, ${theme.colors.correct}, #059669)` }}
                >
                  {loading ? 'Création...' : `JOUER EN TANT QUE ${teamName || '...'}`}
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setGameState('JOIN');
                setSession(null);
                setError('');
              }}
              className="mt-6 text-white/60 hover:text-white transition mx-auto block"
            >
              ← Retour
            </button>
          </div>
        </PageTransition>
      </main>
    );
  }

  // LOBBY SCREEN
  if (gameState === 'LOBBY') {
    return (
      <main className="min-h-screen relative overflow-hidden">
        <AnimatedBackground theme={theme} />
        {connectionOverlay}
        <PageTransition className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md text-center">
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 mb-6 border border-white/20">
              {theme.logo && <img src={theme.logo} alt="Logo" className="h-20 mx-auto mb-4" />}
              <div className="text-6xl mb-4 animate-pulse">⏳</div>
              <h1 className="text-3xl font-bold text-white mb-2">En attente...</h1>
              <p className="text-white/60">Le jeu va bientôt commencer!</p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                <span className="text-white/60">Ton équipe</span>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 rounded-full mr-2"
                    style={{ backgroundColor: team?.color || teamColor }}
                  />
                  <span className="font-bold text-white">{team?.name || teamName}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                <span className="text-white/60">Session</span>
                <span className="font-mono font-bold text-white">{session?.code}</span>
              </div>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                <span className="text-white/60">Score</span>
                <span className="font-bold" style={{ color: theme.colors.primary }}>{team?.score || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Status</span>
                <span className={`flex items-center font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                  {isConnected ? 'Connecté' : 'Connexion...'}
                </span>
              </div>
            </div>

            {/* Fullscreen Button */}
            {!isFullscreen && (
              <button
                onClick={requestFullscreen}
                className="mt-6 w-full font-bold py-4 rounded-2xl shadow-lg transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})`, color: theme.colors.text }}
              >
                <span className="text-xl">📱</span>
                <span>Mode Plein Écran</span>
              </button>
            )}

            <p className="mt-6 text-sm text-white/50">
              Préparez-vous! La première question arrive...
            </p>
          </div>
        </PageTransition>
      </main>
    );
  }

  // QUESTION SCREEN
  if (gameState === 'QUESTION' && currentQuestion) {
    return (
      <main className="min-h-screen flex flex-col relative" style={{ backgroundColor: theme.colors.background }}>
        {connectionOverlay}

        {/* Critical time overlay */}
        {timeRemaining <= 5 && (
          <div className="fixed inset-0 bg-red-900/30 pointer-events-none animate-pulse z-10" />
        )}

        {/* Team Info Bar */}
        <div className="bg-black/40 backdrop-blur px-4 py-2 flex items-center justify-between border-b border-white/10 relative z-20">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full shadow-lg"
              style={{ backgroundColor: team?.color || theme.colors.primary }}
            />
            <span className="font-semibold text-sm text-white">{team?.name || 'Équipe'}</span>
          </div>
          <div className="font-bold text-sm" style={{ color: theme.colors.primary }}>
            {team?.score || 0} pts
          </div>
        </div>

        {/* Timer Header */}
        <header
          className={`p-4 text-center transition-all duration-300 relative z-20 ${timeRemaining <= 5 ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor: timeRemaining <= 5 ? theme.colors.wrong :
              timeRemaining <= 10 ? theme.colors.accent :
              isFinaleMode ? theme.colors.accent : theme.colors.primary
          }}
        >
          {isFinaleMode && (
            <div className="text-xs font-bold mb-1 tracking-wider text-white/90">
              🏆 MODE FINALE
            </div>
          )}
          {timePlusActive && (
            <div className="text-xs font-bold mb-1 animate-bounce" style={{ color: theme.colors.correct }}>
              ⏳ +15 SECONDES!
            </div>
          )}
          <div className={`text-5xl font-black transition-all duration-300 ${getTimerClass()}`}>
            {timeRemaining}
          </div>
          <div className="text-sm text-white/80">secondes</div>
        </header>

        {/* Question */}
        <div className="flex-1 p-4 flex flex-col relative z-20">
          <div className="bg-black/40 backdrop-blur-lg rounded-2xl p-6 mb-4 border border-white/10">
            {currentQuestion.mediaUrl && (
              <img
                src={currentQuestion.mediaUrl}
                alt="Question"
                className="w-full h-40 object-cover rounded-xl mb-4"
              />
            )}
            <p className="text-xl font-semibold text-center leading-relaxed text-white">
              {currentQuestion.text}
            </p>
            <p className="text-center mt-2" style={{ color: theme.colors.primary }}>
              {currentQuestion.points} points
              {activeJoker === 'DOUBLE' && <span style={{ color: theme.colors.accent }} className="ml-2">🔥 x2!</span>}
            </p>
          </div>

          {/* Joker Buttons (Finale Mode Only) */}
          {isFinaleMode && !hasAnswered && (
            <div className="bg-black/30 backdrop-blur-lg rounded-2xl p-3 mb-4 border border-white/10">
              <div className="text-xs text-white/60 text-center mb-2 font-semibold">⚡ JOKERS</div>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => useJoker('DOUBLE')}
                  disabled={!myJokers['DOUBLE'] || myJokers['DOUBLE'] <= 0 || !!activeJoker}
                  className={`${getJokerStyle('DOUBLE')} p-2 rounded-xl text-white transition transform active:scale-95`}
                >
                  <div className="text-xl">🔥</div>
                  <div className="text-[10px] font-bold">x2</div>
                  <div className="text-[10px] opacity-70">{myJokers['DOUBLE'] || 0}</div>
                </button>

                <button
                  onClick={() => useJoker('TIME_PLUS')}
                  disabled={!myJokers['TIME_PLUS'] || myJokers['TIME_PLUS'] <= 0 || !!activeJoker}
                  className={`${getJokerStyle('TIME_PLUS')} p-2 rounded-xl text-white transition transform active:scale-95`}
                >
                  <div className="text-xl">⏳</div>
                  <div className="text-[10px] font-bold">+15s</div>
                  <div className="text-[10px] opacity-70">{myJokers['TIME_PLUS'] || 0}</div>
                </button>

                <button
                  onClick={() => useJoker('FIFTY_FIFTY')}
                  disabled={!myJokers['FIFTY_FIFTY'] || myJokers['FIFTY_FIFTY'] <= 0 || !!activeJoker || currentQuestion.type !== 'MCQ'}
                  className={`${getJokerStyle('FIFTY_FIFTY')} p-2 rounded-xl text-white transition transform active:scale-95 ${currentQuestion.type !== 'MCQ' ? 'opacity-30' : ''}`}
                >
                  <div className="text-xl">🎯</div>
                  <div className="text-[10px] font-bold">50/50</div>
                  <div className="text-[10px] opacity-70">{myJokers['FIFTY_FIFTY'] || 0}</div>
                </button>

                <button
                  onClick={() => useJoker('SHIELD')}
                  disabled={!myJokers['SHIELD'] || myJokers['SHIELD'] <= 0 || !!activeJoker}
                  className={`${getJokerStyle('SHIELD')} p-2 rounded-xl text-white transition transform active:scale-95`}
                >
                  <div className="text-xl">🛡️</div>
                  <div className="text-[10px] font-bold">Shield</div>
                  <div className="text-[10px] opacity-70">{myJokers['SHIELD'] || 0}</div>
                </button>
              </div>
              {activeJoker && (
                <div className="text-center mt-2 text-yellow-400 text-xs font-bold animate-pulse">
                  {activeJoker === 'DOUBLE' && '🔥 Points x2 actif!'}
                  {activeJoker === 'TIME_PLUS' && '⏳ +15 secondes ajoutées!'}
                  {activeJoker === 'FIFTY_FIFTY' && '🎯 2 mauvaises réponses éliminées!'}
                  {activeJoker === 'SHIELD' && '🛡️ Bouclier actif!'}
                </div>
              )}
            </div>
          )}

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
                const isEliminated = eliminatedOptions.includes(letter);

                if (isEliminated) {
                  return (
                    <div
                      key={idx}
                      className="bg-gray-800/50 text-gray-500 py-5 px-6 rounded-2xl border-2 border-dashed border-gray-600"
                    >
                      <div className="flex items-center">
                        <span className="w-10 h-10 bg-gray-700/50 rounded-full flex items-center justify-center mr-4 text-xl font-black line-through">
                          {letter}
                        </span>
                        <span className="text-lg text-left flex-1 line-through opacity-50">{option}</span>
                        <span className="text-2xl">❌</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(letter)}
                    disabled={hasAnswered}
                    className={`bg-gradient-to-r ${colorClasses[idx % 4]} text-white font-bold py-5 px-6 rounded-2xl shadow-lg transition transform active:scale-95 disabled:opacity-70 ${
                      isSelected ? 'ring-4 ring-white scale-[1.02] shadow-xl' : ''
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
                  selectedAnswer === 'TRUE' ? 'ring-4 ring-white shadow-xl' : ''
                }`}
              >
                VRAI
              </button>
              <button
                onClick={() => handleAnswer('FALSE')}
                disabled={hasAnswered}
                className={`bg-gradient-to-br from-red-500 to-red-600 text-white font-black text-3xl py-8 rounded-2xl shadow-lg transition transform active:scale-95 ${
                  selectedAnswer === 'FALSE' ? 'ring-4 ring-white shadow-xl' : ''
                }`}
              >
                FAUX
              </button>
            </div>
          )}

          {/* Buzzer */}
          {currentQuestion.type === 'BUZZER' && (
            <div className="flex-1 flex flex-col items-center justify-center">
              {buzzerWrongFeedback && (
                <div className="mb-4 bg-red-500/20 border-2 border-red-500 rounded-xl p-4 text-center animate-shake">
                  <p className="text-red-400 text-xl font-bold">❌ Mauvais! Réessaye!</p>
                </div>
              )}

              {buzzerWinner ? (
                <div className="text-center">
                  <p className="text-2xl text-white mb-4">
                    {buzzerWinner === team?.name ? '🎉 Tu as buzzé!' : `${buzzerWinner} a buzzé!`}
                  </p>
                  {buzzerWinner === team?.name && (
                    <p className="text-white/60">En attente de validation...</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleBuzzer}
                  disabled={buzzerPressed || !buzzerOpen || buzzerLockedForMe}
                  className={`w-56 h-56 rounded-full shadow-2xl transition transform active:scale-90 ${
                    buzzerLockedForMe
                      ? 'bg-gradient-to-br from-gray-700 to-gray-800 border-4 border-red-500'
                      : buzzerPressed
                        ? 'bg-gray-600'
                        : buzzerOpen
                          ? 'bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 animate-pulse shadow-red-500/50'
                          : 'bg-gray-600 opacity-50'
                  }`}
                >
                  <span className="text-white text-3xl font-black">
                    {buzzerLockedForMe ? '🔒 BLOQUÉ' : buzzerPressed ? 'BUZZÉ!' : buzzerOpen ? 'BUZZ!' : 'ATTENDS...'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Open/Text Answer */}
          {(currentQuestion.type === 'OPEN' || currentQuestion.type === 'TEXT') && (
            <div className="flex-1 flex flex-col justify-center">
              <input
                type="text"
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                disabled={hasAnswered}
                className="w-full px-4 py-4 text-xl text-center font-bold bg-black/30 border-2 border-white/20 rounded-2xl focus:outline-none focus:border-purple-500 text-white placeholder-white/30 mb-4"
                placeholder="Ta réponse..."
              />
              <button
                onClick={handleTextAnswer}
                disabled={hasAnswered || !textAnswer.trim()}
                className="w-full font-bold py-4 rounded-2xl disabled:opacity-50 text-white"
                style={{ background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})` }}
              >
                Envoyer
              </button>
            </div>
          )}

          {/* Blindtest */}
          {currentQuestion.type === 'BLIND_TEST' && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className={`mb-6 px-6 py-3 rounded-full ${
                isBlindtestPlaying ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'
              }`}>
                <p className="text-xl font-bold flex items-center">
                  {isBlindtestPlaying ? (
                    <><span className="animate-pulse mr-2">🎵</span> Musique en cours...</>
                  ) : blindtestRevealed ? (
                    <><span className="mr-2">✅</span> Réponse révélée</>
                  ) : (
                    <><span className="mr-2">🎧</span> En attente...</>
                  )}
                </p>
              </div>

              {blindtestRevealed && (
                <div className="mb-6 bg-purple-500/20 border-2 border-purple-500 rounded-xl p-6 text-center">
                  <p className="text-purple-300 text-lg mb-2">C'était...</p>
                  <p className="text-3xl font-bold text-white">{revealedSong}</p>
                  <p className="text-xl text-purple-300 mt-2">par {revealedArtist}</p>
                </div>
              )}

              {buzzerWrongFeedback && (
                <div className="mb-4 bg-red-500/20 border-2 border-red-500 rounded-xl p-4 text-center animate-shake">
                  <p className="text-red-400 text-xl font-bold">❌ Mauvaise réponse!</p>
                </div>
              )}

              {buzzerWinner ? (
                <div className="text-center">
                  <p className="text-2xl text-white mb-4">
                    {buzzerWinner === team?.name ? '🎉 Tu as buzzé!' : `${buzzerWinner} a buzzé!`}
                  </p>
                  {buzzerWinner === team?.name && (
                    <p className="text-white/60">En attente de validation...</p>
                  )}
                </div>
              ) : !blindtestRevealed && (
                <button
                  onClick={handleBuzzer}
                  disabled={buzzerPressed || !buzzerOpen || !isBlindtestPlaying || buzzerLockedForMe}
                  className={`w-56 h-56 rounded-full shadow-2xl transition transform active:scale-90 ${
                    buzzerLockedForMe
                      ? 'bg-gradient-to-br from-gray-700 to-gray-800 border-4 border-red-500'
                      : buzzerPressed
                        ? 'bg-gray-600'
                        : buzzerOpen && isBlindtestPlaying
                          ? 'bg-gradient-to-br from-purple-500 to-pink-700 hover:from-purple-600 hover:to-pink-800 animate-pulse shadow-purple-500/50'
                          : 'bg-gray-600 opacity-50'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-4xl mb-2">{buzzerLockedForMe ? '🔒' : '🎵'}</span>
                    <span className="text-white text-2xl font-black">
                      {buzzerLockedForMe ? 'BLOQUÉ' : buzzerPressed ? 'BUZZÉ!' : buzzerOpen && isBlindtestPlaying ? 'JE SAIS!' : 'ATTENDS...'}
                    </span>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Score Footer */}
        <footer className="bg-black/40 backdrop-blur p-4 relative z-20">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-white/60">Ton Score</p>
              <p className="text-2xl font-bold" style={{ color: theme.colors.primary }}>{team?.score || 0}</p>
            </div>
            <div
              className="w-4 h-4 rounded-full shadow-lg"
              style={{ backgroundColor: team?.color || teamColor }}
            />
          </div>
        </footer>
      </main>
    );
  }

  // WAITING SCREEN (after answering)
  if (gameState === 'WAITING') {
    return (
      <main className="min-h-screen relative overflow-hidden" style={{ backgroundColor: theme.colors.background }}>
        <AnimatedBackground theme={theme} />
        {connectionOverlay}
        <PageTransition className="relative z-10 min-h-screen flex flex-col">
          {/* Team Info Bar */}
          <div className="bg-black/40 backdrop-blur px-4 py-2 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: team?.color || '#8B5CF6' }}
              />
              <span className="text-white font-semibold text-sm">{team?.name || 'Équipe'}</span>
            </div>
            <div className="font-bold text-sm" style={{ color: theme.colors.primary }}>
              {team?.score || 0} pts
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-center">
              <div className="text-6xl mb-6 animate-bounce">
                {selectedAnswer ? '✅' : buzzerPressed ? '🔔' : '⏳'}
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {selectedAnswer ? 'Réponse envoyée!' : buzzerPressed ? 'Buzzer appuyé!' : 'Temps écoulé!'}
              </h1>
              <p className="text-white/60">En attente des résultats...</p>

              {selectedAnswer && (
                <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <p className="text-white/60 mb-2">Ta réponse</p>
                  <p className="text-4xl font-bold" style={{ color: theme.colors.primary }}>{selectedAnswer}</p>
                </div>
              )}
            </div>
          </div>
        </PageTransition>
      </main>
    );
  }

  // RESULT SCREEN
  if (gameState === 'RESULT') {
    const wasCorrect = isCorrect || (selectedAnswer && selectedAnswer === correctAnswer);
    const wasShielded = activeJoker === 'SHIELD' && !wasCorrect;

    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
        style={{
          background: wasCorrect
            ? `linear-gradient(135deg, ${theme.colors.correct} 0%, ${theme.colors.correct}99 100%)`
            : wasShielded
              ? `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`
              : `linear-gradient(135deg, ${theme.colors.wrong} 0%, ${theme.colors.wrong}99 100%)`
        }}
      >
        {connectionOverlay}

        {/* Background effects for correct answer */}
        {wasCorrect && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-4 h-4 animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-10%',
                  backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1'][Math.floor(Math.random() * 5)],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        )}

        <PageTransition className="text-center relative z-10">
          <div className="text-8xl mb-6">
            {wasCorrect ? '🎉' : wasShielded ? '🛡️' : '😢'}
          </div>
          <h1 className="text-4xl font-black text-white mb-4">
            {wasCorrect ? 'CORRECT!' : wasShielded ? 'PROTÉGÉ!' : 'RATÉ!'}
          </h1>

          {wasShielded && (
            <div className="bg-white/20 backdrop-blur rounded-2xl p-4 mb-4 animate-pulse">
              <p className="text-white/90 text-lg font-bold">🛡️ Bouclier actif!</p>
              <p className="text-white/70 text-sm">Pas de pénalité</p>
            </div>
          )}

          {correctAnswer && (
            <div className="bg-white/20 backdrop-blur rounded-2xl p-4 mb-4">
              <p className="text-white/80 text-sm">Bonne réponse</p>
              <p className="text-2xl font-bold text-white">{correctAnswer}</p>
            </div>
          )}

          {pointsEarned > 0 && (
            <div className="bg-white/20 backdrop-blur rounded-2xl p-6 mb-6">
              <p className="text-white/80">Points gagnés</p>
              <p className="text-5xl font-black text-white">+{pointsEarned}</p>
              {activeJoker === 'DOUBLE' && (
                <p className="text-yellow-300 text-sm mt-2">🔥 Double actif!</p>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 mt-6">
            <div className="text-center">
              <p className="text-gray-500 text-sm">Score total</p>
              <p className="text-4xl font-bold" style={{ color: theme.colors.primary }}>{team?.score || 0}</p>
            </div>
          </div>
        </PageTransition>
      </main>
    );
  }

  // LEADERBOARD SCREEN
  if (gameState === 'LEADERBOARD') {
    const rank = getRank();

    return (
      <main className="min-h-screen relative overflow-hidden">
        <AnimatedBackground theme={theme} />
        {connectionOverlay}
        <PageTransition className="relative z-10 min-h-screen p-4">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8 pt-4">
              {theme.logo && <img src={theme.logo} alt="Logo" className="h-16 mx-auto mb-4" />}
              <div className="text-5xl mb-4">🏆</div>
              <h1 className="text-3xl font-bold text-white">Classement</h1>
              <p className="mt-2 text-white/80">Ton rang: <span className="font-bold" style={{ color: theme.colors.accent }}>#{rank}</span></p>
            </div>

            <div className="space-y-3">
              {leaderboard.map((t, index) => {
                const isYou = t.id === team?.id;
                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl p-4 flex items-center transition-all duration-300 ${isYou ? 'scale-105' : ''}`}
                    style={{
                      backgroundColor: isYou ? theme.colors.primary : index < 3 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                      border: isYou ? `2px solid ${theme.colors.accent}` : '1px solid rgba(255,255,255,0.1)'
                    }}
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
                        {t.name} {isYou && '(Toi)'}
                      </p>
                    </div>
                    <div className="text-2xl font-bold" style={{ color: isYou ? 'white' : theme.colors.primary }}>{t.score}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </PageTransition>
      </main>
    );
  }

  // FINISHED SCREEN
  if (gameState === 'FINISHED') {
    const rank = getRank();

    return (
      <main className="min-h-screen relative overflow-hidden">
        <AnimatedBackground theme={theme} />
        {connectionOverlay}
        <PageTransition className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
          <div className="text-center">
            {theme.logo && <img src={theme.logo} alt="Logo" className="h-24 mx-auto mb-6" />}
            <div className="text-8xl mb-6">🏆</div>
            <h1 className="text-4xl font-black text-white mb-2">FIN DU JEU!</h1>
            <p className="text-xl text-white/80 mb-8">Résultats finaux</p>

            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
              <div className="flex items-center justify-center mb-4">
                <div
                  className="w-6 h-6 rounded-full mr-2 shadow-lg"
                  style={{ backgroundColor: team?.color || teamColor }}
                />
                <p className="text-white/80 font-semibold">{team?.name}</p>
              </div>
              <p className="text-white/60 mb-2">Score Final</p>
              <p className="text-5xl font-black text-white mb-4">{team?.score || 0}</p>
              <p className="text-white/60 mb-2">Rang Final</p>
              <p className="text-4xl font-bold" style={{ color: theme.colors.accent }}>#{rank}</p>
            </div>

            <button
              onClick={goBackToHome}
              className="mt-8 font-bold py-4 px-8 rounded-2xl shadow-lg text-white"
              style={{ background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})` }}
            >
              Rejouer
            </button>
          </div>
        </PageTransition>
      </main>
    );
  }

  return null;
}
