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
    version: '2.1.0'
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
          mediaUrl: q.mediaUrl
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
    const { text, type, options, correctAnswer, points, timeLimit, mediaUrl } = req.body;

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
        timeLimit: timeLimit || 30,
        mediaUrl: mediaUrl || null,
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
        timeLimit: question.timeLimit,
        order: question.order,
        mediaUrl: question.mediaUrl
      }
    });
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
      data: {
        content: text,
        type,
        choices: options,
        correctAnswer,
        points,
        timeLimit,
        mediaUrl,
        order
      }
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
        timeLimit: question.timeLimit,
        order: question.order,
        mediaUrl: question.mediaUrl
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
            mediaUrl: q.mediaUrl
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
      await prisma.team.update({
        where: { id: teamId },
        data: { score: { increment: points } }
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
        mediaUrl: question.mediaUrl
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
    console.log(`Question started in session ${sessionId}:`, data.question?.id);
    io.to(`session:${sessionId}`).emit('question-start', {
      question: data.question,
      timeLimit: data.timeLimit || data.question?.timeLimit || 30
    });
  });

  // Question end - from Studio to Screen/Player
  socket.on('question-end', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Question ended in session ${sessionId}`);
    io.to(`session:${sessionId}`).emit('question-end', {
      questionId: data.questionId,
      correctAnswer: data.correctAnswer
    });
  });

  // Timer events
  socket.on('timer-update', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    io.to(`session:${sessionId}`).emit('timer-update', { timeRemaining: data.timeRemaining });
  });

  socket.on('timer-end', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    io.to(`session:${sessionId}`).emit('timer-end', {});
  });

  // Show leaderboard
  socket.on('show-leaderboard', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Showing leaderboard in session ${sessionId}`);
    io.to(`session:${sessionId}`).emit('show-leaderboard', { teams: data.teams });
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

  // ========== BUZZER EVENTS ==========

  socket.on('buzzer-open', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Buzzer opened in session ${sessionId}`);
    io.to(`session:${sessionId}`).emit('buzzer-open', {});
  });

  socket.on('buzzer-lock', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    io.to(`session:${sessionId}`).emit('buzzer-lock', {});
  });

  socket.on('buzzer-reset', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    io.to(`session:${sessionId}`).emit('buzzer-reset', {});
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
  socket.on('buzzer-correct', (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    console.log(`Buzzer correct in session ${sessionId}: team=${data.teamName}, points=${data.points}`);
    io.to(`session:${sessionId}`).emit('buzzer-correct', {
      team: data.team,
      teamId: data.teamId,
      teamName: data.teamName,
      points: data.points
    });
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

  // Buzzer press - from Player
  const handleBuzzerPress = async (data) => {
    const sessionId = data.sessionId || socket.sessionId;
    const team = data.team || { id: data.teamId, name: data.teamName };
    console.log(`Buzzer pressed by ${team.name} in session ${sessionId}`);
    io.to(`session:${sessionId}`).emit('buzzer-pressed', {
      team,
      teamId: team.id,
      teamName: team.name,
      timestamp: data.timestamp || Date.now()
    });
  };
  socket.on('buzzer-press', handleBuzzerPress);
  socket.on('buzzer:press', handleBuzzerPress);

  // ========== ANSWER EVENTS ==========

  const handleAnswerSubmit = async (data) => {
    const { teamId, questionId, answer, responseTime, timeRemaining } = data;
    const sessionId = data.sessionId || socket.sessionId;

    try {
      const question = await prisma.question.findUnique({ where: { id: questionId } });
      if (!question) {
        console.error('Question not found:', questionId);
        return;
      }

      const isCorrect = answer === question.correctAnswer;
      const timeVal = responseTime ? (question.timeLimit * 1000 - responseTime) / 1000 : (timeRemaining || 0);
      const points = calculateScore(isCorrect, timeVal, question.timeLimit, question.points);

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
          content: answer,
          isCorrect,
          points
        }
      });

      // Emit to all in session (for Screen)
      io.to(`session:${sessionId}`).emit('answer-submitted', {
        teamId,
        questionId,
        answer,
        isCorrect,
        points
      });

      // Emit result back to the submitting player
      socket.emit('answer-result', { teamId, isCorrect, points });

      console.log(`Answer submitted: team=${teamId}, correct=${isCorrect}, points=${points}`);
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

  // ========== DISCONNECT ==========

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.sessionId && socket.teamId) {
      io.to(`session:${socket.sessionId}`).emit('team-left', { teamId: socket.teamId });
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
            mediaUrl: q.mediaUrl
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

    // Count existing teams to assign color
    const teamCount = await prisma.team.count({
      where: { sessionId: req.params.sessionId }
    });

    const team = await prisma.team.create({
      data: {
        name,
        sessionId: req.params.sessionId,
        score: 0
      }
    });

    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
    const teamWithColor = {
      ...team,
      color: colors[teamCount % colors.length]
    };

    io.to(`session:${session.id}`).emit('team-joined', { team: teamWithColor });

    res.json(teamWithColor);
  } catch (error) {
    console.error('Create team error:', error);
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
        mediaUrl: q.mediaUrl
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
      mediaUrl: q.mediaUrl
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
      await prisma.team.update({
        where: { id: teamId },
        data: { score: { increment: points } }
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

// Public: Update team score (for Studio)
app.put('/sessions/:sessionId/teams/:teamId/score', async (req, res) => {
  try {
    const { score } = req.body;

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

// Public: Emit Socket.IO events (for Studio control)
app.post('/sessions/:sessionId/emit', async (req, res) => {
  try {
    const { event, data } = req.body;
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
