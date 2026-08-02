import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('kpis')
  getKpis(
    @Query('entrepotId') entrepotId?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('mois') mois?: string,
    @Query('articleId') articleId?: string,
    @Request() req?: any,
  ) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getKpis(entrepotId, dateDebut, dateFin, mois, articleId, ue);
  }

  @Get('evolution')
  getEvolution(
    @Query('entrepotId') entrepotId?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('mois') mois?: string,
    @Query('articleId') articleId?: string,
    @Request() req?: any,
  ) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getEvolutionStock(entrepotId, dateDebut, dateFin, mois, articleId, ue);
  }

  @Get('departements')
  getVolumeParDepartement(
    @Query('entrepotId') entrepotId?: string,
    @Query('mois') mois?: string,
    @Request() req?: any,
  ) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getVolumeParDepartement(entrepotId, mois, ue);
  }

  @Get('demandeurs')
  getVolumeParDemandeur(@Query('mois') mois?: string, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getVolumeParDemandeur(mois, ue);
  }

  @Get('delais')
  getDelaisMoyens(@Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getDelaisMoyens(ue);
  }

  @Get('top-articles')
  getTopArticles(@Query('limit') limit?: string, @Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getTopArticles(limit ? parseInt(limit) : 5, ue);
  }

  @Get('commandes')
  getResumeCommandes(@Request() req?: any) {
    const ue: string[] = req?.user?.privileges?.entrepots ?? [];
    return this.service.getResumeCommandes(ue);
  }
}
