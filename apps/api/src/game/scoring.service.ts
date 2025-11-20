import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate speed bonus based on time taken
   */
  calculateSpeedBonus(
    timeTaken: number,
    timeLimit: number,
    maxBonus: number = 50,
  ): number {
    if (timeTaken >= timeLimit) return 0;

    const ratio = 1 - timeTaken / timeLimit;
    return Math.floor(ratio * maxBonus);
  }

  /**
   * Update team score manually
   */
  async updateTeamScore(teamId: string, delta: number, reason?: string) {
    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: {
        score: {
          increment: delta,
        },
      },
    });

    return {
      teamId: team.id,
      teamName: team.name,
      newScore: team.score,
      delta,
      reason,
    };
  }

  /**
   * Validate and score an answer manually
   */
  async validateAnswer(answerId: string, isCorrect: boolean, points: number) {
    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId },
      include: {
        question: true,
        team: true,
      },
    });

    if (!answer) {
      throw new Error('Answer not found');
    }

    // Calculate point difference
    const oldPoints = answer.points;
    const delta = points - oldPoints;

    // Update answer
    await this.prisma.answer.update({
      where: { id: answerId },
      data: {
        isCorrect,
        points,
      },
    });

    // Update team score
    if (delta !== 0) {
      await this.prisma.team.update({
        where: { id: answer.teamId },
        data: {
          score: {
            increment: delta,
          },
        },
      });
    }

    return {
      answerId,
      teamId: answer.teamId,
      delta,
      isCorrect,
      points,
    };
  }
}
