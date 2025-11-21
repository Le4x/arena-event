'use client';

import { useState, useEffect } from 'react';

type DisplayMode = 'LOBBY' | 'QUESTION' | 'ANSWERS' | 'REVEAL' | 'LEADERBOARD' | 'PODIUM' | 'BUZZER';

interface Team {
  id: string;
  name: string;
  score: number;
  lastAnswer?: string;
  hasAnswered: boolean;
}

interface Question {
  text: string;
  type: 'MCQ' | 'TRUE_FALSE' | 'BUZZER' | 'TEXT';
  options?: string[];
  correctAnswer?: string;
  points: number;
}

export default function ScreenHome() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('LOBBY');
  const [sessionCode] = useState('XK7M2P');
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions] = useState(10);
  const [buzzerWinner, setBuzzerWinner] = useState<Team | null>(null);

  const [teams] = useState<Team[]>([
    { id: '1', name: 'Les Champions', score: 850, lastAnswer: 'B', hasAnswered: true },
    { id: '2', name: 'Quiz Masters', score: 720, lastAnswer: 'B', hasAnswered: true },
    { id: '3', name: 'Brain Storm', score: 680, lastAnswer: 'A', hasAnswered: true },
    { id: '4', name: 'Les Genies', score: 540, lastAnswer: 'B', hasAnswered: true },
    { id: '5', name: 'Team Rocket', score: 490, lastAnswer: 'C', hasAnswered: false },
  ]);

  const [currentQuestion] = useState<Question>({
    text: 'Quelle est la capitale de la France ?',
    type: 'MCQ',
    options: ['Lyon', 'Paris', 'Marseille', 'Bordeaux'],
    correctAnswer: 'B',
    points: 100,
  });

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if ((displayMode === 'QUESTION' || displayMode === 'ANSWERS') && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [displayMode, timeRemaining]);

  // Demo: Cycle through display modes
  useEffect(() => {
    const modes: DisplayMode[] = ['LOBBY', 'QUESTION', 'ANSWERS', 'REVEAL', 'LEADERBOARD'];
    let currentIndex = 0;

    const cycleMode = () => {
      currentIndex = (currentIndex + 1) % modes.length;
      setDisplayMode(modes[currentIndex]);
      if (modes[currentIndex] === 'QUESTION' || modes[currentIndex] === 'ANSWERS') {
        setTimeRemaining(30);
      }
    };

    const interval = setInterval(cycleMode, 8000);
    return () => clearInterval(interval);
  }, []);

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const answeredCount = teams.filter(t => t.hasAnswered).length;

  // LOBBY Display
  if (displayMode === 'LOBBY') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex flex-col items-center justify-center p-8 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>

        <div className="relative z-10 text-center">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="text-9xl font-black text-white mb-4 tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
                🎮 ARENA EVENT
              </span>
            </h1>
          </div>

          {/* Join Instructions */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 max-w-4xl mx-auto border border-white/20 shadow-2xl">
            <p className="text-3xl text-purple-200 mb-6">Rejoins le jeu sur</p>
            <div className="text-6xl font-bold text-white mb-8 tracking-wide">
              arena-event.com
            </div>

            <div className="border-t border-white/20 pt-8 mt-8">
              <p className="text-3xl text-purple-200 mb-6">Code de session</p>
              <div className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl px-16 py-8">
                <span className="text-8xl font-black text-black tracking-[0.2em]">
                  {sessionCode}
                </span>
              </div>
            </div>
          </div>

          {/* Connected Teams */}
          <div className="mt-12 flex justify-center items-center gap-8">
            <div className="bg-white/10 backdrop-blur rounded-2xl px-8 py-6 text-center">
              <div className="text-6xl font-bold text-green-400">{teams.length}</div>
              <div className="text-xl text-purple-200 mt-2">Teams Connected</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl px-8 py-6 text-center">
              <div className="text-6xl font-bold text-blue-400">{totalQuestions}</div>
              <div className="text-xl text-purple-200 mt-2">Questions</div>
            </div>
          </div>

          {/* Status */}
          <div className="mt-12">
            <div className="inline-flex items-center bg-yellow-500 text-black px-8 py-4 rounded-full text-3xl font-bold animate-pulse">
              <span className="mr-3">⏳</span>
              WAITING FOR PLAYERS...
            </div>
          </div>
        </div>
      </main>
    );
  }

  // QUESTION Display (showing question only)
  if (displayMode === 'QUESTION') {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-4xl">🎮</span>
            <span className="text-2xl font-bold text-white">Arena Event</span>
          </div>
          <div className="text-center">
            <span className="text-purple-400 text-xl">Question {questionNumber}/{totalQuestions}</span>
          </div>
          <div className="bg-purple-600 px-6 py-2 rounded-xl">
            <span className="text-white font-mono text-2xl font-bold">{sessionCode}</span>
          </div>
        </header>

        {/* Timer */}
        <div className={`py-6 text-center ${
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
                'bg-red-500/20 text-red-400'
              }`}>
                {currentQuestion.type === 'MCQ' ? 'Choix Multiple' :
                 currentQuestion.type === 'TRUE_FALSE' ? 'Vrai ou Faux' : 'Buzzer'}
              </span>
              <span className="ml-4 text-purple-400 font-bold text-xl">{currentQuestion.points} pts</span>
            </div>

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

                  return (
                    <div
                      key={idx}
                      className={`bg-gradient-to-r ${colors[idx]} rounded-2xl p-6 flex items-center shadow-lg`}
                    >
                      <span className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mr-6 text-3xl font-black text-white">
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
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-12 text-center">
                  <span className="text-5xl font-black text-white">VRAI</span>
                </div>
                <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-12 text-center">
                  <span className="text-5xl font-black text-white">FAUX</span>
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
                style={{ width: `${(answeredCount / teams.length) * 100}%` }}
              />
            </div>
            <span className="text-white text-2xl font-bold ml-4">{answeredCount}/{teams.length}</span>
          </div>
        </footer>
      </main>
    );
  }

  // ANSWERS Display (showing who answered)
  if (displayMode === 'ANSWERS') {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col">
        {/* Same header as QUESTION */}
        <header className="bg-gray-800 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-4xl">🎮</span>
            <span className="text-2xl font-bold text-white">Arena Event</span>
          </div>
          <div className="text-center">
            <span className="text-purple-400 text-xl">Question {questionNumber}/{totalQuestions}</span>
          </div>
          <div className="bg-purple-600 px-6 py-2 rounded-xl">
            <span className="text-white font-mono text-2xl font-bold">{sessionCode}</span>
          </div>
        </header>

        {/* Timer */}
        <div className={`py-4 text-center ${
          timeRemaining <= 5 ? 'bg-red-600 animate-pulse' :
          timeRemaining <= 10 ? 'bg-yellow-500' :
          'bg-purple-600'
        }`}>
          <div className="text-6xl font-black text-white">{timeRemaining}</div>
        </div>

        <div className="flex-1 flex">
          {/* Question Side */}
          <div className="flex-1 p-8 flex flex-col">
            <div className="bg-gray-800 rounded-2xl p-8 mb-6">
              <h2 className="text-3xl font-bold text-white">{currentQuestion.text}</h2>
            </div>

            {currentQuestion.type === 'MCQ' && currentQuestion.options && (
              <div className="grid grid-cols-2 gap-4 flex-1">
                {currentQuestion.options.map((option, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const colors = [
                    'from-red-500 to-red-600',
                    'from-blue-500 to-blue-600',
                    'from-yellow-500 to-yellow-600',
                    'from-green-500 to-green-600',
                  ];
                  const answerCount = teams.filter(t => t.lastAnswer === letter).length;

                  return (
                    <div
                      key={idx}
                      className={`bg-gradient-to-r ${colors[idx]} rounded-2xl p-4 flex items-center justify-between`}
                    >
                      <div className="flex items-center">
                        <span className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4 text-2xl font-black text-white">
                          {letter}
                        </span>
                        <span className="text-xl font-bold text-white">{option}</span>
                      </div>
                      <div className="bg-white/20 rounded-full px-4 py-2">
                        <span className="text-2xl font-bold text-white">{answerCount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Teams Status */}
          <div className="w-80 bg-gray-800 p-6 overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Teams</h3>
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className={`rounded-lg p-3 flex items-center justify-between ${
                    team.hasAnswered ? 'bg-green-500/20' : 'bg-gray-700'
                  }`}
                >
                  <span className="text-white font-medium">{team.name}</span>
                  {team.hasAnswered ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-gray-400">...</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  // REVEAL Display
  if (displayMode === 'REVEAL') {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">{currentQuestion.text}</h2>
          <p className="text-2xl text-purple-400">La bonne reponse est...</p>
        </div>

        {currentQuestion.type === 'MCQ' && currentQuestion.options && (
          <div className="grid grid-cols-2 gap-6 max-w-4xl w-full mb-12">
            {currentQuestion.options.map((option, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isCorrect = letter === currentQuestion.correctAnswer;
              const answerCount = teams.filter(t => t.lastAnswer === letter).length;

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

        {/* Stats */}
        <div className="flex gap-8">
          <div className="bg-green-500/20 rounded-2xl px-8 py-6 text-center">
            <div className="text-5xl font-bold text-green-400">
              {teams.filter(t => t.lastAnswer === currentQuestion.correctAnswer).length}
            </div>
            <div className="text-green-300 mt-2">Bonnes reponses</div>
          </div>
          <div className="bg-red-500/20 rounded-2xl px-8 py-6 text-center">
            <div className="text-5xl font-bold text-red-400">
              {teams.filter(t => t.lastAnswer && t.lastAnswer !== currentQuestion.correctAnswer).length}
            </div>
            <div className="text-red-300 mt-2">Mauvaises reponses</div>
          </div>
        </div>
      </main>
    );
  }

  // LEADERBOARD Display
  if (displayMode === 'LEADERBOARD') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-5xl font-black text-white">CLASSEMENT</h1>
            <p className="text-purple-300 text-2xl mt-2">Question {questionNumber}/{totalQuestions}</p>
          </div>

          {/* Leaderboard */}
          <div className="space-y-4">
            {sortedTeams.map((team, index) => {
              const prevRank = index; // Could be calculated based on previous scores
              const isTop3 = index < 3;

              return (
                <div
                  key={team.id}
                  className={`rounded-2xl p-6 flex items-center transition-all duration-500 ${
                    isTop3 ? 'bg-gradient-to-r from-purple-600/50 to-pink-600/50' : 'bg-white/10'
                  }`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  {/* Rank */}
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl mr-6 ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900' :
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800' :
                    index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900' :
                    'bg-gray-600 text-white'
                  }`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                  </div>

                  {/* Team Name */}
                  <div className="flex-1">
                    <p className="text-3xl font-bold text-white">{team.name}</p>
                    {team.lastAnswer === currentQuestion.correctAnswer && (
                      <p className="text-green-400 text-lg">+{currentQuestion.points} pts cette question</p>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <p className="text-4xl font-black text-purple-300">{team.score}</p>
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

  // BUZZER Display
  if (displayMode === 'BUZZER') {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
        {buzzerWinner ? (
          <div className="text-center animate-pulse">
            <div className="text-9xl mb-8">🔔</div>
            <h1 className="text-6xl font-black text-red-500 mb-4">BUZZ!</h1>
            <div className="bg-red-500/20 border-4 border-red-500 rounded-3xl px-16 py-12">
              <p className="text-5xl font-black text-white">{buzzerWinner.name}</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-9xl mb-8 animate-bounce">🔔</div>
            <h1 className="text-5xl font-bold text-white">Buzzer Ouvert!</h1>
            <p className="text-2xl text-gray-400 mt-4">Premier arrive, premier servi!</p>
          </div>
        )}
      </main>
    );
  }

  // PODIUM Display (Final)
  if (displayMode === 'PODIUM') {
    const top3 = sortedTeams.slice(0, 3);

    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-600 via-orange-600 to-red-600 flex flex-col items-center justify-center p-8">
        <div className="text-center mb-16">
          <h1 className="text-7xl font-black text-white mb-4">🏆 RESULTATS FINAUX 🏆</h1>
        </div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-8">
          {/* 2nd Place */}
          {top3[1] && (
            <div className="text-center">
              <div className="text-6xl mb-4">🥈</div>
              <div className="bg-gray-400 rounded-t-2xl w-48 h-40 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-gray-800">{top3[1].name}</p>
                <p className="text-3xl font-black text-gray-700">{top3[1].score}</p>
              </div>
              <div className="bg-gray-500 w-48 h-8 rounded-b-lg"></div>
            </div>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <div className="text-center">
              <div className="text-8xl mb-4 animate-bounce">🥇</div>
              <div className="bg-yellow-400 rounded-t-2xl w-56 h-56 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold text-yellow-900">{top3[0].name}</p>
                <p className="text-5xl font-black text-yellow-800">{top3[0].score}</p>
              </div>
              <div className="bg-yellow-600 w-56 h-8 rounded-b-lg"></div>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="text-center">
              <div className="text-5xl mb-4">🥉</div>
              <div className="bg-orange-400 rounded-t-2xl w-44 h-32 flex flex-col items-center justify-center">
                <p className="text-xl font-bold text-orange-900">{top3[2].name}</p>
                <p className="text-2xl font-black text-orange-800">{top3[2].score}</p>
              </div>
              <div className="bg-orange-600 w-44 h-8 rounded-b-lg"></div>
            </div>
          )}
        </div>

        <div className="mt-16 text-center">
          <p className="text-3xl text-white/80">Merci d'avoir joue!</p>
          <p className="text-xl text-white/60 mt-2">Powered by Arena Event</p>
        </div>
      </main>
    );
  }

  return null;
}
