import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtPayload } from '../auth.service';

/**
 * WebSocket JWT Authentication Guard
 * Verifies JWT tokens on WebSocket connections and attaches user data to the socket
 */
@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtAuthGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractToken(client);

      if (!token) {
        // Allow connection without token for players/screens (they authenticate via session code)
        return true;
      }

      const payload = await this.verifyToken(token);

      // Attach user data to socket
      (client as any).user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      this.logger.debug(`WS authenticated: ${payload.email} (${payload.role})`);
      return true;
    } catch (error) {
      this.logger.warn(`WS auth failed: ${error.message}`);
      throw new WsException('Unauthorized');
    }
  }

  private extractToken(client: Socket): string | undefined {
    // Try to get token from handshake auth
    const authHeader = client.handshake?.auth?.token;
    if (authHeader) {
      return authHeader;
    }

    // Try to get token from query params
    const queryToken = client.handshake?.query?.token as string;
    if (queryToken) {
      return queryToken;
    }

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
}

/**
 * Decorator to require GM (Game Master) role for WebSocket events
 */
export function requireGmRole(socket: Socket): boolean {
  const user = (socket as any).user;
  if (!user) {
    return false;
  }
  // Allow ADMIN or ORGANIZER roles to act as GM
  return user.role === 'ADMIN' || user.role === 'ORGANIZER';
}

/**
 * Decorator to verify socket is in the specified session
 */
export function verifySession(socket: Socket, sessionId: string): boolean {
  const socketSessionId = (socket as any).sessionId;
  return socketSessionId === sessionId;
}
