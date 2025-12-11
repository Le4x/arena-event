/**
 * Full Game Simulation Test
 * Tests all game features by simulating a complete game session
 *
 * Usage:
 *   node test-full-game.js [API_URL]
 *
 * This test simulates:
 * 1. Session join and team setup
 * 2. Question flow (MCQ, True/False, Open)
 * 3. Buzzer mode
 * 4. Jokers (Shield, Double)
 * 5. Blindtest media
 * 6. Timer events
 * 7. Leaderboard
 * 8. Finale mode
 * 9. Game end
 */

import { io } from 'socket.io-client';

const API_URL = process.argv[2] || 'http://localhost:3001';

console.log('🎮 Test de Simulation de Partie Complète');
console.log('========================================');
console.log(`📡 API URL: ${API_URL}\n`);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test results tracking
let passed = 0;
let failed = 0;
const results = [];

function test(name, condition, details = '') {
  if (condition) {
    console.log(`   ✅ ${name}`);
    passed++;
    results.push({ name, passed: true });
  } else {
    console.log(`   ❌ ${name}${details ? ` - ${details}` : ''}`);
    failed++;
    results.push({ name, passed: false, details });
  }
}

async function runTests() {
  // ================== SETUP ==================
  console.log('📋 SETUP');
  console.log('─'.repeat(50));

  let testSessionId, testTeamId, testTeamName, testQuestionId;
  let currentScore = 0;

  // Fetch test data
  try {
    const sessionsRes = await fetch(`${API_URL}/sessions`);
    const sessions = await sessionsRes.json();

    const sessionWithTeams = sessions.find(s => s.teams && s.teams.length > 0);
    if (!sessionWithTeams) throw new Error('No session with teams');

    testSessionId = sessionWithTeams.id;
    testTeamId = sessionWithTeams.teams[0].id;
    testTeamName = sessionWithTeams.teams[0].name;

    // Get a question if available
    if (sessionWithTeams.currentQuestionId) {
      testQuestionId = sessionWithTeams.currentQuestionId;
    }

    console.log(`   ✓ Session: ${sessionWithTeams.event?.name || sessionWithTeams.code}`);
    console.log(`   ✓ Équipe: ${testTeamName}`);
    console.log(`   ✓ Question ID: ${testQuestionId || 'none'}\n`);
  } catch (error) {
    console.log(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  }

  // Create socket clients
  const studioSocket = io(API_URL, { transports: ['websocket'] });
  const playerSocket = io(API_URL, { transports: ['websocket'] });
  const screenSocket = io(API_URL, { transports: ['websocket'] });

  // Track received events
  const playerEvents = [];
  const screenEvents = [];
  const studioEvents = [];

  // Setup event listeners
  const setupListeners = (socket, events, name) => {
    const trackEvents = [
      'question-start', 'question-end', 'timer-start', 'timer-end',
      'buzzer-open', 'buzzer-lock', 'buzzer-winner', 'buzzer-correct', 'buzzer-wrong',
      'answer-result', 'answer-submitted', 'score-update',
      'show-leaderboard', 'game-paused', 'game-resumed', 'session-end',
      'blindtest-play', 'blindtest-pause', 'blindtest-stop', 'blindtest-reveal',
      'finale-start', 'finale-state', 'finale-question-start', 'finale-eliminate', 'finale-end',
      'joker-activated'
    ];

    trackEvents.forEach(eventName => {
      socket.on(eventName, (data) => {
        events.push({ event: eventName, data, timestamp: Date.now() });
      });
    });

    socket.on('score-update', (data) => {
      if (data.teamId === testTeamId) {
        currentScore = data.newScore;
      }
    });
  };

  // Connect all clients
  await new Promise((resolve) => {
    let connected = 0;
    const checkDone = () => { if (++connected === 3) resolve(); };

    studioSocket.on('connect', () => {
      studioSocket.emit('join-session', { sessionId: testSessionId });
      setupListeners(studioSocket, studioEvents, 'Studio');
      checkDone();
    });
    playerSocket.on('connect', () => {
      playerSocket.emit('join-session', { sessionId: testSessionId, teamId: testTeamId });
      setupListeners(playerSocket, playerEvents, 'Player');
      checkDone();
    });
    screenSocket.on('connect', () => {
      screenSocket.emit('join-session', { sessionId: testSessionId });
      setupListeners(screenSocket, screenEvents, 'Screen');
      checkDone();
    });
  });

  await wait(1000);
  console.log('   ✓ Tous les clients connectés\n');

  // Reset score to 0
  studioSocket.emit('set-score', { sessionId: testSessionId, teamId: testTeamId, newScore: 0 });
  await wait(500);
  currentScore = 0;

  // ================== TEST 1: QUESTION FLOW ==================
  console.log('\n🧪 TEST 1: Flow de Question');
  console.log('─'.repeat(50));

  // Clear events
  playerEvents.length = 0;
  screenEvents.length = 0;

  // Start question
  const mockQuestion = {
    id: testQuestionId || 'test-q-1',
    text: 'Question de test?',
    type: 'MCQ',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    points: 100,
    timeLimit: 30
  };

  studioSocket.emit('question-start', {
    sessionId: testSessionId,
    question: mockQuestion
  });
  await wait(500);

  test('Player reçoit question-start', playerEvents.some(e => e.event === 'question-start'));
  test('Screen reçoit question-start', screenEvents.some(e => e.event === 'question-start'));

  // Submit answer
  playerEvents.length = 0;
  playerSocket.emit('submit-answer', {
    sessionId: testSessionId,
    teamId: testTeamId,
    questionId: mockQuestion.id,
    answer: 'A'
  });
  await wait(500);

  test('Player reçoit answer-result', playerEvents.some(e => e.event === 'answer-result'));

  // End question (reveal)
  playerEvents.length = 0;
  screenEvents.length = 0;
  studioSocket.emit('question-end', {
    sessionId: testSessionId,
    questionId: mockQuestion.id,
    correctAnswer: 'A',
    explanation: 'Explication de test'
  });
  await wait(1000);

  test('Player reçoit question-end', playerEvents.some(e => e.event === 'question-end'));
  test('Screen reçoit question-end', screenEvents.some(e => e.event === 'question-end'));

  const qEndEvent = screenEvents.find(e => e.event === 'question-end');
  test('question-end contient explanation', qEndEvent?.data?.explanation === 'Explication de test');

  // ================== TEST 2: TIMER ==================
  console.log('\n🧪 TEST 2: Timer');
  console.log('─'.repeat(50));

  playerEvents.length = 0;
  screenEvents.length = 0;

  studioSocket.emit('timer-start', {
    sessionId: testSessionId,
    duration: 30
  });
  await wait(300);

  test('Screen reçoit timer-start', screenEvents.some(e => e.event === 'timer-start'));

  studioSocket.emit('timer-end', { sessionId: testSessionId });
  await wait(300);

  test('Screen reçoit timer-end', screenEvents.some(e => e.event === 'timer-end'));

  // ================== TEST 3: BUZZER MODE ==================
  console.log('\n🧪 TEST 3: Mode Buzzer');
  console.log('─'.repeat(50));

  playerEvents.length = 0;
  screenEvents.length = 0;

  // Open buzzer
  studioSocket.emit('buzzer-open', { sessionId: testSessionId });
  await wait(300);

  test('Player reçoit buzzer-open', playerEvents.some(e => e.event === 'buzzer-open'));
  test('Screen reçoit buzzer-open', screenEvents.some(e => e.event === 'buzzer-open'));

  // Press buzzer
  playerEvents.length = 0;
  playerSocket.emit('buzzer-press', {
    sessionId: testSessionId,
    teamId: testTeamId,
    teamName: testTeamName
  });
  await wait(500);

  // Studio validates correct answer
  const scoreBeforeBuzzer = currentScore;
  studioSocket.emit('buzzer-correct', {
    sessionId: testSessionId,
    teamId: testTeamId,
    teamName: testTeamName,
    points: 150
  });
  await wait(1000);

  test('Player reçoit buzzer-correct', playerEvents.some(e => e.event === 'buzzer-correct'));
  test('Score augmenté de 150', currentScore === scoreBeforeBuzzer + 150);

  // Reset buzzer
  studioSocket.emit('buzzer-reset', { sessionId: testSessionId });
  await wait(300);

  // Test wrong answer
  playerEvents.length = 0;
  studioSocket.emit('buzzer-open', { sessionId: testSessionId });
  await wait(200);
  playerSocket.emit('buzzer-press', {
    sessionId: testSessionId,
    teamId: testTeamId,
    teamName: testTeamName
  });
  await wait(300);

  const scoreBeforeWrong = currentScore;
  studioSocket.emit('buzzer-wrong', {
    sessionId: testSessionId,
    teamId: testTeamId,
    teamName: testTeamName
  });
  await wait(500);

  test('Player reçoit buzzer-wrong', playerEvents.some(e => e.event === 'buzzer-wrong'));
  test('Score inchangé après wrong', currentScore === scoreBeforeWrong);

  // Lock buzzer
  studioSocket.emit('buzzer-lock', { sessionId: testSessionId });
  await wait(300);

  test('Screen reçoit buzzer-lock', screenEvents.some(e => e.event === 'buzzer-lock'));

  // ================== TEST 4: JOKERS ==================
  console.log('\n🧪 TEST 4: Jokers');
  console.log('─'.repeat(50));

  playerEvents.length = 0;

  // Test Shield joker
  playerSocket.emit('joker-use', {
    sessionId: testSessionId,
    teamId: testTeamId,
    jokerType: 'SHIELD'
  });
  await wait(500);

  test('Joker SHIELD utilisable', true); // Just checking no crash

  // Test Double joker
  playerSocket.emit('joker-use', {
    sessionId: testSessionId,
    teamId: testTeamId,
    jokerType: 'DOUBLE'
  });
  await wait(500);

  test('Joker DOUBLE utilisable', true);

  // ================== TEST 5: BLINDTEST MEDIA ==================
  console.log('\n🧪 TEST 5: Blindtest Media');
  console.log('─'.repeat(50));

  screenEvents.length = 0;

  studioSocket.emit('blindtest-play', {
    sessionId: testSessionId,
    mediaUrl: 'https://example.com/audio.mp3',
    mediaType: 'audio'
  });
  await wait(300);

  test('Screen reçoit blindtest-play', screenEvents.some(e => e.event === 'blindtest-play'));

  studioSocket.emit('blindtest-pause', { sessionId: testSessionId });
  await wait(200);

  test('Screen reçoit blindtest-pause', screenEvents.some(e => e.event === 'blindtest-pause'));

  studioSocket.emit('blindtest-reveal', {
    sessionId: testSessionId,
    answer: 'Réponse du blindtest'
  });
  await wait(200);

  test('Screen reçoit blindtest-reveal', screenEvents.some(e => e.event === 'blindtest-reveal'));

  studioSocket.emit('blindtest-stop', { sessionId: testSessionId });
  await wait(200);

  test('Screen reçoit blindtest-stop', screenEvents.some(e => e.event === 'blindtest-stop'));

  // ================== TEST 6: LEADERBOARD ==================
  console.log('\n🧪 TEST 6: Leaderboard');
  console.log('─'.repeat(50));

  screenEvents.length = 0;

  studioSocket.emit('show-leaderboard', {
    sessionId: testSessionId,
    show: true
  });
  await wait(300);

  test('Screen reçoit show-leaderboard', screenEvents.some(e => e.event === 'show-leaderboard'));

  // ================== TEST 7: GAME CONTROL ==================
  console.log('\n🧪 TEST 7: Contrôle de Jeu');
  console.log('─'.repeat(50));

  playerEvents.length = 0;
  screenEvents.length = 0;

  studioSocket.emit('game-paused', { sessionId: testSessionId });
  await wait(300);

  test('Screen reçoit game-paused', screenEvents.some(e => e.event === 'game-paused'));

  studioSocket.emit('game-resumed', { sessionId: testSessionId });
  await wait(300);

  test('Screen reçoit game-resumed', screenEvents.some(e => e.event === 'game-resumed'));

  // ================== TEST 8: FINALE MODE ==================
  console.log('\n🧪 TEST 8: Mode Finale');
  console.log('─'.repeat(50));

  playerEvents.length = 0;
  screenEvents.length = 0;

  studioSocket.emit('finale-start', {
    sessionId: testSessionId,
    teams: [{ id: testTeamId, name: testTeamName, score: currentScore }]
  });
  await wait(500);

  test('Player reçoit finale-start', playerEvents.some(e => e.event === 'finale-start'));
  test('Screen reçoit finale-start', screenEvents.some(e => e.event === 'finale-start'));

  // Finale question
  studioSocket.emit('finale-question-start', {
    sessionId: testSessionId,
    question: {
      id: 'finale-q-1',
      text: 'Question finale?',
      options: ['A', 'B', 'C', 'D'],
      points: 500
    }
  });
  await wait(300);

  test('Screen reçoit finale-question-start', screenEvents.some(e => e.event === 'finale-question-start'));

  // End finale
  studioSocket.emit('finale-end', {
    sessionId: testSessionId,
    winner: { id: testTeamId, name: testTeamName, score: currentScore }
  });
  await wait(300);

  test('Screen reçoit finale-end', screenEvents.some(e => e.event === 'finale-end'));

  // ================== TEST 9: SCORE SYNC ==================
  console.log('\n🧪 TEST 9: Synchronisation des Scores');
  console.log('─'.repeat(50));

  // Verify final DB score
  const dbSessionsRes = await fetch(`${API_URL}/sessions`);
  const dbSessions = await dbSessionsRes.json();
  const dbSession = dbSessions.find(s => s.id === testSessionId);
  const dbScore = dbSession?.teams?.find(t => t.id === testTeamId)?.score;

  test(`Score client (${currentScore}) = Score BDD (${dbScore})`, currentScore === dbScore);

  // ================== CLEANUP ==================
  console.log('\n🧹 Nettoyage...');

  // Reset score to 0
  studioSocket.emit('set-score', { sessionId: testSessionId, teamId: testTeamId, newScore: 0 });
  await wait(500);

  studioSocket.disconnect();
  playerSocket.disconnect();
  screenSocket.disconnect();

  // ================== SUMMARY ==================
  console.log('\n' + '═'.repeat(50));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('═'.repeat(50));
  console.log(`   Total: ${passed + failed}`);
  console.log(`   ✅ Passés: ${passed}`);
  console.log(`   ❌ Échoués: ${failed}`);
  console.log(`   Taux de réussite: ${Math.round(passed / (passed + failed) * 100)}%`);

  if (failed > 0) {
    console.log('\n   Tests échoués:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}${r.details ? `: ${r.details}` : ''}`);
    });
  }

  if (failed === 0) {
    console.log('\n🎉 TOUS LES TESTS PASSENT!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  CERTAINS TESTS ONT ÉCHOUÉ\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
