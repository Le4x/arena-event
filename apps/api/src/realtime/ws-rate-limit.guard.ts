import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';

abstract class BaseWsRateLimitGuard implements CanActivate {
  protected abstract readonly limit: number;
  protected abstract readonly windowMs: number;

  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const handlerName = context.getHandler()?.name || 'unknown';
    const key = this.buildKey(client.id, handlerName);

    const redis = this.redisService.getClient();
    const results = await redis
      .multi()
      .incr(key)
      .pexpire(key, this.windowMs, 'NX')
      .exec();

    const count = Number(results?.[0]?.[1] ?? 0);

    if (count > this.limit) {
      throw new WsException('Too many requests');
    }

    return true;
  }

  protected buildKey(clientId: string, handler: string) {
    return `ws:rate:${handler}:${clientId}`;
  }
}

@Injectable()
export class WsRateLimitGuard extends BaseWsRateLimitGuard {
  protected readonly limit = 30;
  protected readonly windowMs = 1000;

  constructor(redisService: RedisService) {
    super(redisService);
  }
}

@Injectable()
export class WsBuzzerRateLimitGuard extends BaseWsRateLimitGuard {
  protected readonly limit = 5;
  protected readonly windowMs = 1000;

  constructor(redisService: RedisService) {
    super(redisService);
  }
}
