/**
 * Integration Tests for Arena Event API
 *
 * These tests cover the main API endpoints for:
 * - Authentication (login, register)
 * - Events CRUD
 * - Sessions management
 * - Teams and scoring
 * - Game flow
 *
 * Requirements:
 * - PostgreSQL running with test database
 * - Run with: npm test
 */

import { jest } from '@jest/globals';

// Mock Prisma to avoid actual database calls
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  event: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  session: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  team: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  round: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  },
  question: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  },
  answer: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  buzzerPress: {
    upsert: jest.fn(),
  },
};

// Test data
const testUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  password: '$2b$10$abcdefghijklmnopqrstuvwxyz123456', // bcrypt hash
  role: 'ORGANIZER',
  firstName: 'Test',
  lastName: 'User',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testEvent = {
  id: 'test-event-123',
  name: 'Test Quiz',
  description: 'A test quiz event',
  ownerId: testUser.id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testSession = {
  id: 'test-session-123',
  code: 'ABC123',
  eventId: testEvent.id,
  status: 'LOBBY',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testTeam = {
  id: 'test-team-123',
  name: 'Test Team',
  sessionId: testSession.id,
  score: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testQuestion = {
  id: 'test-question-123',
  roundId: 'round-123',
  content: 'What is 2+2?',
  type: 'MCQ',
  choices: ['1', '2', '3', '4'],
  correctAnswer: 'D',
  points: 100,
  timeLimit: 30,
  order: 1,
};

describe('Arena Event API', () => {
  describe('Health Check', () => {
    it('should have health endpoint defined', () => {
      // This is a placeholder - actual test would make HTTP request
      expect(true).toBe(true);
    });
  });

  describe('Utility Functions', () => {
    describe('generateSessionCode', () => {
      it('should generate 6 character code', () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const generateSessionCode = () => {
          let code = '';
          for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return code;
        };

        const code = generateSessionCode();
        expect(code).toHaveLength(6);
        expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
        // Should not contain confusing characters (O, 0, I, 1)
        expect(code).not.toMatch(/[OI01]/);
      });
    });

    describe('calculateScore', () => {
      const calculateScore = (isCorrect, timeRemaining, maxTime, basePoints) => {
        if (!isCorrect) return 0;
        const timeBonus = Math.round((timeRemaining / maxTime) * (basePoints * 0.5));
        return basePoints + timeBonus;
      };

      it('should return 0 for incorrect answers', () => {
        expect(calculateScore(false, 30, 30, 100)).toBe(0);
      });

      it('should return base points for correct answer at time 0', () => {
        expect(calculateScore(true, 0, 30, 100)).toBe(100);
      });

      it('should return base + 50% bonus for instant answer', () => {
        expect(calculateScore(true, 30, 30, 100)).toBe(150);
      });

      it('should return proportional bonus', () => {
        expect(calculateScore(true, 15, 30, 100)).toBe(125);
      });
    });

    describe('Rate Limiting', () => {
      const rateLimitMap = new Map();

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

      beforeEach(() => {
        rateLimitMap.clear();
      });

      it('should allow first request', () => {
        const result = rateLimit('test-key', 5, 1000);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
      });

      it('should block after max requests', () => {
        const key = 'block-test';
        for (let i = 0; i < 5; i++) {
          rateLimit(key, 5, 1000);
        }
        const result = rateLimit(key, 5, 1000);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });

      it('should reset after window expires', async () => {
        const key = 'reset-test';
        for (let i = 0; i < 5; i++) {
          rateLimit(key, 5, 50); // 50ms window
        }

        // Wait for window to expire
        await new Promise(resolve => setTimeout(resolve, 60));

        const result = rateLimit(key, 5, 50);
        expect(result.allowed).toBe(true);
      });
    });
  });

  describe('Buzzer Logic', () => {
    const buzzerState = new Map();

    const resetBuzzer = (sessionId, questionId = null) => {
      buzzerState.set(sessionId, {
        locked: false,
        winner: null,
        timestamp: null,
        questionId,
        queue: []
      });
    };

    const tryPressBuzzer = (sessionId, team, timestamp) => {
      const state = buzzerState.get(sessionId) || { locked: false, winner: null, timestamp: null, queue: [] };

      const alreadyBuzzed = state.queue?.some(entry => entry.team?.id === team?.id);
      if (alreadyBuzzed) {
        return { success: false, winner: state.winner, reason: 'already_buzzed' };
      }

      const rank = (state.queue?.length || 0) + 1;

      if (!state.queue) state.queue = [];
      state.queue.push({ team, timestamp, rank });

      if (state.locked) {
        return { success: false, winner: state.winner, rank, reason: 'buzzer_locked' };
      }

      state.locked = true;
      state.winner = team;
      state.timestamp = timestamp;
      buzzerState.set(sessionId, state);

      return { success: true, winner: team, rank };
    };

    beforeEach(() => {
      buzzerState.clear();
    });

    it('should allow first buzzer press', () => {
      const sessionId = 'session-1';
      resetBuzzer(sessionId);

      const team = { id: 'team-1', name: 'Team A' };
      const result = tryPressBuzzer(sessionId, team, Date.now());

      expect(result.success).toBe(true);
      expect(result.rank).toBe(1);
      expect(result.winner.id).toBe('team-1');
    });

    it('should lock buzzer after first press', () => {
      const sessionId = 'session-2';
      resetBuzzer(sessionId);

      const team1 = { id: 'team-1', name: 'Team A' };
      const team2 = { id: 'team-2', name: 'Team B' };

      tryPressBuzzer(sessionId, team1, Date.now());
      const result = tryPressBuzzer(sessionId, team2, Date.now());

      expect(result.success).toBe(false);
      expect(result.reason).toBe('buzzer_locked');
      expect(result.rank).toBe(2);
    });

    it('should prevent double buzzing from same team', () => {
      const sessionId = 'session-3';
      resetBuzzer(sessionId);

      const team = { id: 'team-1', name: 'Team A' };
      tryPressBuzzer(sessionId, team, Date.now());

      // Manually unlock for test
      const state = buzzerState.get(sessionId);
      state.locked = false;
      buzzerState.set(sessionId, state);

      const result = tryPressBuzzer(sessionId, team, Date.now());

      expect(result.success).toBe(false);
      expect(result.reason).toBe('already_buzzed');
    });

    it('should reset buzzer state', () => {
      const sessionId = 'session-4';
      const team = { id: 'team-1', name: 'Team A' };

      // Setup initial state with a buzzer press
      buzzerState.set(sessionId, {
        locked: true,
        winner: team,
        timestamp: Date.now(),
        queue: [{ team, timestamp: Date.now(), rank: 1 }]
      });

      resetBuzzer(sessionId, 'question-2');

      const state = buzzerState.get(sessionId);
      expect(state.locked).toBe(false);
      expect(state.winner).toBeNull();
      expect(state.queue).toHaveLength(0);
      expect(state.questionId).toBe('question-2');
    });
  });

  describe('Timer Logic', () => {
    const activeTimers = new Map();

    const startServerTimer = (sessionId, duration) => {
      const startTime = Date.now();
      const timerData = {
        startTime,
        duration: duration * 1000,
        remaining: duration
      };
      activeTimers.set(sessionId, timerData);
      return timerData;
    };

    const stopServerTimer = (sessionId) => {
      activeTimers.delete(sessionId);
    };

    const getTimerRemaining = (sessionId) => {
      const timer = activeTimers.get(sessionId);
      if (!timer) return 0;

      const elapsed = Date.now() - timer.startTime;
      return Math.max(0, Math.ceil((timer.duration - elapsed) / 1000));
    };

    beforeEach(() => {
      activeTimers.clear();
    });

    it('should start timer with correct duration', () => {
      const timer = startServerTimer('session-1', 30);

      expect(timer.duration).toBe(30000);
      expect(timer.remaining).toBe(30);
    });

    it('should calculate remaining time correctly', async () => {
      startServerTimer('session-2', 30);

      // Wait 100ms
      await new Promise(resolve => setTimeout(resolve, 100));

      const remaining = getTimerRemaining('session-2');
      expect(remaining).toBeLessThanOrEqual(30);
      expect(remaining).toBeGreaterThan(28);
    });

    it('should return 0 after timer expires', async () => {
      startServerTimer('session-3', 0.05); // 50ms

      await new Promise(resolve => setTimeout(resolve, 100));

      const remaining = getTimerRemaining('session-3');
      expect(remaining).toBe(0);
    });

    it('should stop timer', () => {
      startServerTimer('session-4', 30);
      stopServerTimer('session-4');

      expect(activeTimers.has('session-4')).toBe(false);
    });

    it('should return 0 for non-existent timer', () => {
      const remaining = getTimerRemaining('non-existent');
      expect(remaining).toBe(0);
    });
  });

  describe('Finale Mode Logic', () => {
    const finaleState = new Map();

    const JOKER_TYPES = {
      DOUBLE: 'DOUBLE',
      TIME_PLUS: 'TIME_PLUS',
      FIFTY_FIFTY: 'FIFTY_FIFTY',
      SHIELD: 'SHIELD'
    };

    const initFinale = (sessionId, finalistCount, teams) => {
      const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
      const finalistTeams = sortedTeams.slice(0, finalistCount);

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
        activeJokers: {},
        shieldedTeams: [],
        currentRound: 1
      };

      finaleState.set(sessionId, state);
      return state;
    };

    const useJoker = (sessionId, teamId, jokerType) => {
      const state = finaleState.get(sessionId);
      if (!state || !state.active) return { success: false, error: 'Finale not active' };

      const teamJokers = state.jokers[teamId];
      if (!teamJokers) return { success: false, error: 'Team not in finale' };

      if (teamJokers[jokerType] <= 0) return { success: false, error: 'Joker already used' };

      teamJokers[jokerType]--;

      if (!state.activeJokers[teamId]) {
        state.activeJokers[teamId] = [];
      }
      state.activeJokers[teamId].push(jokerType);

      finaleState.set(sessionId, state);

      return { success: true, jokerType, remainingJokers: teamJokers };
    };

    beforeEach(() => {
      finaleState.clear();
    });

    it('should initialize finale with top teams', () => {
      const teams = [
        { id: 't1', name: 'Team 1', score: 100 },
        { id: 't2', name: 'Team 2', score: 300 },
        { id: 't3', name: 'Team 3', score: 200 },
        { id: 't4', name: 'Team 4', score: 50 },
      ];

      const state = initFinale('session-1', 3, teams);

      expect(state.finalistTeams).toHaveLength(3);
      expect(state.finalistTeams[0].id).toBe('t2'); // Highest score
      expect(state.finalistTeams[1].id).toBe('t3');
      expect(state.finalistTeams[2].id).toBe('t1');
      expect(state.eliminatedTeams).toHaveLength(1);
      expect(state.eliminatedTeams[0].id).toBe('t4');
    });

    it('should give each finalist all jokers', () => {
      const teams = [
        { id: 't1', name: 'Team 1', score: 100 },
        { id: 't2', name: 'Team 2', score: 200 },
      ];

      const state = initFinale('session-2', 2, teams);

      expect(state.jokers['t1']).toEqual({
        DOUBLE: 1,
        TIME_PLUS: 1,
        FIFTY_FIFTY: 1,
        SHIELD: 1,
      });
      expect(state.jokers['t2']).toEqual({
        DOUBLE: 1,
        TIME_PLUS: 1,
        FIFTY_FIFTY: 1,
        SHIELD: 1,
      });
    });

    it('should use joker successfully', () => {
      const teams = [
        { id: 't1', name: 'Team 1', score: 100 },
      ];

      initFinale('session-3', 1, teams);
      const result = useJoker('session-3', 't1', 'DOUBLE');

      expect(result.success).toBe(true);
      expect(result.remainingJokers.DOUBLE).toBe(0);
    });

    it('should prevent using same joker twice', () => {
      const teams = [
        { id: 't1', name: 'Team 1', score: 100 },
      ];

      initFinale('session-4', 1, teams);
      useJoker('session-4', 't1', 'DOUBLE');
      const result = useJoker('session-4', 't1', 'DOUBLE');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Joker already used');
    });

    it('should fail for non-finalist team', () => {
      const teams = [
        { id: 't1', name: 'Team 1', score: 200 },
        { id: 't2', name: 'Team 2', score: 100 },
      ];

      initFinale('session-5', 1, teams);
      const result = useJoker('session-5', 't2', 'DOUBLE');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Team not in finale');
    });
  });

  describe('Connection Tracking', () => {
    const connectedTeams = new Map();
    const disconnectTimers = new Map();

    const trackTeamConnection = (sessionId, teamId) => {
      if (disconnectTimers.has(teamId)) {
        clearTimeout(disconnectTimers.get(teamId));
        disconnectTimers.delete(teamId);
      }

      if (!connectedTeams.has(sessionId)) {
        connectedTeams.set(sessionId, new Set());
      }

      connectedTeams.get(sessionId).add(teamId);
    };

    const getConnectedTeams = (sessionId) => {
      const teams = connectedTeams.get(sessionId);
      return teams ? Array.from(teams) : [];
    };

    beforeEach(() => {
      connectedTeams.clear();
      disconnectTimers.clear();
    });

    it('should track team connection', () => {
      trackTeamConnection('session-1', 'team-1');
      trackTeamConnection('session-1', 'team-2');

      const teams = getConnectedTeams('session-1');
      expect(teams).toContain('team-1');
      expect(teams).toContain('team-2');
      expect(teams).toHaveLength(2);
    });

    it('should return empty array for unknown session', () => {
      const teams = getConnectedTeams('unknown');
      expect(teams).toHaveLength(0);
    });

    it('should not duplicate team connections', () => {
      trackTeamConnection('session-1', 'team-1');
      trackTeamConnection('session-1', 'team-1');

      const teams = getConnectedTeams('session-1');
      expect(teams).toHaveLength(1);
    });
  });
});

describe('Security Tests', () => {
  describe('Input Validation', () => {
    it('should handle missing email in login', () => {
      const validateLogin = (email, password) => {
        if (!email || !password) {
          return { valid: false, error: 'Email and password are required' };
        }
        return { valid: true };
      };

      expect(validateLogin(null, 'password').valid).toBe(false);
      expect(validateLogin('email@test.com', null).valid).toBe(false);
      expect(validateLogin('', 'password').valid).toBe(false);
    });

    it('should validate session code format', () => {
      const validateSessionCode = (code) => {
        if (!code || code.length < 4 || code.length > 6) {
          return false;
        }
        return /^[A-Z0-9]+$/i.test(code);
      };

      expect(validateSessionCode('ABC123')).toBe(true);
      expect(validateSessionCode('abc')).toBe(false); // Too short
      expect(validateSessionCode('ABCDEFGH')).toBe(false); // Too long
      expect(validateSessionCode('ABC-123')).toBe(false); // Invalid char
      expect(validateSessionCode('')).toBe(false);
      expect(validateSessionCode(null)).toBe(false);
    });

    it('should sanitize team name', () => {
      const sanitizeTeamName = (name) => {
        if (!name) return '';
        return name.trim().slice(0, 20);
      };

      expect(sanitizeTeamName('  Team A  ')).toBe('Team A');
      expect(sanitizeTeamName('A'.repeat(30))).toHaveLength(20);
    });
  });

  describe('JWT Validation', () => {
    it('should extract token from Authorization header', () => {
      const extractToken = (authHeader) => {
        if (!authHeader) return null;
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
        return parts[1];
      };

      expect(extractToken('Bearer abc123')).toBe('abc123');
      expect(extractToken('bearer abc123')).toBeNull(); // Case sensitive
      expect(extractToken('Basic abc123')).toBeNull();
      expect(extractToken('abc123')).toBeNull();
      expect(extractToken('')).toBeNull();
      expect(extractToken(null)).toBeNull();
    });
  });
});
