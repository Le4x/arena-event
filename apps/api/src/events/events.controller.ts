import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class CreateEventDto {
  name: string;
  description?: string;
}

class UpdateEventDto {
  name?: string;
  description?: string;
}

class UpdateThemeDto {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    correct?: string;
    wrong?: string;
  };
  logo?: string | null;
  frame?: string | null;
  background?: string | null;
  backgroundType?: 'gradient' | 'solid' | 'image';
  sounds?: {
    correct?: string | null;
    wrong?: string | null;
    timer?: string | null;
    buzzer?: string | null;
  };
  fonts?: {
    heading?: string;
    body?: string;
  };
}

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.eventsService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eventsService.findOne(id, user.id);
  }

  @Post()
  async create(@Body() createEventDto: CreateEventDto, @CurrentUser() user: any) {
    return this.eventsService.create(createEventDto, user.id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user: any,
  ) {
    return this.eventsService.update(id, updateEventDto, user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eventsService.delete(id, user.id);
  }

  @Get(':id/theme')
  async getTheme(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eventsService.getTheme(id, user.id);
  }

  @Put(':id/theme')
  async updateTheme(
    @Param('id') id: string,
    @Body() updateThemeDto: UpdateThemeDto,
    @CurrentUser() user: any,
  ) {
    return this.eventsService.updateTheme(id, updateThemeDto, user.id);
  }
}
