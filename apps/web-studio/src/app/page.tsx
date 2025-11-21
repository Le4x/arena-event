'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = 'http://91.134.135.247:3001';

interface Event {
  id: string;
  name: string;
  description?: string;
}

interface Round {
  id: string;
  name: string;
  orderIndex: number;
  questions: Question[];
}

interface Question {
  id: string;
  text: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'BUZZER' | 'OPEN' | 'BLIND_TEST' | 'IMAGE';
  options?: string[];
  correctAnswer?: string;
  points: number;
  timeLimit: number;
  mediaUrl?: string;
  // Cue points for audio playback (in seconds)
  questionCueStart?: number;
  questionCueEnd?: number;
  revealCueStart?: number;
  revealCueEnd?: number;
  // Blindtest specific
  artist?: string;
  songTitle?: string;
}

interface Team {
  id: string;
  name: string;
  color: string;
  score: number;
  isConnected?: boolean;
  lastAnswer?: string;
  buzzerTime?: number;
}

interface Session {
  id: string;
  code: string;
  status: string;
  currentQuestionId?: string;
  currentRoundId?: string;
  event: Event;
  teams: Team[];
}

interface Answer {
  id: string;
  teamId: string;
  questionId: string;
  answer: string;
  isCorrect: boolean;
  responseTime: number;
  points: number;
  team?: Team;
}

type GameStatus = 'LOBBY' | 'PLAYING' | 'BUZZER_OPEN' | 'REVEAL' | 'LEADERBOARD' | 'PAUSED' | 'FINISHED' | 'FINAL' | 'PODIUM';

type JokerType = 'DOUBLE' | 'STEAL' | 'SHIELD';

interface TeamJoker {
  id: string;
  type: JokerType;
  isUsed: boolean;
}

interface Finalist {
  id: string;
  teamId: string;
  teamName: string;
  initialScore: number;
  finalScore: number;
  position?: number;
  isEliminated: boolean;
  jokers: TeamJoker[];
}

interface FinalMode {
  id: string;
  isActive: boolean;
  finalistCount: number;
  currentQuestion: number;
  totalQuestions: number;
  finalists: Finalist[];
}

interface ActiveJoker {
  teamId: string;
  teamName: string;
  jokerType: JokerType;
  targetTeamId?: string;
  targetTeamName?: string;
}

