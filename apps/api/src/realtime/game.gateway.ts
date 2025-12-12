import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoomsService } from './rooms.service';
import { GameService } from '../game/game.service';
import { TeamsService } from '../teams/teams.service';
import { SessionsService } from '../sessions/sessions.service';
import { JwtPayload } from '../auth/auth.service';

interface JoinSessionPayload {
  sessionId: string;
  teamId?: string;
  role?: 'player' | 'gamemaster' | 'screen';
  token?: string; // JWT token for authenticated users
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

// Extended socket interface with user data
interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  sessionId?: string;
  wsRole?: 'player' | 'gamemaster' | 'screen';
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
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Try to authenticate via handshake
    try {
      const token = this.extractToken(client);
      if (token) {
        const payload = await this.verifyToken(token);
        client.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };
        this.logger.log(`Authenticated WS connection: ${payload.email} (${payload.role})`);
      }
    } catch (error) {
      // Token invalid but allow connection (players/screens don't need auth)
      this.logger.debug(`Unauthenticated WS connection: ${client.id}`);
    }
  }

  private extractToken(client: Socket): string | undefined {
    // Try to get token from handshake auth
    const authHeader = client.handshake?.auth?.token;
    if (authHeader) return authHeader;

    // Try to get token from query params
    const queryToken = client.handshake?.query?.token as string;
    if (queryToken) return queryToken;

    // Try to get token from Authorization header
    const authorizationHeader = client.handshake?.headers?.authorization;
    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
      return authorizationHeader.substring(7);
    }

    return undefined;
  }

  private async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new WsException('Invalid token');
    }
  }

  /**
   * Check if the socket has GM (Game Master) privileges
   * Required for gm-* events
   */
  private requireGmRole(client: AuthenticatedSocket): void {
    if (!client.user) {
      throw new WsException('Authentication required for GM events');
    }
    // Allow ADMIN or ORGANIZER roles to act as GM
    if (client.user.role !== 'ADMIN' && client.user.role !== 'ORGANIZER') {
      throw new WsException('Insufficient permissions: GM role required');
    }
  }

  /**
   * Verify the socket is authorized for the given session
   */
  private verifySessionAccess(client: AuthenticatedSocket, sessionId: string): void {
    if (client.sessionId && client.sessionId !== sessionId) {
      throw new WsException('Not authorized for this session');
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    await this.roomsService.removeClient(client.id);
  }

  /**
   * Join a game session (client event: join-session)
   */
  @SubscribeMessage('join-session')
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

      // Emit success (server event: session-joined)
      client.emit('session-joined', {
        sessionId,
        teamId,
        role,
      });

      // Notify others in the room (server event: team-joined)
      if (teamId && role === 'player') {
        const team = await this.teamsService.findOne(teamId);
        this.server.to(`session:${sessionId}`).emit('team-joined', {
          team: { id: teamId, name: team.name },
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
   * Leave a session (client event: leave-session)
   */
  @SubscribeMessage('leave-session')
  async handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    const { sessionId } = payload;
    client.leave(`session:${sessionId}`);
    await this.roomsService.removeClient(client.id);

    // Server event: team-left
    client.emit('team-left', { sessionId });
  }

  /**
   * Submit an answer (client event: submit-answer)
   */
  @SubscribeMessage('submit-answer')
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

      // Server event: answer-submitted - Emit to gamemaster and screen
      this.server.to(`session:${clientMeta.sessionId}`).emit('answer-submitted', {
        teamId: payload.teamId,
        questionId: payload.questionId,
        timestamp: new Date(),
      });

      // Server event: answer-result - Emit to the player who submitted
      client.emit('answer-result', { answerId: answer.id, success: true });
    } catch (error) {
      this.logger.error('Error submitting answer:', error);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * Press buzzer (client event: buzzer-press)
   */
  @SubscribeMessage('buzzer-press')
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

      // Server event: buzzer-pressed - Broadcast to all in session
      this.server.to(`session:${clientMeta.sessionId}`).emit('buzzer-pressed', {
        team: { id: payload.teamId, name: team.name },
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
   * GameMaster: Start a question (client event: gm-start-question)
   * Requires GM role (ADMIN or ORGANIZER)
   * Accepts either { questionId } or { question } (full object with id)
   */
  @SubscribeMessage('gm-start-question')
  async handleStartQuestion(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string; questionId?: string; question?: { id: string; [key: string]: unknown }; timeLimit?: number },
  ) {
    try {
      // Verify GM role
      this.requireGmRole(client);
      this.verifySessionAccess(client, payload.sessionId);

      // Support both questionId and question.id formats from studio
      const questionId = payload.questionId || payload.question?.id;

      if (!questionId) {
        throw new Error('questionId or question.id is required');
      }

      const result = await this.gameService.startQuestion(payload.sessionId, questionId);

      // Server event: question-start - Broadcast to all in session
      this.server.to(`session:${payload.sessionId}`).emit('question-start', {
        question: result.question,
        endsAt: result.endsAt,
      });
    } catch (error) {
      this.logger.error('Error starting question:', error);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * GameMaster: End a question (client event: gm-end-question)
   * Requires GM role (ADMIN or ORGANIZER)
   */
  @SubscribeMessage('gm-end-question')
  async handleEndQuestion(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string; questionId: string; correctAnswer?: string; explanation?: string },
  ) {
    try {
      // Verify GM role
      this.requireGmRole(client);
      this.verifySessionAccess(client, payload.sessionId);

      await this.gameService.endQuestion(payload.sessionId, payload.questionId);

      // Server event: question-end - Broadcast to all in session
      this.server.to(`session:${payload.sessionId}`).emit('question-end', {
        questionId: payload.questionId,
        correctAnswer: payload.correctAnswer,
        explanation: payload.explanation,
      });
    } catch (error) {
      this.logger.error('Error ending question:', error);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * GameMaster: Show leaderboard (client event: gm-show-leaderboard)
   * Requires GM role (ADMIN or ORGANIZER)
   */
  @SubscribeMessage('gm-show-leaderboard')
  async handleShowLeaderboard(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string },
  ) {
    try {
      // Verify GM role
      this.requireGmRole(client);
      this.verifySessionAccess(client, payload.sessionId);

      const leaderboard = await this.gameService.getLeaderboard(payload.sessionId);

      // Server event: leaderboard-show
      this.server.to(`session:${payload.sessionId}`).emit('leaderboard-show', {
        teams: leaderboard,
        isIntermediate: true,
      });
    } catch (error) {
      this.logger.error('Error showing leaderboard:', error);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * GameMaster: Update score manually (client event: gm-update-score)
   * Requires GM role (ADMIN or ORGANIZER)
   */
  @SubscribeMessage('gm-update-score')
  async handleUpdateScore(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string; teamId: string; delta: number; reason?: string },
  ) {
    try {
      // Verify GM role
      this.requireGmRole(client);
      this.verifySessionAccess(client, payload.sessionId);

      const team = await this.teamsService.updateScore(payload.teamId, payload.delta);

      // Server event: score-update
      this.server.to(`session:${payload.sessionId}`).emit('score-update', {
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
   * GameMaster: Reset buzzer (client event: gm-reset-buzzer)
   * Requires GM role (ADMIN or ORGANIZER)
   */
  @SubscribeMessage('gm-reset-buzzer')
  async handleResetBuzzer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string; questionId: string },
  ) {
    try {
      // Verify GM role
      this.requireGmRole(client);
      this.verifySessionAccess(client, payload.sessionId);

      await this.gameService.resetBuzzer(payload.sessionId, payload.questionId);

      // Server event: buzzer-reset
      this.server.to(`session:${payload.sessionId}`).emit('buzzer-reset', {
        questionId: payload.questionId,
      });
    } catch (error) {
      this.logger.error('Error resetting buzzer:', error);
      client.emit('error', { message: error.message });
    }
  }

  /**
   * GameMaster: Validate buzzer answer (correct or wrong)
   * Requires GM role (ADMIN or ORGANIZER)
   */
  @SubscribeMessage('gm-buzzer-validate')
  async handleBuzzerValidate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string; teamId: string; isCorrect: boolean; points?: number },
  ) {
    try {
      // Verify GM role
      this.requireGmRole(client);
      this.verifySessionAccess(client, payload.sessionId);

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
      client.emit('error', { message: error.message });
    }
  }

  /**
   * GameMaster: Show transition screen (client event: gm-show-transition)
   * Requires GM role (ADMIN or ORGANIZER)
   */
  @SubscribeMessage('gm-show-transition')
  async handleShowTransition(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string },
  ) {
    // Verify GM role
    this.requireGmRole(client);
    this.verifySessionAccess(client, payload.sessionId);

    // Server event: transition-show
    this.server.to(`session:${payload.sessionId}`).emit('transition-show', {});
  }

  /**
   * GameMaster: Start finale mode (client event: gm-finale-start)
   * Requires GM role (ADMIN or ORGANIZER)
   */
  @SubscribeMessage('gm-finale-start')
  async handleFinaleStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string; finalistTeams: string[] },
  ) {
    try {
      // Verify GM role
      this.requireGmRole(client);
      this.verifySessionAccess(client, payload.sessionId);

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
      client.emit('error', { message: error.message });
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
      client.emit('error', { message: error.message });
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
   * GameMaster: End finale mode (client event: gm-finale-end)
   * Requires GM role (ADMIN or ORGANIZER)
   */
  @SubscribeMessage('gm-finale-end')
  async handleFinaleEnd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string },
  ) {
    // Verify GM role
    this.requireGmRole(client);
    this.verifySessionAccess(client, payload.sessionId);

    this.server.to(`session:${payload.sessionId}`).emit('finale-ended', {});
  }
}
