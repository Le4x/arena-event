/**
 * Test script for score synchronization across Player, Studio, and Screen
 *
 * Usage:
 *   node test-score-sync.js [API_URL]
 *   node test-score-sync.js http://your-vps:3001
 *
 * Default: http://localhost:3001
 */

import { io } from 'socket.io-client';
import readline from 'readline';

const API_URL = process.argv[2] || 'http://localhost:3001';

console.log('🧪 Test de synchronisation des scores');
console.log('=====================================');
console.log(`📡 API URL: ${API_URL}\n`);

// Track scores received by each client
const scores = {
  player: null,
  studio: null,
  screen: null
};

let testSessionId = null;
let testTeamId = null;
let testTeamName = null;

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to check score sync
function checkScoreSync(label = '') {
  const playerScore = scores.player;
  const studioScore = scores.studio;
  const screenScore = scores.screen;

  console.log(`\n📊 Scores actuels ${label}:`);
  console.log(`   🎮 Player: ${playerScore}`);
  console.log(`   🎬 Studio: ${studioScore}`);
  console.log(`   📺 Screen: ${screenScore}`);

  if (playerScore === studioScore && studioScore === screenScore) {
    console.log(`   ✅ SYNC OK`);
    return true;
  } else {
    console.log(`   ❌ DÉSYNC!`);
    return false;
  }
}

