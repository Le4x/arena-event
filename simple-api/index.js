import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create media directory if it doesn't exist
const mediaDir = join(__dirname, 'media');
if (!existsSync(mediaDir)) {
  mkdirSync(mediaDir, { recursive: true });
}

// Create theme assets directory
const themeDir = join(__dirname, 'uploads', 'themes');
if (!existsSync(themeDir)) {
  mkdirSync(themeDir, { recursive: true });
}

// Multer configuration for theme uploads
const themeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const eventDir = join(themeDir, req.params.id);
    if (!existsSync(eventDir)) {
      mkdirSync(eventDir, { recursive: true });
    }
    cb(null, eventDir);
  },
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    const type = req.body.type || 'asset'; // logo, frame, background, sound
    cb(null, `${type}-${uuidv4()}${ext}`);
  }
});

const themeUpload = multer({
  storage: themeStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg|mp3|wav|ogg/;
    const ext = extname(file.originalname).toLowerCase().slice(1);
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  }
});

const app = express();
const httpServer = createServer(app);
// SECURITY: Parse CORS origins from environment
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004'];

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  // Optimized for low latency
  transports: ['websocket', 'polling'],
  pingInterval: 5000,      // 5 seconds - faster connection health check
  pingTimeout: 3000,       // 3 seconds - quick disconnect detection
  upgradeTimeout: 5000,    // 5 seconds - faster websocket upgrade
  maxHttpBufferSize: 1e6,  // 1MB max payload
  connectTimeout: 10000,   // 10 seconds connection timeout
  allowUpgrades: true,
  perMessageDeflate: false // Disable compression for lower latency
});

// ============================================
// SERVER-SIDE TIMER MANAGER (for sync across all clients)
// ============================================
const activeTimers = new Map(); // sessionId -> { interval, startTime, duration, remaining }

const startServerTimer = (sessionId, duration) => {
  // Clear existing timer
  stopServerTimer(sessionId);

  const startTime = Date.now();
  const timerData = {
    startTime,
    duration: duration * 1000, // Convert to ms
    remaining: duration
  };

  // Emit sync every 100ms for smooth countdown
  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, Math.ceil((timerData.duration - elapsed) / 1000));
    timerData.remaining = remaining;

    // Emit timer sync to all clients
    io.to(`session:${sessionId}`).emit('timer-sync', {
      remaining,
      serverTime: Date.now()
    });

    if (remaining <= 0) {
      stopServerTimer(sessionId);
      io.to(`session:${sessionId}`).emit('timer-end', { serverTime: Date.now() });
    }
  }, 100); // 100ms for smooth updates

  timerData.interval = interval;
  activeTimers.set(sessionId, timerData);

  console.log(`Timer started for session ${sessionId}: ${duration}s`);
  return timerData;
};

const stopServerTimer = (sessionId) => {
  const timer = activeTimers.get(sessionId);
  if (timer) {
    clearInterval(timer.interval);
    activeTimers.delete(sessionId);
    console.log(`Timer stopped for session ${sessionId}`);
  }
};

const getTimerRemaining = (sessionId) => {
  const timer = activeTimers.get(sessionId);
  return timer ? timer.remaining : 0;
};

// ============================================
// CONNECTION TRACKING (for real-time status)
// ============================================
const connectedTeams = new Map(); // sessionId -> Set<teamId>
const disconnectTimers = new Map(); // teamId -> setTimeout reference (grace period)

const trackTeamConnection = (sessionId, teamId) => {
  // Cancel any pending disconnect for this team (they reconnected!)
  const disconnectTimer = disconnectTimers.get(teamId);
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimers.delete(teamId);
    console.log(`Team ${teamId} reconnected (disconnect cancelled)`);
  }

  if (!connectedTeams.has(sessionId)) {
    connectedTeams.set(sessionId, new Set());
  }

  const wasAlreadyConnected = connectedTeams.get(sessionId).has(teamId);
  connectedTeams.get(sessionId).add(teamId);

  if (!wasAlreadyConnected) {
    console.log(`Team ${teamId} marked as connected in session ${sessionId}`);
  }
};

const untrackTeamConnection = (sessionId, teamId) => {
  // Don't immediately disconnect - give them a grace period (5 seconds)
  // This handles page refreshes and mobile app switching where they reconnect quickly
  const disconnectTimer = setTimeout(() => {
    const teams = connectedTeams.get(sessionId);
    if (teams && teams.has(teamId)) {
      teams.delete(teamId);
      console.log(`Team ${teamId} marked as disconnected from session ${sessionId} (after grace period)`);

      // Emit team-left for backward compatibility
      io.to(`session:${sessionId}`).emit('team-left', { teamId });

      // Emit team-disconnected after grace period
      io.to(`session:${sessionId}`).emit('team-disconnected', {
        teamId,
        sessionId,
        timestamp: Date.now()
      });
    }
    disconnectTimers.delete(teamId);
  }, 5000); // 5 second grace period for mobile app switching

  disconnectTimers.set(teamId, disconnectTimer);
  console.log(`Team ${teamId} disconnect scheduled (5s grace period)`);
};

const getConnectedTeams = (sessionId) => {
  const teams = connectedTeams.get(sessionId);
  return teams ? Array.from(teams) : [];
};

// ============================================
// BUZZER LOCK MANAGER (first-press wins) - WITH PERSISTENCE
// ============================================
const buzzerState = new Map(); // sessionId -> { locked: boolean, winner: team, timestamp, questionId, queue: [] }

const resetBuzzer = (sessionId, questionId = null) => {
  buzzerState.set(sessionId, { 
    locked: false, 
    winner: null, 
    timestamp: null, 
    questionId,
    queue: [] // Track all buzzer presses in order
  });
};

const tryPressBuzzer = (sessionId, team, timestamp) => {
  const state = buzzerState.get(sessionId) || { locked: false, winner: null, timestamp: null, queue: [] };

  // Check if this team already buzzed
  const alreadyBuzzed = state.queue?.some(entry => entry.team?.id === team?.id);
  if (alreadyBuzzed) {
    return { success: false, winner: state.winner, reason: 'already_buzzed' };
  }

  // Calculate rank based on queue length
  const rank = (state.queue?.length || 0) + 1;

  // Add to queue regardless of lock state (for history)
  if (!state.queue) state.queue = [];
  state.queue.push({ team, timestamp, rank });

  if (state.locked) {
    return { success: false, winner: state.winner, rank, reason: 'buzzer_locked' };
  }

  // First press wins!
  state.locked = true;
  state.winner = team;
  state.timestamp = timestamp;
  buzzerState.set(sessionId, state);

  return { success: true, winner: team, rank };
};

// Persist buzzer press to database (async, non-blocking)
const persistBuzzerPress = async (prismaClient, questionId, teamId, rank) => {
  if (!questionId || !teamId) return null;
  
  try {
    const buzzerPress = await prismaClient.buzzerPress.upsert({
      where: {
        questionId_teamId: { questionId, teamId }
      },
      update: {},
      create: {
        questionId,
        teamId,
        rank,
        pressedAt: new Date()
      }
    });
    return buzzerPress;
  } catch (error) {
    console.error('Failed to persist buzzer press:', error.message);
    return null;
  }
};

// Get buzzer queue for a session (for analytics)
const getBuzzerQueue = (sessionId) => {
  const state = buzzerState.get(sessionId);
  return state?.queue || [];
};

// ============================================
// FINALE MODE MANAGER
// ============================================
const finaleState = new Map(); // sessionId -> { active, finalistTeams, jokers, eliminatedTeams }

const JOKER_TYPES = {
  DOUBLE: 'DOUBLE',         // Double les points de la question
  TIME_PLUS: 'TIME_PLUS',   // +15 secondes pour répondre
  FIFTY_FIFTY: 'FIFTY_FIFTY', // Élimine 2 mauvaises réponses (MCQ)
  SHIELD: 'SHIELD'          // Protège contre une mauvaise réponse
};

