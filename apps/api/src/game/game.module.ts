import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { ScoringService } from './scoring.service';
import { StateManager } from './state.manager';
import { GameController } from './game.controller';
import { SessionsModule } from '../sessions/sessions.module';
import { TeamsModule } from '../teams/teams.module';
import { QuestionsModule } from '../questions/questions.module';

@Module({
  imports: [SessionsModule, TeamsModule, QuestionsModule],
  controllers: [GameController],
  providers: [GameService, ScoringService, StateManager],
  exports: [GameService, ScoringService, StateManager],
})
export class GameModule {}
