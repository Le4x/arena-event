import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { RoomsService } from './rooms.service';
import { GameModule } from '../game/game.module';
import { SessionsModule } from '../sessions/sessions.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [GameModule, SessionsModule, TeamsModule],
  providers: [GameGateway, RoomsService],
})
export class RealtimeModule {}