const initFinale = (sessionId, finalistCount, teams) => {
  // Sort teams by score and take top N
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const finalistTeams = sortedTeams.slice(0, finalistCount);

  // Initialize jokers for each finalist (1 of each type)
  const jokers = {};
  finalistTeams.forEach(team => {
    jokers[team.id] = {
      [JOKER_TYPES.DOUBLE]: 1,
      [JOKER_TYPES.TIME_PLUS]: 1,
      [JOKER_TYPES.FIFTY_FIFTY]: 1,
      [JOKER_TYPES.SHIELD]: 1
    };
  });

  const state = {
    active: true,
    finalistCount,
    finalistTeams,
    eliminatedTeams: sortedTeams.slice(finalistCount),
    jokers,
    activeJokers: {}, // teamId -> active joker for current question
    shieldedTeams: [], // teams protected by shield this round
    currentRound: 1
  };

  finaleState.set(sessionId, state);
  console.log(`🏆 FINALE started for session ${sessionId} with ${finalistCount} teams`);
  return state;
};

const getFinaleState = (sessionId) => {
  return finaleState.get(sessionId);
};

const useJoker = (sessionId, teamId, jokerType) => {
  const state = finaleState.get(sessionId);
  if (!state || !state.active) return { success: false, error: 'Finale not active' };

  const teamJokers = state.jokers[teamId];
  if (!teamJokers) return { success: false, error: 'Team not in finale' };

  if (teamJokers[jokerType] <= 0) return { success: false, error: 'Joker already used' };

  // Use the joker
  teamJokers[jokerType]--;

  // Set active joker for this question
  if (!state.activeJokers[teamId]) {
    state.activeJokers[teamId] = [];
  }
  state.activeJokers[teamId].push(jokerType);

  // Special handling for SHIELD
  if (jokerType === JOKER_TYPES.SHIELD) {
    state.shieldedTeams.push(teamId);
  }

  finaleState.set(sessionId, state);
  console.log(`🃏 Joker ${jokerType} used by team ${teamId} in session ${sessionId}`);

  return { success: true, jokerType, remainingJokers: teamJokers };
};

const clearActiveJokers = (sessionId) => {
  const state = finaleState.get(sessionId);
  if (state) {
    state.activeJokers = {};
    state.shieldedTeams = [];
    finaleState.set(sessionId, state);
  }
};

const eliminateTeam = (sessionId, teamId) => {
  const state = finaleState.get(sessionId);
  if (!state) return null;

  const teamIndex = state.finalistTeams.findIndex(t => t.id === teamId);
  if (teamIndex === -1) return null;

  const [eliminatedTeam] = state.finalistTeams.splice(teamIndex, 1);
  state.eliminatedTeams.unshift(eliminatedTeam);
  delete state.jokers[teamId];

  finaleState.set(sessionId, state);
  console.log(`❌ Team ${eliminatedTeam.name} eliminated from finale in session ${sessionId}`);

  return eliminatedTeam;
};

const endFinale = (sessionId) => {
  finaleState.delete(sessionId);
  console.log(`🏁 Finale ended for session ${sessionId}`);
};

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static media files (audio, images)
app.use('/media', express.static(mediaDir));

// Serve theme assets
app.use('/themes', express.static(join(__dirname, 'uploads', 'themes')));

// Create audio subdirectory
const audioDir = join(mediaDir, 'audio');
if (!existsSync(audioDir)) {
  mkdirSync(audioDir, { recursive: true });
}

// ============================================
// FILE UPLOAD ENDPOINT
// ============================================

app.post('/api/upload', async (req, res) => {
  try {
    const { filename, data, type } = req.body;

    if (!filename || !data) {
      return res.status(400).json({ error: 'Filename and data are required' });
    }

    // Extract base64 data
    const base64Data = data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const ext = extname(filename) || '.mp3';
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;

    // Determine subdirectory based on type
    const subdir = type === 'audio' ? 'audio' : 'images';
    const targetDir = join(mediaDir, subdir);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const filepath = join(targetDir, uniqueFilename);
    writeFileSync(filepath, buffer);

    // Use environment variable or construct from request host
    const baseUrl = process.env.API_BASE_URL || `http://${req.headers.host}`;
    const mediaUrl = `${baseUrl}/media/${subdir}/${uniqueFilename}`;

    console.log(`File uploaded: ${mediaUrl}`);
    res.json({ url: mediaUrl, filename: uniqueFilename });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ============================================
// CONFIGURATION (Environment Variables)
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'arena-event-super-secret-jwt-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// SECURITY: Warn if using default JWT secret in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('WARNING: JWT_SECRET not set in production! Using default is insecure.');
}

// ============================================
// RATE LIMITING (Anti-spam protection)
// ============================================
const rateLimitMap = new Map(); // key -> { count, resetTime }

const rateLimit = (key, maxRequests = 10, windowMs = 1000) => {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfter: record.resetTime - now };
  }
  
  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
};

// Cleanup old rate limit entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

// ============================================
// MIDDLEWARE
// ============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const generateSessionCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const calculateScore = (isCorrect, timeRemaining, maxTime, basePoints) => {
  if (!isCorrect) return 0;
  const timeBonus = Math.round((timeRemaining / maxTime) * (basePoints * 0.5));
  return basePoints + timeBonus;
};

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Arena Event API is running!',
    timestamp: new Date().toISOString(),
    version: '2.1.0'
  });
});

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // SECURITY: Rate limit login attempts (5 attempts per minute per IP)
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const rateLimitResult = rateLimit(`login:${clientIP}`, 5, 60000);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
        retryAfter: Math.ceil(rateLimitResult.retryAfter / 1000)
      });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    // SECURITY: Rate limit registration (3 per hour per IP)
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const rateLimitResult = rateLimit(`register:${clientIP}`, 3, 3600000);
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Too many registration attempts. Please try again later.',
        retryAfter: Math.ceil(rateLimitResult.retryAfter / 1000)
      });
    }

    // SECURITY: Role is NOT accepted from request - always ORGANIZER for public registration
    // Admin can change roles via /api/users/:id endpoint (requires SUPER_ADMIN)
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // SECURITY: Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // SECURITY: Password strength validation
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || '',
        lastName: lastName || '',
        role: 'ORGANIZER'  // SECURITY: Always ORGANIZER for public registration
      }
    });

    res.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, role: true, firstName: true, lastName: true }
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// USERS ROUTES
// ============================================

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Only SUPER_ADMIN can list all users
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    // Only SUPER_ADMIN can update users
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;
    const { firstName, lastName, role } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(role !== undefined && { role })
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    // Only SUPER_ADMIN can delete users
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id }
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// EVENTS ROUTES
// ============================================

