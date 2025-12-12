#!/usr/bin/env node
/**
 * Arena Event - Performance Load Test & Simulation
 *
 * Simulates real-world production load with:
 * - Multiple WebSocket connections
 * - Concurrent HTTP clients
 * - Realistic game scenarios
 * - Performance metrics & reporting
 */

const { io } = require('socket.io-client');
const axios = require('axios');
const chalk = require('chalk');
const cliProgress = require('cli-progress');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Server
  API_URL: process.env.API_URL || 'http://localhost:3001',
  WS_URL: process.env.WS_URL || 'http://localhost:3001',

  // Load Parameters
  WEBSOCKET_CLIENTS: parseInt(process.env.WS_CLIENTS) || 100,
  HTTP_CLIENTS: parseInt(process.env.HTTP_CLIENTS) || 200,

  // Timing
  TEST_DURATION_SECONDS: parseInt(process.env.DURATION) || 120, // 2 minutes default
  RAMP_UP_SECONDS: parseInt(process.env.RAMP_UP) || 30, // Gradual connection
  HTTP_REQUEST_INTERVAL_MS: parseInt(process.env.HTTP_INTERVAL) || 500,

  // Simulation
  SIMULATE_ANSWERS: process.env.SIMULATE_ANSWERS !== 'false',
  SIMULATE_BUZZER: process.env.SIMULATE_BUZZER !== 'false',

  // Auth (optional - for authenticated endpoints)
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@arena.local',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
};

// ═══════════════════════════════════════════════════════════════════════════
// METRICS COLLECTION
// ═══════════════════════════════════════════════════════════════════════════

const metrics = {
  // WebSocket
  ws: {
    connections: 0,
    connectionAttempts: 0,
    connectionErrors: 0,
    disconnections: 0,
    reconnections: 0,
    messagesReceived: 0,
    messagesSent: 0,
    latencies: [],
    errors: [],
  },

  // HTTP
  http: {
    requests: 0,
    successes: 0,
    errors: 0,
    latencies: [],
    statusCodes: {},
    errorDetails: [],
  },

  // System
  system: {
    startTime: null,
    endTime: null,
    peakConnections: 0,
    memorySnapshots: [],
  },

  // Game Simulation
  game: {
    answersSubmitted: 0,
    answersAccepted: 0,
    answersRejected: 0,
    buzzerPresses: 0,
    buzzerWins: 0,
  }
};

// Active clients tracking
const activeClients = {
  websockets: [],
  httpInterval: null,
};

// Test session data
let testSession = null;
let testTeams = [];
let authToken = null;

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function log(level, message) {
  const timestamp = new Date().toISOString().substr(11, 12);
  const prefix = {
    info: chalk.blue('ℹ'),
    success: chalk.green('✓'),
    warning: chalk.yellow('⚠'),
    error: chalk.red('✗'),
    metric: chalk.cyan('📊'),
  }[level] || '•';
  console.log(`${chalk.gray(timestamp)} ${prefix} ${message}`);
}

