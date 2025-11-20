import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RoundsService } from './rounds.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class CreateRoundDto {
  eventId: string;
  name: string;
  description?: string;
  order: number;
}

class UpdateRoundDto {
  name?: string;
  description?: string;
  order?: number;
}

@Controller('rounds')
@UseGuards(JwtAuthGuard)
export class RoundsController {
  constructor(private roundsService: RoundsService) {}

  @Get()
  async findAll(@Query('eventId') eventId: string) {
    return this.roundsService.findAll(eventId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.roundsService.findOne(id);
  }

  @Post()
  async create(@Body() createRoundDto: CreateRoundDto) {
    return this.roundsService.create(createRoundDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateRoundDto: UpdateRoundDto) {
    return this.roundsService.update(id, updateRoundDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.roundsService.delete(id);
  }
}
