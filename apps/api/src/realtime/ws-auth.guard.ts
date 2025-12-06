import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RoomsService } from './rooms.service';

@Injectable()
export class WsSessionGuard implements CanActivate {
  constructor(private readonly roomsService: RoomsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const meta = await this.roomsService.getClientMeta(client.id);

    if (!meta) {
      throw new WsException('Not connected to a session');
    }

    return true;
  }
}

@Injectable()
export class WsGameMasterGuard implements CanActivate {
  constructor(private readonly roomsService: RoomsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const meta = await this.roomsService.getClientMeta(client.id);

    if (!meta) {
      throw new WsException('Not connected to a session');
    }

    if (meta.role !== 'gamemaster') {
      throw new WsException('Forbidden');
    }

    return true;
  }
}
