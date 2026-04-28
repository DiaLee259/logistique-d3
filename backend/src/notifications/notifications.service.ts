import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async create(data: { userId?: string; type: string; titre: string; message: string; lien?: string }) {
    return this.prisma.notification.create({ data });
  }

  async marquerLue(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { lue: true } });
  }

  async marquerToutesLues(userId: string) {
    return this.prisma.notification.updateMany({
      where: { OR: [{ userId }, { userId: null }], lue: false },
      data: { lue: true },
    });
  }

  async countNonLues(userId: string) {
    return this.prisma.notification.count({
      where: { OR: [{ userId }, { userId: null }], lue: false },
    });
  }
}
