import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GameGateway } from './game.gateway';
import { RoomsService } from './rooms.service';
import { GameModule } from '../game/game.module';
import { SessionsModule } from '../sessions/sessions.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [
    GameModule,
    SessionsModule,
    TeamsModule,
    // Import JwtModule for WebSocket authentication
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'arena-event-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [GameGateway, RoomsService],
})
export class RealtimeModule {}
