import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

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

  // ── Stats intervenants ────────────────────────────────────────────────────────

  async getStatsIntervenant(id: string) {
    const intervenant = await this.prisma.intervenant.findUnique({
      where: { id },
      select: { id: true, nom: true, prenom: true, societe: { select: { nom: true } }, autoEntrepreneur: true },
    });
    if (!intervenant) throw new NotFoundException('Intervenant introuvable');

    const commandes = await this.prisma.commande.findMany({
      where: { intervenantId: id, deletedAt: null },
      include: {
        lignes: {
          include: { article: { select: { id: true, nom: true, reference: true, unite: true } } },
        },
      },
    });

    // Agréger par articleId
    const articlesMap = new Map<string, { articleId: string; nom: string; reference: string; unite: string; quantiteEnvoyee: number }>();
    for (const commande of commandes) {
      for (const ligne of commande.lignes) {
        const qte = ligne.quantiteFournie ?? ligne.quantiteValidee ?? ligne.quantiteDemandee;
        const existing = articlesMap.get(ligne.articleId);
        if (existing) {
          existing.quantiteEnvoyee += qte;
        } else {
          articlesMap.set(ligne.articleId, {
            articleId: ligne.articleId,
            nom: ligne.article.nom,
            reference: ligne.article.reference,
            unite: ligne.article.unite,
            quantiteEnvoyee: qte,
          });
        }
      }
    }

    return {
      intervenant: {
        id: intervenant.id,
        nom: intervenant.nom,
        prenom: intervenant.prenom,
        societe: intervenant.societe,
        autoEntrepreneur: (intervenant as any).autoEntrepreneur ?? false,
      },
      stats: {
        nbCommandes: commandes.length,
        articles: Array.from(articlesMap.values()),
      },
    };
  }

  async getIntervenantsWithStats() {
    const intervenants = await this.prisma.intervenant.findMany({
      include: { societe: { select: { id: true, nom: true, code: true } } },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });

    const result = await Promise.all(
      intervenants.map(async (intervenant) => {
        const commandes = await this.prisma.commande.findMany({
          where: { intervenantId: intervenant.id, deletedAt: null },
          include: { lignes: { select: { quantiteFournie: true, quantiteValidee: true, quantiteDemandee: true } } },
        });

        const totalArticles = commandes.reduce((sum, c) => {
          return sum + c.lignes.reduce((s, l) => s + (l.quantiteFournie ?? l.quantiteValidee ?? l.quantiteDemandee), 0);
        }, 0);

        return {
          ...intervenant,
          autoEntrepreneur: (intervenant as any).autoEntrepreneur ?? false,
          nbCommandes: commandes.length,
          totalArticles,
        };
      }),
    );

    return result;
  }

  // ── Import Excel ──────────────────────────────────────────────────────────────

  async importSocietes(buffer: Buffer<ArrayBufferLike>) {
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    const rows: any[] = [];
    ws.eachRow((row, idx) => {
      if (idx === 1) return; // skip header
      const nom = String(row.getCell(1).value ?? '').trim();
      const code = String(row.getCell(2).value ?? '').trim() || undefined;
      const adresse = String(row.getCell(3).value ?? '').trim() || undefined;
      const telephone = String(row.getCell(4).value ?? '').trim() || undefined;
      const email = String(row.getCell(5).value ?? '').trim() || undefined;
      if (!nom) return;
      rows.push({ nom, code, adresse, telephone, email });
    });

    if (rows.length === 0) throw new BadRequestException('Aucune ligne valide dans le fichier');

    let created = 0, skipped = 0;
    for (const data of rows) {
      try {
        await this.prisma.societe.create({ data });
        created++;
      } catch {
        skipped++; // code unique en conflit ou autre erreur
      }
    }

    return { created, skipped, total: rows.length };
  }

  async importIntervenants(buffer: Buffer<ArrayBufferLike>) {
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    const rows: any[] = [];
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const prenom = String(row.getCell(1).value ?? '').trim();
      const nom = String(row.getCell(2).value ?? '').trim();
      const email = String(row.getCell(3).value ?? '').trim() || undefined;
      const telephone = String(row.getCell(4).value ?? '').trim() || undefined;
      const codeSociete = String(row.getCell(5).value ?? '').trim() || undefined;
      if (!nom || !prenom) return;
      rows.push({ prenom, nom, email, telephone, codeSociete });
    });

    if (rows.length === 0) throw new BadRequestException('Aucune ligne valide dans le fichier');

    // Résoudre les codes sociétés
    const societes = await this.prisma.societe.findMany({ select: { id: true, code: true } });
    const societeByCode = new Map(societes.filter(s => s.code).map(s => [s.code, s.id]));

    let created = 0, skipped = 0;
    for (const { codeSociete, ...data } of rows) {
      const societeId = codeSociete ? societeByCode.get(codeSociete) : undefined;
      try {
        await this.prisma.intervenant.create({ data: { ...data, societeId: societeId ?? null } });
        created++;
      } catch {
        skipped++;
      }
    }

    return { created, skipped, total: rows.length };
  }
}
