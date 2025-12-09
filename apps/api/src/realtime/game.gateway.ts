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
import { Logger, UseGuards } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { GameService } from '../game/game.service';
import { TeamsService } from '../teams/teams.service';
import { SessionsService } from '../sessions/sessions.service';
import { WsSessionGuard, WsGameMasterGuard } from './ws-auth.guard';

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
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
    ],
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
  @UseGuards(WsSessionGuard)
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
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Press buzzer
   */
  @UseGuards(WsSessionGuard)
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
      client.emit('error', { message: error.message });
    }
  }

  /**
   * GameMaster: Start a question
   */
  @UseGuards(WsGameMasterGuard)
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
      client.emit('error', { message: error.message });
    }
  }

  /**
   * GameMaster: End a question
   */
  @UseGuards(WsGameMasterGuard)
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
      client.emit('error', { message: error.message });
    }
  }

  /**
   * GameMaster: Show leaderboard
   */
  @UseGuards(WsGameMasterGuard)
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
      client.emit('error', { message: error.message });
    }
  }

  /**
   * GameMaster: Update score manually
   */
  @UseGuards(WsGameMasterGuard)
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
      client.emit('error', { message: error.message });
    }
  }

  /**
   * GameMaster: Reset buzzer
   */
  @UseGuards(WsGameMasterGuard)
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
      client.emit('error', { message: error.message });
    }
  }
}
