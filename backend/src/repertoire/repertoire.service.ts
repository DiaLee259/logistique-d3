import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RepertoireService {
  constructor(private prisma: PrismaService) {}

  // ── Sociétés ─────────────────────────────────────────────────────────────────

  async listSocietes() {
    return this.prisma.societe.findMany({
      include: { intervenants: { where: { actif: true }, select: { id: true, nom: true, prenom: true } } },
      orderBy: { nom: 'asc' },
    });
  }

  async listSocietesActives() {
    return this.prisma.societe.findMany({
      where: { actif: true },
      select: { id: true, nom: true, code: true },
      orderBy: { nom: 'asc' },
    });
  }

  async createSociete(data: { nom: string; code?: string; adresse?: string; telephone?: string; email?: string }) {
    return this.prisma.societe.create({ data });
  }

  async updateSociete(id: string, data: Partial<{ nom: string; code: string; adresse: string; telephone: string; email: string; actif: boolean }>) {
    const existing = await this.prisma.societe.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Société introuvable');
    return this.prisma.societe.update({ where: { id }, data });
  }

  async deleteSociete(id: string) {
    // Détacher les intervenants avant suppression
    await this.prisma.intervenant.updateMany({ where: { societeId: id }, data: { societeId: null } });
    return this.prisma.societe.delete({ where: { id } });
  }

  // ── Intervenants ──────────────────────────────────────────────────────────────

  async listIntervenants(societeId?: string) {
    return this.prisma.intervenant.findMany({
      where: societeId ? { societeId } : undefined,
      include: { societe: { select: { id: true, nom: true, code: true } } },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
  }

  async listIntervenantsActifs() {
    return this.prisma.intervenant.findMany({
      where: { actif: true },
      include: { societe: { select: { nom: true, code: true } } },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
  }

  async createIntervenant(data: { nom: string; prenom: string; email?: string; telephone?: string; societeId?: string }) {
    return this.prisma.intervenant.create({
      data,
      include: { societe: { select: { id: true, nom: true, code: true } } },
    });
  }

  async updateIntervenant(id: string, data: Partial<{ nom: string; prenom: string; email: string; telephone: string; societeId: string; actif: boolean }>) {
    const existing = await this.prisma.intervenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Intervenant introuvable');
    return this.prisma.intervenant.update({
      where: { id },
      data,
      include: { societe: { select: { id: true, nom: true, code: true } } },
    });
  }

  async deleteIntervenant(id: string) {
    return this.prisma.intervenant.delete({ where: { id } });
  }
}
