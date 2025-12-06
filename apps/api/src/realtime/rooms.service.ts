import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

interface ClientMetadata {
  socketId: string;
  sessionId: string;
  teamId?: string;
  role?: 'player' | 'gamemaster' | 'screen' | 'studio';
  connectedAt: Date;
}

@Injectable()
export class RoomsService {
  private readonly redisClient;

  constructor(private readonly redisService: RedisService) {
    this.redisClient = this.redisService.getClient();
  }

  private clientKey(socketId: string) {
    return `ws:client:${socketId}`;
  }

  private sessionSetKey(sessionId: string) {
    return `ws:session:${sessionId}`;
  }

  async addClient(
    socketId: string,
    sessionId: string,
    teamId?: string,
    role?: 'player' | 'gamemaster' | 'screen' | 'studio',
  ) {
    const meta: ClientMetadata = {
      socketId,
      sessionId,
      teamId,
      role,
      connectedAt: new Date(),
    };

    await this.redisClient
      .multi()
      .set(this.clientKey(socketId), JSON.stringify(meta))
      .sadd(this.sessionSetKey(sessionId), socketId)
      .exec();
  }

  async removeClient(socketId: string) {
    const meta = await this.getClientMeta(socketId);

    const pipeline = this.redisClient.multi().del(this.clientKey(socketId));

    if (meta) {
      pipeline.srem(this.sessionSetKey(meta.sessionId), socketId);
    }

    await pipeline.exec();
  }

  async getClientMeta(socketId: string): Promise<ClientMetadata | undefined> {
    const raw = await this.redisClient.get(this.clientKey(socketId));
    if (!raw) return undefined;

    try {
      const parsed = JSON.parse(raw) as ClientMetadata;
      return {
        ...parsed,
        connectedAt: new Date(parsed.connectedAt),
      };
    } catch (error) {
      // Corrupted entry, cleanup
      await this.redisClient.del(this.clientKey(socketId));
      return undefined;
    }
  }

  async getClientsInSession(sessionId: string): Promise<ClientMetadata[]> {
    const socketIds = await this.redisClient.smembers(this.sessionSetKey(sessionId));

    if (!socketIds.length) {
      return [];
    }

    const rawMetas = await this.redisClient.mget(socketIds.map((id) => this.clientKey(id)));

    return rawMetas
      .filter((entry): entry is string => Boolean(entry))
      .map((entry) => {
        try {
          return JSON.parse(entry) as ClientMetadata;
        } catch (error) {
          return null;
        }
      })
      .filter((meta): meta is ClientMetadata => Boolean(meta) && meta.sessionId === sessionId)
      .map((meta) => ({ ...meta, connectedAt: new Date(meta.connectedAt) }));
  }

  async getPlayerCount(sessionId: string): Promise<number> {
    const clients = await this.getClientsInSession(sessionId);
    return clients.filter((client) => client.role === 'player').length;
  }
}
