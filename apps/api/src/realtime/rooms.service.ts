import { Injectable } from '@nestjs/common';

interface ClientMetadata {
  socketId: string;
  sessionId: string;
  teamId?: string;
  role?: 'player' | 'gamemaster' | 'screen';
  connectedAt: Date;
}

@Injectable()
export class RoomsService {
  private clients: Map<string, ClientMetadata> = new Map();

  async addClient(
    socketId: string,
    sessionId: string,
    teamId?: string,
    role?: 'player' | 'gamemaster' | 'screen',
  ) {
    this.clients.set(socketId, {
      socketId,
      sessionId,
      teamId,
      role,
      connectedAt: new Date(),
    });
  }

  async removeClient(socketId: string) {
    this.clients.delete(socketId);
  }

  async getClientMeta(socketId: string): Promise<ClientMetadata | undefined> {
    return this.clients.get(socketId);
  }

  async getClientsInSession(sessionId: string): Promise<ClientMetadata[]> {
    return Array.from(this.clients.values()).filter(
      (client) => client.sessionId === sessionId,
    );
  }

  async getPlayerCount(sessionId: string): Promise<number> {
    return Array.from(this.clients.values()).filter(
      (client) => client.sessionId === sessionId && client.role === 'player',
    ).length;
  }
}
