import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Round } from '@prisma/client';

@Injectable()
export class RoundsService {
  constructor(private prisma: PrismaService) {}

  async findAll(eventId: string): Promise<Round[]> {
    return this.prisma.round.findMany({
      where: { eventId },
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });
  }

  async findOne(id: string): Promise<Round> {
    const round = await this.prisma.round.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    return round;
  }

  async create(data: {
    eventId: string;
    name: string;
    description?: string;
    order: number;
  }): Promise<Round> {
    return this.prisma.round.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      order?: number;
    },
  ): Promise<Round> {
    return this.prisma.round.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Round> {
    return this.prisma.round.delete({
      where: { id },
    });
  }
}
