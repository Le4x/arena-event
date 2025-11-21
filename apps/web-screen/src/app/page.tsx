'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = 'http://91.134.135.247:3001';

type DisplayMode = 'SELECT' | 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'BUZZER' | 'PODIUM' | 'PAUSED';

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
  type: 'MCQ' | 'TRUE_FALSE' | 'BUZZER' | 'OPEN';
  options?: string[];
  correctAnswer?: string;
  points: number;
  timeLimit: number;
  mediaUrl?: string;
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

export default function ScreenHome() {
  // Socket
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Session
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Display state
  const [displayMode, setDisplayMode] = useState<DisplayMode>('SELECT');
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [buzzerWinner, setBuzzerWinner] = useState<Team | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(`${API_URL}/sessions?status=ACTIVE`);
        const data = res.ok ? await res.json() : [];
        const res2 = await fetch(`${API_URL}/sessions?status=WAITING`);
        const data2 = res2.ok ? await res2.json() : [];
        setSessions([...data, ...data2]);
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setLoadingSessions(false);
      }
    };
    fetchSessions();
  }, []);

  // Select session and connect
  const selectSession = (session: Session) => {
    setSelectedSession(session);
    setTeams(session.teams.map(t => ({ ...t, hasAnswered: false })));
    setDisplayMode('LOBBY');
    connectSocket(session.id);
  };

  // Socket connection
  const connectSocket = (sessionId: string) => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-session', { sessionId, role: 'screen' });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Team events
    socket.on('team-joined', (data) => {
      setTeams(prev => {
        const exists = prev.find(t => t.id === data.team.id);
        if (exists) return prev;
        return [...prev, { ...data.team, hasAnswered: false }];
      });
    });

    socket.on('team-left', (data) => {
      // Keep team in list but could mark as disconnected
    });

    // Game events
    socket.on('question-start', (data) => {
      setCurrentQuestion(data.question);
      setTimeRemaining(data.timeLimit || data.question.timeLimit || 30);
      setCorrectAnswer(null);
      setBuzzerWinner(null);
      setAnswers({});
      setTeams(prev => prev.map(t => ({ ...t, hasAnswered: false, lastAnswer: undefined })));
      setDisplayMode('QUESTION');
    });

    socket.on('timer-update', (data) => {
      setTimeRemaining(data.timeRemaining);
    });

    socket.on('timer-end', () => {
      setTimeRemaining(0);
    });

    socket.on('question-end', (data) => {
      setCorrectAnswer(data.correctAnswer);
      setDisplayMode('REVEAL');
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
      setDisplayMode('BUZZER');
    });

    socket.on('buzzer-lock', () => {
      // Keep buzzer display but locked
    });

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

    // Leaderboard
    socket.on('show-leaderboard', (data) => {
      if (data.teams) {
        setTeams(data.teams);
      }
      setDisplayMode('LEADERBOARD');
    });

    // Game state
    socket.on('game-paused', () => {
      setDisplayMode('PAUSED');
    });

    socket.on('game-resumed', () => {
      if (currentQuestion) {
        setDisplayMode('QUESTION');
      }
    });

    socket.on('session-end', () => {
      setDisplayMode('PODIUM');
    });
  };

  // Timer effect
  useEffect(() => {
    if (displayMode !== 'QUESTION' || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [displayMode, timeRemaining]);

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const answeredCount = teams.filter(t => t.hasAnswered).length;

  // SESSION SELECT
  if (displayMode === 'SELECT') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-12">
          <div className="text-8xl mb-6">🎮</div>
          <h1 className="text-6xl font-black text-white mb-4">Arena Event</h1>
          <p className="text-2xl text-purple-300">Public Display</p>
        </div>

        <div className="w-full max-w-3xl">
          <h2 className="text-3xl font-bold text-white text-center mb-8">Select a Session</h2>

          {loadingSessions ? (
            <div className="text-center py-12">
              <div className="animate-spin w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-purple-300 text-xl">Loading sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 bg-white/10 backdrop-blur rounded-3xl">
              <p className="text-6xl mb-4">📭</p>
              <p className="text-2xl text-purple-300">No active sessions</p>
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
                className="mt-6 bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl text-xl"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => selectSession(session)}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 hover:border-purple-400 rounded-2xl p-8 text-left transition group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-3xl font-bold text-white group-hover:text-purple-300">
                        {session.event.name}
                      </h3>
                      <p className="text-purple-300 mt-2">{session.event.description}</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-xl">
                      <p className="text-sm text-purple-200">Code</p>
                      <p className="text-4xl font-mono font-black text-white">{session.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 mt-6">
                    <span className={`px-4 py-2 rounded-full text-lg ${
                      session.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {session.status}
                    </span>
                    <span className="text-purple-300 text-lg">
                      {session.teams.length} teams
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`fixed bottom-8 right-8 flex items-center gap-2 px-4 py-2 rounded-full ${
          isConnected ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
        }`}>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`}></div>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </main>
    );
  }

  // LOBBY
  if (displayMode === 'LOBBY') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex flex-col items-center justify-center p-8 overflow-hidden relative">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>

        <div className="relative z-10 text-center">
          <div className="mb-8">
            <h1 className="text-8xl font-black mb-4">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
                🎮 ARENA EVENT
              </span>
            </h1>
            <p className="text-3xl text-purple-300">{selectedSession?.event.name}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 max-w-4xl mx-auto border border-white/20 shadow-2xl">
            <p className="text-3xl text-purple-200 mb-6">Rejoins le jeu sur</p>
            <div className="text-5xl font-bold text-white mb-8">
              http://91.134.135.247:3003
            </div>

            <div className="border-t border-white/20 pt-8 mt-8">
              <p className="text-3xl text-purple-200 mb-6">Code de session</p>
              <div className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl px-16 py-8">
                <span className="text-8xl font-black text-black tracking-[0.2em]">
                  {selectedSession?.code}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-12 flex justify-center items-center gap-8">
            <div className="bg-white/10 backdrop-blur rounded-2xl px-8 py-6 text-center">
              <div className="text-6xl font-bold text-green-400">{teams.length}</div>
              <div className="text-xl text-purple-200 mt-2">Teams</div>
            </div>
          </div>

          {teams.length > 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-3 max-w-4xl">
              {teams.map(team => (
                <div
                  key={team.id}
                  className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 flex items-center gap-2"
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: team.color }}
                  ></div>
                  <span className="text-white font-medium">{team.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12">
            <div className="inline-flex items-center bg-yellow-500 text-black px-8 py-4 rounded-full text-2xl font-bold animate-pulse">
              <span className="mr-3">⏳</span>
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
          className="absolute top-8 left-8 text-white/60 hover:text-white transition"
        >
          ← Back
        </button>
      </main>
    );
  }

  // QUESTION
  if (displayMode === 'QUESTION' && currentQuestion) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-4xl">🎮</span>
            <span className="text-2xl font-bold text-white">{selectedSession?.event.name}</span>
          </div>
          <div className="text-center">
            <span className="text-purple-400 text-xl">Question {questionNumber}/{totalQuestions}</span>
          </div>
          <div className="bg-purple-600 px-6 py-2 rounded-xl">
            <span className="text-white font-mono text-2xl font-bold">{selectedSession?.code}</span>
          </div>
        </header>

        {/* Timer */}
        <div className={`py-6 text-center transition-colors ${
          timeRemaining <= 5 ? 'bg-red-600 animate-pulse' :
          timeRemaining <= 10 ? 'bg-yellow-500' :
          'bg-purple-600'
        }`}>
          <div className="text-8xl font-black text-white">{timeRemaining}</div>
          <div className="text-white/80 text-2xl">seconds</div>
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="bg-gray-800 rounded-3xl p-12 max-w-5xl w-full text-center shadow-2xl">
            <div className="flex items-center justify-center mb-6">
              <span className={`px-4 py-2 rounded-full text-lg font-bold ${
                currentQuestion.type === 'MCQ' ? 'bg-blue-500/20 text-blue-400' :
                currentQuestion.type === 'TRUE_FALSE' ? 'bg-green-500/20 text-green-400' :
                currentQuestion.type === 'BUZZER' ? 'bg-red-500/20 text-red-400' :
                'bg-purple-500/20 text-purple-400'
              }`}>
                {currentQuestion.type === 'MCQ' ? 'Choix Multiple' :
                 currentQuestion.type === 'TRUE_FALSE' ? 'Vrai ou Faux' :
                 currentQuestion.type === 'BUZZER' ? 'Buzzer' : 'Question Ouverte'}
              </span>
              <span className="ml-4 text-purple-400 font-bold text-xl">{currentQuestion.points} pts</span>
            </div>

            {currentQuestion.mediaUrl && (
              <img
                src={currentQuestion.mediaUrl}
                alt="Question media"
                className="max-w-2xl mx-auto rounded-2xl mb-8"
              />
            )}

            <h2 className="text-5xl font-bold text-white leading-tight mb-12">
              {currentQuestion.text}
            </h2>

            {/* MCQ Options */}
            {currentQuestion.type === 'MCQ' && currentQuestion.options && (
              <div className="grid grid-cols-2 gap-6">
                {currentQuestion.options.map((option, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const colors = [
                    'from-red-500 to-red-600',
                    'from-blue-500 to-blue-600',
                    'from-yellow-500 to-yellow-600',
                    'from-green-500 to-green-600',
                  ];
                  const answerCount = Object.values(answers).filter(a => a === letter).length;

                  return (
                    <div
                      key={idx}
                      className={`bg-gradient-to-r ${colors[idx]} rounded-2xl p-6 flex items-center justify-between shadow-lg`}
                    >
                      <div className="flex items-center">
                        <span className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mr-6 text-3xl font-black text-white">
                          {letter}
                        </span>
                        <span className="text-2xl font-bold text-white">{option}</span>
                      </div>
                      {answerCount > 0 && (
                        <div className="bg-white/20 rounded-full px-4 py-2">
                          <span className="text-2xl font-bold text-white">{answerCount}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* True/False */}
            {currentQuestion.type === 'TRUE_FALSE' && (
              <div className="grid grid-cols-2 gap-8">
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-12 text-center relative">
                  <span className="text-5xl font-black text-white">VRAI</span>
                  {Object.values(answers).filter(a => a === 'TRUE').length > 0 && (
                    <div className="absolute top-4 right-4 bg-white/20 rounded-full px-4 py-2">
                      <span className="text-xl font-bold text-white">
                        {Object.values(answers).filter(a => a === 'TRUE').length}
                      </span>
                    </div>
                  )}
                </div>
                <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-12 text-center relative">
                  <span className="text-5xl font-black text-white">FAUX</span>
                  {Object.values(answers).filter(a => a === 'FALSE').length > 0 && (
                    <div className="absolute top-4 right-4 bg-white/20 rounded-full px-4 py-2">
                      <span className="text-xl font-bold text-white">
                        {Object.values(answers).filter(a => a === 'FALSE').length}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Answer Progress */}
        <footer className="bg-gray-800 px-8 py-6">
          <div className="flex items-center justify-center">
            <span className="text-purple-400 text-2xl mr-4">Reponses:</span>
            <div className="flex-1 max-w-2xl bg-gray-700 rounded-full h-8 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${teams.length > 0 ? (answeredCount / teams.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-white text-2xl font-bold ml-4">{answeredCount}/{teams.length}</span>
          </div>
        </footer>
      </main>
    );
  }

  // REVEAL
  if (displayMode === 'REVEAL' && currentQuestion) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">{currentQuestion.text}</h2>
          <p className="text-3xl text-purple-400">La bonne reponse est...</p>
        </div>

        {currentQuestion.type === 'MCQ' && currentQuestion.options && (
          <div className="grid grid-cols-2 gap-6 max-w-4xl w-full mb-12">
            {currentQuestion.options.map((option, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isCorrect = letter === correctAnswer;
              const answerCount = Object.values(answers).filter(a => a === letter).length;

              return (
                <div
                  key={idx}
                  className={`rounded-2xl p-6 flex items-center justify-between transition-all duration-500 ${
                    isCorrect
                      ? 'bg-gradient-to-r from-green-500 to-green-600 scale-105 ring-4 ring-green-400'
                      : 'bg-gray-700 opacity-50'
                  }`}
                >
                  <div className="flex items-center">
                    <span className={`w-14 h-14 rounded-full flex items-center justify-center mr-4 text-2xl font-black ${
                      isCorrect ? 'bg-white/30 text-white' : 'bg-gray-600 text-gray-400'
                    }`}>
                      {isCorrect ? '✓' : letter}
                    </span>
                    <span className={`text-xl font-bold ${isCorrect ? 'text-white' : 'text-gray-400'}`}>
                      {option}
                    </span>
                  </div>
                  <div className={`rounded-full px-4 py-2 ${isCorrect ? 'bg-white/20' : 'bg-gray-600'}`}>
                    <span className={`text-xl font-bold ${isCorrect ? 'text-white' : 'text-gray-400'}`}>
                      {answerCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {currentQuestion.type === 'TRUE_FALSE' && (
          <div className="grid grid-cols-2 gap-8 max-w-2xl w-full mb-12">
            <div className={`rounded-2xl p-12 text-center transition-all ${
              correctAnswer === 'TRUE'
                ? 'bg-gradient-to-r from-green-500 to-green-600 scale-105 ring-4 ring-green-400'
                : 'bg-gray-700 opacity-50'
            }`}>
              <span className="text-4xl font-black text-white">VRAI</span>
              <div className="mt-4 text-2xl text-white/80">
                {Object.values(answers).filter(a => a === 'TRUE').length} reponses
              </div>
            </div>
            <div className={`rounded-2xl p-12 text-center transition-all ${
              correctAnswer === 'FALSE'
                ? 'bg-gradient-to-r from-green-500 to-green-600 scale-105 ring-4 ring-green-400'
                : 'bg-gray-700 opacity-50'
            }`}>
              <span className="text-4xl font-black text-white">FAUX</span>
              <div className="mt-4 text-2xl text-white/80">
                {Object.values(answers).filter(a => a === 'FALSE').length} reponses
              </div>
            </div>
          </div>
        )}

        {(currentQuestion.type === 'BUZZER' || currentQuestion.type === 'OPEN') && correctAnswer && (
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl px-12 py-8 mb-12">
            <p className="text-2xl text-green-100 mb-2">Reponse correcte</p>
            <p className="text-5xl font-black text-white">{correctAnswer}</p>
          </div>
        )}

        <div className="flex gap-8">
          <div className="bg-green-500/20 rounded-2xl px-8 py-6 text-center">
            <div className="text-5xl font-bold text-green-400">
              {Object.values(answers).filter(a => a === correctAnswer).length}
            </div>
            <div className="text-green-300 mt-2">Bonnes reponses</div>
          </div>
          <div className="bg-red-500/20 rounded-2xl px-8 py-6 text-center">
            <div className="text-5xl font-bold text-red-400">
              {Object.values(answers).filter(a => a && a !== correctAnswer).length}
            </div>
            <div className="text-red-300 mt-2">Mauvaises reponses</div>
          </div>
        </div>
      </main>
    );
  }

  // BUZZER
  if (displayMode === 'BUZZER') {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
        {buzzerWinner ? (
          <div className="text-center">
            <div className="text-[12rem] mb-8 animate-bounce">🔔</div>
            <h1 className="text-7xl font-black text-red-500 mb-8">BUZZ!</h1>
            <div className="bg-red-500/20 border-4 border-red-500 rounded-3xl px-20 py-16">
              <p className="text-6xl font-black text-white">{buzzerWinner.name}</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-[12rem] mb-8 animate-pulse">🔔</div>
            <h1 className="text-6xl font-bold text-white mb-4">Buzzer Ouvert!</h1>
            <p className="text-3xl text-gray-400">Premier arrive, premier servi!</p>
          </div>
        )}
      </main>
    );
  }

  // LEADERBOARD
  if (displayMode === 'LEADERBOARD') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-7xl mb-4">🏆</div>
            <h1 className="text-6xl font-black text-white">CLASSEMENT</h1>
          </div>

          <div className="space-y-4">
            {sortedTeams.map((team, index) => {
              const isTop3 = index < 3;

              return (
                <div
                  key={team.id}
                  className={`rounded-2xl p-6 flex items-center ${
                    isTop3 ? 'bg-gradient-to-r from-purple-600/50 to-pink-600/50' : 'bg-white/10'
                  }`}
                >
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl mr-6 ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900' :
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800' :
                    index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900' :
                    'bg-gray-600 text-white'
                  }`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                  </div>

                  <div className="flex items-center flex-1">
                    <div
                      className="w-6 h-6 rounded-full mr-4"
                      style={{ backgroundColor: team.color }}
                    ></div>
                    <p className="text-3xl font-bold text-white">{team.name}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-5xl font-black text-purple-300">{team.score}</p>
                    <p className="text-purple-400">points</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // PAUSED
  if (displayMode === 'PAUSED') {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="text-[10rem] mb-8">⏸️</div>
          <h1 className="text-6xl font-bold text-white mb-4">Jeu en Pause</h1>
          <p className="text-2xl text-gray-400">En attente de la reprise...</p>
        </div>
      </main>
    );
  }

  // PODIUM
  if (displayMode === 'PODIUM') {
    const top3 = sortedTeams.slice(0, 3);

    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-600 via-orange-600 to-red-600 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-16">
          <h1 className="text-7xl font-black text-white mb-4">🏆 RESULTATS FINAUX 🏆</h1>
        </div>

        <div className="flex items-end justify-center gap-8">
          {/* 2nd Place */}
          {top3[1] && (
            <div className="text-center">
              <div className="text-6xl mb-4">🥈</div>
              <div className="bg-gray-400 rounded-t-2xl w-52 h-44 flex flex-col items-center justify-center">
                <div
                  className="w-8 h-8 rounded-full mb-2"
                  style={{ backgroundColor: top3[1].color }}
                ></div>
                <p className="text-2xl font-bold text-gray-800">{top3[1].name}</p>
                <p className="text-3xl font-black text-gray-700">{top3[1].score}</p>
              </div>
              <div className="bg-gray-500 w-52 h-8 rounded-b-lg"></div>
            </div>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <div className="text-center">
              <div className="text-8xl mb-4 animate-bounce">🥇</div>
              <div className="bg-yellow-400 rounded-t-2xl w-60 h-60 flex flex-col items-center justify-center">
                <div
                  className="w-10 h-10 rounded-full mb-2"
                  style={{ backgroundColor: top3[0].color }}
                ></div>
                <p className="text-3xl font-bold text-yellow-900">{top3[0].name}</p>
                <p className="text-5xl font-black text-yellow-800">{top3[0].score}</p>
              </div>
              <div className="bg-yellow-600 w-60 h-8 rounded-b-lg"></div>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="text-center">
              <div className="text-5xl mb-4">🥉</div>
              <div className="bg-orange-400 rounded-t-2xl w-48 h-36 flex flex-col items-center justify-center">
                <div
                  className="w-6 h-6 rounded-full mb-2"
                  style={{ backgroundColor: top3[2].color }}
                ></div>
                <p className="text-xl font-bold text-orange-900">{top3[2].name}</p>
                <p className="text-2xl font-black text-orange-800">{top3[2].score}</p>
              </div>
              <div className="bg-orange-600 w-48 h-8 rounded-b-lg"></div>
            </div>
          )}
        </div>

        <div className="mt-16 text-center">
          <p className="text-3xl text-white/80">Merci d'avoir joue!</p>
          <p className="text-xl text-white/60 mt-2">Powered by Arena Event</p>
        </div>

        <button
          onClick={() => {
            socketRef.current?.disconnect();
            setSelectedSession(null);
            setDisplayMode('SELECT');
            setTeams([]);
          }}
          className="mt-12 bg-white text-orange-600 font-bold py-4 px-8 rounded-2xl text-xl"
        >
          Nouvelle Session
        </button>
      </main>
    );
  }

  return null;
}
