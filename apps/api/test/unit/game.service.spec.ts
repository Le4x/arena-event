import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GameService } from '../../src/game/game.service';
import { ScoringService } from '../../src/game/scoring.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SessionStatus, GamePhase, QuestionType } from '@prisma/client';

describe('GameService', () => {
  let service: GameService;
  let prisma: PrismaService;

  const mockPrisma = {
    session: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    question: {
      findUnique: jest.fn(),
    },
    answer: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    gameState: {
      update: jest.fn(),
    },
    buzzerPress: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const mockScoringService = {
    updateTeamScore: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ScoringService,
          useValue: mockScoringService,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('startQuestion', () => {
    it('should throw NotFoundException when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.startQuestion('invalid-session', 'q1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when session is not active', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        status: SessionStatus.LOBBY,
        gameState: {},
      });

      await expect(service.startQuestion('session-1', 'q1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when question not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        status: SessionStatus.ACTIVE,
        gameState: {},
      });
      mockPrisma.question.findUnique.mockResolvedValue(null);

      await expect(service.startQuestion('session-1', 'invalid-question')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should start question successfully', async () => {
      const mockSession = {
        id: 'session-1',
        status: SessionStatus.ACTIVE,
        gameState: { id: 'gs-1' },
      };
      const mockQuestion = {
        id: 'question-1',
        content: 'What is 2+2?',
        timeLimit: 30,
        points: 100,
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.question.findUnique.mockResolvedValue(mockQuestion);
      mockPrisma.gameState.update.mockResolvedValue({});
      mockPrisma.session.update.mockResolvedValue({});

      const result = await service.startQuestion('session-1', 'question-1');

      expect(mockPrisma.gameState.update).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        data: expect.objectContaining({
          currentQuestionId: 'question-1',
          phase: GamePhase.QUESTION_ACTIVE,
          buzzerLocked: false,
          buzzerWinner: null,
        }),
      });
      expect(result.question).toEqual(mockQuestion);
      expect(result.endsAt).toBeDefined();
    });
  });

  describe('endQuestion', () => {
    it('should throw NotFoundException when session not found', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.endQuestion('invalid-session', 'q1')).rejects.toThrow(NotFoundException);
    });

    it('should end question successfully', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({
        id: 'session-1',
        gameState: { id: 'gs-1' },
      });
      mockPrisma.gameState.update.mockResolvedValue({});

      const result = await service.endQuestion('session-1', 'question-1');

      expect(mockPrisma.gameState.update).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        data: {
          phase: GamePhase.QUESTION_REVEAL,
          buzzerLocked: true,
        },
      });
      expect(result.questionId).toBe('question-1');
    });
  });

  describe('calculateSimilarity', () => {
    // Access private method for testing
    const getSimilarity = (service: any, str1: string, str2: string) => {
      return service.calculateSimilarity(str1, str2);
    };

    it('should return 1.0 for identical strings', () => {
      expect(getSimilarity(service, 'hello', 'hello')).toBe(1.0);
      expect(getSimilarity(service, 'Hello', 'HELLO')).toBe(1.0); // Case insensitive
    });

    it('should return 0.0 for completely different strings', () => {
      expect(getSimilarity(service, 'abc', 'xyz')).toBeLessThan(0.5);
    });

    it('should return high similarity for minor typos', () => {
      expect(getSimilarity(service, 'Beatles', 'Beatels')).toBeGreaterThan(0.7);
      expect(getSimilarity(service, 'Michael Jackson', 'Micheal Jackson')).toBeGreaterThan(0.8);
    });

    it('should handle empty strings', () => {
      expect(getSimilarity(service, '', '')).toBe(1.0);
      expect(getSimilarity(service, 'hello', '')).toBe(0.0);
      expect(getSimilarity(service, '', 'hello')).toBe(0.0);
    });

    it('should handle whitespace', () => {
      expect(getSimilarity(service, '  hello  ', 'hello')).toBe(1.0);
    });
  });

  describe('submitAnswer', () => {
    it('should throw NotFoundException when question not found', async () => {
      mockPrisma.question.findUnique.mockResolvedValue(null);

      await expect(
        service.submitAnswer({
          questionId: 'invalid-q',
          teamId: 'team-1',
          content: 'answer',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when answer already submitted', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        type: QuestionType.MCQ,
      });
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 'existing-answer',
      });

      await expect(
        service.submitAnswer({
          questionId: 'q1',
          teamId: 'team-1',
          content: 'A',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should submit correct MCQ answer and award points', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        type: QuestionType.MCQ,
        correctAnswer: 'A',
        points: 100,
        negativePoints: 0,
      });
      mockPrisma.answer.findUnique.mockResolvedValue(null);
      mockPrisma.answer.create.mockResolvedValue({
        id: 'answer-1',
        isCorrect: true,
        points: 100,
      });
      mockPrisma.team.update.mockResolvedValue({});

      const result = await service.submitAnswer({
        questionId: 'q1',
        teamId: 'team-1',
        content: 'A',
      });

      expect(result.isCorrect).toBe(true);
      expect(result.points).toBe(100);
      expect(mockPrisma.team.update).toHaveBeenCalled();
    });

    it('should submit incorrect MCQ answer and apply negative points', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        type: QuestionType.MCQ,
        correctAnswer: 'A',
        points: 100,
        negativePoints: 25,
      });
      mockPrisma.answer.findUnique.mockResolvedValue(null);
      mockPrisma.answer.create.mockResolvedValue({
        id: 'answer-1',
        isCorrect: false,
        points: -25,
      });
      mockPrisma.team.update.mockResolvedValue({});

      const result = await service.submitAnswer({
        questionId: 'q1',
        teamId: 'team-1',
        content: 'B',
      });

      expect(result.isCorrect).toBe(false);
      expect(result.points).toBe(-25);
    });

    it('should use tolerance for TEXT questions', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 'q1',
        type: QuestionType.TEXT,
        correctAnswer: 'Beatles',
        points: 100,
        tolerance: 0.8,
        negativePoints: 0,
      });
      mockPrisma.answer.findUnique.mockResolvedValue(null);
      mockPrisma.answer.create.mockResolvedValue({
        id: 'answer-1',
        isCorrect: true,
        points: 100,
      });
      mockPrisma.team.update.mockResolvedValue({});

      // Slight typo should still be accepted with 0.8 tolerance
      const result = await service.submitAnswer({
        questionId: 'q1',
        teamId: 'team-1',
        content: 'Beatels',
      });

      expect(result.isCorrect).toBe(true);
    });
  });

  describe('getLeaderboard', () => {
    it('should return teams sorted by score in descending order', async () => {
      const mockTeams = [
        { id: 't1', name: 'Team A', score: 100 },
        { id: 't2', name: 'Team B', score: 200 },
        { id: 't3', name: 'Team C', score: 150 },
      ];
      mockPrisma.team.findMany.mockResolvedValue([
        mockTeams[1],
        mockTeams[2],
        mockTeams[0],
      ]);

      const result = await service.getLeaderboard('session-1');

      expect(result).toHaveLength(3);
      expect(result[0].rank).toBe(1);
      expect(result[0].teamName).toBe('Team B');
      expect(result[0].score).toBe(200);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });

    it('should handle empty session', async () => {
      mockPrisma.team.findMany.mockResolvedValue([]);

      const result = await service.getLeaderboard('session-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('resetBuzzer', () => {
    it('should reset buzzer state and delete buzzer presses', async () => {
      mockPrisma.gameState.update.mockResolvedValue({});
      mockPrisma.buzzerPress.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.resetBuzzer('session-1', 'question-1');

      expect(mockPrisma.gameState.update).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        data: {
          buzzerLocked: false,
          buzzerWinner: null,
        },
      });
      expect(mockPrisma.buzzerPress.deleteMany).toHaveBeenCalledWith({
        where: { questionId: 'question-1' },
      });
      expect(result.success).toBe(true);
    });
  });
});
