import { Controller, Get, Post, Query, Body, Request, UseGuards } from '@nestjs/common';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private service: StockService) {}

  @Get()
  getStockComplet(@Query('entrepotId') entrepotId?: string) {
    return this.service.getStockComplet(entrepotId);
  }

  @Get('alertes')
  getAlertes() {
    return this.service.getArticlesEnAlerte();
  }

  @Get('ecarts')
  getEcarts() {
    return this.service.getInventaireEcarts();
  }

  @Post('inventaire')
  saisirInventaire(@Body() body: any, @Request() req) {
    return this.service.saisirInventairePhysique({ ...body, userId: req.user?.id });
  }
}
