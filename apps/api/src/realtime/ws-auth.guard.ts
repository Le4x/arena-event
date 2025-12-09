import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RoomsService } from './rooms.service';

/**
 * Guard to verify that a client is in a session
 */
@Injectable()
export class WsSessionGuard implements CanActivate {
  constructor(private roomsService: RoomsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const clientMeta = await this.roomsService.getClientMeta(client.id);

    if (!clientMeta) {
      throw new WsException('Not connected to a session');
    }

    return true;
  }
}

/**
 * Guard to verify that a client is a game master
 */
@Injectable()
export class WsGameMasterGuard implements CanActivate {
  constructor(private roomsService: RoomsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const clientMeta = await this.roomsService.getClientMeta(client.id);

    if (!clientMeta) {
      throw new WsException('Not connected to a session');
    }

    if (clientMeta.role !== 'game_master') {
      throw new WsException('Unauthorized: Only game masters can perform this action');
    }

    return true;
  }
}
