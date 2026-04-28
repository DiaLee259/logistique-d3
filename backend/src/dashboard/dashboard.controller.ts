import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
  ) {
    return this.service.getKpis(entrepotId, dateDebut, dateFin, mois, articleId);
  }

  @Get('evolution')
  getEvolution(
    @Query('entrepotId') entrepotId?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('mois') mois?: string,
    @Query('articleId') articleId?: string,
  ) {
    return this.service.getEvolutionStock(entrepotId, dateDebut, dateFin, mois, articleId);
  }

  @Get('departements')
  getVolumeParDepartement(
    @Query('entrepotId') entrepotId?: string,
    @Query('mois') mois?: string,
  ) {
    return this.service.getVolumeParDepartement(entrepotId, mois);
  }

  @Get('demandeurs')
  getVolumeParDemandeur(@Query('mois') mois?: string) {
    return this.service.getVolumeParDemandeur(mois);
  }

  @Get('delais')
  getDelaisMoyens() {
    return this.service.getDelaisMoyens();
  }

  @Get('top-articles')
  getTopArticles(@Query('limit') limit?: string) {
    return this.service.getTopArticles(limit ? parseInt(limit) : 5);
  }

  @Get('commandes')
  getResumeCommandes() {
    return this.service.getResumeCommandes();
  }
}
