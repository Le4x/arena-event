import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamePhase, JokerType } from '@prisma/client';

@Injectable()
export class FinalModeService {
  constructor(private prisma: PrismaService) {}

  /**
   * Start final mode with top N teams
   */
  async startFinalMode(
    sessionId: string,
    finalistCount: 2 | 4 | 6 | 8 = 4,
    totalQuestions: number = 5,
  ) {
    // Get session with game state
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { gameState: true },
    });

    if (!session || !session.gameState) {
      throw new NotFoundException('Session not found');
    }

    // Get top N teams by score
    const topTeams = await this.prisma.team.findMany({
      where: { sessionId },
      orderBy: { score: 'desc' },
      take: finalistCount,
    });

    if (topTeams.length < finalistCount) {
      throw new BadRequestException(
        `Not enough teams. Need ${finalistCount}, have ${topTeams.length}`,
      );
    }

    // Create final mode
    const finalMode = await this.prisma.finalMode.create({
      data: {
        gameStateId: session.gameState.id,
        isActive: true,
        finalistCount,
        totalQuestions,
        startedAt: new Date(),
        finalists: {
          create: topTeams.map((team) => ({
            teamId: team.id,
            initialScore: team.score,
            finalScore: 0,
            jokers: {
              create: [
                { type: JokerType.DOUBLE },
                { type: JokerType.STEAL },
                { type: JokerType.SHIELD },
              ],
            },
          })),
        },
      },
      include: {
        finalists: {
          include: {
            team: true,
            jokers: true,
          },
        },
      },
    });

    // Update game phase
    await this.prisma.gameState.update({
      where: { id: session.gameState.id },
      data: { phase: GamePhase.FINAL },
    });

    return this.formatFinalMode(finalMode);
  }

  /**
   * Get current final mode state
   */
  async getFinalMode(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        gameState: {
          include: {
            finalMode: {
              include: {
                finalists: {
                  include: {
                    team: true,
                    jokers: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session?.gameState?.finalMode) {
      return null;
    }

    return this.formatFinalMode(session.gameState.finalMode);
  }

  /**
   * Activate a joker for a team
   */
  async activateJoker(data: {
    sessionId: string;
    teamId: string;
    jokerType: JokerType;
    questionId: string;
    targetTeamId?: string;
  }) {
    const { sessionId, teamId, jokerType, questionId, targetTeamId } = data;

    // Validate STEAL joker requires target
    if (jokerType === JokerType.STEAL && !targetTeamId) {
      throw new BadRequestException('STEAL joker requires a target team');
    }

    // Get finalist
    const finalMode = await this.getFinalModeWithFinalist(sessionId, teamId);
    const finalist = finalMode.finalists.find((f) => f.teamId === teamId);

    if (!finalist) {
      throw new NotFoundException('Team is not a finalist');
    }

    // Find joker
    const joker = finalist.jokers.find(
      (j) => j.type === jokerType && !j.isUsed,
    );

    if (!joker) {
      throw new BadRequestException('Joker not available or already used');
    }

    // Update joker
    await this.prisma.teamJoker.update({
      where: { id: joker.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
        questionId,
        targetTeamId,
      },
    });

    return {
      teamId,
      jokerType,
      questionId,
      targetTeamId,
      activated: true,
    };
  }

  /**
   * Get active jokers for current question
   */
  async getActiveJokers(sessionId: string, questionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        gameState: {
          include: {
            finalMode: {
              include: {
                finalists: {
                  include: {
                    team: true,
                    jokers: {
                      where: {
                        questionId,
                        isUsed: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session?.gameState?.finalMode) {
      return [];
    }

    const activeJokers: Array<{
      teamId: string;
      teamName: string;
      jokerType: JokerType;
      targetTeamId?: string;
      targetTeamName?: string;
    }> = [];

    for (const finalist of session.gameState.finalMode.finalists) {
      for (const joker of finalist.jokers) {
        const activeJoker: any = {
          teamId: finalist.teamId,
          teamName: finalist.team.name,
          jokerType: joker.type,
        };

        if (joker.targetTeamId) {
          const targetFinalist = session.gameState.finalMode.finalists.find(
            (f) => f.teamId === joker.targetTeamId,
          );
          activeJoker.targetTeamId = joker.targetTeamId;
          activeJoker.targetTeamName = targetFinalist?.team.name;
        }

        activeJokers.push(activeJoker);
      }
    }

    return activeJokers;
  }

  /**
   * Process answer with joker effects
   */
  async processAnswerWithJokers(data: {
    sessionId: string;
    questionId: string;
    teamId: string;
    isCorrect: boolean;
    basePoints: number;
  }) {
    const { sessionId, questionId, teamId, isCorrect, basePoints } = data;

    const finalMode = await this.getFinalModeWithFinalist(sessionId, teamId);
    const finalist = finalMode.finalists.find((f) => f.teamId === teamId);

    if (!finalist) {
      return { points: isCorrect ? basePoints : 0, effects: [] };
    }

    let points = isCorrect ? basePoints : 0;
    const effects: Array<{
      type: string;
      teamId: string;
      points: number;
      description: string;
    }> = [];

    // Check DOUBLE joker
    const doubleJoker = finalist.jokers.find(
      (j) => j.type === JokerType.DOUBLE && j.questionId === questionId,
    );
    if (doubleJoker && isCorrect) {
      points *= 2;
      effects.push({
        type: 'DOUBLE',
        teamId,
        points: basePoints,
        description: 'Points doubled!',
      });
    }

    // Check SHIELD joker (protection)
    const shieldJoker = finalist.jokers.find(
      (j) => j.type === JokerType.SHIELD && j.questionId === questionId,
    );

    // Check if team is targeted by STEAL
    if (!isCorrect) {
      const stealers = finalMode.finalists.filter((f) =>
        f.jokers.some(
          (j) =>
            j.type === JokerType.STEAL &&
            j.questionId === questionId &&
            j.targetTeamId === teamId,
        ),
      );

      for (const stealer of stealers) {
        if (shieldJoker) {
          effects.push({
            type: 'SHIELD_BLOCK',
            teamId,
            points: 0,
            description: 'Shield blocked steal attempt!',
          });
        } else {
          // Stealer gets points
          const stolenPoints = Math.floor(basePoints / 2);
          await this.updateFinalistScore(stealer.id, stolenPoints);
          effects.push({
            type: 'STEAL_SUCCESS',
            teamId: stealer.teamId,
            points: stolenPoints,
            description: `Stole ${stolenPoints} points!`,
          });
        }
      }
    }

    // Update finalist score
    if (points > 0) {
      await this.updateFinalistScore(finalist.id, points);
    }

    return { points, effects };
  }

  /**
   * Update finalist score
   */
  private async updateFinalistScore(finalistId: string, delta: number) {
    await this.prisma.finalist.update({
      where: { id: finalistId },
      data: {
        finalScore: {
          increment: delta,
        },
      },
    });
  }

  /**
   * Get final leaderboard
   */
  async getFinalLeaderboard(sessionId: string) {
    const finalMode = await this.getFinalMode(sessionId);

    if (!finalMode) {
      throw new NotFoundException('Final mode not active');
    }

    const entries = finalMode.finalists
      .map((f) => ({
        teamId: f.teamId,
        teamName: f.teamName,
        initialScore: f.initialScore,
        finalScore: f.finalScore,
        totalScore: f.initialScore + f.finalScore,
        isEliminated: f.isEliminated,
        availableJokers: f.jokers
          .filter((j) => !j.isUsed)
          .map((j) => j.type),
        usedJokers: f.jokers.filter((j) => j.isUsed).map((j) => j.type),
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    return entries;
  }

  /**
   * End final mode and determine podium
   */
  async endFinalMode(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        gameState: {
          include: {
            finalMode: {
              include: {
                finalists: {
                  include: {
                    team: true,
                    jokers: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session?.gameState?.finalMode) {
      throw new NotFoundException('Final mode not active');
    }

    const finalMode = session.gameState.finalMode;

    // Calculate final positions
    const sortedFinalists = finalMode.finalists
      .map((f) => ({
        ...f,
        totalScore: f.initialScore + f.finalScore,
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    // Update positions
    for (let i = 0; i < sortedFinalists.length; i++) {
      await this.prisma.finalist.update({
        where: { id: sortedFinalists[i].id },
        data: { position: i + 1 },
      });
    }

    // Update final mode
    await this.prisma.finalMode.update({
      where: { id: finalMode.id },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });

    // Update game phase to PODIUM
    await this.prisma.gameState.update({
      where: { id: session.gameState.id },
      data: { phase: GamePhase.PODIUM },
    });

    // Return podium (top 3)
    const podium = sortedFinalists.slice(0, 3).map((f, index) => ({
      position: (index + 1) as 1 | 2 | 3,
      teamId: f.teamId,
      teamName: f.team.name,
      totalScore: f.totalScore,
      jokerBonus: f.finalScore,
    }));

    return podium;
  }

  /**
   * Advance to next question in final
   */
  async nextFinalQuestion(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        gameState: {
          include: { finalMode: true },
        },
      },
    });

    if (!session?.gameState?.finalMode) {
      throw new NotFoundException('Final mode not active');
    }

    const finalMode = session.gameState.finalMode;
    const nextQuestion = finalMode.currentQuestion + 1;

    if (nextQuestion >= finalMode.totalQuestions) {
      return { completed: true, currentQuestion: nextQuestion };
    }

    await this.prisma.finalMode.update({
      where: { id: finalMode.id },
      data: { currentQuestion: nextQuestion },
    });

    return { completed: false, currentQuestion: nextQuestion };
  }

  // Helper methods

  private async getFinalModeWithFinalist(sessionId: string, teamId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        gameState: {
          include: {
            finalMode: {
              include: {
                finalists: {
                  include: {
                    team: true,
                    jokers: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session?.gameState?.finalMode) {
      throw new NotFoundException('Final mode not active');
    }

    return session.gameState.finalMode;
  }

  private formatFinalMode(finalMode: any) {
    return {
      id: finalMode.id,
      gameStateId: finalMode.gameStateId,
      isActive: finalMode.isActive,
      finalistCount: finalMode.finalistCount,
      currentQuestion: finalMode.currentQuestion,
      totalQuestions: finalMode.totalQuestions,
      startedAt: finalMode.startedAt,
      endedAt: finalMode.endedAt,
      finalists: finalMode.finalists.map((f: any) => ({
        id: f.id,
        finalModeId: f.finalModeId,
        teamId: f.teamId,
        teamName: f.team?.name,
        initialScore: f.initialScore,
        finalScore: f.finalScore,
        position: f.position,
        isEliminated: f.isEliminated,
        eliminatedAt: f.eliminatedAt,
        jokers: f.jokers.map((j: any) => ({
          id: j.id,
          finalistId: j.finalistId,
          type: j.type,
          isUsed: j.isUsed,
          usedAt: j.usedAt,
          questionId: j.questionId,
          targetTeamId: j.targetTeamId,
          pointsEffect: j.pointsEffect,
        })),
      })),
    };
  }
}
