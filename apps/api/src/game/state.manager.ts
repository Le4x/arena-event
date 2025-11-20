import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamePhase } from '@prisma/client';

@Injectable()
export class StateManager {
  constructor(private prisma: PrismaService) {}

  /**
   * Get current game state for a session
   */
  async getState(sessionId: string) {
    return this.prisma.gameState.findUnique({
      where: { sessionId },
    });
  }

  /**
   * Update game phase
   */
  async updatePhase(sessionId: string, phase: GamePhase) {
    return this.prisma.gameState.update({
      where: { sessionId },
      data: { phase },
    });
  }

  /**
   * Set current round
   */
  async setCurrentRound(sessionId: string, roundId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { currentRoundId: roundId },
    });

    await this.prisma.gameState.update({
      where: { sessionId },
      data: {
        currentRoundId: roundId,
        phase: GamePhase.ROUND_INTRO,
      },
    });
  }
}
