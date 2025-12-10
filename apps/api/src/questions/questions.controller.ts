import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuestionType } from '@prisma/client';

class CreateQuestionDto {
  roundId: string;
  type: QuestionType;
  content: string;
  mediaUrl?: string;
  timeLimit?: number;
  points?: number;
  negativePoints?: number;
  order: number;
  choices?: string[];
  correctAnswer?: string;
  explanation?: string;
  tolerance?: number;
  questionCueStart?: number;
  questionCueEnd?: number;
  revealCueStart?: number;
  revealCueEnd?: number;
}

class UpdateQuestionDto {
  type?: QuestionType;
  content?: string;
  mediaUrl?: string;
  timeLimit?: number;
  points?: number;
  negativePoints?: number;
  order?: number;
  choices?: string[];
  correctAnswer?: string;
  explanation?: string;
  tolerance?: number;
  questionCueStart?: number;
  questionCueEnd?: number;
  revealCueStart?: number;
  revealCueEnd?: number;
}

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

  @Get()
  async findAll(@Query('roundId') roundId: string) {
    return this.questionsService.findAll(roundId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @Post()
  async create(@Body() createQuestionDto: CreateQuestionDto) {
    return this.questionsService.create(createQuestionDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateQuestionDto: UpdateQuestionDto) {
    return this.questionsService.update(id, updateQuestionDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.questionsService.delete(id);
  }
}
