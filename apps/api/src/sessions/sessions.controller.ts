import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SessionStatus } from '@prisma/client';

class CreateSessionDto {
  eventId: string;
  gameMasterId?: string;
}

class UpdateSessionStatusDto {
  status: SessionStatus;
}

@Controller('sessions')
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Get()
  async findAll(@Query('eventId') eventId?: string) {
    return this.sessionsService.findAll(eventId);
  }

  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    return this.sessionsService.findByCode(code);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createSessionDto: CreateSessionDto) {
    return this.sessionsService.create(createSessionDto);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateSessionStatusDto) {
    return this.sessionsService.updateStatus(id, updateStatusDto.status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string) {
    return this.sessionsService.delete(id);
  }

  @Get(':id/theme')
  async getTheme(@Param('id') id: string) {
    return this.sessionsService.getTheme(id);
  }
}
