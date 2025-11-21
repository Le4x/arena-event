import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'arena-event-super-secret-jwt-key-2024';
const JWT_EXPIRES_IN = '7d';

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
    version: '2.0.0'
  });
});

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

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
    const { email, password, firstName, lastName, role = 'ORGANIZER' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
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
        role
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
// EVENTS ROUTES
// ============================================

app.get('/api/events', authenticateToken, async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: { organizerId: req.user.userId },
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
        organizerId: req.user.userId,
        status: 'DRAFT'
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
          include: { questions: true },
          orderBy: { order: 'asc' }
        },
        sessions: true
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, status } = req.body;

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: { name, description, status }
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
// ROUNDS ROUTES
// ============================================

app.post('/api/events/:eventId/rounds', authenticateToken, async (req, res) => {
  try {
    const { name, order } = req.body;

    const round = await prisma.round.create({
      data: {
        name: name || 'New Round',
        order: order || 0,
        eventId: req.params.eventId
      }
    });

    res.json({ success: true, round });
  } catch (error) {
    console.error('Create round error:', error);
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
    res.json({ questions });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/rounds/:roundId/questions', authenticateToken, async (req, res) => {
  try {
    const { text, type, options, correctAnswer, points, timeLimit, mediaUrl, order } = req.body;

    const question = await prisma.question.create({
      data: {
        text,
        type: type || 'MCQ',
        options: options || [],
        correctAnswer: correctAnswer || '',
        points: points || 100,
        timeLimit: timeLimit || 30,
        mediaUrl: mediaUrl || null,
        order: order || 0,
        roundId: req.params.roundId
      }
    });

    res.json({ success: true, question });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/questions/:id', authenticateToken, async (req, res) => {
  try {
    const { text, type, options, correctAnswer, points, timeLimit, mediaUrl, order } = req.body;

    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: { text, type, options, correctAnswer, points, timeLimit, mediaUrl, order }
    });

    res.json({ success: true, question });
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
      where: { event: { organizerId: req.user.userId } },
      include: {
        event: true,
        _count: { select: { teams: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ sessions });
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
        status: 'LOBBY',
        currentQuestionIndex: 0
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
              include: { questions: true },
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

    res.json({ session });
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

    if (session.status === 'COMPLETED') {
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
    const { status, currentQuestionIndex } = req.body;

    const session = await prisma.session.update({
      where: { id: req.params.id },
      data: { status, currentQuestionIndex }
    });

    // Emit to all clients in session
    io.to(`session:${session.id}`).emit('session:updated', { session });

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

    // Emit team joined event
    io.to(`session:${session.id}`).emit('team:joined', { team });

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

    // Emit score update
    io.to(`session:${team.sessionId}`).emit('score:updated', { team });

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

    // Update team score if correct
    if (isCorrect) {
      await prisma.team.update({
        where: { id: teamId },
        data: { score: { increment: points } }
      });
    }

    // Create answer record
    const answerRecord = await prisma.answer.create({
      data: {
        teamId,
        questionId,
        answer,
        isCorrect,
        points,
        timeToAnswer: question.timeLimit - (timeRemaining || 0)
      }
    });

    // Emit answer submitted
    io.to(`session:${req.params.sessionId}`).emit('answer:submitted', {
      teamId,
      questionId,
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
      data: { status: 'IN_PROGRESS', currentQuestionIndex: 0 }
    });

    io.to(`session:${session.id}`).emit('game:started', { session });

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

    io.to(`session:${req.params.sessionId}`).emit('question:started', {
      question: {
        id: question.id,
        text: question.text,
        type: question.type,
        options: question.options,
        timeLimit: question.timeLimit,
        points: question.points,
        mediaUrl: question.mediaUrl
      }
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

    // Get answers for this question
    const answers = await prisma.answer.findMany({
      where: { questionId },
      include: { team: true }
    });

    io.to(`session:${req.params.sessionId}`).emit('question:ended', {
      questionId,
      correctAnswer: question.correctAnswer,
      answers: answers.map(a => ({
        teamId: a.teamId,
        teamName: a.team.name,
        answer: a.answer,
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
    io.to(`session:${req.params.sessionId}`).emit('buzzer:opened', {
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

    io.to(`session:${req.params.sessionId}`).emit('buzzer:pressed', {
      teamId,
      teamName,
      timestamp: Date.now()
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sessions/:sessionId/buzzer/reset', authenticateToken, async (req, res) => {
  try {
    io.to(`session:${req.params.sessionId}`).emit('buzzer:reset', {});
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

    io.to(`session:${req.params.sessionId}`).emit('leaderboard:show', { teams });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sessions/:sessionId/end', authenticateToken, async (req, res) => {
  try {
    const session = await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { status: 'COMPLETED' }
    });

    const teams = await prisma.team.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { score: 'desc' }
    });

    io.to(`session:${session.id}`).emit('game:ended', { teams });

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

  // Join session room
  socket.on('session:join', ({ sessionId, teamId }) => {
    socket.join(`session:${sessionId}`);
    console.log(`Socket ${socket.id} joined session ${sessionId}`);

    if (teamId) {
      socket.teamId = teamId;
    }
  });

  // Leave session room
  socket.on('session:leave', ({ sessionId }) => {
    socket.leave(`session:${sessionId}`);
    console.log(`Socket ${socket.id} left session ${sessionId}`);
  });

  // Buzzer press from player
  socket.on('buzzer:press', async ({ sessionId, teamId, teamName }) => {
    io.to(`session:${sessionId}`).emit('buzzer:pressed', {
      teamId,
      teamName,
      timestamp: Date.now()
    });
  });

  // Answer from player
  socket.on('answer:submit', async ({ sessionId, teamId, questionId, answer, timeRemaining }) => {
    try {
      const question = await prisma.question.findUnique({ where: { id: questionId } });
      if (!question) return;

      const isCorrect = answer === question.correctAnswer;
      const points = calculateScore(isCorrect, timeRemaining || 0, question.timeLimit, question.points);

      if (isCorrect) {
        await prisma.team.update({
          where: { id: teamId },
          data: { score: { increment: points } }
        });
      }

      await prisma.answer.create({
        data: {
          teamId,
          questionId,
          answer,
          isCorrect,
          points,
          timeToAnswer: question.timeLimit - (timeRemaining || 0)
        }
      });

      io.to(`session:${sessionId}`).emit('answer:submitted', {
        teamId,
        questionId,
        isCorrect,
        points
      });

      socket.emit('answer:result', { isCorrect, points });
    } catch (error) {
      console.error('Socket answer error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
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
║   🎮 ARENA EVENT API v2.0.0                          ║
║                                                       ║
║   Server running on http://${HOST}:${PORT}              ║
║   WebSocket enabled                                   ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});