export default function StudioHome() {
  // Socket connection
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Session selection
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Game state
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>('LOBBY');
  const [teams, setTeams] = useState<Team[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);

  // Timer
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Buzzer
  const [buzzerWinner, setBuzzerWinner] = useState<Team | null>(null);
  const [buzzerQueue, setBuzzerQueue] = useState<{team: Team, time: number}[]>([]);
  const [buzzerLocked, setBuzzerLocked] = useState(true);
  const [buzzerPressTime, setBuzzerPressTime] = useState<number>(0);
  const questionStartTimeRef = useRef<number>(0);

  // Blindtest audio
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioRevealed, setAudioRevealed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cueEndTimerRef = useRef<NodeJS.Timeout | null>(null);

  // UI state
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [scoreAdjustment, setScoreAdjustment] = useState(0);
  const [showEndModal, setShowEndModal] = useState(false);

  // Final mode state
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [finalMode, setFinalMode] = useState<FinalMode | null>(null);
  const [selectedFinalistCount, setSelectedFinalistCount] = useState<2 | 4 | 6 | 8>(4);
  const [activeJokers, setActiveJokers] = useState<ActiveJoker[]>([]);
  const [podium, setPodium] = useState<Array<{ position: number; teamId: string; teamName: string; totalScore: number }>>([]);

  // Fetch active sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(`${API_URL}/sessions?status=ACTIVE`);
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
        }
        // Also fetch waiting sessions
        const res2 = await fetch(`${API_URL}/sessions?status=WAITING`);
        if (res2.ok) {
          const data2 = await res2.json();
          setSessions(prev => [...prev, ...data2]);
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();
  }, []);

  // Socket connection
  useEffect(() => {
    if (!selectedSession) return;

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      reconnectionAttempts: 10,
      timeout: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-session', { sessionId: selectedSession.id, role: 'studio' });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for team events
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

    // Listen for answers
    socket.on('answer-submitted', (data) => {
      setAnswers(prev => [...prev, data]);
      setTeams(prev => prev.map(t =>
        t.id === data.teamId ? { ...t, lastAnswer: data.answer } : t
      ));
    });

    // Listen for buzzer
    socket.on('buzzer-pressed', (data) => {
      if (!buzzerLocked) {
        const pressTime = data.timestamp || Date.now();
        setBuzzerQueue(prev => [...prev, { team: data.team, time: pressTime }]);
        if (!buzzerWinner) {
          setBuzzerWinner(data.team);
          setBuzzerPressTime(pressTime);
          // Lock buzzer for other players and announce winner
          socket.emit('buzzer-lock', { sessionId: selectedSession.id });
          socket.emit('buzzer-winner', {
            sessionId: selectedSession.id,
            team: data.team,
            teamId: data.team.id,
            teamName: data.team.name
          });
        }
      }
    });

    // Listen for score updates
    socket.on('score-updated', (data) => {
      setTeams(prev => prev.map(t =>
        t.id === data.teamId ? { ...t, score: data.newScore } : t
      ));
    });

    // Listen for server-side timer sync (authoritative)
    socket.on('timer-sync', (data) => {
      setTimeRemaining(data.remaining);
    });

    // Listen for timer end from server
    socket.on('timer-end', () => {
      setTimeRemaining(0);
      setIsTimerRunning(false);
    });

    // Final mode events
    socket.on('final_started', (data) => {
      setFinalMode(data.finalMode);
      setGameStatus('FINAL');
    });

    socket.on('final_state', (data) => {
      setFinalMode(data.finalMode);
    });

    socket.on('joker_activated', (data) => {
      setActiveJokers(prev => [...prev, {
        teamId: data.teamId,
        teamName: data.teamName,
        jokerType: data.jokerType,
        targetTeamId: data.targetTeamId,
        targetTeamName: data.targetTeamName,
      }]);
    });

    socket.on('final_leaderboard', (data) => {
      if (finalMode) {
        setFinalMode({
          ...finalMode,
          finalists: data.leaderboard.map((entry: any) => ({
            ...finalMode.finalists.find(f => f.teamId === entry.teamId),
            teamName: entry.teamName,
            initialScore: entry.initialScore,
            finalScore: entry.finalScore,
            isEliminated: entry.isEliminated,
          })),
        });
      }
    });

    socket.on('final_ended', (data) => {
      setPodium(data.podium);
      setGameStatus('PODIUM');
    });

    socket.on('podium_revealed', (data) => {
      setPodium(data.podium);
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedSession, buzzerLocked, buzzerWinner, finalMode]);

  // Load session data
  const loadSessionData = useCallback(async (session: Session) => {
    setSelectedSession(session);
    setTeams(session.teams.map(t => ({ ...t, isConnected: false })));

    // Fetch rounds with questions
    try {
      const res = await fetch(`${API_URL}/events/${session.event.id}/rounds`);
      if (res.ok) {
        const roundsData = await res.json();
        // Fetch questions for each round
        const roundsWithQuestions = await Promise.all(
          roundsData.map(async (round: Round) => {
            const qRes = await fetch(`${API_URL}/rounds/${round.id}/questions`);
            const questions = qRes.ok ? await qRes.json() : [];
            return { ...round, questions };
          })
        );
        setRounds(roundsWithQuestions.sort((a, b) => a.orderIndex - b.orderIndex));
      }
    } catch (error) {
      console.error('Failed to load rounds:', error);
    }

    // Fetch existing answers
    try {
      const res = await fetch(`${API_URL}/sessions/${session.id}/answers`);
      if (res.ok) {
        const answersData = await res.json();
        setAnswers(answersData);
      }
    } catch (error) {
      console.error('Failed to load answers:', error);
    }
  }, []);

  // Timer is now server-side - no client-side interval needed
  // The server emits 'timer-sync' events every 100ms for smooth updates
  // Timer cleanup ref kept for legacy code compatibility
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Current question and round
  const currentRound = rounds[currentRoundIndex];
  const currentQuestion = currentRound?.questions?.[currentQuestionIndex];
  const totalQuestions = rounds.reduce((sum, r) => sum + (r.questions?.length || 0), 0);
  const currentQuestionNumber = rounds.slice(0, currentRoundIndex).reduce((sum, r) => sum + (r.questions?.length || 0), 0) + currentQuestionIndex + 1;

  // Game controls
  const startQuestion = async () => {
    if (!currentQuestion || !selectedSession) return;

    setGameStatus('PLAYING');
    setTimeRemaining(currentQuestion.timeLimit || 30);
    setIsTimerRunning(true);
    setBuzzerWinner(null);
    setBuzzerQueue([]);
    setBuzzerPressTime(0);
    setBuzzerLocked(currentQuestion.type !== 'BUZZER' && currentQuestion.type !== 'BLIND_TEST');
    setAnswers(prev => prev.filter(a => a.questionId !== currentQuestion.id));
    setTeams(prev => prev.map(t => ({ ...t, lastAnswer: undefined })));
    questionStartTimeRef.current = Date.now();

    // Reset blindtest state
    setIsAudioPlaying(false);
    setAudioRevealed(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Emit to socket
    socketRef.current?.emit('question-start', {
      sessionId: selectedSession.id,
      question: currentQuestion,
      timeLimit: currentQuestion.timeLimit,
    });

    // Update session state on server
    try {
      await fetch(`${API_URL}/sessions/${selectedSession.id}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          roundId: currentRound.id,
        }),
      });
    } catch (error) {
      console.error('Failed to update question:', error);
    }
  };

  const pauseGame = () => {
    setIsTimerRunning(false);
    setGameStatus('PAUSED');
    socketRef.current?.emit('game-paused', { sessionId: selectedSession?.id });
  };

  const resumeGame = () => {
    setIsTimerRunning(true);
    setGameStatus('PLAYING');
    socketRef.current?.emit('game-resumed', { sessionId: selectedSession?.id });
  };

  const endQuestion = () => {
    setIsTimerRunning(false);
    setGameStatus('REVEAL');
    socketRef.current?.emit('question-end', {
      sessionId: selectedSession?.id,
      questionId: currentQuestion?.id,
      correctAnswer: currentQuestion?.correctAnswer,
    });
  };

  const showLeaderboard = () => {
    setGameStatus('LEADERBOARD');
    socketRef.current?.emit('show-leaderboard', {
      sessionId: selectedSession?.id,
      teams: [...teams].sort((a, b) => b.score - a.score),
    });
  };

  const nextQuestion = () => {
    if (!currentRound) return;

    if (currentQuestionIndex < currentRound.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentRoundIndex < rounds.length - 1) {
      setCurrentRoundIndex(currentRoundIndex + 1);
      setCurrentQuestionIndex(0);
    }
    setGameStatus('LOBBY');
    setTimeRemaining(30);
    setBuzzerWinner(null);
    setBuzzerQueue([]);
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentRoundIndex > 0) {
      setCurrentRoundIndex(currentRoundIndex - 1);
      const prevRound = rounds[currentRoundIndex - 1];
      setCurrentQuestionIndex(prevRound.questions.length - 1);
    }
    setGameStatus('LOBBY');
  };

  // Buzzer controls
  const openBuzzer = () => {
    setBuzzerLocked(false);
    setBuzzerWinner(null);
    setBuzzerQueue([]);
    setGameStatus('BUZZER_OPEN');
    socketRef.current?.emit('buzzer-open', { sessionId: selectedSession?.id });
  };

  const lockBuzzer = () => {
    setBuzzerLocked(true);
    socketRef.current?.emit('buzzer-lock', { sessionId: selectedSession?.id });
  };

  const resetBuzzer = () => {
    setBuzzerWinner(null);
    setBuzzerQueue([]);
    setBuzzerLocked(false);
    socketRef.current?.emit('buzzer-reset', { sessionId: selectedSession?.id });
  };

  // Score management
  const adjustScore = async (team: Team, points: number) => {
    const newScore = Math.max(0, team.score + points);
    setTeams(prev => prev.map(t =>
      t.id === team.id ? { ...t, score: newScore } : t
    ));

    // Update on server
    try {
      await fetch(`${API_URL}/sessions/${selectedSession?.id}/teams/${team.id}/score`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: newScore }),
      });
    } catch (error) {
      console.error('Failed to update score:', error);
    }

    socketRef.current?.emit('score-update', {
      sessionId: selectedSession?.id,
      teamId: team.id,
      newScore,
    });
  };

  const markCorrect = (team: Team) => {
    adjustScore(team, currentQuestion?.points || 100);
  };

  // Calculate buzzer speed bonus and mark correct
  const markBuzzerCorrect = (team: Team) => {
    const basePoints = currentQuestion?.points || 100;
    const timeLimit = currentQuestion?.timeLimit || 30;

    // Calculate speed bonus based on how fast they buzzed
    let speedBonus = 0;
    if (buzzerPressTime > 0 && questionStartTimeRef.current > 0) {
      const responseTimeMs = buzzerPressTime - questionStartTimeRef.current;
      const responseTimeSec = responseTimeMs / 1000;
      const timeRemainingRatio = Math.max(0, (timeLimit - responseTimeSec) / timeLimit);
      speedBonus = Math.round(basePoints * 0.5 * timeRemainingRatio); // Up to 50% bonus
    }

    const totalPoints = basePoints + speedBonus;

    // Adjust score
    adjustScore(team, totalPoints);

    // Emit buzzer-correct event to notify players
    socketRef.current?.emit('buzzer-correct', {
      sessionId: selectedSession?.id,
      team,
      teamId: team.id,
      teamName: team.name,
      points: totalPoints,
      speedBonus
    });

    // Reset buzzer state
    resetBuzzer();
  };

  // Mark buzzer answer as wrong
  const markBuzzerWrong = (team: Team) => {
    // Emit buzzer-wrong event to notify players
    socketRef.current?.emit('buzzer-wrong', {
      sessionId: selectedSession?.id,
      team,
      teamId: team.id,
      teamName: team.name
    });

    // Reset buzzer to allow others to try
    resetBuzzer();
  };

  // ========== BLINDTEST CONTROLS ==========

  const playBlindtest = () => {
    if (!currentQuestion?.mediaUrl) return;

    // Clear any existing cue end timer
    if (cueEndTimerRef.current) {
      clearTimeout(cueEndTimerRef.current);
      cueEndTimerRef.current = null;
    }

    setIsAudioPlaying(true);

    // Auto-open buzzer when music starts
    if (buzzerLocked) {
      setBuzzerLocked(false);
      socketRef.current?.emit('buzzer-open', { sessionId: selectedSession?.id });
    }

    // Play locally for preview with cue point
    if (audioRef.current) {
      const startTime = currentQuestion.questionCueStart || 0;
      audioRef.current.currentTime = startTime;
      audioRef.current.play();

      // Set up cue end timer if there's an end point
      if (currentQuestion.questionCueEnd && currentQuestion.questionCueEnd > startTime) {
        const duration = (currentQuestion.questionCueEnd - startTime) * 1000;
        cueEndTimerRef.current = setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.pause();
          }
          setIsAudioPlaying(false);
        }, duration);
      }
    }

    // Emit to Screen/Player with cue points
    socketRef.current?.emit('blindtest-play', {
      sessionId: selectedSession?.id,
      audioUrl: currentQuestion.mediaUrl,
      questionCueStart: currentQuestion.questionCueStart || 0,
      questionCueEnd: currentQuestion.questionCueEnd || null
    });
  };

  const pauseBlindtest = () => {
    setIsAudioPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
    }

    socketRef.current?.emit('blindtest-pause', {
      sessionId: selectedSession?.id
    });
  };

  const stopBlindtest = () => {
    setIsAudioPlaying(false);

    // Clear cue end timer
    if (cueEndTimerRef.current) {
      clearTimeout(cueEndTimerRef.current);
      cueEndTimerRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    socketRef.current?.emit('blindtest-stop', {
      sessionId: selectedSession?.id
    });
  };

  const revealBlindtest = () => {
    setAudioRevealed(true);

    // Clear cue end timer
    if (cueEndTimerRef.current) {
      clearTimeout(cueEndTimerRef.current);
      cueEndTimerRef.current = null;
    }

    // Parse artist and songTitle from correctAnswer or question fields
    const artist = currentQuestion?.artist || currentQuestion?.correctAnswer?.split(' - ')[0] || 'Unknown Artist';
    const songTitle = currentQuestion?.songTitle || currentQuestion?.correctAnswer?.split(' - ')[1] || currentQuestion?.correctAnswer || 'Unknown Song';

    // Play reveal cue if set
    if (audioRef.current && currentQuestion?.revealCueStart !== undefined) {
      audioRef.current.currentTime = currentQuestion.revealCueStart;
      audioRef.current.play();
      setIsAudioPlaying(true);

      // Set up cue end timer for reveal
      if (currentQuestion.revealCueEnd && currentQuestion.revealCueEnd > currentQuestion.revealCueStart) {
        const duration = (currentQuestion.revealCueEnd - currentQuestion.revealCueStart) * 1000;
        cueEndTimerRef.current = setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.pause();
          }
          setIsAudioPlaying(false);
        }, duration);
      }
    } else {
      // No reveal cue, just stop
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsAudioPlaying(false);
    }

    socketRef.current?.emit('blindtest-reveal', {
      sessionId: selectedSession?.id,
      artist,
      songTitle,
      audioUrl: currentQuestion?.mediaUrl,
      revealCueStart: currentQuestion?.revealCueStart || 0,
      revealCueEnd: currentQuestion?.revealCueEnd || null
    });
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

  // End session
  const endSession = async () => {
    if (!selectedSession) return;

    try {
      await fetch(`${API_URL}/sessions/${selectedSession.id}/end`, {
        method: 'POST',
      });
      socketRef.current?.emit('session-end', { sessionId: selectedSession.id });
      setGameStatus('FINISHED');
      setShowEndModal(false);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  // ========== FINAL MODE CONTROLS ==========

  const startFinalMode = () => {
    if (!selectedSession) return;

    socketRef.current?.emit('start_final', {
      sessionId: selectedSession.id,
      finalistCount: selectedFinalistCount,
      totalQuestions: 5,
    });

    setShowFinalModal(false);
  };

  const getFinalLeaderboard = () => {
    if (!selectedSession) return;
    socketRef.current?.emit('get_final_leaderboard', {
      sessionId: selectedSession.id,
    });
  };

  const endFinalMode = () => {
    if (!selectedSession) return;
    socketRef.current?.emit('end_final', {
      sessionId: selectedSession.id,
    });
  };

  const getJokerIcon = (type: JokerType) => {
    switch (type) {
      case 'DOUBLE': return '2️';
      case 'STEAL': return '🏴‍☠️';
      case 'SHIELD': return '🛡️';
      default: return '🃏';
    }
  };

  const getJokerLabel = (type: JokerType) => {
    switch (type) {
      case 'DOUBLE': return 'x2';
      case 'STEAL': return 'Steal';
      case 'SHIELD': return 'Shield';
      default: return type;
    }
  };

  // Sorted teams
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const connectedTeams = teams.filter(t => t.isConnected);

  // Answer stats for current question
  const getAnswerStats = () => {
    if (!currentQuestion) return {};
    const questionAnswers = answers.filter(a => a.questionId === currentQuestion.id);
    const stats: Record<string, number> = {};

    if (currentQuestion.type === 'MCQ' && currentQuestion.options) {
      currentQuestion.options.forEach((_, idx) => {
        const letter = String.fromCharCode(65 + idx);
        stats[letter] = questionAnswers.filter(a => a.answer === letter).length;
      });
    } else if (currentQuestion.type === 'TRUE_FALSE') {
      stats['TRUE'] = questionAnswers.filter(a => a.answer === 'TRUE').length;
      stats['FALSE'] = questionAnswers.filter(a => a.answer === 'FALSE').length;
    }

    return stats;
  };

  const answerStats = getAnswerStats();

  // Session selection screen
  if (!selectedSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
        <div className="container mx-auto px-6 py-12">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Arena Event Studio
            </h1>
            <p className="text-xl text-gray-400">Game Master Control Panel</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6 text-center">Select a Session</h2>

            {loadingSessions ? (
              <div className="text-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/50 rounded-2xl">
                <p className="text-6xl mb-4">📭</p>
                <p className="text-xl text-gray-400 mb-4">No active sessions found</p>
                <p className="text-gray-500">Create a session in the Admin Dashboard first</p>
                <a
                  href="http://91.134.135.247:3000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-6 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition"
                >
                  Go to Admin Dashboard
                </a>
              </div>
            ) : (
              <div className="grid gap-4">
                {sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => loadSessionData(session)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 hover:border-purple-500 rounded-2xl p-6 text-left transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold group-hover:text-purple-400 transition">
                          {session.event.name}
                        </h3>
                        <p className="text-gray-400 mt-1">{session.event.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 rounded-xl">
                          <p className="text-xs text-purple-200">Code</p>
                          <p className="text-2xl font-mono font-bold">{session.code}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 mt-4 text-sm">
                      <span className={`px-3 py-1 rounded-full ${
                        session.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {session.status}
                      </span>
                      <span className="text-gray-400">
                        {session.teams.length} team{session.teams.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-8 text-center">
              <button
                onClick={() => {
                  setLoadingSessions(true);
                  fetch(`${API_URL}/sessions?status=ACTIVE`)
                    .then(res => res.json())
                    .then(data => {
                      setSessions(data);
                      return fetch(`${API_URL}/sessions?status=WAITING`);
                    })
                    .then(res => res.json())
                    .then(data => setSessions(prev => [...prev, ...data]))
                    .finally(() => setLoadingSessions(false));
                }}
                className="text-purple-400 hover:text-purple-300 transition"
              >
                Refresh Sessions
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSelectedSession(null)}
              className="text-gray-400 hover:text-white transition"
            >
              ← Back
            </button>
            <div className="h-6 w-px bg-gray-700"></div>
            <div>
              <h1 className="text-xl font-bold">{selectedSession.event.name}</h1>
              <p className="text-gray-400 text-sm">Studio Control</p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            {/* Connection Status */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
              isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>

            {/* Session Code */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 rounded-xl">
              <p className="text-xs text-purple-200">Code</p>
              <p className="text-2xl font-mono font-bold tracking-widest">{selectedSession.code}</p>
            </div>

            {/* Status */}
            <div className={`px-4 py-2 rounded-full font-semibold ${
              gameStatus === 'LOBBY' ? 'bg-yellow-500/20 text-yellow-400' :
              gameStatus === 'PLAYING' ? 'bg-green-500/20 text-green-400' :
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
              <p className="text-2xl font-bold text-green-400">{connectedTeams.length}</p>
              <p className="text-xs text-gray-400">Online</p>
            </div>

            {/* End Session Button */}
            <button
              onClick={() => setShowEndModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
            >
              End Session
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar - Teams */}
        <aside className="w-80 bg-gray-800 border-r border-gray-700 h-[calc(100vh-76px)] overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">👥</span> Teams ({teams.length})
            </h2>

            {teams.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-4xl mb-2">⏳</p>
                <p>Waiting for teams...</p>
                <p className="text-sm mt-2">Share code: {selectedSession.code}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedTeams.map((team, index) => (
                  <div
                    key={team.id}
                    onClick={() => openScoreModal(team)}
                    className={`bg-gray-700/50 rounded-lg p-3 transition cursor-pointer hover:bg-gray-700 ${
                      buzzerWinner?.id === team.id ? 'ring-2 ring-red-500 bg-red-500/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
                          style={{ backgroundColor: team.color || (index === 0 ? '#EAB308' : index === 1 ? '#9CA3AF' : index === 2 ? '#EA580C' : '#4B5563') }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{team.name}</p>
                          <p className="text-xs">
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
                          <p className="text-xs text-gray-400">Ans: {team.lastAnswer}</p>
                        )}
                      </div>
                    </div>

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
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto h-[calc(100vh-76px)]">
          {/* No questions warning */}
          {rounds.length === 0 || !currentRound?.questions?.length ? (
            <div className="text-center py-20">
              <p className="text-6xl mb-4">📋</p>
              <h2 className="text-2xl font-bold mb-4">No Questions Found</h2>
              <p className="text-gray-400 mb-6">Add questions to this event in the Admin Dashboard</p>
              <a
                href="http://91.134.135.247:3000"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition"
              >
                Go to Admin Dashboard
              </a>
            </div>
          ) : (
            <>
              {/* Round Navigation */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {rounds.map((round, idx) => (
                    <button
                      key={round.id}
                      onClick={() => {
                        setCurrentRoundIndex(idx);
                        setCurrentQuestionIndex(0);
                        setGameStatus('LOBBY');
                      }}
                      className={`px-4 py-2 rounded-lg transition ${
                        idx === currentRoundIndex
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {round.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timer & Question Navigation */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={prevQuestion}
                    disabled={currentRoundIndex === 0 && currentQuestionIndex === 0}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white p-3 rounded-lg transition"
                  >
                    ◀
                  </button>
                  <div className="text-center">
                    <p className="text-sm text-gray-400">Question</p>
                    <p className="text-2xl font-bold">{currentQuestionNumber} / {totalQuestions}</p>
                  </div>
                  <button
                    onClick={nextQuestion}
                    disabled={currentRoundIndex === rounds.length - 1 && currentQuestionIndex === currentRound.questions.length - 1}
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
                  <p className="text-sm text-gray-400">Time</p>
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

              {/* Current Question */}
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

                {currentQuestion?.mediaUrl && (
                  <div className="mb-4">
                    <img src={currentQuestion.mediaUrl} alt="Question media" className="max-w-full h-auto rounded-lg" />
                  </div>
                )}

                {currentQuestion?.type === 'MCQ' && currentQuestion.options && (
                  <div className="grid grid-cols-2 gap-3">
                    {currentQuestion.options.map((option, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isCorrect = letter === currentQuestion.correctAnswer;
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border-2 transition ${
                            gameStatus === 'REVEAL' && isCorrect
                              ? 'border-green-500 bg-green-500/20'
                              : 'border-gray-600 bg-gray-700/50'
                          }`}
                        >
                          <span className="inline-block w-8 h-8 rounded-full bg-gray-600 text-center leading-8 mr-3 font-bold">
                            {letter}
                          </span>
                          {option}
                          {gameStatus !== 'LOBBY' && (
                            <span className="float-right text-gray-400">
                              {answerStats[letter] || 0}
                            </span>
                          )}
                        </div>
                      );
                    })}
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
                      {gameStatus !== 'LOBBY' && (
                        <span className="block text-sm text-gray-400 mt-2">
                          {answerStats['TRUE'] || 0} responses
                        </span>
                      )}
                    </div>
                    <div className={`flex-1 p-6 rounded-lg border-2 text-center text-xl font-bold ${
                      gameStatus === 'REVEAL' && currentQuestion.correctAnswer === 'FALSE'
                        ? 'border-green-500 bg-green-500/20 text-green-400'
                        : 'border-gray-600 bg-gray-700/50'
                    }`}>
                      FAUX
                      {gameStatus !== 'LOBBY' && (
                        <span className="block text-sm text-gray-400 mt-2">
                          {answerStats['FALSE'] || 0} responses
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {(currentQuestion?.type === 'BUZZER' || currentQuestion?.type === 'OPEN') && (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">Expected answer:</p>
                    <p className={`text-3xl font-bold ${
                      gameStatus === 'REVEAL' ? 'text-green-400' : 'text-gray-500 blur-sm hover:blur-none transition-all cursor-pointer'
                    }`}>
                      {currentQuestion.correctAnswer}
                    </p>
                  </div>
                )}
              </div>

              {/* Main Controls */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <button
                  onClick={startQuestion}
                  disabled={gameStatus === 'PLAYING' || gameStatus === 'BUZZER_OPEN'}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl transition transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                >
                  <span className="text-2xl block mb-1">▶️</span>
                  Start
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
                    disabled={gameStatus === 'LOBBY' || gameStatus === 'REVEAL' || gameStatus === 'LEADERBOARD'}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl transition transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                  >
                    <span className="text-2xl block mb-1">⏸️</span>
                    Pause
                  </button>
                )}

                <button
                  onClick={endQuestion}
                  disabled={gameStatus === 'LOBBY' || gameStatus === 'REVEAL' || gameStatus === 'LEADERBOARD'}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl transition transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                >
                  <span className="text-2xl block mb-1">⏹️</span>
                  Reveal
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
              {(currentQuestion?.type === 'BUZZER' || currentQuestion?.type === 'OPEN') && (
                <div className="bg-gray-800 rounded-xl p-6 mb-6">
                  <h3 className="text-xl font-semibold mb-4">🔔 Buzzer Control</h3>

                  <div className="flex items-center space-x-4 mb-4">
                    <button
                      onClick={openBuzzer}
                      disabled={!buzzerLocked}
                      className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition"
                    >
                      Open Buzzer
                    </button>
                    <button
                      onClick={lockBuzzer}
                      disabled={buzzerLocked}
                      className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition"
                    >
                      Lock Buzzer
                    </button>
                    <button
                      onClick={resetBuzzer}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 rounded-xl transition"
                    >
                      Reset
                    </button>
                  </div>

                  {buzzerWinner && (
                    <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-6 text-center animate-pulse">
                      <p className="text-red-400 text-lg mb-2">🔔 BUZZER!</p>
                      <p className="text-4xl font-bold text-white">{buzzerWinner.name}</p>
                      <div className="flex justify-center space-x-4 mt-4">
                        <button
                          onClick={() => markBuzzerCorrect(buzzerWinner)}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg"
                        >
                          ✓ Correct (+{currentQuestion?.points}+bonus)
                        </button>
                        <button
                          onClick={() => markBuzzerWrong(buzzerWinner)}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg"
                        >
                          ✗ Wrong
                        </button>
                      </div>
                    </div>
                  )}

                  {buzzerQueue.length > 1 && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-400 mb-2">Buzzer Queue:</p>
                      <div className="flex flex-wrap gap-2">
                        {buzzerQueue.map((item, idx) => (
                          <span key={idx} className="bg-gray-700 px-3 py-1 rounded text-sm">
                            {idx + 1}. {item.team.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Blindtest Controls */}
              {currentQuestion?.type === 'BLIND_TEST' && (
                <div className="bg-gray-800 rounded-xl p-6 mb-6">
                  <h3 className="text-xl font-semibold mb-4">🎵 Blindtest Control</h3>

                  {/* Hidden audio element for preview */}
                  {currentQuestion.mediaUrl && (
                    <audio
                      ref={audioRef}
                      src={currentQuestion.mediaUrl}
                      onEnded={() => setIsAudioPlaying(false)}
                    />
                  )}

                  {/* Audio controls */}
                  <div className="flex items-center space-x-4 mb-4">
                    {!isAudioPlaying ? (
                      <button
                        onClick={playBlindtest}
                        disabled={!currentQuestion.mediaUrl}
                        className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition"
                      >
                        ▶️ Play Music
                      </button>
                    ) : (
                      <button
                        onClick={pauseBlindtest}
                        className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 rounded-xl transition"
                      >
                        ⏸️ Pause
                      </button>
                    )}
                    <button
                      onClick={stopBlindtest}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 rounded-xl transition"
                    >
                      ⏹️ Stop
                    </button>
                    <button
                      onClick={revealBlindtest}
                      disabled={audioRevealed}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition"
                    >
                      🎤 Reveal
                    </button>
                  </div>

                  {/* Status */}
                  <div className={`text-center py-3 rounded-xl ${isAudioPlaying ? 'bg-green-500/20 animate-pulse' : 'bg-gray-700/50'}`}>
                    <p className="text-2xl">
                      {isAudioPlaying ? '🎵 Playing...' : audioRevealed ? '✅ Revealed' : '⏸️ Ready'}
                    </p>
                  </div>

                  {/* Answer (hidden until revealed) */}
                  <div className="mt-4 text-center">
                    <p className="text-gray-400 mb-2">Answer:</p>
                    <p className={`text-2xl font-bold transition-all ${
                      audioRevealed ? 'text-green-400' : 'text-gray-500 blur-sm hover:blur-none cursor-pointer'
                    }`}>
                      {currentQuestion.correctAnswer || `${currentQuestion.artist} - ${currentQuestion.songTitle}`}
                    </p>
                  </div>

                  {/* Buzzer for blindtest */}
                  <div className="mt-6 pt-4 border-t border-gray-700">
                    <h4 className="text-lg font-medium mb-3">🔔 Buzzer</h4>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={openBuzzer}
                        disabled={!buzzerLocked}
                        className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition"
                      >
                        Open Buzzer
                      </button>
                      <button
                        onClick={resetBuzzer}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition"
                      >
                        Reset
                      </button>
                    </div>

                    {buzzerWinner && (
                      <div className="mt-4 bg-red-500/20 border-2 border-red-500 rounded-xl p-4 text-center animate-pulse">
                        <p className="text-red-400 mb-1">🔔 BUZZ!</p>
                        <p className="text-2xl font-bold text-white">{buzzerWinner.name}</p>
                        <div className="flex justify-center space-x-4 mt-3">
                          <button
                            onClick={() => markBuzzerCorrect(buzzerWinner)}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg"
                          >
                            ✓ Correct
                          </button>
                          <button
                            onClick={() => markBuzzerWrong(buzzerWinner)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
                          >
                            ✗ Wrong
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Right Sidebar */}
        <aside className="w-64 bg-gray-800 border-l border-gray-700 p-4 h-[calc(100vh-76px)] overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Quick Links</h3>

          <div className="space-y-3">
            <a
              href="http://91.134.135.247:3004"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-blue-600 hover:bg-blue-700 text-white text-center py-3 px-4 rounded-lg transition"
            >
              Screen Display
            </a>
            <a
              href="http://91.134.135.247:3003"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-green-600 hover:bg-green-700 text-white text-center py-3 px-4 rounded-lg transition"
            >
              Player View
            </a>
            <a
              href="http://91.134.135.247:3000"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-purple-600 hover:bg-purple-700 text-white text-center py-3 px-4 rounded-lg transition"
            >
              Admin Dashboard
            </a>
          </div>

          {/* Final Mode Button */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Mode Finale</h3>
            {!finalMode ? (
              <button
                onClick={() => setShowFinalModal(true)}
                disabled={teams.length < 2}
                className="w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-orange-500/25"
              >
                Lancer la Finale
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-yellow-500/20 to-red-500/20 border border-yellow-500/50 rounded-xl p-3 text-center">
                  <p className="text-yellow-400 font-bold">FINALE EN COURS</p>
                  <p className="text-sm text-gray-400">{finalMode.finalistCount} finalistes</p>
                </div>
                <button
                  onClick={getFinalLeaderboard}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  Classement
                </button>
                <button
                  onClick={endFinalMode}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  Terminer & Podium
                </button>
              </div>
            )}
          </div>

          {/* Active Jokers Display */}
          {activeJokers.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">Jokers Actifs</h4>
              {activeJokers.map((joker, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm py-1">
                  <span>{joker.teamName}</span>
                  <span className="px-2 py-1 bg-yellow-500/20 rounded text-yellow-300">
                    {getJokerIcon(joker.jokerType)} {getJokerLabel(joker.jokerType)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-lg font-semibold mb-4">🏆 Top 3</h3>
            <div className="space-y-2">
              {sortedTeams.slice(0, 3).map((team, index) => (
                <div key={team.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </span>
                    <span className="font-medium truncate max-w-[80px]">{team.name}</span>
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
                <span className="text-gray-400">Teams</span>
                <span className="font-medium">{teams.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Online</span>
                <span className="font-medium text-green-400">{connectedTeams.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rounds</span>
                <span className="font-medium">{rounds.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Questions</span>
                <span className="font-medium">{totalQuestions}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Score Modal */}
      {showScoreModal && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Adjust Score</h3>
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
              <p className="text-3xl font-bold">{Math.max(0, selectedTeam.score + scoreAdjustment)}</p>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setShowScoreModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={applyScoreAdjustment}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final Mode Modal */}
      {showFinalModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-yellow-500/30">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                Mode Finale
              </h3>
              <p className="text-gray-400 mt-2">Configurez la grande finale avec jokers</p>
            </div>

            {/* Finalist count selection */}
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-3">Nombre de finalistes</label>
              <div className="grid grid-cols-4 gap-3">
                {([2, 4, 6, 8] as const).map((count) => (
                  <button
                    key={count}
                    onClick={() => setSelectedFinalistCount(count)}
                    disabled={teams.length < count}
                    className={`py-4 rounded-xl font-bold text-2xl transition ${
                      selectedFinalistCount === count
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                        : teams.length < count
                        ? 'bg-gray-700/50 text-gray-600 cursor-not-allowed'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview of finalists */}
            <div className="mb-6 bg-gray-900/50 rounded-xl p-4">
              <h4 className="text-sm text-gray-400 mb-3">Finalistes (Top {selectedFinalistCount})</h4>
              <div className="space-y-2">
                {sortedTeams.slice(0, selectedFinalistCount).map((team, idx) => (
                  <div key={team.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-gray-400 text-black' :
                        idx === 2 ? 'bg-amber-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-medium">{team.name}</span>
                    </div>
                    <span className="text-purple-400 font-bold">{team.score} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Jokers explanation */}
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <h4 className="text-yellow-400 font-semibold mb-2">Jokers disponibles</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-gray-800/50 p-2 rounded text-center">
                  <span className="text-2xl">2️</span>
                  <p className="text-yellow-300 font-bold">x2</p>
                  <p className="text-gray-400 text-xs">Double les points</p>
                </div>
                <div className="bg-gray-800/50 p-2 rounded text-center">
                  <span className="text-2xl">🏴‍☠️</span>
                  <p className="text-red-400 font-bold">Steal</p>
                  <p className="text-gray-400 text-xs">Vole des points</p>
                </div>
                <div className="bg-gray-800/50 p-2 rounded text-center">
                  <span className="text-2xl">🛡️</span>
                  <p className="text-blue-400 font-bold">Shield</p>
                  <p className="text-gray-400 text-xs">Protection</p>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setShowFinalModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={startFinalMode}
                className="flex-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 hover:from-yellow-600 hover:via-orange-600 hover:to-red-600 text-white font-bold py-3 rounded-xl transition shadow-lg"
              >
                Lancer la Finale !
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Podium Modal */}
      {gameStatus === 'PODIUM' && podium.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-yellow-500/30">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                PODIUM
              </h2>
              <p className="text-gray-400 mt-2">Felicitations aux gagnants !</p>
            </div>

            {/* Podium Display */}
            <div className="flex items-end justify-center gap-4 mb-8 h-64">
              {/* 2nd place */}
              {podium[1] && (
                <div className="flex flex-col items-center animate-pulse">
                  <div className="text-4xl mb-2">🥈</div>
                  <div className="bg-gray-400/20 border-2 border-gray-400 rounded-t-xl p-4 w-32 h-40 flex flex-col items-center justify-end">
                    <p className="font-bold text-lg truncate w-full text-center">{podium[1].teamName}</p>
                    <p className="text-gray-400 font-bold">{podium[1].totalScore} pts</p>
                    <p className="text-2xl font-bold text-gray-400">2</p>
                  </div>
                </div>
              )}

              {/* 1st place */}
              {podium[0] && (
                <div className="flex flex-col items-center">
                  <div className="text-6xl mb-2 animate-bounce">👑</div>
                  <div className="bg-yellow-500/20 border-2 border-yellow-500 rounded-t-xl p-4 w-36 h-52 flex flex-col items-center justify-end shadow-lg shadow-yellow-500/25">
                    <p className="font-bold text-xl truncate w-full text-center text-yellow-400">{podium[0].teamName}</p>
                    <p className="text-yellow-500 font-bold text-lg">{podium[0].totalScore} pts</p>
                    <p className="text-3xl font-bold text-yellow-400">1</p>
                  </div>
                </div>
              )}

              {/* 3rd place */}
              {podium[2] && (
                <div className="flex flex-col items-center animate-pulse">
                  <div className="text-4xl mb-2">🥉</div>
                  <div className="bg-amber-600/20 border-2 border-amber-600 rounded-t-xl p-4 w-32 h-32 flex flex-col items-center justify-end">
                    <p className="font-bold text-lg truncate w-full text-center">{podium[2].teamName}</p>
                    <p className="text-gray-400 font-bold">{podium[2].totalScore} pts</p>
                    <p className="text-2xl font-bold text-amber-600">3</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setGameStatus('FINISHED');
                setPodium([]);
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 rounded-xl transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* End Session Modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold mb-4">End Session?</h3>
            <p className="text-gray-400 mb-6">
              This will end the current game session. All teams will be disconnected and final scores will be saved.
            </p>

            <div className="flex space-x-4">
              <button
                onClick={() => setShowEndModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={endSession}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
