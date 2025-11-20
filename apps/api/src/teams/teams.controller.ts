import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { TeamsService } from './teams.service';

class CreateTeamDto {
  sessionId: string;
  name: string;
}

class UpdateScoreDto {
  delta: number;
}

@Controller('teams')
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Get()
  async findAll(@Query('sessionId') sessionId: string) {
    return this.teamsService.findAll(sessionId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Post()
  async create(@Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto);
  }

  @Put(':id/score')
  async updateScore(@Param('id') id: string, @Body() updateScoreDto: UpdateScoreDto) {
    return this.teamsService.updateScore(id, updateScoreDto.delta);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.teamsService.delete(id);
  }
}
