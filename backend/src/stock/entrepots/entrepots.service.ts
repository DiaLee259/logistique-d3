import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EntrepotsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.entrepot.findMany({ where: { actif: true }, orderBy: { code: 'asc' } });
  }

  findAllIncludingInactif() {
    return this.prisma.entrepot.findMany({ orderBy: { code: 'asc' } });
  }

  async findById(id: string) {
    const e = await this.prisma.entrepot.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Entrepôt introuvable');
    return e;
  }

  create(data: { code: string; nom: string; localisation: string; gestionnaire?: string; adresse?: string; telephone?: string; email?: string }) {
    return this.prisma.entrepot.create({ data });
  }

  async update(id: string, data: Partial<{ nom: string; localisation: string; gestionnaire: string; adresse: string; telephone: string; email: string; actif: boolean }>) {
    await this.findById(id);
    return this.prisma.entrepot.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.entrepot.update({ where: { id }, data: { actif: false } });
  }
}
