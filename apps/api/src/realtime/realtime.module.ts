import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RoomsService } from './rooms.service';
import { GameModule } from '../game/game.module';
import { SessionsModule } from '../sessions/sessions.module';
import { TeamsModule } from '../teams/teams.module';
import { WsGameMasterGuard, WsSessionGuard } from './ws-auth.guard';
import { WsBuzzerRateLimitGuard, WsRateLimitGuard } from './ws-rate-limit.guard';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [GameModule, SessionsModule, TeamsModule, RedisModule],
  providers: [
    GameGateway,
    RoomsService,
    WsSessionGuard,
    WsGameMasterGuard,
    WsRateLimitGuard,
    WsBuzzerRateLimitGuard,
  ],
})
export class RealtimeModule {}
