import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { SessionsModule } from './sessions/sessions.module';
import { RoundsModule } from './rounds/rounds.module';
import { QuestionsModule } from './questions/questions.module';
import { TeamsModule } from './teams/teams.module';
import { GameModule } from './game/game.module';
import { RealtimeModule } from './realtime/realtime.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    EventsModule,
    SessionsModule,
    RoundsModule,
    QuestionsModule,
    TeamsModule,
    GameModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
