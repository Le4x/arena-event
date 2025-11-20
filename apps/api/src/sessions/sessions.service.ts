import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Session, SessionStatus } from '@prisma/client';
import { customAlphabet } from 'nanoid';

const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(eventId?: string): Promise<Session[]> {
    const where = eventId ? { eventId } : {};

    return this.prisma.session.findMany({
      where,
      include: {
        event: true,
        gameMaster: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            teams: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string): Promise<Session> {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        event: {
          include: {
            rounds: {
              include: {
                questions: {
                  orderBy: {
                    order: 'asc',
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        gameMaster: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        teams: {
          include: {
            _count: {
              select: {
                devices: true,
              },
            },
          },
          orderBy: {
            score: 'desc',
          },
        },
        gameState: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async findByCode(code: string): Promise<Session> {
    const session = await this.prisma.session.findUnique({
      where: { code },
      include: {
        event: true,
        teams: {
          orderBy: {
            score: 'desc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async create(data: { eventId: string; gameMasterId?: string }): Promise<Session> {
    // Generate unique session code
    let code = generateCode();
    let attempts = 0;

    while (attempts < 10) {
      const existing = await this.prisma.session.findUnique({
        where: { code },
      });

      if (!existing) break;

      code = generateCode();
      attempts++;
    }

    if (attempts >= 10) {
      throw new ConflictException('Failed to generate unique session code');
    }

    // Create session with game state
    return this.prisma.session.create({
      data: {
        ...data,
        code,
        gameState: {
          create: {},
        },
      },
      include: {
        event: true,
        gameState: true,
      },
    });
  }

  async updateStatus(id: string, status: SessionStatus): Promise<Session> {
    const updateData: any = { status };

    if (status === SessionStatus.ACTIVE) {
      updateData.startedAt = new Date();
    } else if (status === SessionStatus.FINISHED) {
      updateData.endedAt = new Date();
    }

    return this.prisma.session.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<Session> {
    return this.prisma.session.delete({
      where: { id },
    });
  }
}
