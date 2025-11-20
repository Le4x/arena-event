import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Question, QuestionType } from '@prisma/client';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(roundId: string): Promise<Question[]> {
    return this.prisma.question.findMany({
      where: { roundId },
      orderBy: {
        order: 'asc',
      },
    });
  }

  async findOne(id: string): Promise<Question> {
    const question = await this.prisma.question.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    return question;
  }

  async create(data: {
    roundId: string;
    type: QuestionType;
    content: string;
    mediaUrl?: string;
    timeLimit?: number;
    points?: number;
    order: number;
    choices?: string[];
    correctAnswer?: string;
  }): Promise<Question> {
    return this.prisma.question.create({
      data: {
        ...data,
        choices: data.choices ? data.choices : undefined,
      },
    });
  }

  async update(
    id: string,
    data: {
      type?: QuestionType;
      content?: string;
      mediaUrl?: string;
      timeLimit?: number;
      points?: number;
      order?: number;
      choices?: string[];
      correctAnswer?: string;
    },
  ): Promise<Question> {
    return this.prisma.question.update({
      where: { id },
      data: {
        ...data,
        choices: data.choices ? data.choices : undefined,
      },
    });
  }

  async delete(id: string): Promise<Question> {
    return this.prisma.question.delete({
      where: { id },
    });
  }
}
