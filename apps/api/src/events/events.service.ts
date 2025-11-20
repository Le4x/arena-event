import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Event } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId?: string): Promise<Event[]> {
    const where = userId ? { ownerId: userId } : {};

    return this.prisma.event.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            sessions: true,
            rounds: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId?: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        sessions: {
          include: {
            _count: {
              select: {
                teams: true,
              },
            },
          },
        },
        rounds: {
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
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (userId && event.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this event');
    }

    return event;
  }

  async create(
    data: {
      name: string;
      description?: string;
    },
    ownerId: string,
  ): Promise<Event> {
    return this.prisma.event.create({
      data: {
        ...data,
        ownerId,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
    },
    userId: string,
  ): Promise<Event> {
    const event = await this.findOne(id, userId);

    return this.prisma.event.update({
      where: { id: event.id },
      data,
    });
  }

  async delete(id: string, userId: string): Promise<Event> {
    const event = await this.findOne(id, userId);

    return this.prisma.event.delete({
      where: { id: event.id },
    });
  }
}
