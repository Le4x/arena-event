import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { GameService } from '../game/game.service';
import { TeamsService } from '../teams/teams.service';
import { SessionsService } from '../sessions/sessions.service';

interface JoinSessionPayload {
  sessionId: string;
  teamId?: string;
  role?: 'player' | 'gamemaster' | 'screen';
}

interface SubmitAnswerPayload {
  questionId: string;
  teamId: string;
  content: string;
}

interface BuzzerPayload {
  questionId: string;
  teamId: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private roomsService: RoomsService,
    private gameService: GameService,
    private teamsService: TeamsService,
    private sessionsService: SessionsService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    await this.roomsService.removeClient(client.id);
  }

  /**
   * Join a game session
   */
  @SubscribeMessage('join_session')
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinSessionPayload,
  ) {
    try {
      const { sessionId, teamId, role } = payload;

      // Verify session exists
      const session = await this.sessionsService.findOne(sessionId);

      if (!session) {
        client.emit('error', { message: 'Session not found' });
        return;
      }

      // Join the session room
      client.join(`session:${sessionId}`);
      await this.roomsService.addClient(client.id, sessionId, teamId, role);

      // Emit success
      client.emit('joined_session', {
        sessionId,
        teamId,
        role,
      });

      // Notify others in the room
      if (teamId && role === 'player') {
        const team = await this.teamsService.findOne(teamId);
        this.server.to(`session:${sessionId}`).emit('player_joined', {
          teamId,
          teamName: team.name,
        });
      }

      this.logger.log(`Client ${client.id} joined session ${sessionId} as ${role}`);
    } catch (error) {
      this.logger.error('Error joining session:', error);
      client.emit('error', { message: 'Failed to join session' });
    }
  }

  /**
   * Leave a session
   */
  @SubscribeMessage('leave_session')
  async handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    const { sessionId } = payload;
    client.leave(`session:${sessionId}`);
    await this.roomsService.removeClient(client.id);

    client.emit('left_session', { sessionId });
  }

  /**
   * Submit an answer
   */
  @SubscribeMessage('submit_answer')
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubmitAnswerPayload,
  ) {
    try {
      const answer = await this.gameService.submitAnswer(payload);

      // Get session ID from client metadata
      const clientMeta = await this.roomsService.getClientMeta(client.id);

      if (!clientMeta) {
        client.emit('error', { message: 'Not in a session' });
        return;
      }

      // Emit to gamemaster only (not to all players)
      this.server.to(`session:${clientMeta.sessionId}`).emit('answer_submitted', {
        teamId: payload.teamId,
        questionId: payload.questionId,
        timestamp: new Date(),
      });

      client.emit('answer_received', { answerId: answer.id });
    } catch (error) {
      this.logger.error('Error submitting answer:', error);
      client.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Press buzzer
   */
  @SubscribeMessage('buzzer_press')
  async handleBuzzerPress(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: BuzzerPayload,
  ) {
    try {
      const buzzerPress = await this.gameService.pressBuzzer(payload);

      // Get session ID
      const clientMeta = await this.roomsService.getClientMeta(client.id);

      if (!clientMeta) {
        client.emit('error', { message: 'Not in a session' });
        return;
      }

      const team = await this.teamsService.findOne(payload.teamId);

      // Broadcast to all in session
      this.server.to(`session:${clientMeta.sessionId}`).emit('buzz', {
        teamId: payload.teamId,
        teamName: team.name,
        rank: buzzerPress.rank,
        timestamp: buzzerPress.pressedAt,
      });
    } catch (error) {
      this.logger.error('Error pressing buzzer:', error);
      client.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * GameMaster: Start a question
   */
  @SubscribeMessage('start_question')
  async handleStartQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; questionId: string },
  ) {
    try {
      const result = await this.gameService.startQuestion(payload.sessionId, payload.questionId);

      // Broadcast to all in session
      this.server.to(`session:${payload.sessionId}`).emit('question_started', {
        question: result.question,
        endsAt: result.endsAt,
      });
    } catch (error) {
      this.logger.error('Error starting question:', error);
      client.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * GameMaster: End a question
   */
  @SubscribeMessage('end_question')
  async handleEndQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; questionId: string },
  ) {
    try {
      await this.gameService.endQuestion(payload.sessionId, payload.questionId);

      // Broadcast to all in session
      this.server.to(`session:${payload.sessionId}`).emit('question_ended', {
        questionId: payload.questionId,
      });
    } catch (error) {
      this.logger.error('Error ending question:', error);
      client.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * GameMaster: Show leaderboard
   */
  @SubscribeMessage('show_leaderboard')
  async handleShowLeaderboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    try {
      const leaderboard = await this.gameService.getLeaderboard(payload.sessionId);

      this.server.to(`session:${payload.sessionId}`).emit('leaderboard_shown', {
        leaderboard,
        isIntermediate: true,
      });
    } catch (error) {
      this.logger.error('Error showing leaderboard:', error);
      client.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * GameMaster: Update score manually
   */
  @SubscribeMessage('update_score')
  async handleUpdateScore(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; teamId: string; delta: number; reason?: string },
  ) {
    try {
      const team = await this.teamsService.updateScore(payload.teamId, payload.delta);

      this.server.to(`session:${payload.sessionId}`).emit('score_updated', {
        teamId: team.id,
        teamName: team.name,
        newScore: team.score,
        delta: payload.delta,
        reason: payload.reason,
      });
    } catch (error) {
      this.logger.error('Error updating score:', error);
      client.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * GameMaster: Reset buzzer
   */
  @SubscribeMessage('reset_buzzer')
  async handleResetBuzzer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; questionId: string },
  ) {
    try {
      await this.gameService.resetBuzzer(payload.sessionId, payload.questionId);

      this.server.to(`session:${payload.sessionId}`).emit('buzzer_reset', {
        questionId: payload.questionId,
      });
    } catch (error) {
      this.logger.error('Error resetting buzzer:', error);
      client.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * GameMaster: Validate buzzer answer (correct or wrong)
   */
  @SubscribeMessage('buzzer-validate')
  async handleBuzzerValidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; teamId: string; isCorrect: boolean; points?: number },
  ) {
    try {
      const team = await this.teamsService.findOne(payload.teamId);

      if (payload.isCorrect) {
        // Update team score
        if (payload.points && payload.points > 0) {
          await this.teamsService.updateScore(payload.teamId, payload.points);
        }

        this.server.to(`session:${payload.sessionId}`).emit('buzzer-correct', {
          teamId: payload.teamId,
          teamName: team.name,
          points: payload.points || 0,
        });
      } else {
        this.server.to(`session:${payload.sessionId}`).emit('buzzer-wrong', {
          teamId: payload.teamId,
          teamName: team.name,
        });

        // Reset buzzer so others can try
        this.server.to(`session:${payload.sessionId}`).emit('buzzer-reset', {});
      }
    } catch (error) {
      this.logger.error('Error validating buzzer:', error);
      client.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * GameMaster: Show transition screen
   */
  @SubscribeMessage('show-transition')
  async handleShowTransition(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    this.server.to(`session:${payload.sessionId}`).emit('show-transition', {});
  }

  /**
   * GameMaster: Start finale mode
   */
  @SubscribeMessage('finale-start')
  async handleFinaleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; finalistTeams: string[] },
  ) {
    try {
      // Initialize jokers for each finalist team
      const jokers: Record<string, Record<string, number>> = {};
      for (const teamId of payload.finalistTeams) {
        jokers[teamId] = {
          DOUBLE: 1,
          TIME_PLUS: 1,
          FIFTY_FIFTY: 1,
          SHIELD: 1,
        };
      }

      this.server.to(`session:${payload.sessionId}`).emit('finale-started', {
        finalistTeams: payload.finalistTeams,
        jokers,
      });
    } catch (error) {
      this.logger.error('Error starting finale:', error);
      client.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Player: Use a joker
   */
  @SubscribeMessage('joker-use')
  async handleJokerUse(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; teamId: string; teamName: string; jokerType: string },
  ) {
    try {
      // Broadcast joker usage to all clients
      this.server.to(`session:${payload.sessionId}`).emit('joker-used', {
        teamId: payload.teamId,
        teamName: payload.teamName,
        jokerType: payload.jokerType,
        // Clients maintain their own joker counts
      });

      // Handle special joker effects
      if (payload.jokerType === 'TIME_PLUS') {
        this.server.to(`session:${payload.sessionId}`).emit('time-plus-activated', {
          teamId: payload.teamId,
          additionalTime: 15,
        });
      }

      if (payload.jokerType === 'FIFTY_FIFTY') {
        // Server should send which options to eliminate
        // This is typically handled by the studio which knows the correct answer
        this.server.to(`session:${payload.sessionId}`).emit('fifty-fifty-requested', {
          teamId: payload.teamId,
        });
      }
    } catch (error) {
      this.logger.error('Error using joker:', error);
      client.emit('error', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * GameMaster: Apply 50/50 joker (eliminate 2 wrong answers)
   */
  @SubscribeMessage('fifty-fifty-apply')
  async handleFiftyFiftyApply(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string; teamId: string; eliminatedOptions: string[] },
  ) {
    this.server.to(`session:${payload.sessionId}`).emit('fifty-fifty-applied', {
      teamId: payload.teamId,
      eliminatedOptions: payload.eliminatedOptions,
    });
  }

  /**
   * GameMaster: End finale mode
   */
  @SubscribeMessage('finale-end')
  async handleFinaleEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    this.server.to(`session:${payload.sessionId}`).emit('finale-ended', {});
  }
}
