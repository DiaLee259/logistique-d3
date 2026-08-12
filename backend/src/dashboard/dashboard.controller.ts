import { Controller, Get, Query, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('kpis')
  getKpis(@Query() filters: Record<string, string>, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getKpis(filters, ue);
  }

  @Get('evolution')
  getEvolution(@Query() filters: Record<string, string>, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getEvolutionStock(filters, ue);
  }

  @Get('departements')
  getVolumeParDepartement(@Query() filters: Record<string, string>, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getVolumeParDepartement(filters, ue);
  }

  @Get('demandeurs')
  getVolumeParDemandeur(@Query() filters: Record<string, string>, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getVolumeParDemandeur(filters, ue);
  }

  @Get('delais')
  getDelaisMoyens(@Query() filters: Record<string, string>, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getDelaisMoyens(filters, ue);
  }

  @Get('top-articles')
  getTopArticles(@Query() filters: Record<string, string>, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getTopArticles(filters, ue);
  }

  @Get('commandes')
  getResumeCommandes(@Query() filters: Record<string, string>, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getResumeCommandes(filters, ue);
  }

  @Get('pilotage')
  getPilotage(@Query() filters: Record<string, string>, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getPilotage(filters, ue);
  }

  @Get('activite-jour')
  getActiviteJour(@Query() filters: Record<string, string>, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getActiviteJour(filters, ue);
  }

  @Get('activite-jour/export')
  async exportActiviteJour(@Query() filters: Record<string, string>, @Request() req: any, @Res() res: Response) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    const buffer = await this.service.exportActiviteJour(filters, ue);
    const jour = filters.date || new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="activite-${jour}.xlsx"`);
    res.send(buffer);
  }
}
