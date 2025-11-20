import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Team } from '@prisma/client';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async findAll(sessionId: string): Promise<Team[]> {
    return this.prisma.team.findMany({
      where: { sessionId },
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
    });
  }

  async findOne(id: string): Promise<Team> {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        devices: true,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  async findByName(sessionId: string, name: string): Promise<Team | null> {
    return this.prisma.team.findUnique({
      where: {
        sessionId_name: {
          sessionId,
          name,
        },
      },
    });
  }

  async create(data: { sessionId: string; name: string }): Promise<Team> {
    // Check if team name already exists in this session
    const existing = await this.findByName(data.sessionId, data.name);

    if (existing) {
      throw new ConflictException('Team name already exists in this session');
    }

    return this.prisma.team.create({
      data,
    });
  }

  async updateScore(id: string, delta: number): Promise<Team> {
    const team = await this.findOne(id);

    return this.prisma.team.update({
      where: { id },
      data: {
        score: team.score + delta,
      },
    });
  }

  async delete(id: string): Promise<Team> {
    return this.prisma.team.delete({
      where: { id },
    });
  }
}
