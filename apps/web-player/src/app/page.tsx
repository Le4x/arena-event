'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// API URL - configurable via environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type GameState = 'JOIN' | 'TEAM_SELECT' | 'LOBBY' | 'QUESTION' | 'BUZZER' | 'WAITING' | 'RESULT' | 'LEADERBOARD' | 'FINISHED';

interface Question {
  id: string;
  text: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'BUZZER' | 'OPEN' | 'BLIND_TEST';
  options?: string[];
  points: number;
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

  // Auto-fill session code from URL parameter (for QR code support)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionParam = urlParams.get('session');
      if (sessionParam) {
        setSessionCode(sessionParam.toUpperCase());
        console.log('📱 QR Code detected - session pre-filled:', sessionParam);
      }
    }
  }, []);

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

  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTime = useRef<number>(0);

  // Game state ref for socket callbacks (avoid stale closure)
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  // Join session via API
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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
      setSession({
        id: data.session.id,
        code: data.session.code,
        eventName: data.session.event?.name || 'Arena Event',
      });
      setExistingTeams(data.session.teams || []);
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

      // Save to localStorage for auto-reconnect
      localStorage.setItem('arena_sessionId', session.id);
      localStorage.setItem('arena_teamId', data.id);
      localStorage.setItem('arena_teamName', data.name);
      localStorage.setItem('arena_teamColor', data.color);

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

    // Save to localStorage for auto-reconnect
    localStorage.setItem('arena_sessionId', session.id);
    localStorage.setItem('arena_teamId', existingTeam.id);
    localStorage.setItem('arena_teamName', existingTeam.name);
    localStorage.setItem('arena_teamColor', existingTeam.color);

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

  // Disconnect function (clears localStorage and returns to join screen)
  const handleDisconnect = () => {
    // Clear localStorage
    localStorage.removeItem('arena_sessionId');
    localStorage.removeItem('arena_teamId');
    localStorage.removeItem('arena_teamName');
    localStorage.removeItem('arena_teamColor');

    // Disconnect socket
    socketRef.current?.disconnect();

    // Reset state
    setSession(null);
    setTeam(null);
    setGameState('JOIN');
    setIsConnected(false);

    console.log('🔌 Manually disconnected');
  };

  // Socket connection (optimized for low latency)
  const connectSocket = (sessionId: string, teamId: string) => {
    // Disconnect existing socket if any
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
      // Show overlay only if not in JOIN state (user has joined a session)
      // Use ref to avoid stale closure bug
      if (gameStateRef.current !== 'JOIN' && gameStateRef.current !== 'TEAM_SELECT') {
        setShowConnectionOverlay(true);
        setConnectionError(`Connexion perdue: ${reason}`);
      }
    });

    // Handle device replacement (when another phone connects for same team)
    socket.on('device-replaced', (data) => {
      console.warn('Device replaced:', data.message);
      // Clear localStorage to prevent auto-reconnect loop
      localStorage.removeItem('arena_sessionId');
      localStorage.removeItem('arena_teamId');
      localStorage.removeItem('arena_teamName');
      localStorage.removeItem('arena_teamColor');
      // Show error and disconnect
      setConnectionError(data.message || 'Un autre appareil s\'est connecté pour votre équipe');
      setShowConnectionOverlay(true);
      socket.disconnect();
      // Return to join screen after 3 seconds
      setTimeout(() => {
        setGameState('JOIN');
        setSession(null);
        setTeam(null);
        setShowConnectionOverlay(false);
      }, 3000);
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

    // Health check - ping/pong every 30s
    const healthCheckInterval = setInterval(() => {
      if (socket.connected) {
        const pingTime = Date.now();
        socket.emit('ping');
        socket.once('pong', (data) => {
          const latency = Date.now() - pingTime;
          console.log(`🏓 Pong received (${latency}ms)`);
        });
      }
    }, 30000);

    // Send heartbeat every 15s
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 15000);

    // Cleanup intervals on disconnect
    socket.on('disconnect', () => {
      clearInterval(healthCheckInterval);
      clearInterval(heartbeatInterval);
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

    // Server-side timer sync (authoritative)
    socket.on('timer-sync', (data) => {
      setTimeRemaining(data.remaining);
    });

    // Legacy timer-update support
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

    // Listen for score updates from server (after reveal)
    socket.on('score-updated', (data) => {
      if (data.teamId === team?.id) {
        setTeam(prev => prev ? { ...prev, score: data.newScore } : prev);
        console.log(`📊 Score updated: ${data.newScore}`);
      }
    });

    socket.on('score-update', (data) => {
      if (data.teamId === team?.id) {
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

    // Blindtest events
    socket.on('blindtest-play', () => {
      setIsBlindtestPlaying(true);
      setBlindtestRevealed(false);
      // Open buzzer for blindtest
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

    // ========== FINALE MODE EVENTS ==========
    socket.on('finale-started', (data) => {
      setIsFinaleMode(true);
      // Set my jokers from the jokers object
      if (data.jokers && teamId && data.jokers[teamId]) {
        setMyJokers(data.jokers[teamId]);
      }
      setEliminatedOptions([]);
    });

    socket.on('finale-question-start', (data) => {
      // Update jokers at start of each finale question
      if (data.jokers && teamId && data.jokers[teamId]) {
        setMyJokers(data.jokers[teamId]);
      }
      setActiveJoker(null);
      setEliminatedOptions([]);
      setTimePlusActive(false);
    });

    socket.on('joker-used', (data) => {
      if (data.teamId === teamId) {
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

  // Timer is now server-side - no client-side interval needed
  // The server emits 'timer-sync' events every 100ms for smooth synchronized updates
  const startTimer = (seconds: number) => {
    // Only set initial time, server will sync the rest
    setTimeRemaining(seconds);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Submit answer (Socket only for lower latency - no duplicate REST call)
  const handleAnswer = async (answer: string) => {
    if (hasAnswered || !currentQuestion || !session || !team) return;

    setSelectedAnswer(answer);
    setHasAnswered(true);
    setGameState('WAITING');

    const responseTime = Date.now() - questionStartTime.current;

    // Send via socket only (server handles persistence)
    socketRef.current?.emit('submit-answer', {
      sessionId: session.id,
      teamId: team.id,
      questionId: currentQuestion.id,
      answer,
      responseTime,
    });
  };

  // Submit text answer
  const handleTextAnswer = () => {
    if (textAnswer.trim()) {
      handleAnswer(textAnswer.trim());
    }
  };

  // Press buzzer (with server acknowledgment for reliability)
  const handleBuzzer = () => {
    if (buzzerPressed || !buzzerOpen || !session || !team) return;

    setBuzzerPressed(true);

    // Emit with acknowledgment callback
    socketRef.current?.emit('buzzer-press', {
      sessionId: session.id,
      teamId: team.id,
      teamName: team.name,
      team: team,
      timestamp: Date.now(),
    }, (response: { success: boolean; winner: boolean; actualWinner?: { name: string } }) => {
      // Handle acknowledgment from server
      if (response) {
        if (response.success && response.winner) {
          // We won the buzzer!
          console.log('Buzzer press confirmed - we won!');
        } else if (!response.success && response.actualWinner) {
          // Someone else was faster
          console.log(`Buzzer press rejected - ${response.actualWinner.name} was faster`);
          setBuzzerPressed(false);
          // Keep buzzer locked since someone else won
          setBuzzerOpen(false);
        }
      }
    });
  };

  // Use joker (finale mode only)
  const useJoker = (jokerType: string) => {
    if (!session || !team || !isFinaleMode) return;
    if (!myJokers[jokerType] || myJokers[jokerType] <= 0) return;
    if (activeJoker) return; // Already using a joker this question

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

    if (count <= 0) return 'bg-gray-700 opacity-40 cursor-not-allowed';
    if (isActive) return 'bg-gradient-to-r from-yellow-400 to-orange-500 ring-2 ring-white animate-pulse';
    return 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600';
  };

  // Auto-reconnect from localStorage on page load
  useEffect(() => {
    const savedSessionId = localStorage.getItem('arena_sessionId');
    const savedTeamId = localStorage.getItem('arena_teamId');
    const savedTeamName = localStorage.getItem('arena_teamName');
    const savedTeamColor = localStorage.getItem('arena_teamColor');

    if (savedSessionId && savedTeamId && savedTeamName) {
      console.log('🔄 Auto-reconnecting to session...');

      // Fetch fresh team data from server to get current score
      fetch(`${API_URL}/api/teams/${savedTeamId}`)
        .then(res => res.json())
        .then(teamData => {
          // Restore session and team state with fresh data
          setSession({
            id: savedSessionId,
            code: '',
            eventName: 'Arena Event',
          });
          setTeam({
            id: teamData.id,
            name: teamData.name,
            color: teamData.color,
            score: teamData.score, // Fresh score from server
          });
          setGameState('LOBBY');
          // Reconnect socket
          connectSocket(savedSessionId, savedTeamId);
        })
        .catch(err => {
          console.error('Auto-reconnect failed:', err);
          // Clear localStorage if team no longer exists
          localStorage.removeItem('arena_sessionId');
          localStorage.removeItem('arena_teamId');
          localStorage.removeItem('arena_teamName');
          localStorage.removeItem('arena_teamColor');
        });
    }
  }, []);

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

            {/* Disconnect Button */}
            <button
              onClick={handleDisconnect}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg mb-4 transition-all"
            >
              🔌 Déconnexion
            </button>

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
          isFinaleMode ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
          'bg-purple-600'
        }`}>
          {/* Finale mode badge */}
          {isFinaleMode && (
            <div className="text-xs font-bold text-white/90 mb-1 tracking-wider">
              🏆 MODE FINALE
            </div>
          )}
          {/* Time plus indicator */}
          {timePlusActive && (
            <div className="text-xs font-bold text-green-300 mb-1 animate-pulse">
              ⏳ +15 SECONDES!
            </div>
          )}
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
            <p className="text-purple-400 text-center mt-2">
              {currentQuestion.points} points
              {activeJoker === 'DOUBLE' && <span className="text-yellow-400 ml-2">🔥 x2!</span>}
            </p>
          </div>

          {/* Joker Buttons (Finale Mode Only) */}
          {isFinaleMode && !hasAnswered && (
            <div className="bg-gray-800/50 rounded-2xl p-3 mb-4">
              <div className="text-xs text-gray-400 text-center mb-2 font-semibold">⚡ JOKERS</div>
              <div className="grid grid-cols-4 gap-2">
                {/* DOUBLE - x2 points */}
                <button
                  onClick={() => useJoker('DOUBLE')}
                  disabled={!myJokers['DOUBLE'] || myJokers['DOUBLE'] <= 0 || !!activeJoker}
                  className={`${getJokerStyle('DOUBLE')} p-2 rounded-xl text-white transition transform active:scale-95`}
                >
                  <div className="text-xl">🔥</div>
                  <div className="text-[10px] font-bold">x2</div>
                  <div className="text-[10px] opacity-70">{myJokers['DOUBLE'] || 0}</div>
                </button>

                {/* TIME_PLUS - +15 seconds */}
                <button
                  onClick={() => useJoker('TIME_PLUS')}
                  disabled={!myJokers['TIME_PLUS'] || myJokers['TIME_PLUS'] <= 0 || !!activeJoker}
                  className={`${getJokerStyle('TIME_PLUS')} p-2 rounded-xl text-white transition transform active:scale-95`}
                >
                  <div className="text-xl">⏳</div>
                  <div className="text-[10px] font-bold">+15s</div>
                  <div className="text-[10px] opacity-70">{myJokers['TIME_PLUS'] || 0}</div>
                </button>

                {/* FIFTY_FIFTY - Remove 2 wrong answers */}
                <button
                  onClick={() => useJoker('FIFTY_FIFTY')}
                  disabled={!myJokers['FIFTY_FIFTY'] || myJokers['FIFTY_FIFTY'] <= 0 || !!activeJoker || currentQuestion.type !== 'MCQ'}
                  className={`${getJokerStyle('FIFTY_FIFTY')} p-2 rounded-xl text-white transition transform active:scale-95 ${currentQuestion.type !== 'MCQ' ? 'opacity-30' : ''}`}
                >
                  <div className="text-xl">🎯</div>
                  <div className="text-[10px] font-bold">50/50</div>
                  <div className="text-[10px] opacity-70">{myJokers['FIFTY_FIFTY'] || 0}</div>
                </button>

                {/* SHIELD - Protect from wrong answer penalty */}
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
                  {activeJoker === 'TIME_PLUS' && '⏳ +15 secondes ajoutees!'}
                  {activeJoker === 'FIFTY_FIFTY' && '🎯 2 mauvaises reponses eliminees!'}
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

                // Don't show eliminated options (50/50 joker)
                if (isEliminated) {
                  return (
                    <div
                      key={idx}
                      className="bg-gray-700/50 text-gray-500 py-5 px-6 rounded-2xl border-2 border-dashed border-gray-600"
                    >
                      <div className="flex items-center">
                        <span className="w-10 h-10 bg-gray-600/50 rounded-full flex items-center justify-center mr-4 text-xl font-black line-through">
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

          {/* Blindtest */}
          {currentQuestion.type === 'BLIND_TEST' && (
            <div className="flex-1 flex flex-col items-center justify-center">
              {/* Status indicator */}
              <div className={`mb-6 px-6 py-3 rounded-full ${
                isBlindtestPlaying ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
              }`}>
                <p className="text-xl font-bold flex items-center">
                  {isBlindtestPlaying ? (
                    <><span className="animate-pulse mr-2">🎵</span> Musique en cours...</>
                  ) : blindtestRevealed ? (
                    <><span className="mr-2">✅</span> Reponse revelee</>
                  ) : (
                    <><span className="mr-2">🎧</span> En attente...</>
                  )}
                </p>
              </div>

              {/* Revealed answer */}
              {blindtestRevealed && (
                <div className="mb-6 bg-purple-500/20 border-2 border-purple-500 rounded-xl p-6 text-center">
                  <p className="text-purple-300 text-lg mb-2">C'etait...</p>
                  <p className="text-3xl font-bold text-white">{revealedSong}</p>
                  <p className="text-xl text-purple-300 mt-2">par {revealedArtist}</p>
                </div>
              )}

              {/* Wrong answer feedback */}
              {buzzerWrongFeedback && (
                <div className="mb-4 bg-red-500/20 border-2 border-red-500 rounded-xl p-4 text-center animate-pulse">
                  <p className="text-red-400 text-xl font-bold">❌ Mauvaise reponse!</p>
                </div>
              )}

              {/* Buzzer winner or buzzer button */}
              {buzzerWinner ? (
                <div className="text-center">
                  <p className="text-2xl text-white mb-4">
                    {buzzerWinner === team?.name ? '🎉 Tu as buzze!' : `${buzzerWinner} a buzze!`}
                  </p>
                  {buzzerWinner === team?.name && (
                    <p className="text-gray-400">En attente de validation...</p>
                  )}
                </div>
              ) : !blindtestRevealed && (
                <button
                  onClick={handleBuzzer}
                  disabled={buzzerPressed || !buzzerOpen || !isBlindtestPlaying}
                  className={`w-56 h-56 rounded-full shadow-2xl transition transform active:scale-90 ${
                    buzzerPressed
                      ? 'bg-gray-600'
                      : buzzerOpen && isBlindtestPlaying
                        ? 'bg-gradient-to-br from-purple-500 to-pink-700 hover:from-purple-600 hover:to-pink-800 animate-pulse'
                        : 'bg-gray-600 opacity-50'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-4xl mb-2">🎵</span>
                    <span className="text-white text-2xl font-black">
                      {buzzerPressed ? 'BUZZE!' : buzzerOpen && isBlindtestPlaying ? 'JE SAIS!' : 'ATTENDS...'}
                    </span>
                  </div>
                </button>
              )}
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
    const wasShielded = activeJoker === 'SHIELD' && !wasCorrect;

    return (
      <main className={`min-h-screen flex flex-col items-center justify-center p-4 ${
        wasCorrect ? 'bg-gradient-to-br from-green-600 to-teal-600' :
        wasShielded ? 'bg-gradient-to-br from-blue-600 to-purple-600' :
        'bg-gradient-to-br from-red-600 to-orange-600'
      }`}>
        <div className="text-center">
          <div className="text-8xl mb-6">
            {wasCorrect ? '🎉' : wasShielded ? '🛡️' : '😢'}
          </div>
          <h1 className="text-4xl font-black text-white mb-4">
            {wasCorrect ? 'CORRECT!' : wasShielded ? 'PROTEGE!' : 'WRONG!'}
          </h1>

          {/* Shield protection message */}
          {wasShielded && (
            <div className="bg-white/20 backdrop-blur rounded-2xl p-4 mb-4 animate-pulse">
              <p className="text-white/90 text-lg font-bold">🛡️ Bouclier actif!</p>
              <p className="text-white/70 text-sm">Pas de penalite</p>
            </div>
          )}

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
              {activeJoker === 'DOUBLE' && (
                <p className="text-yellow-300 text-sm mt-2">🔥 Double actif!</p>
              )}
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

  // Connection Error Overlay - shows when connection is lost
  if (showConnectionOverlay) {
    return (
      <div className="fixed inset-0 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connexion perdue</h2>
          <p className="text-gray-600 mb-6">
            {connectionError || 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.'}
          </p>

          {retryCount > 0 && retryCount < maxRetries && (
            <div className="mb-4">
              <div className="flex items-center justify-center space-x-2 text-gray-500">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Tentative {retryCount}/{maxRetries}...</span>
              </div>
            </div>
          )}

          <button
            onClick={retryConnection}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 mb-4"
          >
            Réessayer la connexion
          </button>

          <button
            onClick={() => {
              socketRef.current?.disconnect();
              setShowConnectionOverlay(false);
              setConnectionError(null);
              setGameState('JOIN');
              setSession(null);
              setTeam(null);
            }}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-6 rounded-xl transition"
          >
            Retour à l'accueil
          </button>

          <p className="text-xs text-gray-400 mt-6">
            Si le problème persiste, contactez l'organisateur
          </p>
        </div>
      </div>
    );
  }

  return null;
}