app.get('/api/events', authenticateToken, async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { ownerId: req.user.userId },
      include: {
        _count: { select: { sessions: true, rounds: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    const event = await prisma.event.create({
      data: {
        name,
        description: description || '',
        ownerId: req.user.userId
      }
    });

    res.json({ success: true, event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        rounds: {
          include: {
            questions: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        },
        sessions: true
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Transform questions to match frontend expectations
    const transformedEvent = {
      ...event,
      rounds: event.rounds.map(round => ({
        ...round,
        questions: round.questions.map(q => ({
          id: q.id,
          text: q.content,
          type: q.type,
          options: q.choices || [],
          correctAnswer: q.correctAnswer || '',
          points: q.points,
          timeLimit: q.timeLimit,
          order: q.order,
          mediaUrl: q.mediaUrl,
          questionCueStart: q.questionCueStart,
          questionCueEnd: q.questionCueEnd,
          revealCueStart: q.revealCueStart,
          revealCueEnd: q.revealCueEnd,
          explanation: q.explanation
        }))
      }))
    };

    res.json({ event: transformedEvent });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: { name, description }
    });

    res.json({ success: true, event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// EVENT THEME ROUTES
// ============================================

// Get theme for an event
app.get('/api/events/:id/theme', authenticateToken, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { theme: true }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Return default theme if none set
    const defaultTheme = {
      colors: {
        primary: '#8B5CF6',      // Purple
        secondary: '#3B82F6',    // Blue
        accent: '#F59E0B',       // Amber
        background: '#1F2937',   // Gray-800
        text: '#FFFFFF',
        correct: '#10B981',      // Green
        wrong: '#EF4444'         // Red
      },
      logo: null,
      frame: null,
      background: null,
      backgroundType: 'gradient', // 'gradient', 'solid', 'image'
      sounds: {
        correct: null,
        wrong: null,
        timer: null,
        buzzer: null
      },
      fonts: {
        heading: 'inherit',
        body: 'inherit'
      }
    };

    res.json({ theme: event.theme || defaultTheme });
  } catch (error) {
    console.error('Get theme error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update theme for an event
app.put('/api/events/:id/theme', authenticateToken, async (req, res) => {
  try {
    const { theme } = req.body;

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: { theme }
    });

    res.json({ success: true, theme: event.theme });
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload theme asset (logo, frame, background, sound)
app.post('/api/events/:id/theme/upload', authenticateToken, themeUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const assetType = req.body.type || 'asset';
    const fileUrl = `/themes/${req.params.id}/${req.file.filename}`;

    // Get current theme and update the specific asset
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { theme: true }
    });

    let currentTheme = event?.theme || {};

    // Update the specific field based on type
    if (assetType === 'logo') {
      currentTheme.logo = fileUrl;
    } else if (assetType === 'frame') {
      currentTheme.frame = fileUrl;
    } else if (assetType === 'background') {
      currentTheme.background = fileUrl;
      currentTheme.backgroundType = 'image';
    } else if (assetType.startsWith('sound_')) {
      const soundType = assetType.replace('sound_', '');
      if (!currentTheme.sounds) currentTheme.sounds = {};
      currentTheme.sounds[soundType] = fileUrl;
    }

    // Save updated theme
    await prisma.event.update({
      where: { id: req.params.id },
      data: { theme: currentTheme }
    });

    res.json({
      success: true,
      url: fileUrl,
      theme: currentTheme
    });
  } catch (error) {
    console.error('Upload theme asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete theme asset
app.delete('/api/events/:id/theme/:assetType', authenticateToken, async (req, res) => {
  try {
    const { assetType } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { theme: true }
    });

    if (!event?.theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    let currentTheme = event.theme;
    let fileToDelete = null;

    // Get file path and clear the field
    if (assetType === 'logo') {
      fileToDelete = currentTheme.logo;
      currentTheme.logo = null;
    } else if (assetType === 'frame') {
      fileToDelete = currentTheme.frame;
      currentTheme.frame = null;
    } else if (assetType === 'background') {
      fileToDelete = currentTheme.background;
      currentTheme.background = null;
      currentTheme.backgroundType = 'gradient';
    } else if (assetType.startsWith('sound_')) {
      const soundType = assetType.replace('sound_', '');
      if (currentTheme.sounds) {
        fileToDelete = currentTheme.sounds[soundType];
        currentTheme.sounds[soundType] = null;
      }
    }

    // Delete file from disk
    if (fileToDelete) {
      const filePath = join(__dirname, 'uploads', fileToDelete);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }

    // Save updated theme
    await prisma.event.update({
      where: { id: req.params.id },
      data: { theme: currentTheme }
    });

    res.json({ success: true, theme: currentTheme });
  } catch (error) {
    console.error('Delete theme asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public endpoint to get theme for a session (for Screen/Player)
app.get('/sessions/:sessionId/theme', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
      include: {
        event: {
          select: { theme: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Default theme
    const defaultTheme = {
      colors: {
        primary: '#8B5CF6',
        secondary: '#3B82F6',
        accent: '#F59E0B',
        background: '#1F2937',
        text: '#FFFFFF',
        correct: '#10B981',
        wrong: '#EF4444'
      },
      logo: null,
      frame: null,
      background: null,
      backgroundType: 'gradient',
      sounds: {},
      fonts: { heading: 'inherit', body: 'inherit' }
    };

    res.json({ theme: session.event?.theme || defaultTheme });
  } catch (error) {
    console.error('Get session theme error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// ROUNDS ROUTES
// ============================================

app.get('/api/events/:eventId/rounds', authenticateToken, async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { eventId: req.params.eventId },
      include: {
        questions: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { order: 'asc' }
    });
    res.json({ rounds });
  } catch (error) {
    console.error('Get rounds error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/events/:eventId/rounds', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    // Get max order
    const maxOrder = await prisma.round.aggregate({
      where: { eventId: req.params.eventId },
      _max: { order: true }
    });

    const round = await prisma.round.create({
      data: {
        name: name || 'New Round',
        order: (maxOrder._max.order ?? -1) + 1,
        eventId: req.params.eventId
      }
    });

    res.json({ success: true, round });
  } catch (error) {
    console.error('Create round error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/rounds/:id', authenticateToken, async (req, res) => {
  try {
    const { name, order } = req.body;

    const round = await prisma.round.update({
      where: { id: req.params.id },
      data: { name, order }
    });

    res.json({ success: true, round });
  } catch (error) {
    console.error('Update round error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/rounds/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.round.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete round error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// QUESTIONS ROUTES
// ============================================

app.get('/api/events/:eventId/questions', authenticateToken, async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      where: { round: { eventId: req.params.eventId } },
      include: { round: true },
      orderBy: [{ round: { order: 'asc' } }, { order: 'asc' }]
    });

    // Transform to match frontend
    const transformed = questions.map(q => ({
      id: q.id,
      text: q.content,
      type: q.type,
      options: q.choices || [],
      correctAnswer: q.correctAnswer || '',
      points: q.points,
      timeLimit: q.timeLimit,
      order: q.order,
      mediaUrl: q.mediaUrl,
      questionCueStart: q.questionCueStart,
      questionCueEnd: q.questionCueEnd,
      revealCueStart: q.revealCueStart,
      revealCueEnd: q.revealCueEnd,
      explanation: q.explanation,
      roundId: q.roundId,
      round: q.round
    }));

    res.json({ questions: transformed });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/rounds/:roundId/questions', authenticateToken, async (req, res) => {
  try {
    const { text, type, options, correctAnswer, points, negativePoints, timeLimit, mediaUrl, questionCueStart, questionCueEnd, revealCueStart, revealCueEnd, explanation, tolerance } = req.body;

    // Get max order for this round
    const maxOrder = await prisma.question.aggregate({
      where: { roundId: req.params.roundId },
      _max: { order: true }
    });

    const question = await prisma.question.create({
      data: {
        content: text || '',
        type: type || 'MCQ',
        choices: options || [],
        correctAnswer: correctAnswer || '',
        points: points || 100,
        negativePoints: negativePoints || 0,
        timeLimit: timeLimit || 30,
        mediaUrl: mediaUrl || null,
        questionCueStart: questionCueStart || null,
        questionCueEnd: questionCueEnd || null,
        revealCueStart: revealCueStart || null,
        revealCueEnd: revealCueEnd || null,
        explanation: explanation || null,
        tolerance: tolerance ?? 0.8,
        order: (maxOrder._max.order ?? -1) + 1,
        roundId: req.params.roundId
      }
    });

    // Return transformed question
    res.json({
      success: true,
      question: {
        id: question.id,
        text: question.content,
        type: question.type,
        options: question.choices || [],
        correctAnswer: question.correctAnswer,
        points: question.points,
        negativePoints: question.negativePoints,
        timeLimit: question.timeLimit,
        order: question.order,
        mediaUrl: question.mediaUrl,
        questionCueStart: question.questionCueStart,
        questionCueEnd: question.questionCueEnd,
        revealCueStart: question.revealCueStart,
        revealCueEnd: question.revealCueEnd,
        explanation: question.explanation,
        tolerance: question.tolerance
      }
    });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const { text, type, options, correctAnswer, points, negativePoints, timeLimit, mediaUrl, order, questionCueStart, questionCueEnd, revealCueStart, revealCueEnd, explanation, tolerance } = req.body;

    // Build update data, only including defined fields
    const updateData = {};
    if (text !== undefined) updateData.content = text;
    if (type !== undefined) updateData.type = type;
    if (options !== undefined) updateData.choices = options;
    if (correctAnswer !== undefined) updateData.correctAnswer = correctAnswer;
    if (points !== undefined) updateData.points = points;
    if (negativePoints !== undefined) updateData.negativePoints = negativePoints;
    if (timeLimit !== undefined) updateData.timeLimit = timeLimit;
    if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl;
    if (order !== undefined) updateData.order = order;
    if (questionCueStart !== undefined) updateData.questionCueStart = questionCueStart;
    if (questionCueEnd !== undefined) updateData.questionCueEnd = questionCueEnd;
    if (revealCueStart !== undefined) updateData.revealCueStart = revealCueStart;
    if (revealCueEnd !== undefined) updateData.revealCueEnd = revealCueEnd;
    if (explanation !== undefined) updateData.explanation = explanation;
    if (tolerance !== undefined) updateData.tolerance = tolerance;

    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({
      success: true,
      question: {
        id: question.id,
        text: question.content,
        type: question.type,
        options: question.choices || [],
        correctAnswer: question.correctAnswer,
        points: question.points,
        negativePoints: question.negativePoints,
        timeLimit: question.timeLimit,
        order: question.order,
        mediaUrl: question.mediaUrl,
        questionCueStart: question.questionCueStart,
        questionCueEnd: question.questionCueEnd,
        revealCueStart: question.revealCueStart,
        revealCueEnd: question.revealCueEnd,
        explanation: question.explanation,
        tolerance: question.tolerance
      }
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// SESSIONS ROUTES
// ============================================

app.get('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { event: { ownerId: req.user.userId } },
      include: {
        event: true,
        _count: { select: { teams: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform status for frontend
    const transformed = sessions.map(s => ({
      ...s,
      status: s.status === 'ACTIVE' ? 'IN_PROGRESS' : s.status === 'FINISHED' ? 'COMPLETED' : s.status
    }));

    res.json({ sessions: transformed });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    let code;
    let codeExists = true;
    while (codeExists) {
      code = generateSessionCode();
      const existing = await prisma.session.findUnique({ where: { code } });
      codeExists = !!existing;
    }

    const session = await prisma.session.create({
      data: {
        code,
        eventId,
        status: 'LOBBY'
      },
      include: { event: true }
    });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        event: {
          include: {
            rounds: {
              include: {
                questions: {
                  orderBy: { order: 'asc' }
                }
              },
              orderBy: { order: 'asc' }
            }
          }
        },
        teams: {
          orderBy: { score: 'desc' }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Transform questions
    const transformedSession = {
      ...session,
      status: session.status === 'ACTIVE' ? 'IN_PROGRESS' : session.status === 'FINISHED' ? 'COMPLETED' : session.status,
      event: {
        ...session.event,
        rounds: session.event.rounds.map(round => ({
          ...round,
          questions: round.questions.map(q => ({
            id: q.id,
            text: q.content,
            type: q.type,
            options: q.choices || [],
            correctAnswer: q.correctAnswer,
            points: q.points,
            timeLimit: q.timeLimit,
            order: q.order,
            mediaUrl: q.mediaUrl,
            questionCueStart: q.questionCueStart,
            questionCueEnd: q.questionCueEnd,
            revealCueStart: q.revealCueStart,
            revealCueEnd: q.revealCueEnd,
            explanation: q.explanation
          }))
        }))
      }
    };

    res.json({ session: transformedSession });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sessions/code/:code', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { code: req.params.code.toUpperCase() },
      include: {
        event: { select: { name: true } },
        teams: { select: { id: true, name: true } }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'FINISHED') {
      return res.status(400).json({ error: 'Session has ended' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Get session by code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const { status, currentQuestionId, currentRoundId } = req.body;

    // Map frontend status to DB status
    let dbStatus = status;
    if (status === 'IN_PROGRESS') dbStatus = 'ACTIVE';
    if (status === 'COMPLETED') dbStatus = 'FINISHED';

    const session = await prisma.session.update({
      where: { id: req.params.id },
      data: { status: dbStatus, currentQuestionId, currentRoundId }
    });

    io.to(`session:${session.id}`).emit('session-updated', { session });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// TEAMS ROUTES
// ============================================

app.post('/api/sessions/:sessionId/teams', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'LOBBY') {
      return res.status(400).json({ error: 'Cannot join - game already started' });
    }

    const team = await prisma.team.create({
      data: {
        name,
        sessionId: req.params.sessionId,
        score: 0
      }
    });

    io.to(`session:${session.id}`).emit('team-joined', { team });

    res.json({ success: true, team });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sessions/:sessionId/teams', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { score: 'desc' }
    });
    res.json({ teams });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/teams/:id/score', authenticateToken, async (req, res) => {
  try {
    const { score, increment } = req.body;

    let team;
    if (increment !== undefined) {
      team = await prisma.team.update({
        where: { id: req.params.id },
        data: { score: { increment } }
      });
    } else {
      team = await prisma.team.update({
        where: { id: req.params.id },
        data: { score }
      });
    }

    io.to(`session:${team.sessionId}`).emit('score-update', { teamId: team.id, newScore: team.score });

    res.json({ success: true, team });
  } catch (error) {
    console.error('Update team score error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// ANSWERS ROUTES
// ============================================

app.post('/api/sessions/:sessionId/answers', async (req, res) => {
  try {
    const { teamId, questionId, answer, timeRemaining } = req.body;

    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const isCorrect = answer === question.correctAnswer;
    const points = calculateScore(isCorrect, timeRemaining || 0, question.timeLimit, question.points);

    if (isCorrect) {
      const updatedTeam = await prisma.team.update({
        where: { id: teamId },
        data: { score: { increment: points } }
      });

      // Emit score-update so Studio sees the new score in real-time
      io.to(`session:${req.params.sessionId}`).emit('score-update', {
        teamId,
        newScore: updatedTeam.score
      });
    }

    const answerRecord = await prisma.answer.create({
      data: {
        teamId,
        questionId,
        content: answer,
        isCorrect,
        points
      }
    });

    io.to(`session:${req.params.sessionId}`).emit('answer-submitted', {
      teamId,
      questionId,
      answer,
      isCorrect,
      points
    });

    res.json({ success: true, answer: answerRecord, isCorrect, points });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// LEADERBOARD ROUTES
// ============================================

app.get('/api/sessions/:sessionId/leaderboard', async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { score: 'desc' },
      select: {
        id: true,
        name: true,
        score: true,
        _count: { select: { answers: true } }
      }
    });

    const leaderboard = teams.map((team, index) => ({
      rank: index + 1,
      ...team,
      answersCount: team._count.answers
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// GAME CONTROL ROUTES (for Studio)
// ============================================

app.post('/api/sessions/:sessionId/start', authenticateToken, async (req, res) => {
  try {
    const session = await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { status: 'ACTIVE', startedAt: new Date() }
    });

    io.to(`session:${session.id}`).emit('game-start', { session });

    res.json({ success: true, session });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sessions/:sessionId/question/start', authenticateToken, async (req, res) => {
  try {
    const { questionId } = req.body;

    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Update session current question
    await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { currentQuestionId: questionId }
    });

    io.to(`session:${req.params.sessionId}`).emit('question-start', {
      question: {
        id: question.id,
        text: question.content,
        type: question.type,
        options: question.choices || [],
        timeLimit: question.timeLimit,
        points: question.points,
        mediaUrl: question.mediaUrl,
        questionCueStart: question.questionCueStart,
        questionCueEnd: question.questionCueEnd,
        revealCueStart: question.revealCueStart,
        revealCueEnd: question.revealCueEnd
      },
      timeLimit: question.timeLimit
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Start question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sessions/:sessionId/question/end', authenticateToken, async (req, res) => {
  try {
    const { questionId } = req.body;

    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const answers = await prisma.answer.findMany({
      where: { questionId },
      include: { team: true }
    });

    io.to(`session:${req.params.sessionId}`).emit('question-end', {
      questionId,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      answers: answers.map(a => ({
        teamId: a.teamId,
        teamName: a.team.name,
        answer: a.content,
        isCorrect: a.isCorrect,
        points: a.points
      }))
    });

    res.json({ success: true });
  } catch (error) {
    console.error('End question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sessions/:sessionId/buzzer/open', authenticateToken, async (req, res) => {
  try {
    io.to(`session:${req.params.sessionId}`).emit('buzzer-open', {
      timestamp: Date.now()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sessions/:sessionId/buzzer/press', async (req, res) => {
  try {
    const { teamId, teamName } = req.body;

    io.to(`session:${req.params.sessionId}`).emit('buzzer-pressed', {
      teamId,
      teamName,
      team: { id: teamId, name: teamName },
      timestamp: Date.now()
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sessions/:sessionId/buzzer/reset', authenticateToken, async (req, res) => {
  try {
    io.to(`session:${req.params.sessionId}`).emit('buzzer-reset', {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sessions/:sessionId/leaderboard/show', authenticateToken, async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { score: 'desc' }
    });

    io.to(`session:${req.params.sessionId}`).emit('show-leaderboard', { teams });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sessions/:sessionId/end', authenticateToken, async (req, res) => {
  try {
    const session = await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { status: 'FINISHED', endedAt: new Date() }
    });

    const teams = await prisma.team.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { score: 'desc' }
    });

    io.to(`session:${session.id}`).emit('session-end', { teams });

    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// SOCKET.IO
// ============================================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // ========== SESSION EVENTS ==========
  // Support both hyphen and colon notation
  const joinSession = ({ sessionId, teamId, role }) => {
    socket.join(`session:${sessionId}`);
    socket.sessionId = sessionId;
    socket.role = role;
    console.log(`Socket ${socket.id} (${role || 'unknown'}) joined session ${sessionId}`);

    if (teamId) {
      socket.teamId = teamId;

      // Track this team as connected
      trackTeamConnection(sessionId, teamId);

      // Notify studio and other clients that this team is now connected
      io.to(`session:${sessionId}`).emit('team-connected', {
        teamId,
        sessionId,
        role,
        timestamp: Date.now()
      });

      console.log(`Team ${teamId} connected to session ${sessionId}`);
    }

    // If this is a studio connection, send the current list of connected teams
    if (role === 'studio') {
      const connected = getConnectedTeams(sessionId);
      socket.emit('session-state', {
        connectedTeams: connected,
        timestamp: Date.now()
      });
      console.log(`Sent session state to studio: ${connected.length} teams connected`);
    }
  };
  socket.on('join-session', joinSession);
  socket.on('session:join', joinSession);

  const leaveSession = ({ sessionId }) => {
    socket.leave(`session:${sessionId}`);
    console.log(`Socket ${socket.id} left session ${sessionId}`);
  };
  socket.on('leave-session', leaveSession);
  socket.on('session:leave', leaveSession);

  // ========== STUDIO CONTROL EVENTS (relayed to all clients) ==========

  // Question start - from Studio to Screen/Player
  socket.on('question-start', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const timeLimit = data.timeLimit || data.question?.timeLimit || 30;
    console.log(`Question started in session ${sessionId}:`, data.question?.id, `(${timeLimit}s)`);

    // Start server-side timer for perfect sync
    startServerTimer(sessionId, timeLimit);

    // Reset buzzer state for new question
    resetBuzzer(sessionId);

    io.to(`session:${sessionId}`).emit('question-start', {
      question: data.question,
      timeLimit,
      serverTime: Date.now() // Send server timestamp for sync
    });
  });

  // Question end - from Studio to Screen/Player
  socket.on('question-end', async (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const questionId = data.questionId;
    console.log(`Question ended in session ${sessionId}, questionId=${questionId}`);

    // Stop server-side timer
    stopServerTimer(sessionId);

    // NOW apply points for all answers to this question
    if (questionId) {
      try {
        const answers = await prisma.answer.findMany({
          where: { questionId },
          include: { team: true }
        });

        for (const answer of answers) {
          if (answer.isCorrect && answer.points > 0) {
            const updatedTeam = await prisma.team.update({
              where: { id: answer.teamId },
              data: { score: { increment: answer.points } }
            });

            console.log(`📊 Points applied at reveal: team=${answer.teamId}, +${answer.points}, newScore=${updatedTeam.score}`);

            // Emit score-update for this team
            io.to(`session:${sessionId}`).emit('score-update', {
              teamId: answer.teamId,
              newScore: updatedTeam.score
            });
          }
        }

        // Emit question-end with all answer results
        io.to(`session:${sessionId}`).emit('question-end', {
          questionId: data.questionId,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
          serverTime: Date.now(),
          answers: answers.map(a => ({
            teamId: a.teamId,
            teamName: a.team.name,
            answer: a.content,
            isCorrect: a.isCorrect,
            points: a.points
          }))
        });
      } catch (error) {
        console.error('Error applying points at reveal:', error);
        // Still emit question-end even if there was an error
        io.to(`session:${sessionId}`).emit('question-end', {
          questionId: data.questionId,
          correctAnswer: data.correctAnswer,
          explanation: data.explanation,
          serverTime: Date.now()
        });
      }
    } else {
      io.to(`session:${sessionId}`).emit('question-end', {
        questionId: data.questionId,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        serverTime: Date.now()
      });
    }
  });

  // Timer events - server-side timer is now authoritative
  socket.on('timer-start', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const duration = data.duration || 30;
    startServerTimer(sessionId, duration);
  });

  socket.on('timer-stop', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    stopServerTimer(sessionId);
    io.to(`session:${sessionId}`).emit('timer-stopped', { serverTime: Date.now() });
  });

  // Legacy timer-update (clients can request current time)
  socket.on('timer-update', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const remaining = getTimerRemaining(sessionId);
    socket.emit('timer-sync', { remaining, serverTime: Date.now() });
  });

  socket.on('timer-end', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    stopServerTimer(sessionId);
    io.to(`session:${sessionId}`).emit('timer-end', { serverTime: Date.now() });
  });

  // Show leaderboard
  socket.on('show-leaderboard', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Showing leaderboard in session ${sessionId}`);
    io.to(`session:${sessionId}`).emit('show-leaderboard', { teams: data.teams });
  });

  // Show waiting screen (instructions)
  socket.on('show-waiting', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Showing waiting screen in session ${sessionId}`);
    io.to(`session:${sessionId}`).emit('show-waiting', {
      message: data.message || 'Préparez-vous pour la prochaine question !',
      instructions: data.instructions || [],
      serverTime: Date.now()
    });
  });

  // Show sponsors screen
  socket.on('show-sponsors', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Showing sponsors screen in session ${sessionId}`);
    io.to(`session:${sessionId}`).emit('show-sponsors', {
      sponsors: data.sponsors || [],
      message: data.message || 'Merci à nos sponsors !',
      duration: data.duration || 10000, // 10 seconds by default
      serverTime: Date.now()
    });
  });

  // Show transition screen
  socket.on('show-transition', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Showing transition screen in session ${sessionId}`);
    io.to(`session:${sessionId}`).emit('show-transition', {
      message: data.message || '',
      type: data.type || 'default', // 'next-round', 'finale', 'break', etc.
      serverTime: Date.now()
    });
  });

  // Game paused/resumed
  socket.on('game-paused', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    io.to(`session:${sessionId}`).emit('game-paused', {});
  });

  socket.on('game-resumed', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    io.to(`session:${sessionId}`).emit('game-resumed', {});
  });

  // Session end
  socket.on('session-end', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Session ${sessionId} ended`);
    io.to(`session:${sessionId}`).emit('session-end', {});
  });

  // ========== BUZZER EVENTS (with server-side lock for fairness) ==========

  socket.on('buzzer-open', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Buzzer opened in session ${sessionId}`);
    // Reset buzzer state when opening
    resetBuzzer(sessionId);
    io.to(`session:${sessionId}`).emit('buzzer-open', { serverTime: Date.now() });
  });

  socket.on('buzzer-lock', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    // Force lock (manual lock from studio)
    const state = buzzerState.get(sessionId) || { locked: false, winner: null, timestamp: null };
    state.locked = true;
    buzzerState.set(sessionId, state);
    io.to(`session:${sessionId}`).emit('buzzer-lock', { serverTime: Date.now() });
  });

  socket.on('buzzer-reset', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    resetBuzzer(sessionId);
    io.to(`session:${sessionId}`).emit('buzzer-reset', { serverTime: Date.now() });
  });

  // Buzzer winner announcement - from Studio
  socket.on('buzzer-winner', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Buzzer winner in session ${sessionId}: ${data.teamName}`);
    io.to(`session:${sessionId}`).emit('buzzer-winner', {
      team: data.team,
      teamId: data.teamId,
      teamName: data.teamName
    });
  });

  // Buzzer validation - correct answer (from Studio)
  socket.on('buzzer-correct', async (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const points = data.points || 100;
    console.log(`Buzzer correct in session ${sessionId}: team=${data.teamName}, points=${points}`);

    // Update score in database
    try {
      const updatedTeam = await prisma.team.update({
        where: { id: data.teamId },
        data: { score: { increment: points } }
      });

      console.log(`📊 Buzzer points applied: team=${data.teamId}, +${points}, newScore=${updatedTeam.score}`);

      // Emit score-update FIRST so all clients get the new score
      io.to(`session:${sessionId}`).emit('score-update', {
        teamId: data.teamId,
        newScore: updatedTeam.score
      });

      // Then emit buzzer-correct for UI feedback
      io.to(`session:${sessionId}`).emit('buzzer-correct', {
        team: data.team,
        teamId: data.teamId,
        teamName: data.teamName,
        points: points
      });
    } catch (error) {
      console.error('Error updating score for buzzer:', error);
      // Still emit the event even if DB update fails
      io.to(`session:${sessionId}`).emit('buzzer-correct', {
        team: data.team,
        teamId: data.teamId,
        teamName: data.teamName,
        points: points
      });
    }
  });

  // Buzzer validation - wrong answer (from Studio)
  socket.on('buzzer-wrong', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Buzzer wrong in session ${sessionId}: team=${data.teamName}`);
    io.to(`session:${sessionId}`).emit('buzzer-wrong', {
      team: data.team,
      teamId: data.teamId,
      teamName: data.teamName
    });
  });

  // Buzzer press - from Player (with server-side lock and acknowledgment)
  const handleBuzzerPress = async (data, callback) => {
    const sessionId = data.sessionId || socket.sessionId;
    const team = data.team || { id: data.teamId, name: data.teamName };
    const questionId = data.questionId; // For persistence
    const clientTimestamp = data.timestamp || Date.now();
    const serverTimestamp = Date.now();

    // Rate limiting: max 5 buzzer attempts per second per team
    const rateLimitKey = `buzzer:${sessionId}:${team.id}`;
    const limitResult = rateLimit(rateLimitKey, 5, 1000);
    
    if (!limitResult.allowed) {
      console.log(`⚠️ RATE LIMITED: ${team.name} in session ${sessionId}`);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'rate_limited', retryAfter: limitResult.retryAfter });
      }
      return;
    }

    // Try to acquire buzzer lock (first press wins)
    const result = tryPressBuzzer(sessionId, team, serverTimestamp);

    if (result.success) {
      console.log(`🔔 BUZZER WON by ${team.name} (rank #${result.rank}) in session ${sessionId} (latency: ${serverTimestamp - clientTimestamp}ms)`);

      // Persist to database (async, non-blocking)
      if (questionId && team.id) {
        persistBuzzerPress(prisma, questionId, team.id, result.rank).catch(err => 
          console.error('Buzzer persistence error:', err.message)
        );
      }

      // Broadcast winner to all clients
      io.to(`session:${sessionId}`).emit('buzzer-pressed', {
        team,
        teamId: team.id,
        teamName: team.name,
        rank: result.rank,
        timestamp: serverTimestamp,
        serverTime: serverTimestamp
      });

      // Auto-lock buzzer after first press
      io.to(`session:${sessionId}`).emit('buzzer-lock', { serverTime: serverTimestamp });

      // Send acknowledgment to the pressing player
      if (typeof callback === 'function') {
        callback({ success: true, winner: true, rank: result.rank, serverTime: serverTimestamp });
      }
    } else {
      const reason = result.reason || 'buzzer_locked';
      console.log(`❌ Buzzer press REJECTED for ${team.name} - ${reason} (winner: ${result.winner?.name})`);

      // Still persist for analytics (they tried but were too slow)
      if (questionId && team.id && reason !== 'already_buzzed' && result.rank) {
        persistBuzzerPress(prisma, questionId, team.id, result.rank).catch(err => 
          console.error('Buzzer persistence error:', err.message)
        );
      }

      // Send rejection acknowledgment
      if (typeof callback === 'function') {
        callback({ success: false, winner: false, reason, actualWinner: result.winner, serverTime: serverTimestamp });
      }
    }
  };
  socket.on('buzzer-press', handleBuzzerPress);
  socket.on('buzzer:press', handleBuzzerPress);

  // ========== BLINDTEST EVENTS ==========

  socket.on('blindtest-play', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Blindtest play in session ${sessionId}`);
    io.to(`session:${sessionId}`).emit('blindtest-play', {
      audioUrl: data.audioUrl,
      startTime: data.startTime || data.questionCueStart || 0,
      endTime: data.endTime || data.questionCueEnd || null,
      questionCueStart: data.questionCueStart,
      questionCueEnd: data.questionCueEnd
    });
  });

  socket.on('blindtest-pause', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    io.to(`session:${sessionId}`).emit('blindtest-pause', {});
  });

  socket.on('blindtest-stop', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    io.to(`session:${sessionId}`).emit('blindtest-stop', {});
  });

  socket.on('blindtest-reveal', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Blindtest reveal in session ${sessionId}: ${data.artist} - ${data.songTitle}`);
    io.to(`session:${sessionId}`).emit('blindtest-reveal', {
      artist: data.artist,
      songTitle: data.songTitle,
      audioUrl: data.audioUrl,
      startTime: data.startTime || data.revealCueStart || 0,
      endTime: data.endTime || data.revealCueEnd || null,
      revealCueStart: data.revealCueStart,
      revealCueEnd: data.revealCueEnd
    });
  });

  // ========== ANSWER EVENTS ==========

  const handleAnswerSubmit = async (data) => {
    const { teamId, questionId, answer, responseTime, timeRemaining } = data;
    const sessionId = data.sessionId || socket.sessionId;

    // Rate limiting: max 3 answer submissions per second per team
    const rateLimitKey = `answer:${sessionId}:${teamId}`;
    const limitResult = rateLimit(rateLimitKey, 3, 1000);
    
    if (!limitResult.allowed) {
      console.log(`⚠️ RATE LIMITED answer from team ${teamId}`);
      socket.emit('answer-rejected', { error: 'rate_limited', retryAfter: limitResult.retryAfter });
      return;
    }

    try {
      const question = await prisma.question.findUnique({ where: { id: questionId } });
      if (!question) {
        console.error('Question not found:', questionId);
        return;
      }

      // Normalize answer based on question type
      let normalizedAnswer = answer;
      let normalizedCorrect = question.correctAnswer;

      if (question.type === 'OPEN' || question.type === 'BLIND_TEST') {
        // For open questions and blindtest, normalize: trim, lowercase, remove accents
        normalizedAnswer = answer.toString().trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
        normalizedCorrect = question.correctAnswer.toString().trim().toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      } else if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
        // For MCQ and TRUE_FALSE, strict comparison (uppercase already)
        normalizedAnswer = answer.toString().trim().toUpperCase();
        normalizedCorrect = question.correctAnswer.toString().trim().toUpperCase();
      } else if (question.type === 'BUZZER') {
        // For buzzer, we don't validate here - validation happens in buzzer-correct/wrong events
        // But we still store the answer
        normalizedAnswer = answer.toString().trim();
        normalizedCorrect = question.correctAnswer ? question.correctAnswer.toString().trim() : '';
      }

      const isCorrect = normalizedAnswer === normalizedCorrect;

      // Debug logging for TRUE_FALSE questions
      if (question.type === 'TRUE_FALSE') {
        console.log(`🔍 TRUE_FALSE Debug:`, {
          originalAnswer: answer,
          normalizedAnswer,
          originalCorrect: question.correctAnswer,
          normalizedCorrect,
          isCorrect,
          match: normalizedAnswer === normalizedCorrect
        });
      }

      const timeVal = responseTime ? (question.timeLimit * 1000 - responseTime) / 1000 : (timeRemaining || 0);
      let points = calculateScore(isCorrect, timeVal, question.timeLimit, question.points);

      // Check for finale jokers
      const state = getFinaleState(sessionId);
      let jokerApplied = null;
      let shieldActivated = false;

      if (state?.active && state.activeJokers[teamId]) {
        const activeJokers = state.activeJokers[teamId];

        // DOUBLE joker - double the points if correct
        if (activeJokers.includes('DOUBLE') && isCorrect) {
          points *= 2;
          jokerApplied = 'DOUBLE';
          console.log(`🃏 DOUBLE joker applied: ${points} points for team ${teamId}`);
        }

        // SHIELD joker - protect from wrong answer (no negative impact)
        if (activeJokers.includes('SHIELD') && !isCorrect) {
          shieldActivated = true;
          console.log(`🛡️ SHIELD joker protected team ${teamId} from wrong answer`);
        }
      }

      // Store answer with calculated points (but DON'T add to score yet - wait for reveal)
      await prisma.answer.upsert({
        where: {
          questionId_teamId: {
            questionId,
            teamId
          }
        },
        update: {
          content: answer,
          isCorrect,
          points: isCorrect ? points : 0
        },
        create: {
          teamId,
          questionId,
          content: answer,
          isCorrect,
          points: isCorrect ? points : 0
        }
      });

      // Emit to all in session (for Screen) - DON'T reveal if correct yet
      io.to(`session:${sessionId}`).emit('answer-submitted', {
        teamId,
        questionId,
        answer,
        // Don't reveal correctness until question-end
        hasAnswered: true
      });

      // Emit result back to the submitting player - DON'T reveal if correct yet
      socket.emit('answer-result', {
        teamId,
        // Points and correctness will be revealed at question-end
        submitted: true,
        jokerApplied,
        shieldActivated
      });

      console.log(`Answer submitted: team=${teamId}, answer="${answer}", joker=${jokerApplied || 'none'} (points will be added at reveal)`);
    } catch (error) {
      console.error('Socket answer error:', error);
    }
  };
  socket.on('submit-answer', handleAnswerSubmit);
  socket.on('answer:submit', handleAnswerSubmit);

  // ========== SCORE EVENTS ==========

  socket.on('score-update', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    io.to(`session:${sessionId}`).emit('score-update', {
      teamId: data.teamId,
      newScore: data.newScore
    });
  });

  // Set score - updates DB and broadcasts (for Studio manual edits and tests)
  socket.on('set-score', async (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    try {
      const updatedTeam = await prisma.team.update({
        where: { id: data.teamId },
        data: { score: data.newScore }
      });
      console.log(`📊 Score set: team=${data.teamId}, newScore=${updatedTeam.score}`);
      io.to(`session:${sessionId}`).emit('score-update', {
        teamId: data.teamId,
        newScore: updatedTeam.score
      });
    } catch (error) {
      console.error('Error setting score:', error);
    }
  });

  // ========== FINALE MODE EVENTS ==========

  // Start finale mode - from Studio
  socket.on('finale-start', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const { finalistCount, teams } = data;

    console.log(`🏆 Starting finale with ${finalistCount} teams in session ${sessionId}`);

    const state = initFinale(sessionId, finalistCount, teams);

    // Broadcast finale start to all clients
    io.to(`session:${sessionId}`).emit('finale-started', {
      finalistCount,
      finalistTeams: state.finalistTeams,
      eliminatedTeams: state.eliminatedTeams,
      jokers: state.jokers,
      serverTime: Date.now()
    });
  });

  // Get finale state
  socket.on('finale-state', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const state = getFinaleState(sessionId);

    socket.emit('finale-state', {
      active: state?.active || false,
      finalistTeams: state?.finalistTeams || [],
      eliminatedTeams: state?.eliminatedTeams || [],
      jokers: state?.jokers || {},
      currentRound: state?.currentRound || 0
    });
  });

  // Use joker - from Player
  socket.on('joker-use', (data, callback) => {
    const sessionId = data.sessionId || socket.sessionId;
    const { teamId, teamName, jokerType } = data;

    const result = useJoker(sessionId, teamId, jokerType);

    if (result.success) {
      // Broadcast joker usage to all clients
      io.to(`session:${sessionId}`).emit('joker-used', {
        teamId,
        teamName,
        jokerType,
        remainingJokers: result.remainingJokers,
        serverTime: Date.now()
      });

      // Special handling for FIFTY_FIFTY - Studio needs to send eliminated options
      if (jokerType === 'FIFTY_FIFTY') {
        io.to(`session:${sessionId}`).emit('fifty-fifty-request', {
          teamId,
          teamName
        });
      }

      // Special handling for TIME_PLUS
      if (jokerType === 'TIME_PLUS') {
        const timer = activeTimers.get(sessionId);
        if (timer) {
          // Add 15 seconds to the timer
          timer.duration += 15000;
          console.log(`⏳ TIME_PLUS: Added 15s to timer for session ${sessionId}`);

          io.to(`session:${sessionId}`).emit('time-plus-activated', {
            teamId,
            teamName,
            bonusSeconds: 15,
            serverTime: Date.now()
          });
        }
      }
    }

    // Send acknowledgment
    if (typeof callback === 'function') {
      callback(result);
    }
  });

  // Fifty-fifty response from Studio (which options to eliminate)
  socket.on('fifty-fifty-options', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const { eliminatedOptions } = data;

    io.to(`session:${sessionId}`).emit('fifty-fifty-applied', {
      eliminatedOptions,
      serverTime: Date.now()
    });
  });

  // Clear active jokers (at end of question)
  socket.on('finale-clear-jokers', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    clearActiveJokers(sessionId);
  });

  // Eliminate team - from Studio
  socket.on('finale-eliminate', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const { teamId } = data;

    const eliminatedTeam = eliminateTeam(sessionId, teamId);

    if (eliminatedTeam) {
      io.to(`session:${sessionId}`).emit('team-eliminated', {
        team: eliminatedTeam,
        teamId: eliminatedTeam.id,
        teamName: eliminatedTeam.name,
        serverTime: Date.now()
      });
    }
  });

  // End finale - from Studio
  socket.on('finale-end', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const state = getFinaleState(sessionId);

    const winner = state?.finalistTeams?.[0];

    endFinale(sessionId);

    io.to(`session:${sessionId}`).emit('finale-ended', {
      winner,
      finalRanking: state?.finalistTeams || [],
      serverTime: Date.now()
    });
  });

  // Finale question start (includes joker state)
  socket.on('finale-question-start', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const { question, timeLimit } = data;

    // Clear active jokers from previous question
    clearActiveJokers(sessionId);

    // Start timer
    startServerTimer(sessionId, timeLimit || question?.timeLimit || 30);

    const state = getFinaleState(sessionId);

    io.to(`session:${sessionId}`).emit('finale-question-start', {
      question,
      timeLimit: timeLimit || question?.timeLimit || 30,
      jokers: state?.jokers || {},
      finalistTeams: state?.finalistTeams || [],
      serverTime: Date.now()
    });
  });

  // ========== DISCONNECT ==========

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.sessionId && socket.teamId) {
      // Untrack this team from connected teams (with grace period)
      // The grace period will emit team-disconnected/team-left after 5 seconds if no reconnection
      untrackTeamConnection(socket.sessionId, socket.teamId);
      console.log(`Team ${socket.teamId} disconnect initiated from session ${socket.sessionId} (grace period active)`);
    }
  });
});

// ============================================
// PUBLIC ROUTES (no auth required for frontend apps)
// ============================================

// Public: Get sessions by status (for Studio/Screen)
app.get('/sessions', async (req, res) => {
  try {
    const { status } = req.query;

    // Map frontend status to DB status
    let dbStatus = status;
    if (status === 'ACTIVE') dbStatus = 'ACTIVE';
    if (status === 'WAITING') dbStatus = 'LOBBY';

    const where = dbStatus ? { status: dbStatus } : { status: { not: 'FINISHED' } };

    const sessions = await prisma.session.findMany({
      where,
      include: {
        event: { select: { id: true, name: true, description: true } },
        teams: { select: { id: true, name: true, score: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform for frontend - add color to teams
    const transformed = sessions.map(s => ({
      ...s,
      status: s.status === 'LOBBY' ? 'WAITING' : s.status,
      teams: s.teams.map((t, i) => ({
        ...t,
        color: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][i % 6]
      }))
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get public sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Get session by ID (for Studio/Screen/Player)
app.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId },
      include: {
        event: {
          include: {
            rounds: {
              include: {
                questions: { orderBy: { order: 'asc' } }
              },
              orderBy: { order: 'asc' }
            }
          }
        },
        teams: { orderBy: { score: 'desc' } }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Transform
    const transformed = {
      ...session,
      status: session.status === 'LOBBY' ? 'WAITING' : session.status,
      teams: session.teams.map((t, i) => ({
        ...t,
        color: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][i % 6]
      })),
      event: {
        ...session.event,
        rounds: session.event.rounds.map(r => ({
          ...r,
          questions: r.questions.map(q => ({
            id: q.id,
            text: q.content,
            type: q.type,
            options: q.choices || [],
            correctAnswer: q.correctAnswer,
            points: q.points,
            timeLimit: q.timeLimit,
            order: q.order,
            mediaUrl: q.mediaUrl,
            questionCueStart: q.questionCueStart,
            questionCueEnd: q.questionCueEnd,
            revealCueStart: q.revealCueStart,
            revealCueEnd: q.revealCueEnd,
            explanation: q.explanation
          }))
        }))
      }
    };

    res.json(transformed);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Join session by code (for Player)
app.post('/sessions/join', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Session code is required' });
    }

    const session = await prisma.session.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        event: { select: { id: true, name: true, description: true } },
        teams: { select: { id: true, name: true, score: true } }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'FINISHED') {
      return res.status(400).json({ error: 'Session has ended' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Create team in session (for Player)
app.post('/sessions/:sessionId/teams', async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Count existing teams to assign color if not provided
    const teamCount = await prisma.team.count({
      where: { sessionId: req.params.sessionId }
    });

    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
    const teamColor = color || colors[teamCount % colors.length];

    const team = await prisma.team.create({
      data: {
        name,
        sessionId: req.params.sessionId,
        score: 0
      }
    });

    const teamWithColor = {
      ...team,
      color: teamColor
    };

    io.to(`session:${session.id}`).emit('team-joined', { team: teamWithColor });

    res.json(teamWithColor);
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Get all events
app.get('/events', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: { rounds: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Get single event
app.get('/events/:id', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        rounds: {
          include: { questions: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' }
        }
      }
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Create event (for testing)
app.post('/events', async (req, res) => {
  try {
    const { name, description } = req.body;
    // Use a default owner for public creation
    let defaultUser = await prisma.user.findFirst();
    if (!defaultUser) {
      defaultUser = await prisma.user.create({
        data: {
          email: 'admin@arena-event.com',
          password: await bcrypt.hash('admin123', 10),
          role: 'ORGANIZER'
        }
      });
    }
    const event = await prisma.event.create({
      data: { name, description, ownerId: defaultUser.id }
    });
    res.status(201).json(event);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Create round for event
app.post('/events/:eventId/rounds', async (req, res) => {
  try {
    const { name, description, order } = req.body;
    const round = await prisma.round.create({
      data: {
        eventId: req.params.eventId,
        name,
        description,
        order: order || 1
      }
    });
    res.status(201).json(round);
  } catch (error) {
    console.error('Create round error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Get rounds for event (for Studio)
app.get('/events/:eventId/rounds', async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { eventId: req.params.eventId },
      include: {
        questions: { orderBy: { order: 'asc' } }
      },
      orderBy: { order: 'asc' }
    });

    // Transform questions
    const transformed = rounds.map(r => ({
      ...r,
      questions: r.questions.map(q => ({
        id: q.id,
        text: q.content,
        type: q.type,
        options: q.choices || [],
        correctAnswer: q.correctAnswer,
        points: q.points,
        timeLimit: q.timeLimit,
        order: q.order,
        mediaUrl: q.mediaUrl,
        questionCueStart: q.questionCueStart,
        questionCueEnd: q.questionCueEnd,
        revealCueStart: q.revealCueStart,
        revealCueEnd: q.revealCueEnd,
        explanation: q.explanation
      }))
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get rounds error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Get questions for round (for Studio)
app.get('/rounds/:roundId/questions', async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      where: { roundId: req.params.roundId },
      orderBy: { order: 'asc' }
    });

    // Transform
    const transformed = questions.map(q => ({
      id: q.id,
      text: q.content,
      type: q.type,
      options: q.choices || [],
      correctAnswer: q.correctAnswer,
      points: q.points,
      timeLimit: q.timeLimit,
      order: q.order,
      mediaUrl: q.mediaUrl,
      questionCueStart: q.questionCueStart,
      questionCueEnd: q.questionCueEnd,
      revealCueStart: q.revealCueStart,
      revealCueEnd: q.revealCueEnd,
      explanation: q.explanation
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Submit answer (for Player)
app.post('/sessions/:sessionId/answers', async (req, res) => {
  try {
    const { teamId, questionId, answer, responseTime } = req.body;

    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const isCorrect = answer === question.correctAnswer;
    const timeBonus = Math.max(0, Math.round((1 - (responseTime / 1000) / question.timeLimit) * question.points * 0.5));
    const points = isCorrect ? question.points + timeBonus : 0;

    if (isCorrect) {
      const updatedTeam = await prisma.team.update({
        where: { id: teamId },
        data: { score: { increment: points } }
      });

      // Emit score-update so Studio sees the new score in real-time
      io.to(`session:${req.params.sessionId}`).emit('score-update', {
        teamId,
        newScore: updatedTeam.score
      });
    }

    const answerRecord = await prisma.answer.create({
      data: {
        teamId,
        questionId,
        content: answer,
        isCorrect,
        points
      }
    });

    io.to(`session:${req.params.sessionId}`).emit('answer-submitted', {
      teamId,
      questionId,
      answer,
      isCorrect,
      points
    });

    res.json({ success: true, isCorrect, points });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SECURITY: Update team score - requires authentication (Game Master or Admin only)
app.put('/sessions/:sessionId/teams/:teamId/score', authenticateToken, async (req, res) => {
  try {
    // SECURITY: Verify user has permission to modify scores
    if (!['SUPER_ADMIN', 'ORGANIZER', 'GAME_MASTER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized to modify scores' });
    }

    const { score } = req.body;

    // SECURITY: Validate score is a number
    if (typeof score !== 'number' || isNaN(score)) {
      return res.status(400).json({ error: 'Score must be a valid number' });
    }

    const team = await prisma.team.update({
      where: { id: req.params.teamId },
      data: { score }
    });

    io.to(`session:${req.params.sessionId}`).emit('score-update', {
      teamId: req.params.teamId,
      newScore: score
    });

    res.json({ success: true, team });
  } catch (error) {
    console.error('Update score error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Get session answers (for Studio)
app.get('/sessions/:sessionId/answers', async (req, res) => {
  try {
    const answers = await prisma.answer.findMany({
      where: { team: { sessionId: req.params.sessionId } },
      include: { team: true }
    });
    res.json(answers);
  } catch (error) {
    console.error('Get answers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Set current question (for Studio)
app.post('/sessions/:sessionId/question', async (req, res) => {
  try {
    const { questionId, roundId } = req.body;

    await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { currentQuestionId: questionId, currentRoundId: roundId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Set question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Start session (for Studio)
app.post('/sessions/:sessionId/start', async (req, res) => {
  try {
    const session = await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { status: 'ACTIVE', startedAt: new Date() }
    });

    io.to(`session:${session.id}`).emit('game-start', {});

    res.json({ success: true });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: End session (for Studio)
app.post('/sessions/:sessionId/end', async (req, res) => {
  try {
    const session = await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { status: 'FINISHED', endedAt: new Date() }
    });

    io.to(`session:${session.id}`).emit('session-end', {});

    res.json({ success: true });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SECURITY: Emit Socket.IO events - requires authentication + whitelist of allowed events
const ALLOWED_EMIT_EVENTS = [
  'question-start', 'question-end', 'timer-sync', 'timer-end',
  'buzzer-open', 'buzzer-lock', 'buzzer-reset', 'buzzer-winner',
  'show-leaderboard', 'session-end', 'game-paused', 'game-resumed',
  'blindtest-play', 'blindtest-pause', 'blindtest-stop', 'blindtest-reveal',
  'score-update', 'finale-started', 'finale-ended'
];

app.post('/sessions/:sessionId/emit', authenticateToken, async (req, res) => {
  try {
    // SECURITY: Only Game Masters and Admins can emit events
    if (!['SUPER_ADMIN', 'ORGANIZER', 'GAME_MASTER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized to emit events' });
    }

    const { event, data } = req.body;

    // SECURITY: Validate event is in whitelist
    if (!event || !ALLOWED_EMIT_EVENTS.includes(event)) {
      return res.status(400).json({
        error: 'Invalid or disallowed event type',
        allowedEvents: ALLOWED_EMIT_EVENTS
      });
    }

    io.to(`session:${req.params.sessionId}`).emit(event, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Emit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// START SERVER
// ============================================

const PORT = 3001;
const HOST = '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎮 ARENA EVENT API v2.1.0                          ║
║                                                       ║
║   Server running on http://${HOST}:${PORT}              ║
║   WebSocket enabled                                   ║
║                                                       ║
║   Routes available:                                   ║
║   - Auth: /api/auth/*                                ║
║   - Events: /api/events/*                            ║
║   - Rounds: /api/events/:id/rounds, /api/rounds/*    ║
║   - Questions: /api/rounds/:id/questions             ║
║   - Sessions: /api/sessions/*, /sessions/*           ║
║   - Teams: /api/sessions/:id/teams                   ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});
