import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { GameService } from './game.service';
import { ScoringService } from './scoring.service';
import { StateManager } from './state.manager';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class StartQuestionDto {
  sessionId: string;
  questionId: string;
}

class EndQuestionDto {
  sessionId: string;
  questionId: string;
}

class SubmitAnswerDto {
  questionId: string;
  teamId: string;
  content: string;
}

class BuzzerPressDto {
  questionId: string;
  teamId: string;
}

class UpdateScoreDto {
  delta: number;
  reason?: string;
}

@Controller('game')
export class GameController {
  constructor(
    private gameService: GameService,
    private scoringService: ScoringService,
    private stateManager: StateManager,
  ) {}

  @Post('question/start')
  @UseGuards(JwtAuthGuard)
  async startQuestion(@Body() dto: StartQuestionDto) {
    return this.gameService.startQuestion(dto.sessionId, dto.questionId);
  }

  @Post('question/end')
  @UseGuards(JwtAuthGuard)
  async endQuestion(@Body() dto: EndQuestionDto) {
    return this.gameService.endQuestion(dto.sessionId, dto.questionId);
  }

  @Post('answer')
  async submitAnswer(@Body() dto: SubmitAnswerDto) {
    return this.gameService.submitAnswer(dto);
  }

  @Post('buzzer')
  async pressBuzzer(@Body() dto: BuzzerPressDto) {
    return this.gameService.pressBuzzer(dto);
  }

  @Post('buzzer/reset')
  @UseGuards(JwtAuthGuard)
  async resetBuzzer(@Body() dto: { sessionId: string; questionId: string }) {
    return this.gameService.resetBuzzer(dto.sessionId, dto.questionId);
  }

  @Get('leaderboard/:sessionId')
  async getLeaderboard(@Param('sessionId') sessionId: string) {
    return this.gameService.getLeaderboard(sessionId);
  }

  @Post('score/:teamId')
  @UseGuards(JwtAuthGuard)
  async updateScore(@Param('teamId') teamId: string, @Body() dto: UpdateScoreDto) {
    return this.scoringService.updateTeamScore(teamId, dto.delta, dto.reason);
  }

  @Get('state/:sessionId')
  async getState(@Param('sessionId') sessionId: string) {
    return this.stateManager.getState(sessionId);
  }
}
