import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from '../../src/game/scoring.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('ScoringService', () => {
  let service: ScoringService;
  let prisma: PrismaService;

  const mockPrisma = {
    team: {
      update: jest.fn(),
    },
    answer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('calculateSpeedBonus', () => {
    it('should return 0 when time taken equals or exceeds time limit', () => {
      expect(service.calculateSpeedBonus(30, 30)).toBe(0);
      expect(service.calculateSpeedBonus(35, 30)).toBe(0);
    });

    it('should return maximum bonus when answered instantly', () => {
      expect(service.calculateSpeedBonus(0, 30, 50)).toBe(50);
    });

    it('should return proportional bonus based on time taken', () => {
      // Half time taken = half bonus
      expect(service.calculateSpeedBonus(15, 30, 50)).toBe(25);
      // Quarter time taken = 75% bonus
      expect(service.calculateSpeedBonus(7.5, 30, 50)).toBe(37);
    });

    it('should use default maxBonus of 50 when not specified', () => {
      expect(service.calculateSpeedBonus(0, 30)).toBe(50);
    });
  });

  describe('updateTeamScore', () => {
    it('should increment team score with positive delta', async () => {
      const mockTeam = { id: 'team-1', name: 'Test Team', score: 150 };
      mockPrisma.team.update.mockResolvedValue(mockTeam);

      const result = await service.updateTeamScore('team-1', 50, 'Correct answer');

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { score: { increment: 50 } },
      });
      expect(result).toEqual({
        teamId: 'team-1',
        teamName: 'Test Team',
        newScore: 150,
        delta: 50,
        reason: 'Correct answer',
      });
    });

    it('should decrement team score with negative delta', async () => {
      const mockTeam = { id: 'team-1', name: 'Test Team', score: 50 };
      mockPrisma.team.update.mockResolvedValue(mockTeam);

      const result = await service.updateTeamScore('team-1', -25, 'Wrong answer penalty');

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { score: { increment: -25 } },
      });
      expect(result.delta).toBe(-25);
    });

    it('should handle zero delta', async () => {
      const mockTeam = { id: 'team-1', name: 'Test Team', score: 100 };
      mockPrisma.team.update.mockResolvedValue(mockTeam);

      const result = await service.updateTeamScore('team-1', 0);

      expect(result.delta).toBe(0);
    });
  });

  describe('validateAnswer', () => {
    const mockAnswer = {
      id: 'answer-1',
      teamId: 'team-1',
      questionId: 'question-1',
      content: 'Paris',
      isCorrect: null,
      points: 0,
      question: { points: 100 },
      team: { id: 'team-1', name: 'Test Team', score: 0 },
    };

    it('should throw error when answer not found', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue(null);

      await expect(service.validateAnswer('invalid-id', true, 100)).rejects.toThrow(
        'Answer not found',
      );
    });

    it('should validate answer as correct and award points', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue({ ...mockAnswer, points: 0 });
      mockPrisma.answer.update.mockResolvedValue({});
      mockPrisma.team.update.mockResolvedValue({});

      const result = await service.validateAnswer('answer-1', true, 100);

      expect(mockPrisma.answer.update).toHaveBeenCalledWith({
        where: { id: 'answer-1' },
        data: { isCorrect: true, points: 100 },
      });
      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { score: { increment: 100 } },
      });
      expect(result.isCorrect).toBe(true);
      expect(result.points).toBe(100);
    });

    it('should validate answer as incorrect and not change score when delta is 0', async () => {
      mockPrisma.answer.findUnique.mockResolvedValue({ ...mockAnswer, points: 0 });
      mockPrisma.answer.update.mockResolvedValue({});

      const result = await service.validateAnswer('answer-1', false, 0);

      expect(mockPrisma.answer.update).toHaveBeenCalled();
      expect(mockPrisma.team.update).not.toHaveBeenCalled(); // No score change for delta 0
      expect(result.isCorrect).toBe(false);
      expect(result.delta).toBe(0);
    });

    it('should handle score adjustment when re-validating answer', async () => {
      // Answer was previously marked correct with 100 points, now marking incorrect with 0
      mockPrisma.answer.findUnique.mockResolvedValue({ ...mockAnswer, points: 100 });
      mockPrisma.answer.update.mockResolvedValue({});
      mockPrisma.team.update.mockResolvedValue({});

      const result = await service.validateAnswer('answer-1', false, 0);

      expect(mockPrisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { score: { increment: -100 } }, // delta = 0 - 100 = -100
      });
      expect(result.delta).toBe(-100);
    });
  });
});
