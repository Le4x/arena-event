import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamePhase, SessionStatus } from '@prisma/client';
import { ScoringService } from './scoring.service';

@Injectable()
export class GameService {
  constructor(
    private prisma: PrismaService,
    private scoringService: ScoringService,
  ) {}

  /**
   * Start a question in a session
   */
  async startQuestion(sessionId: string, questionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { gameState: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Session is not active');
    }

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + question.timeLimit * 1000);

    // Update game state
    await this.prisma.gameState.update({
      where: { sessionId },
      data: {
        currentQuestionId: questionId,
        questionStartedAt: now,
        questionEndsAt: endsAt,
        phase: GamePhase.QUESTION_ACTIVE,
        buzzerLocked: false,
        buzzerWinner: null,
      },
    });

    // Update session
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        currentQuestionId: questionId,
      },
    });

    return { question, endsAt };
  }

  /**
   * End a question in a session
   */
  async endQuestion(sessionId: string, questionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { gameState: true },
    });

    if (!session || !session.gameState) {
      throw new NotFoundException('Session not found');
    }

    // Update game state
    await this.prisma.gameState.update({
      where: { sessionId },
      data: {
        phase: GamePhase.QUESTION_REVEAL,
        buzzerLocked: true,
      },
    });

    return { questionId };
  }

  /**
   * Submit an answer
   */
  async submitAnswer(data: {
    questionId: string;
    teamId: string;
    content: string;
  }) {
    const { questionId, teamId, content } = data;

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Check if answer already exists
    const existingAnswer = await this.prisma.answer.findUnique({
      where: {
        questionId_teamId: {
          questionId,
          teamId,
        },
      },
    });

    if (existingAnswer) {
      throw new BadRequestException('Answer already submitted');
    }

    // Determine if answer is correct (auto-check for MCQ/TRUE_FALSE)
    let isCorrect: boolean | null = null;
    let points = 0;

    if (question.correctAnswer) {
      isCorrect = content.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
      if (isCorrect) {
        points = question.points;
      }
    }

    // Create answer
    const answer = await this.prisma.answer.create({
      data: {
        questionId,
        teamId,
        content,
        isCorrect,
        points,
      },
    });

    // Update team score if auto-corrected
    if (isCorrect && points > 0) {
      await this.prisma.team.update({
        where: { id: teamId },
        data: {
          score: {
            increment: points,
          },
        },
      });
    }

    return answer;
  }

  /**
   * Record a buzzer press - ATOMIC VERSION (no race condition)
   * Uses Prisma transaction with serializable isolation level
   */
  async pressBuzzer(data: { questionId: string; teamId: string }) {
    const { questionId, teamId } = data;

    // Use a transaction to ensure atomicity
    const buzzerPress = await this.prisma.$transaction(async (tx) => {
      // 1. Get game state to check if buzzer is locked
      const question = await tx.question.findUnique({
        where: { id: questionId },
        include: {
          round: {
            include: {
              event: {
                include: {
                  sessions: {
                    include: {
                      gameState: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!question) {
        throw new NotFoundException('Question not found');
      }

      // Find the game state for this question
      const session = question.round.event.sessions.find(
        (s) => s.currentQuestionId === questionId,
      );

      if (!session || !session.gameState) {
        throw new BadRequestException('Question is not active');
      }

      if (session.gameState.buzzerLocked) {
        throw new BadRequestException('Buzzer is locked');
      }

      // 2. Check if team already buzzed (within transaction)
      const existingBuzz = await tx.buzzerPress.findUnique({
        where: {
          questionId_teamId: {
            questionId,
            teamId,
          },
        },
      });

      if (existingBuzz) {
        throw new BadRequestException('Team already buzzed');
      }

      // 3. Get current rank atomically using raw query with FOR UPDATE lock
      // This prevents race conditions by locking the rows during count
      const countResult = await tx.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::int as count 
        FROM buzzer_presses 
        WHERE "questionId" = ${questionId}
        FOR UPDATE
      `;
      
      const rank = Number(countResult[0].count) + 1;

      // 4. Create buzzer press with the calculated rank
      const newBuzzerPress = await tx.buzzerPress.create({
        data: {
          questionId,
          teamId,
          rank,
        },
      });

      // 5. If this is the first buzz, lock the buzzer
      if (rank === 1) {
        await tx.gameState.update({
          where: { sessionId: session.id },
          data: {
            buzzerLocked: true,
            buzzerWinner: teamId,
          },
        });
      }

      return newBuzzerPress;
    }, {
      // Serializable isolation ensures no concurrent modifications
      isolationLevel: 'Serializable',
      // Timeout after 5 seconds to prevent deadlocks
      timeout: 5000,
    });

    return buzzerPress;
  }

  /**
   * Reset buzzer for a question
   */
  async resetBuzzer(sessionId: string, questionId: string) {
    await this.prisma.gameState.update({
      where: { sessionId },
      data: {
        buzzerLocked: false,
        buzzerWinner: null,
      },
    });

    // Optionally, delete all buzzer presses for this question
    await this.prisma.buzzerPress.deleteMany({
      where: { questionId },
    });

    return { success: true };
  }

  /**
   * Get leaderboard for a session
   */
  async getLeaderboard(sessionId: string) {
    const teams = await this.prisma.team.findMany({
      where: { sessionId },
      orderBy: {
        score: 'desc',
      },
    });

    return teams.map((team, index) => ({
      teamId: team.id,
      teamName: team.name,
      score: team.score,
      rank: index + 1,
    }));
  }
}