async function runTests() {
  // First, get a real session and team from the API
  console.log('📋 Récupération des données...');

  try {
    const sessionsRes = await fetch(`${API_URL}/sessions`);
    const sessions = await sessionsRes.json();

    if (!sessions.length) {
      console.log('❌ Aucune session trouvée. Créez une session dans l\'admin.');
      process.exit(1);
    }

    // Find a session with teams
    const sessionWithTeams = sessions.find(s => s.teams && s.teams.length > 0);
    if (!sessionWithTeams) {
      console.log('❌ Aucune session avec équipe trouvée. Créez une équipe dans l\'admin.');
      process.exit(1);
    }

    testSessionId = sessionWithTeams.id;
    console.log(`   ✓ Session: ${sessionWithTeams.event?.name || sessionWithTeams.code}`);

    // Teams are included in the session response
    const teams = sessionWithTeams.teams;
    testTeamId = teams[0].id;
    testTeamName = teams[0].name;
    const initialScore = teams[0].score;
    console.log(`   ✓ Équipe: ${testTeamName}`);
    console.log(`   ✓ Score initial: ${initialScore}\n`);

    // Initialize scores
    scores.player = initialScore;
    scores.studio = initialScore;
    scores.screen = initialScore;

  } catch (error) {
    console.log(`❌ Erreur de connexion à l'API: ${error.message}`);
    console.log(`   Vérifiez que l'API tourne sur ${API_URL}`);
    process.exit(1);
  }

  // Create 3 socket connections
  console.log('🔌 Connexion des clients simulés...');

  const playerSocket = io(API_URL, { transports: ['websocket'] });
  const studioSocket = io(API_URL, { transports: ['websocket'] });
  const screenSocket = io(API_URL, { transports: ['websocket'] });

  let connectedCount = 0;

  // Setup event listeners for each client
  const setupClient = (socket, name, key) => {
    socket.on('connect', () => {
      connectedCount++;
      console.log(`   ✓ ${name} connecté`);
      socket.emit('join-session', { sessionId: testSessionId });
    });

    socket.on('score-update', (data) => {
      if (data.teamId === testTeamId) {
        scores[key] = data.newScore;
        console.log(`   📨 ${name} ← score-update: ${data.newScore}`);
      }
    });

    socket.on('buzzer-correct', (data) => {
      if (data.teamId === testTeamId) {
        console.log(`   📨 ${name} ← buzzer-correct: +${data.points}`);
      }
    });

    socket.on('question-end', (data) => {
      console.log(`   📨 ${name} ← question-end`);
      if (data.answers) {
        const teamAnswer = data.answers.find(a => a.teamId === testTeamId);
        if (teamAnswer) {
          console.log(`      → Points gagnés: ${teamAnswer.points}`);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`   ⚠️  ${name} déconnecté`);
    });
  };

  setupClient(playerSocket, '🎮 Player', 'player');
  setupClient(studioSocket, '🎬 Studio', 'studio');
  setupClient(screenSocket, '📺 Screen', 'screen');

  // Wait for connections
  await wait(2000);

  if (connectedCount < 3) {
    console.log(`\n❌ Seulement ${connectedCount}/3 clients connectés`);
    process.exit(1);
  }

  console.log(`\n✅ Tous les clients sont connectés!\n`);

  // Interactive mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const showMenu = () => {
    console.log('\n' + '─'.repeat(50));
    console.log('Commandes disponibles:');
    console.log('  1 - Buzzer correct (+100 points)');
    console.log('  2 - Buzzer correct (+200 points)');
    console.log('  3 - Test rapide (3x +50 points)');
    console.log('  4 - Réinitialiser score à 0');
    console.log('  s - Afficher les scores');
    console.log('  d - Vérifier score en BDD');
    console.log('  q - Quitter');
    console.log('─'.repeat(50));
  };

  const handleCommand = async (cmd) => {
    switch (cmd.trim()) {
      case '1':
        console.log('\n🎯 Envoi buzzer-correct +100...');
        studioSocket.emit('buzzer-correct', {
          sessionId: testSessionId,
          teamId: testTeamId,
          teamName: testTeamName,
          points: 100
        });
        await wait(1000);
        checkScoreSync('après +100');
        break;

      case '2':
        console.log('\n🎯 Envoi buzzer-correct +200...');
        studioSocket.emit('buzzer-correct', {
          sessionId: testSessionId,
          teamId: testTeamId,
          teamName: testTeamName,
          points: 200
        });
        await wait(1000);
        checkScoreSync('après +200');
        break;

      case '3':
        console.log('\n🎯 Test rapide: 3x +50 points...');
        for (let i = 0; i < 3; i++) {
          studioSocket.emit('buzzer-correct', {
            sessionId: testSessionId,
            teamId: testTeamId,
            teamName: testTeamName,
            points: 50
          });
          await wait(300);
        }
        await wait(1500);
        checkScoreSync('après 3x50');
        break;

      case '4':
        console.log('\n🔄 Réinitialisation du score à 0...');
        // Use set-score which updates DB and broadcasts
        studioSocket.emit('set-score', {
          sessionId: testSessionId,
          teamId: testTeamId,
          newScore: 0
        });
        await wait(1000);
        checkScoreSync('après reset');
        break;

      case 's':
        checkScoreSync();
        break;

      case 'd':
        console.log('\n🔍 Vérification BDD...');
        const dbSessionsRes = await fetch(`${API_URL}/sessions`);
        const dbSessions = await dbSessionsRes.json();
        const dbSession = dbSessions.find(s => s.id === testSessionId);
        const dbTeam = dbSession?.teams?.find(t => t.id === testTeamId);
        console.log(`   Score en BDD: ${dbTeam?.score}`);
        console.log(`   Score Player: ${scores.player}`);
        console.log(`   Score Studio: ${scores.studio}`);
        console.log(`   Score Screen: ${scores.screen}`);
        if (dbTeam?.score === scores.player && dbTeam?.score === scores.studio && dbTeam?.score === scores.screen) {
          console.log(`   ✅ Tout est cohérent!`);
        } else {
          console.log(`   ❌ Incohérence détectée!`);
        }
        break;

      case 'q':
        console.log('\n👋 Fermeture des connexions...');
        playerSocket.disconnect();
        studioSocket.disconnect();
        screenSocket.disconnect();
        rl.close();
        process.exit(0);
        break;

      default:
        console.log('Commande inconnue');
    }
  };

  showMenu();

  rl.on('line', async (line) => {
    await handleCommand(line);
    showMenu();
  });

  rl.on('close', () => {
    playerSocket.disconnect();
    studioSocket.disconnect();
    screenSocket.disconnect();
    process.exit(0);
  });
}

// Run tests
runTests().catch(console.error);
