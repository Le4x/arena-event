/**
 * Automated test for score synchronization - CI/CD friendly
 *
 * Usage:
 *   node test-score-sync-auto.js [API_URL]
 *
 * Exit codes:
 *   0 - All tests passed
 *   1 - Tests failed
 */

import { io } from 'socket.io-client';

const API_URL = process.argv[2] || 'http://localhost:3001';

console.log('🧪 Test automatisé de synchronisation des scores');
console.log('================================================');
console.log(`📡 API URL: ${API_URL}\n`);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  let passed = 0;
  let failed = 0;

  const scores = { player: null, studio: null, screen: null };
  let testSessionId, testTeamId, testTeamName;

  // Fetch test data
  console.log('📋 Setup...');
  try {
    const sessionsRes = await fetch(`${API_URL}/sessions`);
    const sessions = await sessionsRes.json();
    if (!sessions.length) throw new Error('No sessions');

    // Find a session with teams
    const sessionWithTeams = sessions.find(s => s.teams && s.teams.length > 0);
    if (!sessionWithTeams) throw new Error('No session with teams');

    testSessionId = sessionWithTeams.id;
    testTeamId = sessionWithTeams.teams[0].id;
    testTeamName = sessionWithTeams.teams[0].name;

    scores.player = 0;
    scores.studio = 0;
    scores.screen = 0;
    console.log(`   ✓ Session: ${sessionWithTeams.event?.name || sessionWithTeams.code}`);
    console.log(`   ✓ Team: ${testTeamName}\n`);
  } catch (error) {
    console.log(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  }

  // Connect clients
  console.log('🔌 Connecting clients...');
  const playerSocket = io(API_URL, { transports: ['websocket'] });
  const studioSocket = io(API_URL, { transports: ['websocket'] });
  const screenSocket = io(API_URL, { transports: ['websocket'] });

  const setupClient = (socket, key) => {
    socket.on('connect', () => {
      socket.emit('join-session', { sessionId: testSessionId });
    });
    socket.on('score-update', (data) => {
      if (data.teamId === testTeamId) {
        scores[key] = data.newScore;
      }
    });
  };

  setupClient(playerSocket, 'player');
  setupClient(studioSocket, 'studio');
  setupClient(screenSocket, 'screen');

  await wait(2000);
  console.log('   ✓ All clients connected\n');

  // Reset score to 0 using socket (updates DB and broadcasts)
  studioSocket.emit('set-score', {
    sessionId: testSessionId,
    teamId: testTeamId,
    newScore: 0
  });
  await wait(1000);
  console.log('   ✓ Score reset to 0\n');

  // Test function
  const test = (name, condition) => {
    if (condition) {
      console.log(`   ✅ ${name}`);
      passed++;
    } else {
      console.log(`   ❌ ${name}`);
      failed++;
    }
  };

  const allSynced = () => scores.player === scores.studio && scores.studio === scores.screen;

  // ========== TEST 1: Initial sync ==========
  console.log('🧪 TEST 1: Initial sync');
  test('All scores are 0', scores.player === 0 && scores.studio === 0 && scores.screen === 0);
  test('All clients synced', allSynced());

  // ========== TEST 2: Buzzer correct ==========
  console.log('\n🧪 TEST 2: Buzzer correct (+100)');
  studioSocket.emit('buzzer-correct', {
    sessionId: testSessionId,
    teamId: testTeamId,
    teamName: testTeamName,
    points: 100
  });
  await wait(1500);

  test('Player received update', scores.player === 100);
  test('Studio received update', scores.studio === 100);
  test('Screen received update', scores.screen === 100);
  test('All clients synced', allSynced());

  // ========== TEST 3: Multiple rapid updates ==========
  console.log('\n🧪 TEST 3: Multiple rapid updates (3x +50)');
  for (let i = 0; i < 3; i++) {
    studioSocket.emit('buzzer-correct', {
      sessionId: testSessionId,
      teamId: testTeamId,
      teamName: testTeamName,
      points: 50
    });
    await wait(200);
  }
  await wait(2000);

  const expectedScore = 100 + (3 * 50); // 250
  test(`Expected score is ${expectedScore}`, scores.player === expectedScore);
  test('All clients synced after rapid updates', allSynced());

  // ========== TEST 4: DB consistency ==========
  console.log('\n🧪 TEST 4: Database consistency');
  const dbSessionsRes = await fetch(`${API_URL}/sessions`);
  const dbSessions = await dbSessionsRes.json();
  const dbSession = dbSessions.find(s => s.id === testSessionId);
  const dbScore = dbSession?.teams?.find(t => t.id === testTeamId)?.score;

  test(`DB score matches (${dbScore})`, dbScore === scores.player);
  test('All clients match DB', dbScore === scores.player && dbScore === scores.studio && dbScore === scores.screen);

  // ========== TEST 5: Score reset ==========
  console.log('\n🧪 TEST 5: Score reset');
  studioSocket.emit('set-score', {
    sessionId: testSessionId,
    teamId: testTeamId,
    newScore: 0
  });
  await wait(1000);

  test('Score reset to 0', scores.player === 0);
  test('All clients synced after reset', allSynced());

  // Cleanup
  playerSocket.disconnect();
  studioSocket.disconnect();
  screenSocket.disconnect();

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 RÉSULTATS');
  console.log('='.repeat(50));
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n✅ TOUS LES TESTS PASSENT!\n');
    process.exit(0);
  } else {
    console.log('\n❌ CERTAINS TESTS ONT ÉCHOUÉ\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