function generateTeamName() {
  const adjectives = ['Swift', 'Brave', 'Clever', 'Mighty', 'Quick', 'Smart', 'Bold'];
  const nouns = ['Tigers', 'Eagles', 'Wolves', 'Hawks', 'Lions', 'Bears', 'Foxes'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculatePercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

async function authenticate() {
  try {
    const response = await axios.post(`${CONFIG.API_URL}/api/auth/login`, {
      email: CONFIG.ADMIN_EMAIL,
      password: CONFIG.ADMIN_PASSWORD,
    });
    authToken = response.data.token;
    log('success', `Authenticated as ${CONFIG.ADMIN_EMAIL}`);
    return true;
  } catch (error) {
    log('warning', `Authentication failed: ${error.message} - Using public endpoints only`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION SETUP
// ═══════════════════════════════════════════════════════════════════════════

async function setupTestSession() {
  log('info', 'Setting up test session...');

  try {
    // Try to find existing sessions or create one
    const sessionsResponse = await axios.get(`${CONFIG.API_URL}/sessions`);
    const sessions = sessionsResponse.data;

    if (sessions && sessions.length > 0) {
      testSession = sessions[0];
      log('success', `Using existing session: ${testSession.code || testSession.id}`);
    } else {
      // Create a new session if authenticated
      if (authToken) {
        const eventResponse = await axios.post(
          `${CONFIG.API_URL}/api/events`,
          {
            name: `Load Test Event ${Date.now()}`,
            description: 'Automated load testing event',
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );

        const sessionResponse = await axios.post(
          `${CONFIG.API_URL}/api/sessions`,
          {
            eventId: eventResponse.data.id,
            name: `Load Test Session ${Date.now()}`,
            status: 'IN_PROGRESS',
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );

        testSession = sessionResponse.data;
        log('success', `Created test session: ${testSession.code || testSession.id}`);
      } else {
        log('warning', 'No session available and not authenticated - using mock session');
        testSession = { id: 'mock-session', code: 'MOCK01' };
      }
    }

    return testSession;
  } catch (error) {
    log('warning', `Session setup failed: ${error.message} - using mock session`);
    testSession = { id: 'mock-session', code: 'MOCK01' };
    return testSession;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET CLIENT SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

function createWebSocketClient(clientId) {
  return new Promise((resolve) => {
    const teamName = generateTeamName();
    const connectStart = Date.now();

    metrics.ws.connectionAttempts++;

    const socket = io(CONFIG.WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000,
      forceNew: true,
    });

    const client = {
      id: clientId,
      socket,
      teamName,
      teamId: null,
      connected: false,
      messageCount: 0,
    };

    socket.on('connect', () => {
      const latency = Date.now() - connectStart;
      metrics.ws.latencies.push(latency);
      metrics.ws.connections++;
      client.connected = true;

      if (metrics.ws.connections > metrics.system.peakConnections) {
        metrics.system.peakConnections = metrics.ws.connections;
      }

      // Join session
      if (testSession) {
        socket.emit('join-session', {
          sessionId: testSession.id,
          teamId: `team-${clientId}`,
          role: 'player',
        });
        client.teamId = `team-${clientId}`;
      }

      resolve(client);
    });

    socket.on('connect_error', (error) => {
      metrics.ws.connectionErrors++;
      metrics.ws.errors.push({
        type: 'connection_error',
        message: error.message,
        clientId,
        timestamp: new Date().toISOString(),
      });
      resolve(client);
    });

    socket.on('disconnect', (reason) => {
      metrics.ws.disconnections++;
      client.connected = false;
      metrics.ws.connections = Math.max(0, metrics.ws.connections - 1);
    });

    socket.on('reconnect', () => {
      metrics.ws.reconnections++;
      client.connected = true;
      metrics.ws.connections++;
    });

    // Listen to game events
    const gameEvents = [
      'session-joined', 'session-state', 'team-joined', 'team-left',
      'question-start', 'question-end', 'answer-submitted', 'answer-result',
      'buzzer-pressed', 'buzzer-reset', 'timer-sync', 'timer-end',
      'leaderboard-show', 'score-update', 'error'
    ];

    gameEvents.forEach(event => {
      socket.on(event, (data) => {
        metrics.ws.messagesReceived++;
        client.messageCount++;

        if (event === 'error') {
          metrics.ws.errors.push({
            type: 'game_error',
            message: data?.message || 'Unknown error',
            clientId,
            timestamp: new Date().toISOString(),
          });
        }
      });
    });

    // Timeout for connection
    setTimeout(() => {
      if (!client.connected) {
        metrics.ws.connectionErrors++;
        resolve(client);
      }
    }, 15000);
  });
}

async function rampUpWebSocketClients() {
  const progressBar = new cliProgress.SingleBar({
    format: 'WebSocket Connections |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} clients',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  progressBar.start(CONFIG.WEBSOCKET_CLIENTS, 0);

  const clientsPerBatch = Math.ceil(CONFIG.WEBSOCKET_CLIENTS / (CONFIG.RAMP_UP_SECONDS * 2));
  const batchDelay = 500; // 500ms between batches

  for (let i = 0; i < CONFIG.WEBSOCKET_CLIENTS; i += clientsPerBatch) {
    const batchSize = Math.min(clientsPerBatch, CONFIG.WEBSOCKET_CLIENTS - i);
    const batchPromises = [];

    for (let j = 0; j < batchSize; j++) {
      batchPromises.push(createWebSocketClient(i + j));
    }

    const clients = await Promise.all(batchPromises);
    activeClients.websockets.push(...clients);
    progressBar.update(activeClients.websockets.length);

    await sleep(batchDelay);
  }

  progressBar.stop();
  log('success', `${metrics.ws.connections} WebSocket clients connected`);
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP CLIENT SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

async function makeHttpRequest() {
  const endpoints = [
    { method: 'GET', path: '/health', public: true },
    { method: 'GET', path: '/sessions', public: true },
    { method: 'GET', path: '/events', public: true },
    { method: 'GET', path: '/metrics', public: true },
  ];

  if (testSession) {
    endpoints.push(
      { method: 'GET', path: `/sessions/${testSession.id}`, public: true },
      { method: 'GET', path: `/api/sessions/${testSession.id}/leaderboard`, public: true },
      { method: 'GET', path: `/api/sessions/${testSession.id}/teams`, public: true },
    );
  }

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const startTime = Date.now();

  try {
    const config = {
      timeout: 10000,
    };

    if (!endpoint.public && authToken) {
      config.headers = { Authorization: `Bearer ${authToken}` };
    }

    const response = await axios({
      method: endpoint.method,
      url: `${CONFIG.API_URL}${endpoint.path}`,
      ...config,
    });

    const latency = Date.now() - startTime;
    metrics.http.requests++;
    metrics.http.successes++;
    metrics.http.latencies.push(latency);
    metrics.http.statusCodes[response.status] = (metrics.http.statusCodes[response.status] || 0) + 1;

  } catch (error) {
    const latency = Date.now() - startTime;
    metrics.http.requests++;
    metrics.http.errors++;
    metrics.http.latencies.push(latency);

    const statusCode = error.response?.status || 'NETWORK_ERROR';
    metrics.http.statusCodes[statusCode] = (metrics.http.statusCodes[statusCode] || 0) + 1;

    metrics.http.errorDetails.push({
      endpoint: endpoint.path,
      status: statusCode,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

function startHttpClients() {
  log('info', `Starting ${CONFIG.HTTP_CLIENTS} concurrent HTTP request cycles...`);

  const requestsPerSecond = Math.ceil(CONFIG.HTTP_CLIENTS / (CONFIG.HTTP_REQUEST_INTERVAL_MS / 1000));
  log('info', `Target: ~${requestsPerSecond} requests/second`);

  // Distribute requests across the interval
  const intervalPerClient = CONFIG.HTTP_REQUEST_INTERVAL_MS / CONFIG.HTTP_CLIENTS;

  for (let i = 0; i < CONFIG.HTTP_CLIENTS; i++) {
    setTimeout(() => {
      const interval = setInterval(makeHttpRequest, CONFIG.HTTP_REQUEST_INTERVAL_MS);
      if (!activeClients.httpInterval) {
        activeClients.httpInterval = [];
      }
      activeClients.httpInterval.push(interval);
    }, i * intervalPerClient);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

function simulateGameActions() {
  if (!CONFIG.SIMULATE_ANSWERS && !CONFIG.SIMULATE_BUZZER) return;

  log('info', 'Starting game action simulation...');

  const interval = setInterval(() => {
    // Random answer submission
    if (CONFIG.SIMULATE_ANSWERS && activeClients.websockets.length > 0) {
      const randomClient = activeClients.websockets[
        Math.floor(Math.random() * activeClients.websockets.length)
      ];

      if (randomClient.connected && randomClient.socket && testSession) {
        randomClient.socket.emit('submit-answer', {
          sessionId: testSession.id,
          questionId: 'test-question',
          teamId: randomClient.teamId,
          content: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
        });
        metrics.ws.messagesSent++;
        metrics.game.answersSubmitted++;
      }
    }

    // Random buzzer press
    if (CONFIG.SIMULATE_BUZZER && activeClients.websockets.length > 0) {
      const randomClient = activeClients.websockets[
        Math.floor(Math.random() * activeClients.websockets.length)
      ];

      if (randomClient.connected && randomClient.socket && testSession) {
        randomClient.socket.emit('buzzer-press', {
          sessionId: testSession.id,
          questionId: 'test-question',
          teamId: randomClient.teamId,
        });
        metrics.ws.messagesSent++;
        metrics.game.buzzerPresses++;
      }
    }
  }, 100); // 10 actions per second

  return interval;
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY MONITORING
// ═══════════════════════════════════════════════════════════════════════════

function startMemoryMonitoring() {
  const interval = setInterval(() => {
    const usage = process.memoryUsage();
    metrics.system.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
    });
  }, 5000);

  return interval;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE STATUS DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

function displayLiveStatus(remainingSeconds) {
  const wsConnected = activeClients.websockets.filter(c => c.connected).length;
  const httpRate = metrics.http.requests > 0
    ? Math.round(metrics.http.requests / ((Date.now() - metrics.system.startTime) / 1000))
    : 0;

  console.log(chalk.gray('─'.repeat(60)));
  console.log(
    chalk.yellow(`⏱  ${remainingSeconds}s remaining`) + ' | ' +
    chalk.green(`WS: ${wsConnected}/${CONFIG.WEBSOCKET_CLIENTS}`) + ' | ' +
    chalk.blue(`HTTP: ${metrics.http.requests} (${httpRate}/s)`) + ' | ' +
    chalk.red(`Errors: ${metrics.ws.connectionErrors + metrics.http.errors}`)
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateReport() {
  const duration = (metrics.system.endTime - metrics.system.startTime) / 1000;

  console.log('\n');
  console.log(chalk.bold('═'.repeat(70)));
  console.log(chalk.bold.cyan('  📊 PERFORMANCE TEST REPORT'));
  console.log(chalk.bold('═'.repeat(70)));

  // Test Summary
  console.log(chalk.bold.white('\n📋 TEST SUMMARY'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`  Duration:            ${duration.toFixed(1)} seconds`);
  console.log(`  WebSocket Clients:   ${CONFIG.WEBSOCKET_CLIENTS}`);
  console.log(`  HTTP Clients:        ${CONFIG.HTTP_CLIENTS}`);
  console.log(`  API URL:             ${CONFIG.API_URL}`);

  // WebSocket Metrics
  console.log(chalk.bold.green('\n🔌 WEBSOCKET METRICS'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`  Connection Attempts: ${metrics.ws.connectionAttempts}`);
  console.log(`  Successful:          ${metrics.ws.connections} (${((metrics.ws.connections / metrics.ws.connectionAttempts) * 100).toFixed(1)}%)`);
  console.log(`  Connection Errors:   ${chalk.red(metrics.ws.connectionErrors)}`);
  console.log(`  Disconnections:      ${metrics.ws.disconnections}`);
  console.log(`  Reconnections:       ${metrics.ws.reconnections}`);
  console.log(`  Peak Connections:    ${metrics.system.peakConnections}`);
  console.log(`  Messages Received:   ${metrics.ws.messagesReceived}`);
  console.log(`  Messages Sent:       ${metrics.ws.messagesSent}`);

  if (metrics.ws.latencies.length > 0) {
    const avgLatency = metrics.ws.latencies.reduce((a, b) => a + b, 0) / metrics.ws.latencies.length;
    console.log(`  Avg Connection Time: ${avgLatency.toFixed(2)}ms`);
    console.log(`  P50 Connection Time: ${calculatePercentile(metrics.ws.latencies, 50)}ms`);
    console.log(`  P95 Connection Time: ${calculatePercentile(metrics.ws.latencies, 95)}ms`);
    console.log(`  P99 Connection Time: ${calculatePercentile(metrics.ws.latencies, 99)}ms`);
  }

  // HTTP Metrics
  console.log(chalk.bold.blue('\n🌐 HTTP METRICS'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`  Total Requests:      ${metrics.http.requests}`);
  console.log(`  Successful:          ${metrics.http.successes} (${metrics.http.requests > 0 ? ((metrics.http.successes / metrics.http.requests) * 100).toFixed(1) : 0}%)`);
  console.log(`  Errors:              ${chalk.red(metrics.http.errors)}`);
  console.log(`  Requests/second:     ${(metrics.http.requests / duration).toFixed(2)}`);

  if (metrics.http.latencies.length > 0) {
    const avgLatency = metrics.http.latencies.reduce((a, b) => a + b, 0) / metrics.http.latencies.length;
    console.log(`  Avg Latency:         ${avgLatency.toFixed(2)}ms`);
    console.log(`  P50 Latency:         ${calculatePercentile(metrics.http.latencies, 50)}ms`);
    console.log(`  P95 Latency:         ${calculatePercentile(metrics.http.latencies, 95)}ms`);
    console.log(`  P99 Latency:         ${calculatePercentile(metrics.http.latencies, 99)}ms`);
    console.log(`  Min Latency:         ${Math.min(...metrics.http.latencies)}ms`);
    console.log(`  Max Latency:         ${Math.max(...metrics.http.latencies)}ms`);
  }

  console.log(`\n  Status Codes:`);
  Object.entries(metrics.http.statusCodes).forEach(([code, count]) => {
    const color = code.startsWith('2') ? chalk.green : code.startsWith('4') ? chalk.yellow : chalk.red;
    console.log(`    ${color(code)}: ${count}`);
  });

  // Game Simulation Metrics
  if (CONFIG.SIMULATE_ANSWERS || CONFIG.SIMULATE_BUZZER) {
    console.log(chalk.bold.magenta('\n🎮 GAME SIMULATION'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  Answers Submitted:   ${metrics.game.answersSubmitted}`);
    console.log(`  Buzzer Presses:      ${metrics.game.buzzerPresses}`);
  }

  // Memory Usage
  if (metrics.system.memorySnapshots.length > 0) {
    console.log(chalk.bold.yellow('\n💾 LOAD TEST MEMORY USAGE'));
    console.log(chalk.gray('─'.repeat(50)));
    const lastSnapshot = metrics.system.memorySnapshots[metrics.system.memorySnapshots.length - 1];
    const maxHeap = Math.max(...metrics.system.memorySnapshots.map(s => s.heapUsed));
    const maxRss = Math.max(...metrics.system.memorySnapshots.map(s => s.rss));
    console.log(`  Final Heap Used:     ${lastSnapshot.heapUsed}MB`);
    console.log(`  Max Heap Used:       ${maxHeap}MB`);
    console.log(`  Max RSS:             ${maxRss}MB`);
  }

  // Errors Summary
  const totalErrors = metrics.ws.errors.length + metrics.http.errorDetails.length;
  if (totalErrors > 0) {
    console.log(chalk.bold.red('\n❌ ERRORS SUMMARY'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  Total Errors:        ${totalErrors}`);

    // Group errors by type
    const errorGroups = {};
    metrics.ws.errors.forEach(e => {
      const key = `WS: ${e.type}`;
      errorGroups[key] = (errorGroups[key] || 0) + 1;
    });
    metrics.http.errorDetails.forEach(e => {
      const key = `HTTP ${e.status}: ${e.endpoint}`;
      errorGroups[key] = (errorGroups[key] || 0) + 1;
    });

    console.log(`\n  Error Breakdown:`);
    Object.entries(errorGroups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([error, count]) => {
        console.log(`    ${chalk.red(count.toString().padStart(4))} × ${error}`);
      });
  }

  // Overall Assessment
  console.log(chalk.bold.white('\n📈 OVERALL ASSESSMENT'));
  console.log(chalk.gray('─'.repeat(50)));

  const wsSuccessRate = metrics.ws.connectionAttempts > 0
    ? (metrics.ws.connections / metrics.ws.connectionAttempts) * 100
    : 0;
  const httpSuccessRate = metrics.http.requests > 0
    ? (metrics.http.successes / metrics.http.requests) * 100
    : 0;

  let status = 'PASS';
  let statusColor = chalk.green;

  if (wsSuccessRate < 90 || httpSuccessRate < 95) {
    status = 'WARNING';
    statusColor = chalk.yellow;
  }
  if (wsSuccessRate < 70 || httpSuccessRate < 80) {
    status = 'FAIL';
    statusColor = chalk.red;
  }

  console.log(`  WebSocket Success:   ${wsSuccessRate.toFixed(1)}%`);
  console.log(`  HTTP Success:        ${httpSuccessRate.toFixed(1)}%`);
  console.log(`  Status:              ${statusColor.bold(status)}`);

  console.log(chalk.bold('\n' + '═'.repeat(70)));
  console.log(chalk.gray(`  Report generated at ${new Date().toISOString()}`));
  console.log(chalk.bold('═'.repeat(70) + '\n'));

  // Return metrics for JSON export
  return {
    summary: {
      duration,
      wsClients: CONFIG.WEBSOCKET_CLIENTS,
      httpClients: CONFIG.HTTP_CLIENTS,
      status,
    },
    websocket: {
      connectionAttempts: metrics.ws.connectionAttempts,
      successful: metrics.ws.connections,
      errors: metrics.ws.connectionErrors,
      peakConnections: metrics.system.peakConnections,
      avgLatencyMs: metrics.ws.latencies.length > 0
        ? metrics.ws.latencies.reduce((a, b) => a + b, 0) / metrics.ws.latencies.length
        : 0,
      p95LatencyMs: calculatePercentile(metrics.ws.latencies, 95),
    },
    http: {
      totalRequests: metrics.http.requests,
      successful: metrics.http.successes,
      errors: metrics.http.errors,
      requestsPerSecond: metrics.http.requests / duration,
      avgLatencyMs: metrics.http.latencies.length > 0
        ? metrics.http.latencies.reduce((a, b) => a + b, 0) / metrics.http.latencies.length
        : 0,
      p95LatencyMs: calculatePercentile(metrics.http.latencies, 95),
    },
    errors: {
      total: totalErrors,
      websocket: metrics.ws.errors,
      http: metrics.http.errorDetails,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════

function cleanup() {
  log('info', 'Cleaning up...');

  // Close all WebSocket connections
  activeClients.websockets.forEach(client => {
    if (client.socket) {
      client.socket.disconnect();
    }
  });

  // Clear HTTP intervals
  if (activeClients.httpInterval) {
    activeClients.httpInterval.forEach(interval => clearInterval(interval));
  }

  log('success', 'Cleanup complete');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n');
  console.log(chalk.bold.cyan('═'.repeat(70)));
  console.log(chalk.bold.cyan('  🚀 ARENA EVENT - PERFORMANCE LOAD TEST'));
  console.log(chalk.bold.cyan('═'.repeat(70)));
  console.log(`\n  Target: ${chalk.yellow(CONFIG.API_URL)}`);
  console.log(`  WebSocket Clients: ${chalk.green(CONFIG.WEBSOCKET_CLIENTS)}`);
  console.log(`  HTTP Clients: ${chalk.green(CONFIG.HTTP_CLIENTS)}`);
  console.log(`  Duration: ${chalk.green(CONFIG.TEST_DURATION_SECONDS + 's')}`);
  console.log(`  Ramp-up: ${chalk.green(CONFIG.RAMP_UP_SECONDS + 's')}\n`);

  metrics.system.startTime = Date.now();

  try {
    // Step 1: Authenticate
    await authenticate();

    // Step 2: Setup test session
    await setupTestSession();

    // Step 3: Start memory monitoring
    const memoryInterval = startMemoryMonitoring();

    // Step 4: Ramp up WebSocket clients
    log('info', `Ramping up ${CONFIG.WEBSOCKET_CLIENTS} WebSocket clients over ${CONFIG.RAMP_UP_SECONDS}s...`);
    await rampUpWebSocketClients();

    // Step 5: Start HTTP clients
    startHttpClients();

    // Step 6: Start game simulation
    const gameInterval = simulateGameActions();

    // Step 7: Run for test duration
    log('info', `Running test for ${CONFIG.TEST_DURATION_SECONDS} seconds...`);

    const statusInterval = setInterval(() => {
      const elapsed = (Date.now() - metrics.system.startTime) / 1000;
      const remaining = Math.max(0, CONFIG.TEST_DURATION_SECONDS - Math.floor(elapsed));
      displayLiveStatus(remaining);
    }, 5000);

    await sleep(CONFIG.TEST_DURATION_SECONDS * 1000);

    // Step 8: Stop test
    clearInterval(statusInterval);
    clearInterval(memoryInterval);
    if (gameInterval) clearInterval(gameInterval);

    metrics.system.endTime = Date.now();

    // Step 9: Generate report
    const report = generateReport();

    // Step 10: Cleanup
    cleanup();

    // Export JSON report
    const fs = require('fs');
    const reportPath = `./load-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log('success', `JSON report saved to ${reportPath}`);

    process.exit(report.summary.status === 'FAIL' ? 1 : 0);

  } catch (error) {
    console.error(chalk.red(`\nFatal error: ${error.message}`));
    console.error(error.stack);
    cleanup();
    process.exit(1);
  }
}

// Handle interrupts
process.on('SIGINT', () => {
  console.log('\n');
  log('warning', 'Test interrupted by user');
  metrics.system.endTime = Date.now();
  generateReport();
  cleanup();
  process.exit(130);
});

// Run
main();
